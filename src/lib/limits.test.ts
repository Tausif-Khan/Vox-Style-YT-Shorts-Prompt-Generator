import { describe, expect, test } from "bun:test";
import {
  DEFAULT_LIMITS,
  advanceRegen,
  evaluateUpstream,
  formatRemaining,
  istDayKey,
  limitsFromEnv,
  nextIstDayStart,
  normalizeTopic,
  pruneWindow,
  topicFingerprint,
  MINUTE_MS,
  DAY_MS,
  type LimitsConfig,
  type RegenState,
} from "./limits";
import { issueVisitorToken, verifyVisitorToken } from "./visitorToken";

const cfg: LimitsConfig = { ...DEFAULT_LIMITS };

function state(overrides: Partial<Parameters<typeof evaluateUpstream>[0]> = {}) {
  return {
    recent: [] as number[],
    dayKey: istDayKey(Date.now()),
    dayCount: 0,
    inflight: [] as { id: string; at: number }[],
    ...overrides,
  };
}

describe("windows", () => {
  test("istDayKey shifts by +5:30", () => {
    // 2026-01-01T23:00:00Z → still 2026-01-02 in IST
    expect(istDayKey(Date.parse("2026-01-01T23:00:00Z"))).toBe("2026-01-02");
    // 2026-01-01T18:29:00Z → 2026-01-01 23:59 IST
    expect(istDayKey(Date.parse("2026-01-01T18:29:00Z"))).toBe("2026-01-01");
  });

  test("nextIstDayStart is the next IST midnight", () => {
    const ts = Date.parse("2026-01-01T18:29:00Z"); // 23:59 IST
    const next = nextIstDayStart(ts);
    expect(istDayKey(next)).toBe("2026-01-02");
    expect(next - ts).toBeLessThan(DAY_MS);
    expect(next).toBeGreaterThan(ts);
    // 00:30 IST on Jan 2 → next start is Jan 3 midnight IST
    const later = Date.parse("2026-01-01T19:00:00Z");
    expect(istDayKey(nextIstDayStart(later))).toBe("2026-01-03");
  });

  test("pruneWindow keeps only the rolling minute", () => {
    const now = 1_000_000_000;
    const list = [now - 2 * MINUTE_MS, now - MINUTE_MS + 1, now - 1000, now];
    expect(pruneWindow(list, now, MINUTE_MS)).toEqual([now - MINUTE_MS + 1, now - 1000, now]);
  });
});

describe("global upstream quota", () => {
  test("allows requests below the caps", () => {
    const now = Date.now();
    const s = state({ recent: [now - 1000, now - 2000], dayCount: 5 });
    expect(evaluateUpstream(s, null, now, cfg, false).ok).toBe(true);
  });

  test("blocks at 10 per rolling minute and reports the reset time", () => {
    const now = Date.now();
    // ascending: oldest first (as stored by the quota mutation)
    const recent = Array.from({ length: 10 }, (_, i) => now - (10 - i) * 1000);
    const d = evaluateUpstream(state({ recent }), null, now, cfg, false);
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.code).toBe("QUOTA_MINUTE");
      // oldest inside window was now (index 0 = now)... most recent 10 entries
      expect(d.retryAt).toBeLessThanOrEqual(now + MINUTE_MS);
      expect(d.retryAt).toBeGreaterThan(now);
    }
  });

  test("blocking at 10 does not block when only 9 exist", () => {
    const now = Date.now();
    const recent = Array.from({ length: 9 }, (_, i) => now - (9 - i) * 1000);
    expect(evaluateUpstream(state({ recent }), null, now, cfg, false).ok).toBe(true);
  });

  test("blocks at 40 per IST day with reset at next IST midnight", () => {
    const now = Date.parse("2026-03-05T10:00:00+05:30");
    const d = evaluateUpstream(state({ dayCount: 40, dayKey: istDayKey(now) }), null, now, cfg, false);
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.code).toBe("QUOTA_DAILY");
      expect(d.retryAt).toBe(nextIstDayStart(now));
      expect(istDayKey(d.retryAt!)).toBe("2026-03-06");
    }
  });

  test("daily counter resets when the stored day is a previous day", () => {
    const now = Date.parse("2026-03-05T10:00:00+05:30");
    const d = evaluateUpstream(state({ dayCount: 999, dayKey: "2020-01-01" }), null, now, cfg, false);
    expect(d.ok).toBe(true);
  });

  test("concurrency cap blocks when inflight is full", () => {
    const now = Date.now();
    const inflight = Array.from({ length: cfg.maxConcurrent }, (_, i) => ({ id: `x${i}`, at: now }));
    const d = evaluateUpstream(state({ inflight }), null, now, cfg, false);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.code).toBe("QUOTA_CONCURRENCY");
  });

  test("per-IP caps apply only when an IP key is present", () => {
    const now = Date.now();
    const ip = { recent: Array.from({ length: cfg.ipPerMinute }, () => now - 500), dayKey: istDayKey(now), dayCount: 0 };
    const withIp = evaluateUpstream(state(), ip, now, cfg, true);
    expect(withIp.ok).toBe(false);
    if (!withIp.ok) expect(withIp.code).toBe("IP_MINUTE");
    // Same state without IP → allowed (global not exceeded)
    expect(evaluateUpstream(state(), ip, now, cfg, false).ok).toBe(true);
  });

  test("configured caps are honoured (owner-adjustable, no hardcoding)", () => {
    const now = Date.now();
    const custom = { ...cfg, perMinute: 2 };
    const d = evaluateUpstream(state({ recent: [now - 1, now - 2] }), null, now, custom, false);
    expect(d.ok).toBe(false);
  });
});

