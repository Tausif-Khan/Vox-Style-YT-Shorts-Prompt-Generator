import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { getProvider, geminiSchemas } from "./ai";
import {
  researchPrompt,
  storyPrompt,
  scriptPrompt,
  visualBiblePrompt,
  scenePlannerPrompt,
  editingPlanPrompt,
  regenerateScenePrompt,
  PROMPT_VERSIONS,
  STORY_TYPE_GUIDANCE,
} from "./ai/prompts";
import {
  researchSchema,
  storySchema,
  scriptSchema,
  visualBibleSchema,
  editingPlanSchema,
  sceneSchema,
} from "../lib/schemas";
import { internal } from "./_generated/api";

/** Resolve "auto" scene count from duration. */
function resolveSceneCount(duration: number, sceneCount: string | number): number {
  if (typeof sceneCount === "number") return sceneCount;
  if (duration <= 30) return 6;
  if (duration <= 60) return 10;
  return 14;
}

/** Resolve "auto" story type from topic keywords. */
function resolveStoryType(topic: string, requested: string): string {
  if (requested !== "auto") return requested;
  const t = topic.toLowerCase();
  if (/^how .* changed/.test(t)) return "how_it_changed_the_world";
  if (/^how (is|does|do|it) /.test(t) || /^how .* works/.test(t)) return "how_it_works";
  if (/^(why|the reason) /.test(t)) return "why_does_this_exist";
  if (/rise|fall|decline|collapse|downfall/.test(t)) return "rise_and_fall";
  if (/mystery|secret|unsolved|origin of/.test(t)) return "mystery_origin";
  return "historical_documentary";
}

async function callAI(
  system: string,
  user: string,
  schemaKey: keyof typeof geminiSchemas,
  temperature = 0.6
): Promise<unknown> {
  const provider = getProvider();
  const raw = await provider.generate({
    system,
    user,
    schemaJson: JSON.stringify(geminiSchemas[schemaKey]),
    temperature,
    maxTokens: 8192,
  });
  return raw;
}

/** Validate + normalize a scene object. */
function normalizeScene(raw: any, fallbackNarration = "") {
  const parsed = sceneSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`Scene validation failed: ${parsed.error.message}`);
  const s = parsed.data;
  return {
    ...s,
    narration: s.narration || fallbackNarration,
    graphic_type: s.graphic_type ?? "",
    graphic_prompt: s.graphic_prompt ?? "",
    graphic_animation: s.graphic_animation ?? "",
    graphic_labels: s.graphic_labels ?? [],
    narration_emphasis: s.narration_emphasis ?? "",
    ambient: s.ambient ?? "",
    status: "draft" as const,
    asset_status: "PROMPT_READY" as const,
  };
}

