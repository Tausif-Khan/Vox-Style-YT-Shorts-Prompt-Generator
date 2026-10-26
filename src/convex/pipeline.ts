import { action, type ActionCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { verifyVisitorToken, keyedHash } from "../lib/visitorToken";
import { topicFingerprint, formatRemaining, type LimitCode } from "../lib/limits";
import type { Charge } from "./generation";
import type { Id } from "./_generated/dataModel";

/**
 * Public generation entry points (the ONLY ways to reach OpenRouter).
 *
 * Request path:  Browser → these Convex actions → OpenRouter → Browser
 * The browser never sees the API key, never talks to OpenRouter directly,
 * and cannot bypass any server-side control by changing client code.
 *
 * Every entry point:
 *  1. verifies the signed visitor token (identity)
 *  2. derives a keyed IP hash from platform request metadata (never a
 *     client-supplied header)
 *  3. validates input and ownership
 *  4. pre-checks global + per-IP quota (no upstream contact when rejected)
 *  5. deduplicates concurrent submissions (idempotency key)
 *  6. reserves the 90s regeneration cooldown / 24h topic lock when the
 *     operation is a regeneration
 *  7. performs quota-consuming upstream attempts inside generation.callAI
 */

type RegenReservation = {
  ok: boolean;
  key?: string;
  seq?: number;
  code?: string;
  retryAt?: number;
  message?: string;
  cooldownUntil?: number;
  lockUntil?: number;
  accepted?: number;
  allowanceLeft?: number;
};

function fail(code: LimitCode | string, message: string, retryAt?: number): never {
  throw new ConvexError({ code, message, retryAt: retryAt ?? 0 });
}

function regenDenialMessage(r: RegenReservation, now: number): string {
  const until = r.retryAt ?? now;
  if (r.code === "REGEN_LOCK") {
    return `You've reached the regeneration limit for this topic. You can regenerate again in ${formatRemaining(until - now)}.`;
  }
  return `Regeneration available in ${formatRemaining(until - now)}.`;
}

/** Verify the visitor token and derive the per-IP key (platform metadata). */
async function identify(ctx: ActionCtx, token: string | undefined): Promise<{ visitorId: string; ipKey?: string }> {
  const visitorId = await verifyVisitorToken(token);
  if (!visitorId) {
    // Security signal: a missing/forged token never reaches OpenRouter.
    await ctx.runMutation(internal.quota.recordEvent, {
      kind: "invalid_session",
      detail: "visitor token rejected",
    });
    fail("INVALID_SESSION", "Your session could not be verified. Please reload the page and try again.");
  }
  let ipKey: string | undefined;
  try {
    const meta = await ctx.meta.getRequestMetadata();
    if (meta.ip) ipKey = await keyedHash(meta.ip); // keyed hash — raw IP never stored
  } catch {
    // Request metadata unavailable in this runtime: IP limits are skipped
    // (global limits still apply). Recorded honestly in the audit report.
  }
  return { visitorId, ipKey };
}

/** Load a project and confirm the calling visitor may act on it. */
async function loadProject(ctx: ActionCtx, projectId: Id<"projects">, visitorId: string) {
  const project = await ctx.runQuery(internal.projects.getProjectInternal, { id: projectId });
  if (!project) fail("NOT_FOUND", "This project no longer exists.");
  if (project.visitor && project.visitor !== visitorId) {
    fail("FORBIDDEN", "You don't have access to this project.");
  }
  return project;
}

/** Non-consuming quota check — rejected requests never reach OpenRouter. */
async function precheckQuota(ctx: ActionCtx, ipKey?: string): Promise<void> {
  const decision = await ctx.runQuery(internal.quota.precheck, { ipKey });
  if (!decision.ok) {
    fail(
      decision.code ?? "QUOTA_MINUTE",
      decision.message ?? "Generation is temporarily unavailable. Please try again shortly.",
      decision.retryAt
    );
  }
}

async function claimRequest(
  ctx: ActionCtx,
  scope: string,
  visitorId: string,
  requestId: string | undefined
): Promise<boolean> {
  if (!requestId) return true;
  const result = await ctx.runMutation(internal.idempotency.claim, { scope, visitorId, requestId });
  if (result === "duplicate") {
    fail("DUPLICATE", "This request is already being processed.");
  }
  return true;
}

async function settleRequest(
  ctx: ActionCtx,
  scope: string,
  visitorId: string,
  requestId: string | undefined,
  status: "done" | "failed"
): Promise<void> {
  if (!requestId) return;
  await ctx.runMutation(internal.idempotency.settle, { scope, visitorId, requestId, status });
}

/**
 * Client entry point for full generation. Runs all 3 stages in order.
 * Completed stages are skipped; failed stages can be retried individually
 * from the workspace. Initial generation is NOT a regeneration and never
 * consumes a regeneration allowance.
 */
export const startPipeline = action({
  args: {
    projectId: v.id("projects"),
    visitorToken: v.string(),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { visitorId, ipKey } = await identify(ctx, args.visitorToken);
    await loadProject(ctx, args.projectId, visitorId);
    await precheckQuota(ctx, ipKey);
    await claimRequest(ctx, "pipeline", visitorId, args.requestId);

    const stages = ["story", "script", "scenes"] as const;
    const charge: Charge = { purpose: "initial", ipKey };
    let lastError: unknown = null;
    try {
      // Clear any stale banner; a fresh run starts clean.
      await ctx.runMutation(internal.projects.setLastError, { id: args.projectId, error: undefined });
      // Stamp the run start once, so the UI can show elapsed / total time.
      await ctx.runMutation(internal.projects.setPipelineStarted, { id: args.projectId });
      for (const stage of stages) {
        const current = await ctx.runQuery(internal.projects.getProjectInternal, {
          id: args.projectId,
        });
        if (!current) throw new Error("Project not found");
        if (current.stage_status[stage] === "COMPLETED") continue;
        if (current.stage_status[stage] === "GENERATING") continue; // duplicate guard
        try {
          await ctx.runAction(internal.generation.runStage, {
            projectId: args.projectId,
            stage,
            charge,
          });
        } catch (err) {
          lastError = err;
          break;
        }
      }
      if (lastError) throw lastError;
      await settleRequest(ctx, "pipeline", visitorId, args.requestId, "done");
      return { ok: true };
    } catch (err) {
      // Surface WHY generation didn't (fully) start inside the workspace, so
      // quota/session denials are visible even if the user already navigated.
      const data = err instanceof ConvexError ? (err.data as { message?: string } | undefined) : undefined;
      const message =
        typeof data?.message === "string" && data.message.trim()
          ? data.message
          : "Generation could not start. Please try again shortly.";
      await ctx.runMutation(internal.projects.setLastError, {
        id: args.projectId,
        error: message.slice(0, 300),
      });
      await settleRequest(ctx, "pipeline", visitorId, args.requestId, "failed");
      throw err;
    }
  },
});

/**
 * Run a single stage. When the stage already COMPLETED this is a
 * REGENERATION: it must pass the cooldown/lock policy first.
 */
export const runStage = action({
  args: {
    projectId: v.id("projects"),
    stage: v.union(v.literal("story"), v.literal("script"), v.literal("scenes")),
    visitorToken: v.string(),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { visitorId, ipKey } = await identify(ctx, args.visitorToken);
    const project = await loadProject(ctx, args.projectId, visitorId);
    if (project.stage_status[args.stage] === "GENERATING") {
      fail("DUPLICATE", "This step is already generating.");
    }
    await precheckQuota(ctx, ipKey);
    await claimRequest(ctx, "stage", visitorId, args.requestId);

    const isRegeneration = project.stage_status[args.stage] === "COMPLETED";
    let regenKey: string | undefined;
    let regenSeq: number | undefined;
    const charge: Charge = { purpose: isRegeneration ? "regen" : "initial", ipKey };

    if (isRegeneration) {
      const topicKey = await topicFingerprint(project.topic);
      const reservation = (await ctx.runMutation(internal.regen.reserve, {
        visitorId,
        topicKey,
      })) as RegenReservation;
      if (!reservation.ok) {
        await settleRequest(ctx, "stage", visitorId, args.requestId, "failed");
        fail(
          reservation.code ?? "REGEN_COOLDOWN",
          regenDenialMessage(reservation, Date.now()),
          reservation.retryAt
        );
      }
      regenKey = reservation.key;
      regenSeq = reservation.seq;
      charge.regenKey = regenKey;
      charge.regenSeq = regenSeq;
    }

    try {
      await ctx.runAction(internal.generation.runStage, {
        projectId: args.projectId,
        stage: args.stage,
        charge,
      });
      await settleRequest(ctx, "stage", visitorId, args.requestId, "done");
    } catch (err) {
      // Refund if the failure happened BEFORE any upstream request (refund
      // is a no-op once an attempt was actually made).
      if (regenKey && regenSeq !== undefined) {
        await ctx.runMutation(internal.regen.refund, { key: regenKey, seq: regenSeq });
      }
      await settleRequest(ctx, "stage", visitorId, args.requestId, "failed");
      throw err;
    }
  },
});

/** Regenerate a single scene (always counts as a regeneration). */
export const regenerateScene = action({
  args: {
    projectId: v.id("projects"),
    sceneNumber: v.number(),
    instruction: v.optional(v.string()),
    visitorToken: v.string(),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<unknown> => {
    const { visitorId, ipKey } = await identify(ctx, args.visitorToken);
    const project = await loadProject(ctx, args.projectId, visitorId);

    // Input validation (server-side, authoritative).
    if (!Number.isInteger(args.sceneNumber) || args.sceneNumber < 1 || args.sceneNumber > 200) {
      fail("INVALID_INPUT", "That scene number is not valid.");
    }
    const instruction = args.instruction?.trim() ?? "";
    if (instruction.length > 500) {
      fail("INVALID_INPUT", "The instruction is too long (max 500 characters).");
    }

    await precheckQuota(ctx, ipKey);
    await claimRequest(ctx, "scene", visitorId, args.requestId);

    const topicKey = await topicFingerprint(project.topic);
    const reservation = (await ctx.runMutation(internal.regen.reserve, {
      visitorId,
      topicKey,
    })) as RegenReservation;
    if (!reservation.ok) {
      await settleRequest(ctx, "scene", visitorId, args.requestId, "failed");
      fail(
        reservation.code ?? "REGEN_COOLDOWN",
        regenDenialMessage(reservation, Date.now()),
        reservation.retryAt
      );
    }

    try {
      const scene = await ctx.runAction(internal.generation.regenerateScene, {
        projectId: args.projectId,
        sceneNumber: args.sceneNumber,
        instruction: instruction || undefined,
        charge: {
          purpose: "regen",
          ipKey,
          regenKey: reservation.key,
          regenSeq: reservation.seq,
        } as Charge,
      });
      await settleRequest(ctx, "scene", visitorId, args.requestId, "done");
      return scene;
    } catch (err) {
      await ctx.runMutation(internal.regen.refund, {
        key: reservation.key!,
        seq: reservation.seq!,
      });
      await settleRequest(ctx, "scene", visitorId, args.requestId, "failed");
      throw err;
    }
  },
});
