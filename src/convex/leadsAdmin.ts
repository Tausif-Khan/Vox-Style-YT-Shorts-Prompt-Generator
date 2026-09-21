import { query } from "./_generated/server";

/** Admin: full lead list for export (used by scripts/export-leads.ts). */
export const list = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("leads").collect(),
});
