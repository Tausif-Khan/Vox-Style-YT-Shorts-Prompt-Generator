"use node";

/**
 * Contact form backend: emails form submissions to the operator.
 * The recipient is hardcoded here (server-side only) — it is never visible
 * anywhere on the page or in the client bundle.
 *
 * Requires RESEND_API_KEY in the Convex env store:
 *   bunx convex env set RESEND_API_KEY re_xxxxxxxx
 * Uses Resend's sandbox sender (onboarding@resend.dev) — works without
 * domain verification; swap in your own domain later if you want.
 */
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

const OPERATOR_EMAIL = "mtkgroupdesigns@gmail.com";
const FROM = "Papercut Studio <onboarding@resend.dev>";

export const submit = action({
  args: {
    name: v.string(),
    email: v.string(),
    request_type: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim().slice(0, 100);
    const email = args.email.trim().toLowerCase().slice(0, 200);
    const message = args.message.trim().slice(0, 3000);
    const requestType = args.request_type.slice(0, 60);

    if (!name) throw new Error("Please enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw new Error("Please enter a valid email address.");
    }
    if (!message) throw new Error("Please describe your request.");

    const id = await ctx.runMutation(internal.contactRequests.saveRequest, {
      name,
      email,
      request_type: requestType,
      message,
    });

    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error(
        "The contact form is not fully configured yet. Please try again later."
      );
    }

    const subjectMap: Record<string, string> = {
      privacy: "Privacy / data request",
      dmca: "DMCA notice",
      other: "General question",
    };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: OPERATOR_EMAIL,
        reply_to: email,
        subject: `[Contact] ${subjectMap[requestType] ?? requestType} — ${name}`,
        html: [
          `<p><strong>Name:</strong> ${name}</p>`,
          `<p><strong>Email:</strong> ${email}</p>`,
          `<p><strong>Request type:</strong> ${subjectMap[requestType] ?? requestType}</p>`,
          `<p><strong>Message:</strong></p>`,
          `<pre style="font-family:inherit;white-space:pre-wrap">${message.replace(/</g, "&lt;")}</pre>`,
        ].join("\n"),
      }),
    });

    if (!res.ok) {
      throw new Error(`Email delivery failed (${res.status}). Please try again later.`);
    }

    await ctx.runMutation(internal.contactRequests.markEmailed, { id });
    return { ok: true };
  },
});
