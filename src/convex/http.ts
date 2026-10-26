import { httpRouter, httpActionGeneric, type GenericActionCtx } from "convex/server";
import { issueVisitorToken, verifyVisitorToken } from "../lib/visitorToken";

/**
 * HTTP actions for visitor sessions.
 *
 * `POST /session` (also mounted at `/api/session` for the dev proxy) issues an
 * opaque, HMAC-signed visitor token and mirrors it into an HttpOnly cookie.
 *
 *  - The cookie carries ONLY the opaque session token — never counters or
 *    cooldown timestamps (those live in Convex tables).
 *  - Secure + HttpOnly always; SameSite=None; Secure on https so credentialed
 *    cross-origin calls to the Convex site URL work; plain Lax on local http.
 *  - The token returned in the body is what the browser passes as an argument
 *    to generation actions; it is unforgeable without the server-side secret.
 */

const http = httpRouter();

const COOKIE_NAME = "ps_vid";
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 2048;

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

/**
 * CORS: when APP_ALLOWED_ORIGINS is configured only those origins are
 * allowed (with credentials). When unset (local/dev) any origin is reflected
 * so the preview works — set APP_ALLOWED_ORIGINS in production.
 */
function resolveOrigin(origin: string | null): string | null {
  if (!origin) return null;
  const list = (process.env.APP_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0) return origin;
  return list.includes(origin) ? origin : null;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = resolveOrigin(origin);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  if (allowed) {
    headers["Access-Control-Allow-Origin"] = allowed;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Vary"] = "Origin";
  }
  return headers;
}

function jsonResponse(origin: string | null, status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...corsHeaders(origin),
      ...extra,
    },
  });
}

async function session(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  // Reject oversized payloads before parsing.
  const text = await request.text().catch(() => "");
  if (text.length > MAX_BODY_BYTES) {
    return jsonResponse(origin, 413, { error: "payload_too_large" });
  }

  // Reuse the existing signed cookie when present; otherwise issue a new id.
  const cookies = parseCookies(request.headers.get("cookie"));
  const existing = await verifyVisitorToken(cookies[COOKIE_NAME]);
  const { token } = existing ? { token: cookies[COOKIE_NAME] } : await issueVisitorToken();

  const isHttps = new URL(request.url).protocol === "https:";
  const cookieAttrs = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${Math.floor(YEAR_MS / 1000)}`,
    isHttps ? "SameSite=None" : "SameSite=Lax",
    ...(isHttps ? ["Secure"] : []),
  ].join("; ");

  return jsonResponse(origin, 200, { token, expiresInMs: YEAR_MS }, { "Set-Cookie": cookieAttrs });
}

// This handler uses no Convex context; httpActionGeneric types ctx generically.
const handler = httpActionGeneric(
  async (_ctx: GenericActionCtx<any>, request: Request): Promise<Response> => await session(request)
);

http.route({ path: "/session", method: "POST", handler });
http.route({ path: "/session", method: "GET", handler });
http.route({ path: "/session", method: "OPTIONS", handler });
// Dev: Vite proxies /api/* to the local Convex backend without stripping the
// prefix, so the same handler is mounted under /api too.
http.route({ path: "/api/session", method: "POST", handler });
http.route({ path: "/api/session", method: "GET", handler });
http.route({ path: "/api/session", method: "OPTIONS", handler });

export default http;
