import { internalMutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";

/**
 * Idempotency claims: the same (visitor, scope, requestId) may only start one
 * upstream operation. Double-clicks and parallel retries reuse the same
 * requestId and are answered from the claim instead of hitting OpenRouter.
 *
 * Claims are scoped to the verified visitor id, expire after 10 minutes, and
 * never let a client replay another visitor's response.
 */

const CLAIM_TTL_MS = 10 * 60_000;
const SWEEP_BATCH = 20;

async function sweep(ctx: MutationCtx, now: number): Promise<void> {
  const cutoff = now - CLAIM_TTL_MS;
  const stale = await ctx.db
    .query("idempotency")
    .withIndex("by_created", (q) => q.lt("created_at", cutoff))
    .take(SWEEP_BATCH);
  for (const row of stale) await ctx.db.delete(row._id);
}

/**
 * Try to claim a request id. Returns "claimed" for the first caller,
 * "duplicate" when the same id is already inflight or done.
 */
export const claim = internalMutation({
  args: { scope: v.string(), visitorId: v.string(), requestId: v.string() },
  handler: async (ctx, args): Promise<"claimed" | "duplicate"> => {
    const now = Date.now();
    await sweep(ctx, now);
    const key = `${args.scope}:${args.visitorId}:${args.requestId}`;
    const rows = await ctx.db
      .query("idempotency")
      .withIndex("by_key", (q) => q.eq("key", key))
      .collect();
    if (rows[0]) return "duplicate";
    await ctx.db.insert("idempotency", { key, status: "inflight", created_at: now });
    return "claimed";
  },
});

/** Mark a claim finished (success or failure). Failures free the id for retry. */
export const settle = internalMutation({
  args: {
    scope: v.string(),
    visitorId: v.string(),
    requestId: v.string(),
    status: v.union(v.literal("done"), v.literal("failed")),
  },
  handler: async (ctx, args) => {
    const key = `${args.scope}:${args.visitorId}:${args.requestId}`;
    const rows = await ctx.db
      .query("idempotency")
      .withIndex("by_key", (q) => q.eq("key", key))
      .collect();
    const row = rows[0];
    if (!row) return;
    if (args.status === "failed") {
      // A failed claim must not block a legitimate retry.
      await ctx.db.delete(row._id);
    } else {
      await ctx.db.patch(row._id, { status: "done" });
    }
  },
});
