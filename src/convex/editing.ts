import { mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { ownsProject } from "./projects";

/**
 * Update narration for a scene's script section. The scene keeps its own copy
 * of narration; the user can regenerate the scene's visual plan afterwards.
 */
export const updateNarration = mutation({
  args: {
    projectId: v.id("projects"),
    sceneNumber: v.number(),
    narration: v.string(),
    userId: v.string(),
    visitorToken: v.string(),
  },
  handler: async (ctx, args) => {
    // Ownership first: nobody may edit a project they do not own, whatever
    // the client sends.
    const project = await ctx.db.get(args.projectId);
    if (!(await ownsProject(project, args.userId, args.visitorToken))) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You don't have access to this project.",
        retryAt: 0,
      });
    }
    // Server-side validation limits payload size regardless of client code.
    if (!Number.isInteger(args.sceneNumber) || args.sceneNumber < 1 || args.sceneNumber > 200) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "That scene number is not valid.", retryAt: 0 });
    }
    const narration = args.narration.trim();
    if (narration.length > 5000) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: "Narration is too long (max 5000 characters).",
        retryAt: 0,
      });
    }
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
