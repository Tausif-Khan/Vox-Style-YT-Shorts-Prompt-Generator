/**
 * Decode backend errors (ConvexError payloads) into friendly, human messages.
 * The server is the source of truth: codes, timestamps and countdowns all
 * come from it — this module only formats them for display.
 */
import { ConvexError } from "convex/values";
import { formatRemaining } from "./limits";

export interface GenError {
  code: string;
  /** Epoch ms when the restriction is expected to lift (0 = unknown). */
  retryAt: number;
  message: string;
}

const GENERIC = "Something went wrong. Please try again.";

export function toGenError(err: unknown): GenError {
  if (err instanceof ConvexError) {
    const data = err.data as { code?: unknown; retryAt?: unknown; message?: unknown } | undefined;
    if (data && typeof data.code === "string") {
      return {
        code: data.code,
        retryAt: typeof data.retryAt === "number" ? data.retryAt : 0,
        message:
          typeof data.message === "string" && data.message.trim() ? data.message : GENERIC,
      };
    }
  }
  // Non-convex errors (network, plain throws): show a stable friendly text,
  // never raw internals.
  const raw = err instanceof Error ? err.message : "";
  const message = raw && raw.length < 200 && !/convex|uncaught|internal/i.test(raw) ? raw : GENERIC;
  return { code: "UNKNOWN", retryAt: 0, message };
}

/** App-wide quota / upstream conditions, formatted with remaining time. */
export function describeLimit(e: GenError, now = Date.now()): string {
  const left = e.retryAt > now ? formatRemaining(e.retryAt - now) : "";
  switch (e.code) {
    case "QUOTA_MINUTE":
      return `The site is at its per-minute generation limit. Please try again in ${left || "about a minute"}.`;
    case "QUOTA_DAILY":
      return `Today's generation quota is used up. Generation resumes in ${left}.`;
    case "IP_MINUTE":
      return `Too many generation requests from your network. Please try again in ${left || "a minute"}.`;
    case "IP_DAILY":
      return `Your network's generation allowance for today is used up. Please try again in ${left}.`;
    case "QUOTA_CONCURRENCY":
      return `Too many generations are running right now. Please try again in ${left || "a few seconds"}.`;
    case "REGEN_COOLDOWN":
      return `Regeneration available in ${left || "a moment"}.`;
    case "REGEN_LOCK":
      return `You've reached the regeneration limit for this topic. You can regenerate again in ${left}.`;
    case "DUPLICATE":
      return "This request is already being processed.";
    case "INVALID_SESSION":
      return "Your session expired. Please reload the page and try again.";
    default:
      return e.message;
  }
}

/** Full display string: quota codes get a countdown, everything else as-is. */
export function userMessage(err: unknown, now = Date.now()): string {
  const e = toGenError(err);
  if (e.code.startsWith("QUOTA_") || e.code.startsWith("IP_") || e.code.startsWith("REGEN_")) {
    return describeLimit(e, now);
  }
  return e.message;
}
