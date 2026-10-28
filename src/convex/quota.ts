import { internalMutation, internalQuery, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  evaluateUpstream,
  limitsFromEnv,
  nextUtcDayStart,
  pruneWindow,
  utcDayKey,
  MINUTE_MS,
  type LimitsConfig,
} from "../lib/limits";

/**
 * Application-wide quota for upstream OpenRouter requests.
 *
 * - Authoritative server-side state (Convex tables) — never in cookies or
 *   client storage, so clearing cookies / private windows / new browsers do
 *   NOT reset the global limits.
 * - Convex mutations are serializable transactions, so the check-and-reserve
 *   below is atomic: concurrent requests cannot overshoot the caps.
 * - A request rejected here never reaches OpenRouter.
 * - Quota is consumed at the moment an upstream request is actually attempted
 *   (inside provider.generate, immediately before each fetch), including the
 *   provider's single bounded retry — and never for attempts that never happen.
 */

const GLOBAL_KEY = "global";
const HOUR_MS = 60 * MINUTE_MS;
const INFLIGHT_STALE_MS = 10 * MINUTE_MS;
const IP_DOC_TTL_MS = 48 * HOUR_MS;

interface GlobalDoc {
  _id: Id<"runtime_quota">;
  key: string;
  recent: number[];
  day_key: string;
  day_count: number;
  day_initial: number;
  day_regen: number;
  inflight: { id: string; at: number }[];
  rejected: number;
  last_rejection_at?: number;
  last_alert_at?: number;
  upstream_errors: number;
  upstream_429: number;
  last_upstream_error_at?: number;
  created_at: number;
  updated_at: number;
}

async function getGlobal(ctx: QueryCtx | MutationCtx): Promise<GlobalDoc | null> {
  const rows = await ctx.db
    .query("runtime_quota")
    .withIndex("by_key", (q) => q.eq("key", GLOBAL_KEY))
    .collect();
  return (rows[0] as GlobalDoc | undefined) ?? null;
}

function emptyGlobal(now: number): Omit<GlobalDoc, "_id"> {
  return {
    key: GLOBAL_KEY,
    recent: [],
    day_key: utcDayKey(now),
    day_count: 0,
    day_initial: 0,
    day_regen: 0,
    inflight: [],
    rejected: 0,
    upstream_errors: 0,
    upstream_429: 0,
    created_at: now,
    updated_at: now,
  };
}

async function upsertGlobal(
  ctx: MutationCtx,
  patch: Partial<Omit<GlobalDoc, "_id" | "key">>,
  now: number
): Promise<void> {
  const existing = await getGlobal(ctx);
  if (existing) {
    await ctx.db.patch(existing._id, { ...patch, updated_at: now });
  } else {
    await ctx.db.insert("runtime_quota", { ...emptyGlobal(now), ...patch });
  }
}

export interface QuotaSnapshot {
  perMinute: number;
  perDay: number;
  minuteRemaining: number;
  dailyRemaining: number;
  minuteResetAt: number;
  dailyResetAt: number;
  inflight: number;
  rejected: number;
  upstreamErrors: number;
}

function snapshotFrom(doc: GlobalDoc | null, cfg: LimitsConfig, now: number): QuotaSnapshot {
  const recent = pruneWindow(doc?.recent, now, MINUTE_MS);
  const dayCount = doc && doc.day_key === utcDayKey(now) ? doc.day_count : 0;
  const inflight = (doc?.inflight ?? []).filter((e) => now - e.at < INFLIGHT_STALE_MS);
  return {
    perMinute: cfg.perMinute,
    perDay: cfg.perDay,
    minuteRemaining: Math.max(0, cfg.perMinute - recent.length),
    dailyRemaining: Math.max(0, cfg.perDay - dayCount),
    minuteResetAt: recent.length > 0 ? recent[0] + MINUTE_MS : now,
    dailyResetAt: nextUtcDayStart(now),
    inflight: inflight.length,
    rejected: doc?.rejected ?? 0,
    upstreamErrors: doc?.upstream_errors ?? 0,
  };
}

/**
 * Public, read-only snapshot for the UI (pre-submit friendly warnings).
 * Contains counters only — no identifiers, no configuration secrets.
 */
export async function readSnapshot(ctx: QueryCtx, now: number): Promise<QuotaSnapshot> {
  const cfg = limitsFromEnv(process.env);
  const doc = await getGlobal(ctx);
  return snapshotFrom(doc, cfg, now);
}

export const snapshot = query({
  args: {},
  handler: async (ctx): Promise<QuotaSnapshot> => await readSnapshot(ctx, Date.now()),
});

