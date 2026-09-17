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
});
