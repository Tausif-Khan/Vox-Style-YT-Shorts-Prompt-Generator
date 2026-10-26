/**
 * Pure application-level limit rules (no I/O, no Convex, no DOM).
 *
 * Used by:
 *  - the Convex backend (authoritative enforcement), and
 *  - the frontend (displaying remaining time / countdowns only — the client
 *    never decides authorization).
 *
 * IMPORTANT: these are application limits configured by the site owner,
 * deliberately conservative. They are NOT OpenRouter's own platform limits
 * and must not be treated as such in business logic.
 */

export const MINUTE_MS = 60_000;
export const DAY_MS = 86_400_000;

/** Daily caps are counted per IST calendar day (site audience is IST-centric). */
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export type LimitCode =
  | "QUOTA_MINUTE" // application-wide rolling-minute cap reached
  | "QUOTA_DAILY" // application-wide daily cap reached
  | "QUOTA_CONCURRENCY" // too many upstream requests in flight
  | "IP_MINUTE" // per-IP rolling-minute cap reached
  | "IP_DAILY" // per-IP daily cap reached
  | "REGEN_COOLDOWN" // 90s per visitor+topic regeneration cooldown
  | "REGEN_LOCK" // 24h per topic regeneration lock (3 accepted regens)
  | "INVALID_SESSION" // visitor token missing/invalid
  | "INVALID_INPUT" // server-side validation failure
  | "DUPLICATE" // duplicate submission (idempotency)
  | "FORBIDDEN"; // visitor does not own the requested resource

export interface LimitDenial {
  ok: false;
  code: LimitCode;
  /** Epoch ms when the limit is expected to lift. */
  retryAt?: number;
  message?: string;
}

export type LimitDecision = { ok: true } | LimitDenial;

export interface LimitsConfig {
  /** Global upstream OpenRouter requests per rolling minute. */
  perMinute: number;
  /** Global upstream OpenRouter requests per IST calendar day. */
  perDay: number;
  /** Upstream requests per rolling minute, per hashed client IP. */
  ipPerMinute: number;
  /** Upstream requests per IST calendar day, per hashed client IP. */
  ipPerDay: number;
  /** Global cap on simultaneous in-flight upstream requests. */
  maxConcurrent: number;
  /** Per visitor+topic cooldown after an accepted regeneration. */
  cooldownMs: number;
  /** Accepted regenerations that trigger the topic lock. */
  lockCount: number;
  /** Duration of the topic lock once triggered. */
  lockMs: number;
}

export const DEFAULT_LIMITS: LimitsConfig = {
  perMinute: 10,
  perDay: 40,
  ipPerMinute: 5,
  ipPerDay: 20,
  maxConcurrent: 3,
  cooldownMs: 90_000,
  lockCount: 3,
  lockMs: DAY_MS,
};

