import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { getProvider, geminiSchemas } from "./ai";
import {
  storyPrompt,
  scriptPrompt,
  scenePlannerPrompt,
  regenerateScenePrompt,
  PROMPT_VERSIONS,
  STORY_TYPE_GUIDANCE,
} from "./ai/prompts";
import { storySchema, scriptSchema, sceneSchema } from "../lib/schemas";
import { resolveSceneCount } from "./projects";
import { internal } from "./_generated/api";

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
  schemaKey: "story" | "script" | "scenes" | "scene",
  temperature = 0.6,
  maxTokens = 16384
): Promise<unknown> {
  const provider = getProvider();
  return await provider.generate({
    system,
    user,
    schemaJson: JSON.stringify(geminiSchemas[schemaKey]),
    temperature,
    maxTokens,
  });
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

const STAGE_LITERALS = {
  stage: v.union(v.literal("story"), v.literal("script"), v.literal("scenes")),
} as const;

export const runStage = internalAction({
  args: {
    projectId: v.id("projects"),
    ...STAGE_LITERALS,
  },
  handler: async (ctx, args) => {
    const project = await ctx.runQuery(internal.projects.getProjectInternal, {
      id: args.projectId,
    });
    if (!project) throw new Error("Project not found");

    await ctx.runMutation(internal.projects.setStageStatus, {
      id: args.projectId,
      stage: args.stage,
      status: "GENERATING",
    });

    try {
      // ---------- STORY (research + story architecture in one call) ----------
      if (args.stage === "story") {
        const storyType = resolveStoryType(project.topic, project.story_type);
        const raw = await callAI(
          "You are the research desk and story architect of a premium editorial documentary studio. Return JSON only.",
          storyPrompt({
            topic: project.topic,
            storyType,
            guidance: STORY_TYPE_GUIDANCE[storyType] ?? STORY_TYPE_GUIDANCE.custom,
            custom: project.custom_story_direction,
          }),
          "story",
          0.5
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
        const sceneCount = resolveSceneCount(project.duration, project.scene_count);
        const raw = await callAI(
          "You are the scriptwriter of a premium editorial documentary studio. Return JSON only.",
          scriptPrompt({
            story: JSON.stringify(storyRow.data),
            duration: project.duration,
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

      // ---------- SCENES (Flow-ready prompts, budget-aware) ----------
      if (args.stage === "scenes") {
        const storyRow = await ctx.runQuery(internal.stages.getStage, {
          projectId: args.projectId,
          table: "story",
        });
        const scriptRow = await ctx.runQuery(internal.stages.getStage, {
          projectId: args.projectId,
          table: "script",
        });
        if (!scriptRow) throw new Error("Run Script first.");

        const scriptData = scriptRow.data as {
          sections: { scene_number: number; start_time: number; end_time: number; narration: string }[];
        };

        const raw = await callAI(
          "You are the scene planner of a premium editorial documentary studio. Return JSON only.",
          scenePlannerPrompt({
            story: storyRow ? JSON.stringify(storyRow.data) : "",
            scriptSections: JSON.stringify(scriptData.sections),
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

    const neighbors = (scenes as any[])
      .filter((s) => Math.abs(s.scene_number - args.sceneNumber) === 1)
      .sort((a, b) => a.scene_number - b.scene_number)
      .map((s) => `Scene ${s.scene_number}: ${s.data.visual_type} — ${s.data.visual_goal}`)
      .join("\n");

    const raw = await callAI(
      "You are regenerating one scene of a premium editorial documentary. Return JSON only.",
      regenerateScenePrompt({
        scene: JSON.stringify(target.data),
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
