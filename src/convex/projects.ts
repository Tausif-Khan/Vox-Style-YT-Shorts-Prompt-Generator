import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

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

/** Resolve "auto" scene count from duration — kept LOW for free Flow accounts. */
export function resolveSceneCount(duration: number, sceneCount: number): number {
  if (sceneCount > 0) return sceneCount;
  if (duration <= 30) return 6;
  if (duration <= 60) return 8;
  return 10;
}

export const create = mutation({
  args: {
    userId: v.string(),
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
    return await ctx.db.insert("projects", {
      ...args,
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
    });
  },
});