function intFrom(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Read limits from server-side configuration. Values are clamped to sane
 * bounds so a typo cannot disable protection. There is deliberately no logic
 * that raises limits on its own: the configured value is authoritative, and
 * changing configuration never resets already-consumed counters.
 */
export function limitsFromEnv(env: Record<string, string | undefined>): LimitsConfig {
  return {
    perMinute: intFrom(env.APP_PER_MINUTE_CAP, DEFAULT_LIMITS.perMinute, 1, 10_000),
    perDay: intFrom(env.APP_DAILY_CAP, DEFAULT_LIMITS.perDay, 1, 1_000_000),
    ipPerMinute: intFrom(env.APP_IP_PER_MINUTE_CAP, DEFAULT_LIMITS.ipPerMinute, 1, 10_000),
    ipPerDay: intFrom(env.APP_IP_DAILY_CAP, DEFAULT_LIMITS.ipPerDay, 1, 1_000_000),
    maxConcurrent: intFrom(env.APP_MAX_CONCURRENT, DEFAULT_LIMITS.maxConcurrent, 1, 100),
    cooldownMs: intFrom(env.APP_REGEN_COOLDOWN_MS, DEFAULT_LIMITS.cooldownMs, 1_000, DAY_MS),
    lockCount: intFrom(env.APP_REGEN_LOCK_COUNT, DEFAULT_LIMITS.lockCount, 1, 100),
    lockMs: intFrom(env.APP_REGEN_LOCK_MS, DEFAULT_LIMITS.lockMs, 60_000, 30 * DAY_MS),
  };
}

/** "YYYY-MM-DD" of the IST calendar day containing `ts`. */
export function istDayKey(ts: number): string {
  return new Date(ts + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Epoch ms of the next IST midnight after `ts` (daily reset time). */
export function nextIstDayStart(ts: number): number {
  const dayStartUtcMidnight = Date.parse(`${istDayKey(ts)}T00:00:00Z`);
  return dayStartUtcMidnight - IST_OFFSET_MS + DAY_MS;
}

/** Keep only timestamps inside the rolling window ending at `now`. */
export function pruneWindow(timestamps: readonly number[] | undefined, now: number, windowMs: number): number[] {
  if (!timestamps || timestamps.length === 0) return [];
  const cutoff = now - windowMs;
  return timestamps.filter((t) => t > cutoff && t <= now);
}

export interface UpstreamState {
  recent: readonly number[]; // upstream attempt timestamps inside the last minute
  dayKey: string; // IST day the counters belong to
  dayCount: number; // upstream attempts today
  inflight: readonly { id: string; at: number }[];
}

export interface IpState {
  recent: readonly number[];
  dayKey: string;
  dayCount: number;
}

/**
 * Evaluate whether a NEW upstream request may be attempted right now.
 * Rejected requests never contact OpenRouter.
 */
export function evaluateUpstream(
  state: UpstreamState,
  ip: IpState | null,
  now: number,
  cfg: LimitsConfig,
  hasIp: boolean
): LimitDecision {
  if (state.inflight.length >= cfg.maxConcurrent) {
    return {
      ok: false,
      code: "QUOTA_CONCURRENCY",
      retryAt: now + 5_000,
      message: "Too many generations are running right now. Please try again in a few seconds.",
    };
  }
  const recent = pruneWindow(state.recent, now, MINUTE_MS);
  if (recent.length >= cfg.perMinute) {
    return {
      ok: false,
      code: "QUOTA_MINUTE",
      retryAt: recent[0] + MINUTE_MS,
      message: "The site is receiving a lot of generation requests. Please try again in about a minute.",
    };
  }
  const dayKey = istDayKey(now);
  const dayCount = state.dayKey === dayKey ? state.dayCount : 0;
  if (dayCount >= cfg.perDay) {
    return {
      ok: false,
      code: "QUOTA_DAILY",
      retryAt: nextIstDayStart(now),
      message: "Today's generation quota is used up. Generation resumes tomorrow (IST).",
    };
  }
  if (hasIp && ip) {
    const ipRecent = pruneWindow(ip.recent, now, MINUTE_MS);
    if (ipRecent.length >= cfg.ipPerMinute) {
      return {
        ok: false,
        code: "IP_MINUTE",
        retryAt: ipRecent[0] + MINUTE_MS,
        message: "Too many requests from your network. Please try again in about a minute.",
      };
    }
    const ipDay = ip.dayKey === dayKey ? ip.dayCount : 0;
    if (ipDay >= cfg.ipPerDay) {
      return {
        ok: false,
        code: "IP_DAILY",
        retryAt: nextIstDayStart(now),
        message: "Your network has used its generation allowance for today. Please try again tomorrow.",
      };
    }
  }
  return { ok: true };
}

export interface RegenState {
  accepted: number;
  cooldownUntil: number;
  lockUntil: number;
  lastAcceptedAt: number;
}

export interface RegenAccept {
  ok: true;
  /** Counter value AFTER this acceptance (used as an idempotency sequence). */
  seq: number;
  cooldownUntil: number;
  lockUntil: number;
  accepted: number;
  allowanceLeft: number;
  key: string;
}

export type RegenDecision = RegenAccept | LimitDenial;

/**
 * Decide + advance the per visitor+topic regeneration state.
 * Pure: the caller persists the returned state atomically.
 *
 * Rules (per spec):
 *  - initial generation is NOT a regeneration (caller never calls this for it)
 *  - an accepted regeneration starts a 90s cooldown for the same visitor+topic
 *  - the 3rd accepted regeneration triggers a 24h topic lock
 *  - after a lock expires the counter resets (fresh allowance)
 *  - counters older than the lock window decay, so unrelated later activity
 *    is not blocked forever
 */
export function advanceRegen(state: RegenState, key: string, now: number, cfg: LimitsConfig): RegenDecision {
  // Lock expired → the topic earns a fresh allowance.
  if (state.lockUntil > 0 && now >= state.lockUntil) {
    state = { accepted: 0, cooldownUntil: 0, lockUntil: 0, lastAcceptedAt: 0 };
  } else if (state.lockUntil > now) {
    return {
      ok: false,
      code: "REGEN_LOCK",
      retryAt: state.lockUntil,
      message: "You've reached the regeneration limit for this topic.",
    };
  } else if (state.cooldownUntil > now) {
    return {
      ok: false,
      code: "REGEN_COOLDOWN",
      retryAt: state.cooldownUntil,
      message: "Regeneration is cooling down for this topic.",
    };
  }

  // Decay the counter when no regeneration happened within the lock window,
  // so the 3-regeneration rule applies to a burst, not to all time.
  let accepted = state.lastAcceptedAt > 0 && now - state.lastAcceptedAt >= cfg.lockMs ? 0 : state.accepted;

  const seq = accepted + 1;
  const lockUntil = seq >= cfg.lockCount ? now + cfg.lockMs : 0;
  return {
    ok: true,
    seq,
    key,
    accepted: seq,
    cooldownUntil: now + cfg.cooldownMs,
    lockUntil,
    allowanceLeft: Math.max(0, cfg.lockCount - seq),
  };
}

/** Topic identity: normalized, then SHA-256 (privacy-conscious fingerprint). */
export function normalizeTopic(topic: string): string {
  return topic.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 400);
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function topicFingerprint(topic: string): Promise<string> {
  return await sha256Hex(`topic:${normalizeTopic(topic)}`);
}

/** "01:29" / "23:59:59" style remaining-time text (display only). */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
