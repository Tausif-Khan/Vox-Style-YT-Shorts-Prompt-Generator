/**
 * Hand-written Gemini responseSchema definitions (strict JSON Schema subset).
 * 3-stage pipeline: story (research+story merged), script, scenes.
 */

const S = { type: "STRING" } as const;
const N = { type: "NUMBER" } as const;
const strArr = { type: "ARRAY", items: S } as const;

/**
 * Lean scene contract for the papercut pipeline: only the fields the user
 * actually pastes into Google Flow. Nothing else is requested or stored.
 */
const sceneProps = {
  scene_number: N,
  start_time: N,
  end_time: N,
  duration: N,
  narration: S,
  visual_goal: S,
  image_prompt: S,
  video_prompt: S,
} as const;
const sceneRequired = [
  "scene_number",
  "start_time",
  "end_time",
  "duration",
  "narration",
  "visual_goal",
  "image_prompt",
  "video_prompt",
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
          properties: sceneProps,
          required: [...sceneRequired],
        },
      },
    },
    required: ["scenes"],
  },

  scene: {
    type: "OBJECT",
    properties: sceneProps,
    required: [...sceneRequired],
  },
};
