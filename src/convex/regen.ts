import { internalMutation, internalQuery, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { advanceRegen, limitsFromEnv, topicFingerprint, type RegenState } from "../lib/limits";
import { verifyVisitorToken } from "../lib/visitorToken";
import { readSnapshot } from "./quota";

/**
 * Per visitor + topic regeneration policy:
 *  - 90s cooldown after every accepted regeneration (all stages share it)
 *  - the 3rd accepted regeneration locks THAT topic for 24h
 *  - initial generation never consumes a regeneration allowance
 *
 * Authoritative state lives here (server-side), keyed by the verified visitor
 * id and a SHA-256 topic fingerprint. Client counters are never trusted.
 */

async function loadState(ctx: QueryCtx | MutationCtx, key: string): Promise<(RegenState & { attempt_seq: number }) | null> {
  const rows = await ctx.db
    .query("regen_state")
    .withIndex("by_key", (q) => q.eq("key", key))
    .collect();
  const doc = rows[0];
  if (!doc) return null;
  return {
    accepted: doc.accepted,
    cooldownUntil: doc.cooldown_until,
    lockUntil: doc.lock_until,
    lastAcceptedAt: doc.last_accepted_at,
    attempt_seq: doc.attempt_seq,
  };
}

export interface RegenReservation {
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
}

/**
 * Atomically accept a regeneration (or reject it with the active restriction).
 * Convex mutations serialize, so two simultaneous requests cannot both pass.
 */
export const reserve = internalMutation({
  args: { visitorId: v.string(), topicKey: v.string() },
  handler: async (ctx, args): Promise<RegenReservation> => {
    const now = Date.now();
    const cfg = limitsFromEnv(process.env);
    const key = `${args.visitorId}:${args.topicKey}`;
    const state = (await loadState(ctx, key)) ?? {
      accepted: 0,
      cooldownUntil: 0,
      lockUntil: 0,
      lastAcceptedAt: 0,
      attempt_seq: 0,
    };

    const decision = advanceRegen({ ...state }, key, now, cfg);
    if (!decision.ok) {
      return {
        ok: false,
        key,
        code: decision.code,
        retryAt: decision.retryAt,
        message: decision.message,
        cooldownUntil: state.cooldownUntil,
        lockUntil: state.lockUntil,
        accepted: state.accepted,
        allowanceLeft: Math.max(0, cfg.lockCount - state.accepted),
      };
    }

    const patch = {
      key,
      visitor: args.visitorId,
      topic_hash: args.topicKey,
      accepted: decision.accepted,
      cooldown_until: decision.cooldownUntil,
      lock_until: decision.lockUntil,
      last_accepted_at: now,
      updated_at: now,
    };
    const existingRows = await ctx.db
      .query("regen_state")
      .withIndex("by_key", (q) => q.eq("key", key))
      .collect();
    if (existingRows[0]) {
      await ctx.db.patch(existingRows[0]._id, { ...patch, attempt_seq: existingRows[0].attempt_seq });
    } else {
      await ctx.db.insert("regen_state", { ...patch, attempt_seq: 0 });
    }

    return {
      ok: true,
      key,
      seq: decision.seq,
      cooldownUntil: decision.cooldownUntil,
      lockUntil: decision.lockUntil,
      accepted: decision.accepted,
      allowanceLeft: decision.allowanceLeft,
      retryAt: decision.cooldownUntil,
    };
  },
});

/** Mark that an upstream attempt actually happened for this reservation. */
export const markAttempt = internalMutation({
  args: { key: v.string(), seq: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("regen_state")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .collect();
    if (rows[0]) await ctx.db.patch(rows[0]._id, { attempt_seq: args.seq, updated_at: Date.now() });
  },
});

/**
 * Refund an accepted regeneration when the attempt failed BEFORE any upstream
 * request was sent (validation failure, quota rejection, missing config).
 * A request that actually reached OpenRouter is never refunded (a timeout
 * does not prove the upstream never processed it).
 */
export const refund = internalMutation({
  args: { key: v.string(), seq: v.number() },
  handler: async (ctx, args): Promise<{ refunded: boolean }> => {
    const now = Date.now();
    const cfg = limitsFromEnv(process.env);
    const state = await loadState(ctx, args.key);
    if (!state || state.accepted !== args.seq) return { refunded: false };
    if (state.attempt_seq === args.seq) return { refunded: false }; // upstream was attempted

    const accepted = args.seq - 1;
    const patch = {
      accepted,
      cooldown_until: 0, // the cooldown started by this failed attempt
      lock_until: accepted >= cfg.lockCount ? state.lockUntil : 0,
      last_accepted_at: accepted > 0 ? state.lastAcceptedAt : 0,
      updated_at: now,
    };
    const rows = await ctx.db
      .query("regen_state")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .collect();
    if (rows[0]) await ctx.db.patch(rows[0]._id, patch);
    return { refunded: true };
  },
});

export const getState = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => await loadState(ctx, args.key),
});

export interface RegenStatus {
  ok: boolean;
  code?: string;
  serverNow: number;
  cooldownUntil: number;
  lockUntil: number;
  accepted: number;
  allowanceLeft: number;
  quota?: {
    perMinute: number;
    perDay: number;
    minuteRemaining: number;
    dailyRemaining: number;
    minuteResetAt: number;
    dailyResetAt: number;
    inflight: number;
  };
}

/**
 * Authoritative cooldown / lock / quota state for one project's topic.
 * The client uses it for display and button state only — enforcement happens
 * in the generation actions themselves.
 */
export const status = query({
  args: { projectId: v.id("projects"), visitorToken: v.string() },
  handler: async (ctx, args): Promise<RegenStatus> => {
    const now = Date.now();
    const visitorId = await verifyVisitorToken(args.visitorToken);
    if (!visitorId) return { ok: false, code: "INVALID_SESSION", serverNow: now, cooldownUntil: 0, lockUntil: 0, accepted: 0, allowanceLeft: 0 };

    const project = await ctx.db.get(args.projectId);
    if (!project) return { ok: false, code: "NOT_FOUND", serverNow: now, cooldownUntil: 0, lockUntil: 0, accepted: 0, allowanceLeft: 0 };
    if (project.visitor && project.visitor !== visitorId) {
      return { ok: false, code: "FORBIDDEN", serverNow: now, cooldownUntil: 0, lockUntil: 0, accepted: 0, allowanceLeft: 0 };
    }

    const cfg = limitsFromEnv(process.env);
    const topicKey = await topicFingerprint(project.topic);
    const state = await loadState(ctx, `${visitorId}:${topicKey}`);
    const quota = await readSnapshot(ctx, now);
    return {
      ok: true,
      serverNow: now,
      cooldownUntil: state?.cooldownUntil ?? 0,
      lockUntil: state?.lockUntil ?? 0,
      accepted: state?.accepted ?? 0,
      allowanceLeft: Math.max(0, cfg.lockCount - (state?.accepted ?? 0)),
      quota,
    };
  },
});
