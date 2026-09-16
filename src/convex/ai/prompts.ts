/**
 * Server-side prompt system. Prompts never live in UI code.
 * Every prompt has a version — bump when the architecture evolves.
 */

export const PROMPT_VERSIONS = {
  research: "research_v1",
  story: "story_v1",
  script: "script_v1",
  scene_planner: "scene_planner_v1",
  visual_bible: "visual_bible_v1",
  flow_image: "flow_image_v1",
  flow_video: "flow_video_v1",
  editing: "editing_v1",
} as const;

export const STORY_TYPE_GUIDANCE: Record<string, string> = {
  historical_documentary:
    "Chronological origin story. Trace how the thing came to be, through real events, people and turning points. End on why it still matters today.",
  why_does_this_exist:
    "Assume the viewer never questioned it. Reveal the hidden reason it exists. Structure: familiar object → surprising origin → the forces that shaped it → modern echo.",
  how_it_works:
    "Deconstruct the mechanism. Layers: what the viewer sees → the hidden system underneath → why it was designed that way → what happens if it disappears.",
  rise_and_fall:
    "Two-act structure: ascent and decline. Find the single decision or condition that flipped the trajectory.",
  how_it_changed_the_world:
    "Trace a before/after. Pick the moment of change, then show three concrete consequences the viewer can feel today.",
  mystery_origin:
    "Open on an unexplained detail or contradiction. Investigate. Resolve with the most evidence-backed explanation; acknowledge competing theories honestly.",
  custom: "Follow the user's custom story direction if provided; otherwise use the strongest curiosity-driven arc.",
};

export const VISUAL_TYPE_GUIDANCE = `
Choose the BEST communication method per scene. Never default to cinematic footage for everything.
Types: CINEMATIC_FOOTAGE, HISTORICAL_RECREATION, ARCHIVAL_STYLE, MACRO_DETAIL, AERIAL, MAP, TIMELINE, DIAGRAM, DATA_GRAPHIC, OBJECT_FOCUS, PORTRAIT, PROCESS, COMPARISON, MODERN_FOOTAGE, TEXT_GRAPHIC.
Guidance:
- Geography, migration, spread → MAP
- Chronology spanning decades/centuries → TIMELINE
- Physical small object or mechanism → MACRO_DETAIL or OBJECT_FOCUS
- Single person central to the story → PORTRAIT
- Step-by-step mechanism → PROCESS or DIAGRAM
- Numbers, prices, quantities → DATA_GRAPHIC
- Two things contrasted → COMPARISON
- Everyday modern life proof → MODERN_FOOTAGE
- Before photography era → HISTORICAL_RECREATION
- Post-photography historical moments → ARCHIVAL_STYLE
Use variety. Two adjacent scenes should rarely share a visual type.
`.trim();

export const VISUAL_BIBLE_TEMPLATE = `
Overall style: premium editorial documentary. Intelligent, restrained, modern.
Realism: photorealistic and physically believable. Real materials, real physics.
Camera: modern documentary cinematography. Purposeful, controlled movement.
Lighting: naturalistic cinematic lighting motivated by the environment.
Color: restrained editorial palette. Muted bases, one deliberate accent.
Texture: tactile surfaces — paper, grain, metal, fabric, stone.
Human subjects: natural anatomy, believable movement, period-appropriate faces.
Historical scenes: period-appropriate architecture, clothing, objects, signage, transport.
Things to avoid: text overlays baked into imagery, logos, modern objects in historical scenes, exaggerated anatomy, glossy AI sheen.
`.trim();

export const researchPrompt = (topic: string) => `
You are the research desk of a premium editorial documentary studio.

TOPIC: ${topic}

Produce a rigorous research dossier. Rules:
- Facts only. If a claim is disputed, put it in controversial_or_disputed_claims with a note on which sides exist.
- Never invent dates, names, numbers or quotes. If unsure, omit.
- timeline: 5-9 entries, each { period, event }. period is short, e.g. "17th century" or "1905".
- key_facts: 6-10 crisp, verifiable facts that would surprise an intelligent viewer.
- common_misconceptions: 2-4 things people wrongly believe about the topic.
- sources: 3-6 reference categories (e.g. "Encyclopaedia Britannica", "peer-reviewed history of ..."), not fake URLs.
- central_question: the most interesting question this topic begs.
Return JSON only.
`.trim();

export const storyPrompt = (opts: {
  research: string;
  storyType: string;
  guidance: string;
  custom?: string;
}) => `
You are the story architect of a premium editorial documentary studio.

RESEARCH DOSSIER:
${opts.research}

STORY TYPE: ${opts.storyType}
${opts.guidance}
${opts.custom ? `CUSTOM DIRECTION: ${opts.custom}` : ""}

Build the most interesting way to explain this topic. Rules:
- Prioritize: curiosity, clarity, causality, historical progression, surprise, payoff.
- hook: 1-2 sentences that create instant curiosity. NO generic openings like "Have you ever wondered".
- core_idea: the one insight everything else serves.
- story_angle: the editorial stance in one sentence.
- narrative_structure: 4-6 stages (HOOK, QUESTION, DEVELOPMENT, REVEAL, PAYOFF at minimum), each { stage, description }.
- key_reveals: 2-4 insights ordered for escalating impact.
- ending_payoff: answers the central question with a satisfying, factual resolution.
Return JSON only.
`.trim();

