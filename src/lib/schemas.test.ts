// Runnable check: `bun test src/lib/schemas.test.ts` (bun's built-in runner)
import { describe, test, expect } from "bun:test";
import { storySchema, scriptSchema, sceneSchema } from "./schemas";

const story = { central_question: "q", summary: "s", hook: "h", key_facts: ["f"], narrative_structure: [{ stage: "HOOK", description: "d" }], key_reveals: ["r"], ending_payoff: "p" };
const scene = { scene_number: 1, start_time: 0, end_time: 5, duration: 5, narration: "n", visual_goal: "g", image_prompt: "i", video_prompt: "v" };

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
  test("lean scene passes", () => {
    expect(sceneSchema.parse(scene)).toBeTruthy();
  });
  test("legacy extras are stripped, core fields kept", () => {
    const parsed = sceneSchema.parse({
      ...scene,
      visual_type: "MAP",
      transition: "HARD_CUT",
      sound_effects: "paper rustle",
      music_direction: "tense strings",
      continuity_notes: "same palette",
      on_screen_text: "1600s",
    }) as any;
    expect(parsed.image_prompt).toBe("i");
    expect(parsed.video_prompt).toBe("v");
    expect(parsed.visual_type).toBeUndefined();
    expect(parsed.transition).toBeUndefined();
    expect(parsed.sound_effects).toBeUndefined();
    expect(parsed.music_direction).toBeUndefined();
  });
  test("missing core field rejected", () => {
    expect(() => sceneSchema.parse({ ...scene, image_prompt: undefined })).toThrow();
  });
});
