export type StageStatus = "QUEUED" | "GENERATING" | "COMPLETED" | "FAILED";

export type AspectRatio = "9:16" | "16:9";
/** Shorts: 60/90s @ 9:16 · Long-form: 120/180s @ 16:9 (30s option removed). */
export type DurationOption = 60 | 90 | 120 | 180;
export type VideoFormat = "short" | "long";

export const FORMAT_ASPECT: Record<VideoFormat, AspectRatio> = {
  short: "9:16",
  long: "16:9",
};
export const FORMAT_DURATIONS: Record<VideoFormat, DurationOption[]> = {
  short: [60, 90],
  long: [120, 180],
};
export const FORMAT_LABELS: Record<VideoFormat, string> = {
  short: "Short · 9:16",
  long: "Long · 16:9",
};

/** "60 sec" for shorts, "2 min" for long-form. */
export function durationLabel(d: number): string {
  return d >= 120 ? `${d / 60} min` : `${d} sec`;
}

/** Scene (prompt) budget per duration — long-form gets many more prompts. */
export function resolveSceneCount(duration: number): number {
  if (duration <= 60) return 6;
  if (duration <= 90) return 8;
  if (duration <= 120) return 10;
  return 12;
}

export type StoryType =
  | "auto"
  | "historical_documentary"
  | "why_does_this_exist"
  | "how_it_works"
  | "rise_and_fall"
  | "how_it_changed_the_world"
  | "mystery_origin"
  | "custom";

export const STORY_TYPE_LABELS: Record<StoryType, string> = {
  auto: "Auto",
  historical_documentary: "Historical Documentary",
  why_does_this_exist: "Why Does This Exist?",
  how_it_works: "How It Works",
  rise_and_fall: "Rise & Fall",
  how_it_changed_the_world: "How It Changed the World",
  mystery_origin: "Mystery / Origin",
  custom: "Custom",
};

export const VISUAL_TYPES = [
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
export type VisualType = (typeof VISUAL_TYPES)[number];

export const TRANSITION_TYPES = [
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

export type TransitionType = (typeof TRANSITION_TYPES)[number];

export type StoryData = {
  central_question: string;
  summary: string;
  hook: string;
  key_facts: string[];
  narrative_structure: { stage: string; description: string }[];
  key_reveals: string[];
  ending_payoff: string;
};

export type ScriptSection = {
  scene_number: number;
  start_time: number;
  end_time: number;
  narration: string;
};

export type ScriptData = {
  total_word_count: number;
  estimated_duration: number;
  sections: ScriptSection[];
};

export type Scene = {
  scene_number: number;
  start_time: number;
  end_time: number;
  duration: number;
  narration: string;
  visual_goal: string;
  image_prompt: string;
  video_prompt: string;
  status: "draft" | "approved";
  asset_status: "NOT_STARTED" | "PROMPT_READY" | "GENERATED" | "APPROVED" | "REJECTED";
};

export type ProjectStage = "story" | "script" | "scenes";