/** Non-consuming check used before starting a run (friendly early errors). */
export const precheck = internalQuery({
  args: { ipKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cfg = limitsFromEnv(process.env);
    const doc = await getGlobal(ctx);
    const base = {
      recent: doc ? pruneWindow(doc.recent, now, MINUTE_MS) : [],
      dayKey: doc?.day_key ?? "",
      dayCount: doc?.day_count ?? 0,
      inflight: (doc?.inflight ?? []).filter((e) => now - e.at < INFLIGHT_STALE_MS),
    };
    let ip = null;
    if (args.ipKey) {
      const rows = await ctx.db
        .query("ip_quota")
        .withIndex("by_key", (q) => q.eq("key", args.ipKey!))
        .collect();
      const ipDoc = rows[0];
      ip = {
        recent: pruneWindow(ipDoc?.recent, now, MINUTE_MS),
        dayKey: ipDoc?.day_key ?? "",
        dayCount: ipDoc?.day_count ?? 0,
      };
    }
    return evaluateUpstream(base, ip, now, cfg, !!args.ipKey);
  },
});

/**
 * Atomically reserve capacity for one upstream attempt.
 * Returns a reservation that MUST be released in a finally block.
 */
export const consumeUpstream = internalMutation({
  args: {
    purpose: v.union(v.literal("initial"), v.literal("regen")),
    ipKey: v.optional(v.string()),
    regenKey: v.optional(v.string()),
    regenSeq: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; reservationId?: string; code?: string; retryAt?: number; message?: string; minuteRemaining: number; dailyRemaining: number }> => {
    const now = Date.now();
    const cfg = limitsFromEnv(process.env);
    const doc = await getGlobal(ctx);
    const recent = pruneWindow(doc?.recent, now, MINUTE_MS);
    const inflight = (doc?.inflight ?? []).filter((e) => now - e.at < INFLIGHT_STALE_MS);
    const dayKey = utcDayKey(now);
    const dayCount = doc && doc.day_key === dayKey ? doc.day_count : 0;

    // Per-IP state (keyed hash — raw IP never stored).
    let ipDoc: Doc<"ip_quota"> | null = null;
    if (args.ipKey) {
      const rows = await ctx.db
        .query("ip_quota")
        .withIndex("by_key", (q) => q.eq("key", args.ipKey!))
        .collect();
      ipDoc = rows[0] ?? null;
    }
    const ipState = args.ipKey
      ? {
          recent: pruneWindow(ipDoc?.recent, now, MINUTE_MS),
          dayKey: ipDoc?.day_key ?? "",
          dayCount: ipDoc?.day_count ?? 0,
        }
      : null;

    const decision = evaluateUpstream(
      { recent, dayKey, dayCount, inflight },
      ipState,
      now,
      cfg,
      !!args.ipKey
    );

    if (!decision.ok) {
      // Record the rejection for monitoring (bounded, no PII).
      await upsertGlobal(
        ctx,
        {
          recent,
          day_key: dayKey,
          day_count: dayCount,
          inflight,
          rejected: (doc?.rejected ?? 0) + 1,
          last_rejection_at: now,
        },
        now
      );
      if (args.ipKey && ipDoc) {
        await ctx.db.patch(ipDoc._id, {
          recent: pruneWindow(ipDoc.recent, now, MINUTE_MS),
          day_key: ipDoc.day_key === dayKey ? ipDoc.day_key : dayKey,
          day_count: ipDoc.day_key === dayKey ? ipDoc.day_count : 0,
          rejected: ipDoc.rejected + 1,
          updated_at: now,
        });
      }
      // Alert (deduped to at most one log line per minute) for quota exhaustion.
      const firstRejectInAWindow = !doc?.last_rejection_at || now - doc.last_rejection_at > MINUTE_MS;
      if (!doc?.last_alert_at || now - doc.last_alert_at > MINUTE_MS) {
        await upsertGlobal(ctx, { last_alert_at: now }, now);
        console.warn(
          `[quota] upstream request rejected code=${decision.code} retryAt=${decision.retryAt ?? 0}`
        );
      }
      // Bounded security event (rate-limited) for the owner's monitoring.
      if (firstRejectInAWindow) {
        await ctx.runMutation(internal.quota.recordEvent, {
          kind: "quota_rejected",
          detail: `${decision.code} ip=${args.ipKey ? "keyed" : "unknown"}`,
        });
      }
      return {
        ok: false,
        code: decision.code,
        retryAt: decision.retryAt,
        message: decision.message,
        minuteRemaining: Math.max(0, cfg.perMinute - recent.length),
        dailyRemaining: Math.max(0, cfg.perDay - dayCount),
      };
    }

    // ── Reserve ──
    const reservationId = `${now}-${inflight.length}-${recent.length}`;
    const nextRecent = [...recent, now];
    const nextInflight = [...inflight, { id: reservationId, at: now }];
    await upsertGlobal(
      ctx,
      {
        recent: nextRecent,
        day_key: dayKey,
        day_count: dayCount + 1,
        day_initial: (doc && doc.day_key === dayKey ? doc.day_initial : 0) + (args.purpose === "initial" ? 1 : 0),
        day_regen: (doc && doc.day_key === dayKey ? doc.day_regen : 0) + (args.purpose === "regen" ? 1 : 0),
        inflight: nextInflight,
      },
      now
    );

    if (args.ipKey) {
      const ipRecent = pruneWindow(ipDoc?.recent, now, MINUTE_MS);
      const ipDayKey = ipDoc?.day_key === dayKey ? ipDoc.day_key : dayKey;
      const ipDayCount = ipDoc && ipDoc.day_key === dayKey ? ipDoc.day_count : 0;
      if (ipDoc) {
        await ctx.db.patch(ipDoc._id, {
          recent: [...ipRecent, now],
          day_key: ipDayKey,
          day_count: ipDayCount + 1,
          updated_at: now,
        });
        // Opportunistic cleanup of stale IP docs (bounded work per call).
        const cutoff = now - IP_DOC_TTL_MS;
        const stale = await ctx.db
          .query("ip_quota")
          .withIndex("by_updated", (q) => q.lt("updated_at", cutoff))
          .take(10);
        for (const row of stale) await ctx.db.delete(row._id);
      } else {
        await ctx.db.insert("ip_quota", {
          key: args.ipKey,
          recent: [now],
          day_key: dayKey,
          day_count: 1,
          rejected: 0,
          updated_at: now,
        });
      }
    }

    // Mark the regeneration attempt so a failure-before-upstream can be refunded.
    if (args.regenKey && args.regenSeq !== undefined) {
      const rows = await ctx.db
        .query("regen_state")
        .withIndex("by_key", (q) => q.eq("key", args.regenKey!))
        .collect();
      if (rows[0]) await ctx.db.patch(rows[0]._id, { attempt_seq: args.regenSeq, updated_at: now });
    }

    return {
      ok: true,
      reservationId,
      minuteRemaining: Math.max(0, cfg.perMinute - nextRecent.length),
      dailyRemaining: Math.max(0, cfg.perDay - (dayCount + 1)),
    };
  },
});

