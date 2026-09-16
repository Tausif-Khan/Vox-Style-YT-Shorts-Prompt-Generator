import { z } from "zod";
import { VISUAL_TYPES, TRANSITION_TYPES } from "./types";

export const researchSchema = z.object({
  topic: z.string(),
  central_question: z.string().min(1),
  summary: z.string().min(1),
  timeline: z.array(z.object({ period: z.string(), event: z.string() })).min(1),
  locations: z.array(z.string()),
  people: z.array(z.string()),
  key_events: z.array(z.string()).min(1),
  key_facts: z.array(z.string()).min(1),
  common_misconceptions: z.array(z.string()),
  controversial_or_disputed_claims: z.array(z.string()),
  sources: z.array(z.string()).min(1),
});

export const storySchema = z.object({
  central_question: z.string().min(1),
  hook: z.string().min(1),
  core_idea: z.string().min(1),
  story_angle: z.string().min(1),
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

export const scenesArraySchema = z.object({
  scenes: z.array(sceneSchema).min(1),
});

export const visualBibleSchema = z.object({
  overall_style: z.string().min(1),
  realism: z.string().min(1),
  camera_language: z.string().min(1),
  lighting: z.string().min(1),
  color_direction: z.string().min(1),
  texture: z.string().min(1),
  historical_accuracy: z.string().min(1),
  human_character_direction: z.string().min(1),
  environment_direction: z.string().min(1),
  motion_direction: z.string().min(1),
  things_to_avoid: z.array(z.string()).min(1),
});

export const editingPlanSchema = z.object({
  total_duration: z.number().positive(),
  scenes: z
    .array(
      z.object({
        scene: z.number().int().positive(),
        start: z.number().nonnegative(),
        end: z.number().positive(),
        visual: z.string(),
        narration: z.string(),
        graphics: z.string(),
        transition: z.string(),
        audio: z.string(),
      })
    )
    .min(1),
});

export type ResearchInput = z.infer<typeof researchSchema>;
export type StoryInput = z.infer<typeof storySchema>;
export type ScriptInput = z.infer<typeof scriptSchema>;
export type SceneInput = z.infer<typeof sceneSchema>;
export type VisualBibleInput = z.infer<typeof visualBibleSchema>;
export type EditingPlanInput = z.infer<typeof editingPlanSchema>;
