import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  projects: defineTable({
    userId: v.string(),
    title: v.string(),
    topic: v.string(),
    duration: v.number(),
    aspect_ratio: v.string(),
    language: v.string(),
    scene_count: v.number(),
    story_type: v.string(),
    custom_story_direction: v.optional(v.string()),
    visual_style: v.string(),
    status: v.string(), // draft | generating | ready | failed
    stage_status: v.object({
      story: v.string(), // QUEUED | GENERATING | COMPLETED | FAILED
      script: v.string(),
      scenes: v.string(),
    }),
    prompt_versions: v.optional(
      v.object({
        story: v.string(),
        script: v.string(),
        scene_planner: v.string(),
      })
    ),
    last_error: v.optional(v.string()),
    // End-to-end pipeline timing (epoch ms), set by startPipeline.
    pipeline_started_at: v.optional(v.number()),
    pipeline_completed_at: v.optional(v.number()),
    // Server-verified visitor id that created this project (set at creation;
    // optional so projects created before identity was introduced still work).
    visitor: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  story: defineTable({
    projectId: v.id("projects"),
    data: v.any(),
    prompt_version: v.string(),
  }).index("by_project", ["projectId"]),

  script: defineTable({
    projectId: v.id("projects"),
    data: v.any(),
    prompt_version: v.string(),
  }).index("by_project", ["projectId"]),

  scenes: defineTable({
    projectId: v.id("projects"),
    scene_number: v.number(),
    data: v.any(),
    prompt_version: v.string(),
  }).index("by_project", ["projectId"]),

  ideas: defineTable({
    userId: v.string(),
    title: v.string(),
    category: v.string(), // why | history | world | other
    status: v.string(), // IDEA | IN_PROGRESS | DRAFT | READY | PUBLISHED
  }).index("by_user", ["userId"]),

  // Sign-in leads: just name + email (no passwords, no auth tokens).
  // One doc per email; re-login updates name and bumps sign-in count.
  leads: defineTable({
    email: v.string(), // lowercase, unique
    name: v.string(),
    email_domain: v.string(), // e.g. "gmail.com"
    signin_count: v.number(),
    last_seen: v.number(), // epoch ms
  }).index("by_email", ["email"]),

  // Contact form submissions (privacy requests, DMCA notices, questions).
  // Stored server-side; also emailed to the operator via Resend.
  contact_requests: defineTable({
    name: v.string(),
    email: v.string(),
    request_type: v.string(), // privacy | dmca | other
    message: v.string(),
    emailed: v.boolean(),
    created_at: v.number(),
  }),

  // ── Application-wide quota (authoritative, shared across ALL visitors) ──
  // One singleton document (key = "global"). Never derived from cookies, so
  // clearing cookies / private windows / other browsers cannot reset it.
  runtime_quota: defineTable({
    key: v.string(),
    // Timestamps of actual upstream attempts inside the rolling minute.
    recent: v.array(v.number()),
    // IST calendar day the daily counters below belong to.
    day_key: v.string(),
    day_count: v.number(), // upstream attempts today (all purposes)
    day_initial: v.number(), // internal metric: initial generation attempts
    day_regen: v.number(), // internal metric: regeneration attempts
    // In-flight upstream requests (id, start) for the concurrency cap.
    inflight: v.array(v.object({ id: v.string(), at: v.number() })),
    rejected: v.number(), // rejections by the app limiter (monitoring)
    last_rejection_at: v.optional(v.number()),
    last_alert_at: v.optional(v.number()), // log-dedupe for server alerts
    upstream_errors: v.number(), // non-2xx upstream responses (monitoring)
    upstream_429: v.number(), // upstream rate-limit responses (monitoring)
    last_upstream_error_at: v.optional(v.number()),
    created_at: v.number(),
    updated_at: v.number(),
  }).index("by_key", ["key"]),

  // Per-IP counters, keyed by a keyed hash — raw IPs are never stored.
  ip_quota: defineTable({
    key: v.string(),
    recent: v.array(v.number()),
    day_key: v.string(),
    day_count: v.number(),
    rejected: v.number(),
    updated_at: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_updated", ["updated_at"]),

  // Per visitor + topic regeneration state (cooldown / allowance / lock).
  regen_state: defineTable({
    key: v.string(), // `${visitorId}:${topicFingerprint}`
    visitor: v.string(),
    topic_hash: v.string(),
    accepted: v.number(),
    cooldown_until: v.number(),
    lock_until: v.number(),
    last_accepted_at: v.number(),
    // Sequence of the last upstream attempt for this key (refund logic).
    attempt_seq: v.number(),
    updated_at: v.number(),
  }).index("by_key", ["key"]),

  // Idempotency claims: dedupe double-clicks / parallel identical submissions.
  idempotency: defineTable({
    key: v.string(), // `${scope}:${visitorId}:${requestId}`
    status: v.string(), // inflight | done | failed
    created_at: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_created", ["created_at"]),

  // Security / abuse monitoring events (no keys, no raw IPs, no payloads).
  security_events: defineTable({
    kind: v.string(),
    detail: v.string(),
    at: v.number(),
  }).index("by_at", ["at"]),
});
