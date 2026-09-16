/**
 * Hand-written Gemini responseSchema definitions (strict JSON Schema subset).
 * Written explicitly rather than converted so behavior is predictable.
 */

const S = { type: "STRING" } as const;
const N = { type: "NUMBER" } as const;
const B = { type: "BOOLEAN" } as const;
const strArr = { type: "ARRAY", items: S } as const;

const periodEvent = {
  type: "OBJECT",
  properties: { period: S, event: S },
  required: ["period", "event"],
} as const;

const stageDesc = {
  type: "OBJECT",
  properties: { stage: S, description: S },
  required: ["stage", "description"],
} as const;

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
  research: {
    type: "OBJECT",
    properties: {
      topic: S,
      central_question: S,
      summary: S,
      timeline: { type: "ARRAY", items: periodEvent },
      locations: strArr,
      people: strArr,
      key_events: strArr,
      key_facts: strArr,
      common_misconceptions: strArr,
      controversial_or_disputed_claims: strArr,
      sources: strArr,
    },
    required: [
      "topic",
      "central_question",
      "summary",
      "timeline",
      "locations",
      "people",
      "key_events",
      "key_facts",
      "common_misconceptions",
      "controversial_or_disputed_claims",
      "sources",
    ],
  },

  story: {
    type: "OBJECT",
    properties: {
      central_question: S,
      hook: S,
      core_idea: S,
      story_angle: S,
      narrative_structure: { type: "ARRAY", items: stageDesc },
      key_reveals: strArr,
      ending_payoff: S,
    },
    required: [
      "central_question",
      "hook",
      "core_idea",
      "story_angle",
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

  visualBible: {
    type: "OBJECT",
    properties: {
      overall_style: S,
      realism: S,
      camera_language: S,
      lighting: S,
      color_direction: S,
      texture: S,
      historical_accuracy: S,
      human_character_direction: S,
      environment_direction: S,
      motion_direction: S,
      things_to_avoid: strArr,
    },
    required: [
      "overall_style",
      "realism",
      "camera_language",
      "lighting",
      "color_direction",
      "texture",
      "historical_accuracy",
      "human_character_direction",
      "environment_direction",
      "motion_direction",
      "things_to_avoid",
    ],
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

  editingPlan: {
    type: "OBJECT",
    properties: {
      total_duration: N,
      scenes: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            scene: N,
            start: N,
            end: N,
            visual: S,
            narration: S,
            graphics: S,
            transition: S,
            audio: S,
          },
          required: ["scene", "start", "end", "visual", "narration", "graphics", "transition", "audio"],
        },
      },
    },
    required: ["total_duration", "scenes"],
  },
};
