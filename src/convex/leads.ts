import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Only well-known free/personal email providers are allowed at sign-in.
// This blocks temporary/disposable and lookalike domains (e.g. mailinator.com,
// gmailmobille.com). Add a domain here and it is accepted instantly.
const ALLOWED_EMAIL_DOMAINS = [
  // Google
  "gmail.com",
  "googlemail.com",
  // Yahoo
  "yahoo.com",
  "yahoo.co.in",
  "yahoo.co.uk",
  "yahoo.ca",
  "yahoo.de",
  "yahoo.fr",
  // Microsoft
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "live.com",
  "msn.com",
  // Apple
  "icloud.com",
  "me.com",
  "mac.com",
  // Other major consumer providers
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "gmx.de",
  "mail.com",
  "zoho.com",
  "yandex.com",
  "yandex.ru",
  "rediffmail.com",
];

function normalizeEmail(raw: string): { ok: true; email: string; domain: string } | { ok: false; error: string } {
  const email = raw.trim().toLowerCase();
  if (!email) return { ok: false, error: "Please enter your email address." };
  // Strict-enough shape check; the domain whitelist does the heavy lifting.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, error: "That doesn't look like a valid email address." };
  }
  const domain = email.split("@")[1] ?? "";
  if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
    return {
      ok: false,
      error:
        "We only accept email addresses from well-known providers (Gmail, Yahoo, Hotmail/Outlook, iCloud, etc.) to keep the tool spam-free.",
    };
  }
  return { ok: true, email, domain };
}

/** Register (or re-greet) a lead. Returns the stored email on success. */
export const register = mutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    const name = args.name.trim().slice(0, 80);
    const parsed = normalizeEmail(args.email);
    if (!parsed.ok) throw new Error(parsed.error);
    if (!name) throw new Error("Please enter your name.");

    const existing = await ctx.db
      .query("leads")
      .withIndex("by_email", (q) => q.eq("email", parsed.email))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: name || existing.name,
        signin_count: existing.signin_count + 1,
        last_seen: Date.now(),
      });
      return { email: existing.email };
    }

    await ctx.db.insert("leads", {
      email: parsed.email,
      name,
      email_domain: parsed.domain,
      signin_count: 1,
      last_seen: Date.now(),
    });
    return { email: parsed.email };
  },
});

/** For the signed-in user's own UI state (not an export path). */
export const lookup = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const parsed = normalizeEmail(args.email);
    if (!parsed.ok) return null;
    return await ctx.db
      .query("leads")
      .withIndex("by_email", (q) => q.eq("email", parsed.email))
      .unique();
  },
});
