import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const SEED_TOPICS: { title: string; category: string }[] = [
  { title: "Why We Have Weekends", category: "why" },
  { title: "Why Diamonds Are So Expensive", category: "why" },
  { title: "Why We Shake Hands", category: "why" },
  { title: "Why Airplanes Have Round Windows", category: "why" },
  { title: "Why We Say OK", category: "why" },
  { title: "Why Maps Put North at the Top", category: "why" },
  { title: "Why Everything Costs 99 Instead of 100", category: "why" },
  { title: "Why We Have Time Zones", category: "why" },
  { title: "Why School Buses Are Yellow", category: "why" },
  { title: "Why Coins Are Round", category: "why" },
  { title: "Why We Use 60 Seconds in a Minute", category: "why" },
  { title: "Why Keyboards Use QWERTY", category: "why" },
  { title: "Why We Wear Wedding Rings", category: "why" },
  { title: "Why Friday the 13th Is Unlucky", category: "why" },
  { title: "Why Bananas Are Curved", category: "why" },
  { title: "Why Humans Started Drinking Milk", category: "why" },
  { title: "Why Gold Is Valuable", category: "why" },
  { title: "Why We Drive on Different Sides of the Road", category: "why" },
  { title: "Why Wi-Fi Is Called Wi-Fi", category: "why" },
  { title: "The History of Pizza", category: "history" },
  { title: "The History of Money", category: "history" },
  { title: "The History of Blue Jeans", category: "history" },
  { title: "The History of Coca-Cola", category: "history" },
  { title: "The History of Paper Money", category: "history" },
  { title: "The History of the Elevator", category: "history" },
  { title: "The History of the Barcode", category: "history" },
  { title: "The History of the ATM", category: "history" },
  { title: "The History of the Internet", category: "history" },
  { title: "The History of the Smartphone", category: "history" },
  { title: "How GPS Changed the World", category: "world" },
  { title: "How English Became a Global Language", category: "world" },
  { title: "How McDonald's Conquered the World", category: "world" },
  { title: "How YouTube Changed Television", category: "world" },
  { title: "How Nike Became a Global Brand", category: "world" },
  { title: "How the Panama Canal Changed the World", category: "world" },
  { title: "How Dubai Became a Global City", category: "world" },
  { title: "How Venice Was Built on Water", category: "world" },
  { title: "How Mumbai Became a Megacity", category: "world" },
  { title: "Why We Celebrate Birthdays", category: "other" },
];

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("ideas")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect(),
});

export const seed = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ideas")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    if (existing.length > 0) return;
    for (const t of SEED_TOPICS) {
      await ctx.db.insert("ideas", { userId: args.userId, ...t, status: "READY" });
    }
  },
});

export const add = mutation({
  args: { userId: v.string(), title: v.string(), category: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("ideas", {
      userId: args.userId,
      title: args.title,
      category: args.category,
      status: "IDEA",
    });
  },
});

export const updateStatus = mutation({
  args: { id: v.id("ideas"), status: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const rename = mutation({
  args: { id: v.id("ideas"), title: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { title: args.title });
  },
});

export const remove = mutation({
  args: { id: v.id("ideas") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
