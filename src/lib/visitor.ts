/**
 * Visitor session (frontend side).
 *
 * Two ways to get a signed, opaque visitor token — both issue the same
 * unforgeable token; only the cookie side-effect differs:
 *
 *  1. Production: `POST <VITE_CONVEX_SITE_URL>/session` (HTTP action) —
 *     returns the token AND mirrors it into an HttpOnly, Secure cookie, so
 *     the identity survives cleared localStorage and reconnects sessions.
 *  2. Everywhere (and as the production fallback): the `visitor:session`
 *     Convex action over the normal function API — used in local dev because
 *     the dev proxy only routes the function API, not HTTP actions.
 *
 * The token is cached in localStorage so every tab of this browser shares one
 * identity (multiple tabs must not be able to dodge the regeneration
 * cooldown). The token contains no counters or cooldown timestamps — the
 * server owns all authoritative state. Clearing site data yields a new
 * identity (in production the cookie restores the previous one).
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const TOKEN_KEY = "docstudio:visitor_token";

let inflight: Promise<string> | null = null;

function siteUrl(): string {
  const site = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined;
  return site ? `${site.replace(/\/$/, "")}/session` : "";
}

function functionApiBase(): string {
  // Dev: same-origin (Vite proxies the function API to the local backend).
  // Prod: the Convex deployment URL from configuration.
  if (import.meta.env.PROD) {
    return (import.meta.env.VITE_CONVEX_URL as string | undefined) ?? "";
  }
  return window.location.origin;
}

function readToken(data: unknown): string | null {
  const token = (data as { token?: unknown } | null)?.token;
  return typeof token === "string" && token.length > 10 ? token : null;
}

/** Cookie path: HTTP action (production only — it's the only place routed). */
async function tokenFromHttpEndpoint(): Promise<string | null> {
  const url = siteUrl();
  if (!import.meta.env.PROD || !url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) return null;
    return readToken(await res.json().catch(() => null));
  } catch {
    return null;
  }
}

/** Function-API path: the visitor:session action (works in dev and prod). */
async function tokenFromAction(): Promise<string | null> {
  const base = functionApiBase();
  if (!base) return null;
  try {
    const client = new ConvexHttpClient(base);
    const result = await client.action(api.visitor.session, {});
    return readToken(result);
  } catch {
    return null;
  }
}

export async function ensureVisitorToken(): Promise<string> {
  const cached = localStorage.getItem(TOKEN_KEY);
  if (cached) return cached;
  if (!inflight) {
    inflight = (async () => {
      const token = (await tokenFromHttpEndpoint()) ?? (await tokenFromAction());
      if (!token) {
        throw new Error("Could not verify your session. Please reload the page.");
      }
      localStorage.setItem(TOKEN_KEY, token);
      return token;
    })().finally(() => {
      inflight = null;
    });
  }
  return await inflight;
}

/** Drop the cached token (used when the server says the session is invalid). */
export function clearVisitorToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

/**
 * Run a generation call with a valid token; on INVALID_SESSION (e.g. the
 * signing secret rotated), fetch a fresh token once and retry.
 */
export async function withVisitor<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = await ensureVisitorToken();
  try {
    return await fn(token);
  } catch (err) {
    const code = (err as { data?: { code?: string } })?.data?.code;
    if (code === "INVALID_SESSION") {
      clearVisitorToken();
      const fresh = await ensureVisitorToken();
      return await fn(fresh);
    }
    throw err;
  }
}
