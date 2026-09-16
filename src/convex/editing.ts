import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Update narration for a scene's script section. The scene keeps its own copy
 * of narration; the user can regenerate the scene's visual plan afterwards.
 */
export const updateNarration = mutation({
  args: {
    projectId: v.id("projects"),
    sceneNumber: v.number(),
    narration: v.string(),
  },
  handler: async (ctx, args) => {
    const narration = args.narration.trim();
    if (!narration) return; // never blank a scene's narration
    // Update script section narration
    const scriptRow = await ctx.db
      .query("script")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const script = scriptRow[0];
    if (script) {
      const data = script.data as {
        sections: { scene_number: number; narration: string }[];
      };
      const section = data.sections.find((s) => s.scene_number === args.sceneNumber);
      if (section) section.narration = narration;
      await ctx.db.patch(script._id, { data });
    }

    // Update scene narration
    const sceneRows = await ctx.db
      .query("scenes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("scene_number"), args.sceneNumber))
      .collect();
    if (sceneRows[0]) {
      const d = { ...sceneRows[0].data, narration };
      await ctx.db.patch(sceneRows[0]._id, { data: d });
    }
  },
});
