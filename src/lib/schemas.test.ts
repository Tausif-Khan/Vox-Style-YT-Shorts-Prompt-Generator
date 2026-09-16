// Runnable check: `bun test src/lib/schemas.test.ts` (bun's built-in runner)
import { describe, test, expect } from "bun:test";
import { researchSchema, storySchema, scriptSchema, sceneSchema, visualBibleSchema, editingPlanSchema } from "./schemas";
import { TRANSITION_TYPES, VISUAL_TYPES } from "./types";

const research = { topic: "t", central_question: "q", summary: "s", timeline: [{ period: "p", event: "e" }], locations: [], people: [], key_events: ["x"], key_facts: ["x"], common_misconceptions: [], controversial_or_disputed_claims: [], sources: ["s"] };
const story = { central_question: "q", hook: "h", core_idea: "c", story_angle: "a", narrative_structure: [{ stage: "HOOK", description: "d" }], key_reveals: ["r"], ending_payoff: "p" };
const scene = { scene_number: 1, start_time: 0, end_time: 5, duration: 5, narration: "n", visual_goal: "g", visual_type: "MAP", image_prompt: "i", video_prompt: "v", graphics_required: true, graphic_type: "MAP", on_screen_text: "", transition: "HARD_CUT", sound_effects: "s", music_direction: "m", continuity_notes: "c" };
const plan = { total_duration: 60, scenes: [{ scene: 1, start: 0, end: 5, visual: "v", narration: "n", graphics: "", transition: "HARD_CUT", audio: "a" }] };

describe("stage schemas", () => {
  test("research valid / missing field rejected", () => {
    expect(researchSchema.parse(research)).toBeTruthy();
    expect(() => researchSchema.parse({ ...research, key_facts: undefined })).toThrow();
  });
  test("story empty hook rejected", () => {
    expect(storySchema.parse(story)).toBeTruthy();
    expect(() => storySchema.parse({ ...story, hook: "" })).toThrow();
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
  test("visual bible requires avoid list", () => {
    const base = { overall_style: "s", realism: "r", camera_language: "c", lighting: "l", color_direction: "c", texture: "t", historical_accuracy: "h", human_character_direction: "h", environment_direction: "e", motion_direction: "m" };
    expect(visualBibleSchema.parse({ ...base, things_to_avoid: ["x"] })).toBeTruthy();
    expect(() => visualBibleSchema.parse({ ...base, things_to_avoid: [] })).toThrow();
  });
  test("editing plan rejects negative start", () => {
    expect(editingPlanSchema.parse(plan)).toBeTruthy();
    expect(() => editingPlanSchema.parse({ ...plan, scenes: [{ ...plan.scenes[0], start: -1 }] })).toThrow();
  });
});
