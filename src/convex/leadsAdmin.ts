import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Lead export for the operator (used by scripts/export-leads.ts).
 *
 * SECURITY: this returns the entire collected lead list (emails + names), so
 * it MUST NOT be callable by an arbitrary visitor. Convex public queries are
 * reachable by anyone who knows the deployment URL — and that URL is in the
 * client bundle. The handler therefore fails CLOSED:
 *
 *   - LEADS_EXPORT_KEY must be configured server-side (never client-side),
 *   - the caller must present the same value,
 *   - with no configured key the query always rejects.
 *
 * Configure with:  bunx convex env set LEADS_EXPORT_KEY <random string>
 * and pass the same value to the export script.
 */

/** Constant-time-ish comparison so the key can't be guessed byte by byte. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const list = query({
  args: { exportKey: v.string() },
  handler: async (ctx, args) => {
    const expected = process.env.LEADS_EXPORT_KEY ?? "";
    if (!expected || !safeEqual(args.exportKey, expected)) {
      // Rejected before any data is read.
      throw new Error("Not authorized.");
    }
    return await ctx.db.query("leads").collect();
  },
});
