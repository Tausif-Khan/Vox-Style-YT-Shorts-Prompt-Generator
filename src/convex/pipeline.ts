import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Client entry point for full generation. Runs all stages in order.
 * Completed stages are skipped; failed stages can be retried individually
 * from the workspace.
 */
export const startPipeline = action({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const stages = ["research", "story", "script", "visuals", "scenes", "editing"] as const;
    let lastError: unknown = null;
    for (const stage of stages) {
      const project = await ctx.runQuery(internal.projects.getProjectInternal, {
        id: args.projectId,
      });
      if (!project) throw new Error("Project not found");
      if (project.stage_status[stage] === "COMPLETED") continue;
      try {
        await ctx.runAction(internal.generation.runStage, {
          projectId: args.projectId,
          stage,
        });
      } catch (err) {
        // Keep going to later stages only if prerequisites exist; otherwise abort.
        lastError = err;
        break;
      }
    }
    if (lastError) throw lastError;
  },
});

export const runStage = action({
  args: {
    projectId: v.id("projects"),
    stage: v.union(
      v.literal("research"),
      v.literal("story"),
      v.literal("script"),
      v.literal("scenes"),
      v.literal("visuals"),
      v.literal("editing")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.runAction(internal.generation.runStage, args);
  },
});

export const regenerateScene = action({
  args: {
    projectId: v.id("projects"),
    sceneNumber: v.number(),
    instruction: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<unknown> => {
    return await ctx.runAction(internal.generation.regenerateScene, args);
  },
});
