import { z } from "zod";

export const storySchema = z.object({
  central_question: z.string().min(1),
  summary: z.string().min(1),
  hook: z.string().min(1),
  key_facts: z.array(z.string()).min(1),
  narrative_structure: z
    .array(z.object({ stage: z.string(), description: z.string() }))
    .min(1),
  key_reveals: z.array(z.string()).min(1),
  ending_payoff: z.string().min(1),
});

export const scriptSectionSchema = z.object({
  scene_number: z.number().int().positive(),
  start_time: z.number().nonnegative(),
  end_time: z.number().positive(),
  narration: z.string().min(1),
});

export const scriptSchema = z.object({
  total_word_count: z.number().int().positive(),
  estimated_duration: z.number().positive(),
  sections: z.array(scriptSectionSchema).min(1),
});

// Lean paper-cut scene: only what the user pastes into Google Flow.
// Legacy fields are tolerated on input but stripped from stored data.
export const sceneCoreSchema = z.object({
  scene_number: z.number().int().positive(),
  start_time: z.number().nonnegative(),
  end_time: z.number().positive(),
  duration: z.number().positive(),
  narration: z.string(),
  visual_goal: z.string().min(1),
  image_prompt: z.string().min(1),
  video_prompt: z.string().min(1),
});

// Lean paper-cut scene: only what the user pastes into Google Flow.
// Legacy/extra fields are tolerated on input but stripped from stored data.
export const sceneSchema = z
  .object({
    scene_number: z.number().int().positive(),
    start_time: z.number().nonnegative(),
    end_time: z.number().positive(),
    duration: z.number().positive(),
    narration: z.string(),
    visual_goal: z.string().min(1),
    image_prompt: z.string().min(1),
    video_prompt: z.string().min(1),
  })
  .passthrough()
  .transform((s) => ({
    scene_number: s.scene_number,
    start_time: s.start_time,
    end_time: s.end_time,
    duration: s.duration,
    narration: s.narration,
    visual_goal: s.visual_goal,
    image_prompt: s.image_prompt,
    video_prompt: s.video_prompt,
  }));

export type StoryInput = z.infer<typeof storySchema>;
export type ScriptInput = z.infer<typeof scriptSchema>;
export type SceneInput = z.infer<typeof sceneCoreSchema>;