export const scriptPrompt = (opts: {
  story: string;
  research: string;
  duration: number;
  sceneCount: number;
}) => `
You are the scriptwriter of a premium editorial documentary studio.

STORY ARCHITECTURE:
${opts.story}

RESEARCH (facts must originate here):
${opts.research}

RULES:
- Target total duration: ${opts.duration} seconds across ${opts.sceneCount} scenes.
- Conversational, intelligent, concise. No filler, no greetings, no repetition.
- Every sentence advances the story. End with the ending_payoff.
- Word budget: roughly ${Math.round(opts.duration * 2.3)} spoken words total (±10%).
- Distribute time continuously: scene 1 starts at 0, each scene's start equals the previous end. No gaps or overlaps.
- Each scene's narration should be 1-3 sentences, narratable aloud.
Return JSON only. total_word_count = actual word count of all narration combined; estimated_duration = ${opts.duration}.
`.trim();

export const visualBiblePrompt = (opts: { topic: string; research: string }) => `
You are the visual director of a premium editorial documentary studio.

TOPIC: ${opts.topic}
RESEARCH CONTEXT:
${opts.research}

Define the project's visual bible. Every scene prompt will inherit it.
- things_to_avoid: 4-7 items, specific to this topic plus the standard bans (baked-in text, logos, anachronisms, anatomy errors).
- historical_accuracy: state the concrete periods, places, clothing, objects that must be right for THIS topic.
Return JSON only.
`.trim();

export const scenePlannerPrompt = (opts: {
  story: string;
  scriptSections: string;
  visualBible: string;
  aspectRatio: string;
}) => `
You are the scene planner of a premium editorial documentary studio.

STORY ARCHITECTURE:
${opts.story}

SCRIPT SECTIONS (narration is fixed — do not rewrite it):
${opts.scriptSections}

PROJECT VISUAL BIBLE (every prompt inherits this):
${opts.visualBible}

${VISUAL_TYPE_GUIDANCE}

ASPECT RATIO: ${opts.aspectRatio} — compose frames for this shape.

For EACH script section produce one scene with the same scene_number, start_time, end_time and narration.
- visual_goal: what the viewer should understand from this frame, one sentence.
- image_prompt: self-contained still-image prompt. Structure: SUBJECT + CONTEXT + ENVIRONMENT + (CHARACTERS + WARDROBE if any) + OBJECTS + COMPOSITION + CAMERA + LENS + LIGHTING + TEXTURE + REALISM + AVOIDANCES. Describe what makes it cinematic — never the word "cinematic" alone. 60-120 words. Explicitly forbid baked-in text/logos and anachronisms relevant to the period.
- video_prompt: MOTION ONLY. Never restate the still composition. Structure: SUBJECT MOVEMENT + ENVIRONMENTAL MOVEMENT + CAMERA MOVEMENT + FOCUS BEHAVIOR + PACING + PHYSICAL REALISM. 40-80 words. One camera move maximum; no slow motion unless meaningful.
- graphics_required: true only when a graphic communicates better than footage (maps, timelines, data, diagrams, comparisons, labeled objects, statistics, text reveals, process diagrams). graphic_type: MAP | TIMELINE | FLOW_DIAGRAM | DATA_VISUALIZATION | COMPARISON | LABELED_OBJECT | STATISTIC | TEXT_REVEAL | PROCESS_DIAGRAM. graphic_prompt: full spec for a motion designer. graphic_animation: how it animates. graphic_labels: on-screen labels.
- When graphics_required is true, image_prompt should describe the clean background plate the graphic sits on, and video_prompt the subtle motion behind the graphic.
- on_screen_text: maximum 4-6 words, ONLY if it improves comprehension (location, date, arrow of change). Often empty.
- transition: how this scene hands off to the next. HARD_CUT | MATCH_CUT | MAP_MORPH | OBJECT_MATCH | WHIP_PAN | DISSOLVE | PUSH_IN | GRAPHIC_TRANSITION | ARCHIVAL_TO_MODERN. Support the story; last scene use HARD_CUT.
- sound_effects: 1-3 concrete diegetic sounds. music_direction: mood + intensity arc. narration_emphasis: the word/phrase to stress, if any. ambient: environmental bed, if any.
- continuity_notes: how this scene matches neighbors (palette, location, subject).
Return JSON only: { "scenes": [ ... ] }.
`.trim();

export const editingPlanPrompt = (opts: { scenes: string; duration: number }) => `
You are the finishing editor of a premium editorial documentary studio.

SCENES (final):
${opts.scenes}

Produce the assembly timeline. Rules:
- total_duration must equal ${opts.duration}.
- scenes in chronological order, timings identical to the scene data, continuous.
- visual: short label of what's on screen. narration: keep the narration verbatim. graphics: the graphic spec or "".
- transition: the outgoing transition of that scene. audio: music + SFX + ambience summary.
Return JSON only.
`.trim();

export const regenerateScenePrompt = (opts: {
  scene: string;
  visualBible: string;
  instruction?: string;
  neighbors: string;
}) => `
You are regenerating ONE scene of a premium editorial documentary.

PROJECT VISUAL BIBLE:
${opts.visualBible}

CURRENT SCENE:
${opts.scene}

NEIGHBORING SCENES (for continuity):
${opts.neighbors}

${opts.instruction ? `USER INSTRUCTION (highest priority): ${opts.instruction}` : ""}

Rewrite this scene to a higher standard. Keep scene_number, start_time, end_time and narration unchanged.
${VISUAL_TYPE_GUIDANCE}
Apply the full prompt-quality rules from the studio style guide: image_prompt is a self-contained still prompt (subject, environment, period detail, composition, camera, lens, lighting, texture, realism, avoidances); video_prompt describes motion only, never restating composition.
Return JSON only: a single scene object.
`.trim();