describe("limitsFromEnv", () => {
  test("defaults when unset", () => {
    const l = limitsFromEnv({});
    expect(l.perMinute).toBe(10);
    expect(l.perDay).toBe(40);
  });

  test("reads configured values", () => {
    const l = limitsFromEnv({ APP_PER_MINUTE_CAP: "25", APP_DAILY_CAP: "500" });
    expect(l.perMinute).toBe(25);
    expect(l.perDay).toBe(500);
  });

  test("garbage and out-of-range values are clamped, never disabling protection", () => {
    expect(limitsFromEnv({ APP_PER_MINUTE_CAP: "abc" }).perMinute).toBe(10);
    expect(limitsFromEnv({ APP_PER_MINUTE_CAP: "0" }).perMinute).toBe(1);
    expect(limitsFromEnv({ APP_DAILY_CAP: "-5" }).perDay).toBe(1);
    expect(limitsFromEnv({ APP_MAX_CONCURRENT: "9999" }).maxConcurrent).toBe(100);
  });
});

function regenState(overrides: Partial<RegenState> = {}): RegenState {
  return { accepted: 0, cooldownUntil: 0, lockUntil: 0, lastAcceptedAt: 0, ...overrides };
}

describe("regeneration cooldown + topic lock", () => {
  test("first acceptance starts a 90s cooldown", () => {
    const now = Date.now();
    const d = advanceRegen(regenState(), "k", now, cfg);
    expect(d.ok).toBe(true);
    if (d.ok) {
      expect(d.seq).toBe(1);
      expect(d.cooldownUntil).toBe(now + 90_000);
      expect(d.lockUntil).toBe(0);
      expect(d.allowanceLeft).toBe(2);
    }
  });

  test("second acceptance inside cooldown is rejected with the expiry time", () => {
    const now = Date.now();
    const d = advanceRegen(regenState({ accepted: 1, cooldownUntil: now + 45_000, lastAcceptedAt: now }), "k", now, cfg);
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.code).toBe("REGEN_COOLDOWN");
      expect(d.retryAt).toBe(now + 45_000);
    }
  });

  test("third accepted regeneration triggers the 24h topic lock", () => {
    const now = Date.now();
    // accepted=2, cooldown expired
    const d = advanceRegen(regenState({ accepted: 2, cooldownUntil: now - 1, lastAcceptedAt: now - 1000 }), "k", now, cfg);
    expect(d.ok).toBe(true);
    if (d.ok) {
      expect(d.seq).toBe(3);
      expect(d.lockUntil).toBe(now + DAY_MS);
      expect(d.allowanceLeft).toBe(0);
    }
  });

  test("while locked, regeneration is rejected", () => {
    const now = Date.now();
    const d = advanceRegen(regenState({ accepted: 3, cooldownUntil: now - 1, lockUntil: now + 3600_000, lastAcceptedAt: now }), "k", now, cfg);
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.code).toBe("REGEN_LOCK");
      expect(d.retryAt).toBe(now + 3600_000);
    }
  });

  test("after the 24h lock expires the counter resets (fresh allowance)", () => {
    const now = Date.now();
    const d = advanceRegen(
      regenState({ accepted: 3, cooldownUntil: now - DAY_MS, lockUntil: now - 1, lastAcceptedAt: now - DAY_MS }),
      "k",
      now,
      cfg
    );
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.seq).toBe(1);
  });

  test("counter decays after 24h without regeneration activity", () => {
    const now = Date.now();
    const d = advanceRegen(
      regenState({ accepted: 2, cooldownUntil: now - DAY_MS, lastAcceptedAt: now - DAY_MS - 1 }),
      "k",
      now,
      cfg
    );
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.seq).toBe(1);
  });
});

describe("topic fingerprint", () => {
  test("normalizes whitespace and case", async () => {
    const a = await topicFingerprint("  The   History OF Pizza ");
    const b = await topicFingerprint("the history of pizza");
    expect(a).toBe(b);
  });

  test("distinct topics never collide", async () => {
    const a = await topicFingerprint("History of Pizza");
    const b = await topicFingerprint("History of Pasta");
    expect(a).not.toBe(b);
    expect(a).toHaveLength(64);
  });

  test("normalizeTopic is bounded", () => {
    expect(normalizeTopic("x".repeat(500)).length).toBe(400);
  });
});

describe("visitor tokens (server identity)", () => {
  test("issue → verify roundtrip", async () => {
    process.env.OPENROUTER_API_KEY = "test-secret-for-unit-tests";
    const { visitorId, token } = await issueVisitorToken();
    expect(await verifyVisitorToken(token)).toBe(visitorId);
  });

  test("tampered tokens are rejected", async () => {
    process.env.OPENROUTER_API_KEY = "test-secret-for-unit-tests";
    const { token } = await issueVisitorToken();
    const [v, id, sig] = token.split(".");
    expect(await verifyVisitorToken(`${v}.${"0".repeat(id.length)}.${sig}`)).toBeNull();
    expect(await verifyVisitorToken(`${v}.${id}.${sig.slice(0, -2)}ff`)).toBeNull();
    expect(await verifyVisitorToken("garbage")).toBeNull();
    expect(await verifyVisitorToken("")).toBeNull();
    expect(await verifyVisitorToken(undefined)).toBeNull();
  });
});

describe("display helpers", () => {
  test("formatRemaining matches the required UI strings", () => {
    expect(formatRemaining(89_000)).toBe("01:29");
    expect(formatRemaining(90_000)).toBe("01:30");
    expect(formatRemaining(24 * 3600_000 - 1000)).toBe("23:59:59");
    expect(formatRemaining(-5)).toBe("00:00");
  });
});
