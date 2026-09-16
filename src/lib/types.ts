export type StageStatus = "QUEUED" | "GENERATING" | "COMPLETED" | "FAILED";

export type AspectRatio = "9:16" | "16:9";
export type DurationOption = 30 | 60 | 90;
export type SceneCount = "auto" | 8 | 10 | 12 | 15;

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

export const GRAPHIC_TYPES = [
  "MAP",
  "TIMELINE",
  "FLOW_DIAGRAM",
  "DATA_VISUALIZATION",
  "COMPARISON",
  "LABELED_OBJECT",
  "STATISTIC",
  "TEXT_REVEAL",
  "PROCESS_DIAGRAM",
] as const;
export type GraphicType = (typeof GRAPHIC_TYPES)[number];

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


export type ResearchData = {
  topic: string;
  central_question: string;
  summary: string;
  timeline: { period: string; event: string }[];
  locations: string[];
  people: string[];
  key_events: string[];
  key_facts: string[];
  common_misconceptions: string[];
  controversial_or_disputed_claims: string[];
  sources: string[];
};

export type StoryArchitecture = {
  central_question: string;
  hook: string;
  core_idea: string;
  story_angle: string;
  narrative_structure: { stage: string; description: string }[];
  key_reveals: string[];
  arc: string;
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
  visual_type: VisualType | string;
  image_prompt: string;
  video_prompt: string;
  graphics_required: boolean;
  graphic_type: string;
  graphic_prompt: string;
  graphic_animation: string;
  graphic_labels?: string[];
  on_screen_text: string;
  transition: TransitionType | string;
  sound_effects: string;
  music_direction: string;
  narration_emphasis?: string;
  ambient?: string;
  continuity_notes: string;
  status: "draft" | "approved";
  asset_status: "NOT_STARTED" | "PROMPT_READY" | "GENERATED" | "APPROVED" | "REJECTED";
};

export type VisualBible = {
  overall_style: string;
  realism: string;
  camera_language: string;
  lighting: string;
  color_direction: string;
  texture: string;
  historical_accuracy: string;
  human_character_direction: string;
  environment_direction: string;
  motion_direction: string;
  things_to_avoid: string[];
};

export type EditingPlan = {
  total_duration: number;
  scenes: {
    scene: number;
    start: number;
    end: number;
    visual: string;
    narration: string;
    graphics: string;
    transition: string;
    audio: string;
  }[];
};

export type ProjectStage = "research" | "story" | "script" | "scenes" | "visuals" | "editing";


