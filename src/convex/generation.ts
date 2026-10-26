import { internalAction, type ActionCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getProvider, geminiSchemas } from "./ai";
import { UpstreamError } from "./ai/provider";
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

/**
 * What kind of work this call is, for quota accounting.
 * - purpose drives the global request counter (initial vs regeneration metrics)
 * - ipKey is the keyed hash of the caller's IP (per-IP limits)
 * - regenKey/regenSeq link the call to an accepted regeneration so it can be
 *   refunded if the failure happens BEFORE any upstream request is sent
 */
export const CHARGE = v.object({
  purpose: v.union(v.literal("initial"), v.literal("regen")),
  ipKey: v.optional(v.string()),
  regenKey: v.optional(v.string()),
  regenSeq: v.optional(v.number()),
});

export type Charge = {
  purpose: "initial" | "regen";
  ipKey?: string;
  regenKey?: string;
  regenSeq?: number;
};

/**
 * The single choke point for OpenRouter traffic. Every upstream attempt:
 *  1. atomically reserves global + per-IP quota (may throw ConvexError)
 *  2. marks the regeneration as attempted (affects refund eligibility)
 *  3. goes out through the provider (which calls back for retries too)
 * and always releases its in-flight reservation afterwards.
 */
async function callAI(
  ctx: ActionCtx,
  charge: Charge,
  system: string,
  user: string,
  schemaKey: "story" | "script" | "scenes" | "scene",
  temperature = 0.6,
  maxTokens = 16384
): Promise<unknown> {
  let reservationId: string | undefined;
  const onBeforeAttempt = async (): Promise<void> => {
    // Free the previous attempt's slot BEFORE reserving the next one, so a
    // bounded retry never counts against its own reservation (and can never
    // self-deadlock the concurrency cap). Between the two, the slot is
    // genuinely free: the earlier request has already completed.
    if (reservationId) {
      await ctx.runMutation(internal.quota.releaseUpstream, { reservationId });
      reservationId = undefined;
    }
    const res = await ctx.runMutation(internal.quota.consumeUpstream, {
      purpose: charge.purpose,
      ipKey: charge.ipKey,
      regenKey: charge.regenKey,
      regenSeq: charge.regenSeq,
    });
    if (!res.ok) {
      // Rejected before contacting OpenRouter: no upstream usage, clear code
      // for the frontend to render a friendly, dated message.
      throw new ConvexError({
        code: res.code ?? "QUOTA_MINUTE",
        retryAt: res.retryAt ?? 0,
        message: res.message ?? "Generation is temporarily unavailable. Please try again shortly.",
      });
    }
    reservationId = res.reservationId;
  };

  try {
    return await getProvider().generate({
      system,
      user,
      schemaJson: JSON.stringify(geminiSchemas[schemaKey]),
      temperature,
      maxTokens,
      onBeforeAttempt,
    });
  } catch (err) {
    if (err instanceof UpstreamError) {
      // Status-only monitoring (no bodies, no keys, no payloads).
      await ctx.runMutation(internal.quota.noteUpstreamError, { status: err.upstreamStatus });
    }
    throw err;
  } finally {
    if (reservationId) {
      await ctx.runMutation(internal.quota.releaseUpstream, { reservationId });
    }
  }
}

/** Validate + normalize a scene object (lean papercut shape). */
function normalizeScene(raw: any, fallbackNarration = "") {
  const parsed = sceneSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`Scene validation failed: ${parsed.error.message}`);
  const s = parsed.data as any;
  return {
    scene_number: s.scene_number,
    start_time: s.start_time,
    end_time: s.end_time,
    duration: s.duration,
    narration: s.narration || fallbackNarration,
    visual_goal: s.visual_goal,
    image_prompt: s.image_prompt,
    video_prompt: s.video_prompt,
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
    charge: v.optional(CHARGE),
  },
  handler: async (ctx, args) => {
    const charge: Charge = args.charge ?? { purpose: "initial" };
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
          ctx,
          charge,
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
          ctx,
          charge,
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
          ctx,
          charge,
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
    charge: v.optional(CHARGE),
  },
  handler: async (ctx, args) => {
    const charge: Charge = args.charge ?? { purpose: "regen" };
    const scenes = await ctx.runQuery(internal.stages.getScenes, {
      projectId: args.projectId,
    });
    const target = scenes.find((s: any) => s.scene_number === args.sceneNumber);
    if (!target) throw new Error("Scene not found.");

    const neighbors = (scenes as any[])
      .filter((s) => Math.abs(s.scene_number - args.sceneNumber) === 1)
      .sort((a, b) => a.scene_number - b.scene_number)
      .map((s) => `Scene ${s.scene_number}: ${s.data.visual_goal}`)
      .join("\n");

    const raw = await callAI(
      ctx,
      charge,
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
