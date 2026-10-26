import { action } from "./_generated/server";
import { issueVisitorToken } from "../lib/visitorToken";

/**
 * Issues an opaque, HMAC-signed visitor token over the normal function API.
 *
 * This is the identity path used in local dev (the dev proxy routes only the
 * function API) and as the production fallback for the `/session` HTTP action,
 * which additionally mirrors the token into an HttpOnly cookie.
 *
 * The token carries no counters, cooldowns or personal data; it exists purely
 * so the backend can key authoritative rate-limit state. It cannot be forged
 * without the server-side secret and reveals nothing about the visitor.
 */
export const session = action({
  args: {},
  handler: async () => {
    const { token } = await issueVisitorToken();
    return { token, expiresInMs: 365 * 24 * 60 * 60 * 1000 };
  },
});