export const runStage = internalAction({
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
    const project = await ctx.runQuery(internal.projects.getProjectInternal, {
      id: args.projectId,
    });
    if (!project) throw new Error("Project not found");

    try {
      const duration = project.duration;
      const sceneCount = resolveSceneCount(duration, project.scene_count);
      const storyType = resolveStoryType(project.topic, project.story_type);

      // ---------- RESEARCH ----------
      if (args.stage === "research") {
        const raw = await callAI(
          "You are the research desk of a premium editorial documentary studio. Return JSON only.",
          researchPrompt(project.topic),
          "research",
          0.3
        );
        const data = researchSchema.parse(raw);
        await ctx.runMutation(internal.stages.saveStage, {
          projectId: args.projectId,
          table: "research",
          data,
          promptVersion: PROMPT_VERSIONS.research,
        });
      }

      // ---------- STORY ----------
      if (args.stage === "story") {
        const researchRow = await ctx.runQuery(internal.stages.getStage, {
          projectId: args.projectId,
          table: "research",
        });
        if (!researchRow) throw new Error("Run Research first.");
        const raw = await callAI(
          "You are the story architect of a premium editorial documentary studio. Return JSON only.",
          storyPrompt({
            research: JSON.stringify(researchRow.data),
            storyType,
            guidance: STORY_TYPE_GUIDANCE[storyType] ?? STORY_TYPE_GUIDANCE.custom,
            custom: project.custom_story_direction,
          }),
          "story"
        );
        const data = storySchema.parse(raw);
        await ctx.runMutation(internal.stages.saveStage, {
          projectId: args.projectId,
          table: "story",
          data,
          promptVersion: PROMPT_VERSIONS.story,
        });
      }

      // ---------- SCRIPT ----------
      if (args.stage === "script") {
        const storyRow = await ctx.runQuery(internal.stages.getStage, {
          projectId: args.projectId,
          table: "story",
        });
        if (!storyRow) throw new Error("Run Story first.");
        const researchRow = await ctx.runQuery(internal.stages.getStage, {
          projectId: args.projectId,
          table: "research",
        });
        const raw = await callAI(
          "You are the scriptwriter of a premium editorial documentary studio. Return JSON only.",
          scriptPrompt({
            story: JSON.stringify(storyRow.data),
            research: researchRow ? JSON.stringify(researchRow.data) : "",
            duration,
            sceneCount,
          }),
          "script"
        );
        const data = scriptSchema.parse(raw);
        await ctx.runMutation(internal.stages.saveStage, {
          projectId: args.projectId,
          table: "script",
          data,
          promptVersion: PROMPT_VERSIONS.script,
        });
      }

      // ---------- VISUAL BIBLE ----------
      if (args.stage === "visuals") {
        const researchRow = await ctx.runQuery(internal.stages.getStage, {
          projectId: args.projectId,
          table: "research",
        });
        const raw = await callAI(
          "You are the visual director of a premium editorial documentary studio. Return JSON only.",
          visualBiblePrompt({
            topic: project.topic,
            research: researchRow ? JSON.stringify(researchRow.data) : "",
          }),
          "visualBible"
        );
        const data = visualBibleSchema.parse(raw);
        await ctx.runMutation(internal.stages.saveStage, {
          projectId: args.projectId,
          table: "visual_bible",
          data,
          promptVersion: PROMPT_VERSIONS.visual_bible,
        });
      }

      // ---------- SCENES ----------
      if (args.stage === "scenes") {
        const storyRow = await ctx.runQuery(internal.stages.getStage, {
          projectId: args.projectId,
          table: "story",
        });
        const scriptRow = await ctx.runQuery(internal.stages.getStage, {
          projectId: args.projectId,
          table: "script",
        });
        const bibleRow = await ctx.runQuery(internal.stages.getStage, {
          projectId: args.projectId,
          table: "visual_bible",
        });
        if (!scriptRow) throw new Error("Run Script first.");

        const scriptData = scriptRow.data as {
          sections: { scene_number: number; start_time: number; end_time: number; narration: string }[];
        };
        const bibleText = bibleRow
          ? JSON.stringify(bibleRow.data)
          : "Use the default premium editorial documentary style.";

        const raw = await callAI(
          "You are the scene planner of a premium editorial documentary studio. Return JSON only.",
          scenePlannerPrompt({
            story: storyRow ? JSON.stringify(storyRow.data) : "",
            scriptSections: JSON.stringify(scriptData.sections),
            visualBible: bibleText,
            aspectRatio: project.aspect_ratio,
          }),
          "scenes",
          0.7
        );

        const parsed = (raw as { scenes: any[] }).scenes ?? [];
        if (parsed.length === 0) throw new Error("Scene planner returned no scenes.");

        for (const section of scriptData.sections) {
          const match = parsed.find((s: any) => s.scene_number === section.scene_number);
          if (!match) throw new Error(`Scene planner missing scene ${section.scene_number}.`);
          const scene = normalizeScene(match, section.narration);
          await ctx.runMutation(internal.stages.saveScene, {
            projectId: args.projectId,
            scene_number: scene.scene_number,
            data: scene,
            promptVersion: PROMPT_VERSIONS.scene_planner,
          });
        }
      }

      // ---------- EDITING ----------
      if (args.stage === "editing") {
        const scenes = await ctx.runQuery(internal.stages.getScenes, {
          projectId: args.projectId,
        });
        if (scenes.length === 0) throw new Error("Run Scenes first.");
        const sorted = [...scenes].sort((a: any, b: any) => a.scene_number - b.scene_number);
        const raw = await callAI(
          "You are the finishing editor of a premium editorial documentary studio. Return JSON only.",
          editingPlanPrompt({
            scenes: JSON.stringify(sorted.map((s: any) => s.data)),
            duration,
          }),
          "editingPlan",
          0.3
        );
        const data = editingPlanSchema.parse(raw);
        await ctx.runMutation(internal.stages.saveStage, {
          projectId: args.projectId,
          table: "editing_plan",
          data,
          promptVersion: PROMPT_VERSIONS.editing,
        });
      }

      await ctx.runMutation(internal.projects.setStageStatus, {
        id: args.projectId,
        stage: args.stage,
        status: "COMPLETED",
      });
    } catch (err: any) {
      await ctx.runMutation(internal.projects.setStageStatus, {
        id: args.projectId,
        stage: args.stage,
        status: "FAILED",
        error: String(err?.message ?? err).slice(0, 500),
      });
      throw err;
    }
  },
});

export const regenerateScene = internalAction({
  args: {
    projectId: v.id("projects"),
    sceneNumber: v.number(),
    instruction: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scenes = await ctx.runQuery(internal.stages.getScenes, {
      projectId: args.projectId,
    });
    const target = scenes.find((s: any) => s.scene_number === args.sceneNumber);
    if (!target) throw new Error("Scene not found.");

    const bibleRow = await ctx.runQuery(internal.stages.getStage, {
      projectId: args.projectId,
      table: "visual_bible",
    });
    const bibleText = bibleRow ? JSON.stringify(bibleRow.data) : "Default premium editorial documentary style.";

    const neighbors = (scenes as any[])
      .filter((s) => Math.abs(s.scene_number - args.sceneNumber) === 1)
      .sort((a, b) => a.scene_number - b.scene_number)
      .map((s) => `Scene ${s.scene_number}: ${s.data.visual_type} — ${s.data.visual_goal}`)
      .join("\n");

    const raw = await callAI(
      "You are regenerating one scene of a premium editorial documentary. Return JSON only.",
      regenerateScenePrompt({
        scene: JSON.stringify(target.data),
        visualBible: bibleText,
        instruction: args.instruction,
        neighbors: neighbors || "None.",
      }),
      "scene",
      0.7
    );

    const scene = normalizeScene(raw, target.data.narration);
    scene.scene_number = target.scene_number;
    scene.start_time = target.data.start_time;
    scene.end_time = target.data.end_time;
    scene.duration = target.data.duration;
    scene.narration = target.data.narration;

    await ctx.runMutation(internal.stages.saveScene, {
      projectId: args.projectId,
      scene_number: args.sceneNumber,
      data: scene,
      promptVersion: PROMPT_VERSIONS.scene_planner,
    });
    return scene;
  },
});
