/**
 * Contact form storage: submissions are saved so nothing is lost even if
 * email delivery hiccups. Plain mutations (no Node runtime needed).
 */
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const saveRequest = internalMutation({
  args: {
    name: v.string(),
    email: v.string(),
    request_type: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("contact_requests", {
      name: args.name,
      email: args.email,
      request_type: args.request_type,
      message: args.message,
      emailed: false,
      created_at: Date.now(),
    });
  },
});

export const markEmailed = internalMutation({
  args: { id: v.id("contact_requests") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { emailed: true });
  },
});
