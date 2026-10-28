# Vox-Style-YT-Shorts-Prompt-Generator

Create Google Flow prompt for Vox style you tube shorts for any topic

---

## Architecture

```
Browser (React + Vite + react-router)
   │  Convex function API (queries / mutations / actions)
   ▼
Convex backend  ── only place OPENROUTER_API_KEY exists ──►  OpenRouter
```

* The browser **never** talks to OpenRouter. The only upstream call site is
  `src/convex/ai/provider.ts`, reached through the actions in
  `src/convex/pipeline.ts`, which validate the visitor token, validate input,
  and check quota *before* any network request leaves the backend.
* All authoritative counters (global quota, per-IP quota, regeneration
  cooldowns, idempotency claims) live in Convex tables — shared, persistent
  and transactional, so clearing cookies or opening a private window cannot
  reset them. No extra database or Redis is required.

## Configuration

Copy `env.example` → `.env.local` for local development.

* `VITE_*` values are **public** — they are inlined into the client bundle.
* Everything without the prefix is **private** — set it on the Convex side:

```sh
bunx convex env set OPENROUTER_API_KEY sk-or-...
bunx convex env set APP_ALLOWED_ORIGINS https://your-domain.example
bunx convex env set APP_IDENTITY_SECRET "$(openssl rand -hex 32)"
```

Application limits (defaults: 10 upstream requests/minute, 40/UTC-day,
3 concurrent, 90s regeneration cooldown, 3 regenerations → 24h topic lock) are
set with `APP_PER_MINUTE_CAP`, `APP_DAILY_CAP`, `APP_IP_PER_MINUTE_CAP`,
`APP_IP_DAILY_CAP`, `APP_MAX_CONCURRENT`, `APP_REGEN_COOLDOWN_MS`,
`APP_REGEN_LOCK_COUNT`, `APP_REGEN_LOCK_MS`. Changing a cap never resets
counters that were already consumed.

## Hosting

* **Backend:** Convex Cloud — it already provides the shared,
  concurrency-safe store the rate limiter and cooldowns need.
* **Frontend:** any static host (Cloudflare Pages, Vercel, Freebuff hosting).
  `vite build` outputs static files to `dist/`; security headers live in
  `public/_headers` (Cloudflare Pages format).
* Requires `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`, `APP_ALLOWED_ORIGINS`,
  `OPENROUTER_API_KEY` (plus optional `RESEND_API_KEY`, `LEADS_EXPORT_KEY`).

## Commands

```sh
bun install
bun run dev        # dev server (Vite + Convex)
bun run build      # production bundle → dist/
bunx tsc --noEmit  # typecheck
bun test           # unit tests (limits, cooldowns, tokens)
```
