// Runnable check: `bun test src/lib/schemas.test.ts` (bun's built-in runner)
import { describe, test, expect } from "bun:test";
import { storySchema, scriptSchema, sceneSchema } from "./schemas";
import { TRANSITION_TYPES, VISUAL_TYPES } from "./types";

const story = { central_question: "q", summary: "s", hook: "h", key_facts: ["f"], narrative_structure: [{ stage: "HOOK", description: "d" }], key_reveals: ["r"], ending_payoff: "p" };
const scene = { scene_number: 1, start_time: 0, end_time: 5, duration: 5, narration: "n", visual_goal: "g", visual_type: "MAP", image_prompt: "i", video_prompt: "v", graphics_required: true, graphic_type: "MAP", on_screen_text: "", transition: "HARD_CUT", sound_effects: "s", music_direction: "m", continuity_notes: "c" };

describe("stage schemas", () => {
  test("story valid / missing key_facts rejected", () => {
    expect(storySchema.parse(story)).toBeTruthy();
    expect(() => storySchema.parse({ ...story, key_facts: undefined })).toThrow();
  });
  test("story requires summary (merged research)", () => {
    expect(() => storySchema.parse({ ...story, summary: "" })).toThrow();
  });
  test("script zero words rejected", () => {
    expect(scriptSchema.parse({ total_word_count: 140, estimated_duration: 60, sections: [{ scene_number: 1, start_time: 0, end_time: 5, narration: "hello" }] })).toBeTruthy();
    expect(() => scriptSchema.parse({ total_word_count: 0, estimated_duration: 60, sections: [{ scene_number: 1, start_time: 0, end_time: 5, narration: "x" }] })).toThrow();
  });
  test("scene accepts every visual type and transition", () => {
    for (const vt of VISUAL_TYPES) expect(sceneSchema.parse({ ...scene, visual_type: vt })).toBeTruthy();
    for (const tr of TRANSITION_TYPES) expect(sceneSchema.parse({ ...scene, transition: tr })).toBeTruthy();
  });
  test("scene rejects bogus enums", () => {
    expect(() => sceneSchema.parse({ ...scene, visual_type: "DRONE_SHOT" })).toThrow();
    expect(() => sceneSchema.parse({ ...scene, transition: "STAR_WIPE" })).toThrow();
  });
});
