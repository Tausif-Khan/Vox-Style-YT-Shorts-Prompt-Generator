/**
 * Hand-written Gemini responseSchema definitions (strict JSON Schema subset).
 * 3-stage pipeline: story (research+story merged), script, scenes.
 */

const S = { type: "STRING" } as const;
const N = { type: "NUMBER" } as const;
const B = { type: "BOOLEAN" } as const;
const strArr = { type: "ARRAY", items: S } as const;

const TRANSITIONS = [
  "HARD_CUT",
  "MATCH_CUT",
  "MAP_MORPH",
  "OBJECT_MATCH",
  "WHIP_PAN",
  "DISSOLVE",
  "PUSH_IN",
  "GRAPHIC_TRANSITION",
  "ARCHIVAL_TO_MODERN",
] as const;

const VISUALS = [
  "CINEMATIC_FOOTAGE",
  "HISTORICAL_RECREATION",
  "ARCHIVAL_STYLE",
  "MACRO_DETAIL",
  "AERIAL",
  "MAP",
  "TIMELINE",
  "DIAGRAM",
  "DATA_GRAPHIC",
  "OBJECT_FOCUS",
  "PORTRAIT",
  "PROCESS",
  "COMPARISON",
  "MODERN_FOOTAGE",
  "TEXT_GRAPHIC",
] as const;

export const geminiSchemas = {
  story: {
    type: "OBJECT",
    properties: {
      central_question: S,
      summary: S,
      hook: S,
      key_facts: strArr,
      narrative_structure: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: { stage: S, description: S },
          required: ["stage", "description"],
        },
      },
      key_reveals: strArr,
      ending_payoff: S,
    },
    required: [
      "central_question",
      "summary",
      "hook",
      "key_facts",
      "narrative_structure",
      "key_reveals",
      "ending_payoff",
    ],
  },

  script: {
    type: "OBJECT",
    properties: {
      total_word_count: N,
      estimated_duration: N,
      sections: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            scene_number: N,
            start_time: N,
            end_time: N,
            narration: S,
          },
          required: ["scene_number", "start_time", "end_time", "narration"],
        },
      },
    },
    required: ["total_word_count", "estimated_duration", "sections"],
  },

  scenes: {
    type: "OBJECT",
    properties: {
      scenes: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            scene_number: N,
            start_time: N,
            end_time: N,
            duration: N,
            narration: S,
            visual_goal: S,
            visual_type: { type: "STRING", enum: [...VISUALS] },
            image_prompt: S,
            video_prompt: S,
            graphics_required: B,
            graphic_type: S,
            graphic_prompt: S,
            graphic_animation: S,
            graphic_labels: strArr,
            on_screen_text: S,
            transition: { type: "STRING", enum: [...TRANSITIONS] },
            sound_effects: S,
            music_direction: S,
            narration_emphasis: S,
            ambient: S,
            continuity_notes: S,
          },
          required: [
            "scene_number",
            "start_time",
            "end_time",
            "duration",
            "narration",
            "visual_goal",
            "visual_type",
            "image_prompt",
            "video_prompt",
            "graphics_required",
            "on_screen_text",
            "transition",
            "sound_effects",
            "music_direction",
            "continuity_notes",
          ],
        },
      },
    },
    required: ["scenes"],
  },

  scene: {
    type: "OBJECT",
    properties: {
      scene_number: N,
      start_time: N,
      end_time: N,
      duration: N,
      narration: S,
      visual_goal: S,
      visual_type: { type: "STRING", enum: [...VISUALS] },
      image_prompt: S,
      video_prompt: S,
      graphics_required: B,
      graphic_type: S,
      graphic_prompt: S,
      graphic_animation: S,
      graphic_labels: strArr,
      on_screen_text: S,
      transition: { type: "STRING", enum: [...TRANSITIONS] },
      sound_effects: S,
      music_direction: S,
      narration_emphasis: S,
      ambient: S,
      continuity_notes: S,
    },
    required: [
      "scene_number",
      "start_time",
      "end_time",
      "duration",
      "narration",
      "visual_goal",
      "visual_type",
      "image_prompt",
      "video_prompt",
      "graphics_required",
      "on_screen_text",
      "transition",
      "sound_effects",
      "music_direction",
      "continuity_notes",
    ],
  },
};
