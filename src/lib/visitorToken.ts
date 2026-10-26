/**
 * SERVER-ONLY visitor identity helpers (HMAC-signed, opaque tokens).
 *
 * Never import this from frontend code: the signing key material comes from
 * server-side environment variables (`APP_IDENTITY_SECRET`, falling back to
 * `OPENROUTER_API_KEY`) and only ever exists inside the Convex backend.
 *
 * The token is an opaque, unforgeable visitor identifier. It contains no
 * counters, no cooldown timestamps and no personal data. Authoritative
 * rate-limit state lives in Convex tables, keyed by the verified id.
 */

const TOKEN_VERSION = "ps1";

const te = new TextEncoder();

async function hmacKey(): Promise<CryptoKey> {
  const material = process.env.APP_IDENTITY_SECRET || process.env.OPENROUTER_API_KEY;
  if (!material) {
    throw new Error(
      "Visitor identity is not configured: set APP_IDENTITY_SECRET (recommended) or OPENROUTER_API_KEY."
    );
  }
  // Domain-separated digest so the raw provider key is never used directly.
  const digest = await crypto.subtle.digest("SHA-256", te.encode(`papercut-visitor:${material}`));
  return await crypto.subtle.importKey("raw", digest, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

async function sign(value: string): Promise<string> {
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, te.encode(value));
  return toHex(new Uint8Array(sig));
}

/** Length-independent comparison (best-effort constant time). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Create a fresh cryptographically-random visitor id + signed token. */
export async function issueVisitorToken(): Promise<{ visitorId: string; token: string }> {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes); // actions/HTTP actions only (nondeterministic)
  const visitorId = toHex(bytes);
  const token = `${TOKEN_VERSION}.${visitorId}.${await sign(visitorId)}`;
  return { visitorId, token };
}

/**
 * Verify a token issued by {@link issueVisitorToken}.
 * Returns the visitor id, or null when the token is absent/malformed/forged.
 */
export async function verifyVisitorToken(token: string | undefined | null): Promise<string | null> {
  if (!token || token.length > 256) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [version, visitorId, sig] = parts;
  if (version !== TOKEN_VERSION) return null;
  if (!/^[0-9a-f]{16,128}$/.test(visitorId)) return null;
  let expected: string;
  try {
    expected = await sign(visitorId);
  } catch {
    return null;
  }
  return safeEqual(sig, expected) ? visitorId : null;
}

/**
 * Keyed, one-way hash of a raw value (e.g. a client IP) used as a lookup key.
 * The raw value is never stored or logged — only this derived key.
 */
export async function keyedHash(raw: string): Promise<string> {
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, te.encode(raw));
  return toHex(new Uint8Array(sig)).slice(0, 32);
}
