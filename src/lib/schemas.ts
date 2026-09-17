import { z } from "zod";
import { VISUAL_TYPES, TRANSITION_TYPES } from "./types";

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

export const sceneSchema = z.object({
  scene_number: z.number().int().positive(),
  start_time: z.number().nonnegative(),
  end_time: z.number().positive(),
  duration: z.number().positive(),
  narration: z.string(),
  visual_goal: z.string().min(1),
  visual_type: z.enum(VISUAL_TYPES),
  image_prompt: z.string().min(1),
  video_prompt: z.string().min(1),
  graphics_required: z.boolean(),
  graphic_type: z.string().optional().nullable(),
  graphic_prompt: z.string().optional().nullable(),
  graphic_animation: z.string().optional().nullable(),
  graphic_labels: z.array(z.string()).optional().nullable(),
  on_screen_text: z.string(),
  transition: z.enum(TRANSITION_TYPES),
  sound_effects: z.string(),
  music_direction: z.string(),
  narration_emphasis: z.string().optional().nullable(),
  ambient: z.string().optional().nullable(),
  continuity_notes: z.string(),
});

export type StoryInput = z.infer<typeof storySchema>;
export type ScriptInput = z.infer<typeof scriptSchema>;
export type SceneInput = z.infer<typeof sceneSchema>;
