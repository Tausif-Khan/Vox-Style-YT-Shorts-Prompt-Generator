import { query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

type StageTable = "research" | "story" | "script" | "visual_bible" | "editing_plan";

const stageArg = v.object({
  projectId: v.id("projects"),
  table: v.union(
    v.literal("research"),
    v.literal("story"),
    v.literal("script"),
    v.literal("visual_bible"),
    v.literal("editing_plan")
  ),
});

export const getStage = internalQuery({
  args: stageArg.fields,
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query(args.table as StageTable)
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return rows[0] ?? null;
  },
});

export const getStagePublic = query({
  args: stageArg.fields,
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query(args.table as StageTable)
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return rows[0] ?? null;
  },
});

export const saveStage = internalMutation({
  args: {
    projectId: v.id("projects"),
    table: v.union(
      v.literal("research"),
      v.literal("story"),
      v.literal("script"),
      v.literal("visual_bible"),
      v.literal("editing_plan")
    ),
    data: v.any(),
    promptVersion: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query(args.table as StageTable)
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    if (existing[0]) {
      await ctx.db.patch(existing[0]._id, {
        data: args.data,
        prompt_version: args.promptVersion,
      });
    } else {
      await ctx.db.insert(args.table, {
        projectId: args.projectId,
        data: args.data,
        prompt_version: args.promptVersion,
      });
    }
  },
});

export const getScenes = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("scenes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect(),
});

export const getScenesPublic = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("scenes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect(),
});

export const saveScene = internalMutation({
  args: {
    projectId: v.id("projects"),
    scene_number: v.number(),
    data: v.any(),
    promptVersion: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("scenes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("scene_number"), args.scene_number))
      .collect();
    if (existing[0]) {
      await ctx.db.patch(existing[0]._id, {
        data: args.data,
        prompt_version: args.promptVersion,
      });
    } else {
      await ctx.db.insert("scenes", {
        projectId: args.projectId,
        scene_number: args.scene_number,
        data: args.data,
        prompt_version: args.promptVersion,
      });
    }
  },
});
