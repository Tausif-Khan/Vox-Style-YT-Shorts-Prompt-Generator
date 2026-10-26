import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { verifyVisitorToken } from "../lib/visitorToken";

const DURATIONS = [60, 90, 120, 180];
const ASPECT_RATIOS = ["9:16", "16:9"];

function requireText(value: string, label: string, min: number, max: number): string {
  const t = value.trim();
  if (t.length < min || t.length > max) {
    throw new ConvexError({
      code: "INVALID_INPUT",
      message: `${label} must be ${min}–${max} characters.`,
      retryAt: 0,
    });
  }
  return t;
}

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect(),
});

export const get = query({
  args: { id: v.id("projects"), userId: v.string() },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== args.userId) return null;
    return project;
  },
});

export const getProjectInternal = internalQuery({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Resolve "auto" scene count from duration. Shorts (60/90s @9:16) stay lean for
 * free Flow accounts; long-form (120/180s @16:9) gets many more prompts.
 */
export function resolveSceneCount(duration: number, sceneCount: number): number {
  if (sceneCount > 0) return sceneCount;
  if (duration <= 60) return 6;
  if (duration <= 90) return 8;
  if (duration <= 120) return 10;
  return 12;
}

export const create = mutation({
  args: {
    userId: v.string(),
    visitorToken: v.string(),
    title: v.string(),
    topic: v.string(),
    duration: v.number(),
    aspect_ratio: v.string(),
    language: v.string(),
    scene_count: v.number(), // resolved "auto" client-side; >0
    story_type: v.string(),
    custom_story_direction: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Server-side validation — the client's checks are convenience only.
    const visitorId = await verifyVisitorToken(args.visitorToken);
    if (!visitorId) {
      throw new ConvexError({
        code: "INVALID_SESSION",
        message: "Your session could not be verified. Please reload the page and try again.",
        retryAt: 0,
      });
    }
    const title = requireText(args.title, "Title", 3, 120);
    const topic = requireText(args.topic, "Topic", 3, 300);
    if (!DURATIONS.includes(args.duration)) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Unsupported duration.", retryAt: 0 });
    }
    if (!ASPECT_RATIOS.includes(args.aspect_ratio)) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Unsupported aspect ratio.", retryAt: 0 });
    }
    if (args.language.trim().length < 1 || args.language.trim().length > 40) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Unsupported language.", retryAt: 0 });
    }
    if (!Number.isInteger(args.scene_count) || args.scene_count < 0 || args.scene_count > 30) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Unsupported scene count.", retryAt: 0 });
    }
    if (!/^[a-z_]{0,40}$/.test(args.story_type)) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Unsupported story type.", retryAt: 0 });
    }
    const custom = args.custom_story_direction?.slice(0, 1000);

    return await ctx.db.insert("projects", {
      userId: args.userId,
      visitor: visitorId,
      title,
      topic,
      duration: args.duration,
      aspect_ratio: args.aspect_ratio,
      language: args.language.trim().slice(0, 40),
      scene_count: args.scene_count,
      story_type: args.story_type,
      custom_story_direction: custom,
      visual_style: "premium_editorial_explainer",
      status: "draft",
      stage_status: {
        story: "QUEUED",
        script: "QUEUED",
        scenes: "QUEUED",
      },
    });
  },
});

export const remove = mutation({
  args: { id: v.id("projects"), userId: v.string() },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== args.userId) return;
    const tables = ["story", "script", "scenes"] as const;
    for (const table of tables) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_project", (q) => q.eq("projectId", args.id))
        .collect();
      for (const row of rows) await ctx.db.delete(row._id);
    }
    await ctx.db.delete(args.id);
  },
});

/** Clear or set the project-level error banner (pipeline start failures). */
export const setLastError = internalMutation({
  args: { id: v.id("projects"), error: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project) return;
    await ctx.db.patch(args.id, { last_error: args.error });
  },
});

export const setPipelineStarted = internalMutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      pipeline_started_at: Date.now(),
      pipeline_completed_at: undefined,
    });
  },
});

export const setStageStatus = internalMutation({
  args: {
    id: v.id("projects"),
    stage: v.string(),
    status: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project) return;
    const stage_status = { ...project.stage_status, [args.stage]: args.status };
    const anyGenerating = Object.values(stage_status).some((s) => s === "GENERATING");
    const anyFailed = Object.values(stage_status).some((s) => s === "FAILED");
    const allDone = Object.values(stage_status).every((s) => s === "COMPLETED");
    const status = anyGenerating
      ? "generating"
      : allDone
        ? "ready"
        : anyFailed
          ? "failed"
          : project.status === "generating"
            ? "draft"
            : project.status;
    await ctx.db.patch(args.id, {
      stage_status,
      status,
      last_error: args.error ?? (args.status === "COMPLETED" ? undefined : project.last_error),
      // When the last stage completes, stamp the end-to-end pipeline time.
      ...(allDone && !project.pipeline_completed_at
        ? { pipeline_completed_at: Date.now() }
        : {}),
    });
  },
});