/** Release an in-flight reservation (always called from a finally block). */
export const releaseUpstream = internalMutation({
  args: { reservationId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const doc = await getGlobal(ctx);
    if (!doc) return;
    const next = doc.inflight.filter((e) => e.id !== args.reservationId && now - e.at < INFLIGHT_STALE_MS);
    if (next.length !== doc.inflight.length) {
      await ctx.db.patch(doc._id, { inflight: next, updated_at: now });
    }
  },
});

/** Record an upstream (OpenRouter) error for monitoring — status only. */
export const noteUpstreamError = internalMutation({
  args: { status: v.number() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const doc = await getGlobal(ctx);
    await upsertGlobal(
      ctx,
      {
        upstream_errors: (doc?.upstream_errors ?? 0) + 1,
        upstream_429: (doc?.upstream_429 ?? 0) + (args.status === 429 ? 1 : 0),
        last_upstream_error_at: now,
      },
      now
    );
    if (args.status === 429) {
      console.warn(`[upstream] OpenRouter rate-limited the app (HTTP 429)`);
    } else if (args.status >= 500) {
      console.warn(`[upstream] OpenRouter server error (HTTP ${args.status})`);
    }
  },
});

/**
 * Bounded security/abuse event log for monitoring (no keys, no raw IPs,
 * no request payloads). Retention: 24h, at most one event per 30s — so the
 * table stays small even if someone spams a rejected endpoint.
 */
export const recordEvent = internalMutation({
  args: { kind: v.string(), detail: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff = now - 24 * HOUR_MS;
    const last = await ctx.db
      .query("security_events")
      .withIndex("by_at", (q) => q.gte("at", cutoff))
      .order("desc")
      .first();
    if (last && now - last.at < 30_000) return; // rate-limited logging
    await ctx.db.insert("security_events", {
      kind: args.kind.slice(0, 60),
      detail: args.detail.slice(0, 200),
      at: now,
    });
    const stale = await ctx.db
      .query("security_events")
      .withIndex("by_at", (q) => q.lt("at", cutoff))
      .take(20);
    for (const row of stale) await ctx.db.delete(row._id);
  },
});
