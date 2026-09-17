/**
 * Server-side prompt system. Prompts never live in UI code.
 * 3-stage pipeline: story (research+story merged), script, scenes.
 */

export const PROMPT_VERSIONS = {
  story: "story_v2",
  script: "script_v2",
  scene_planner: "scene_planner_v2",
} as const;

const VISUAL_TYPE_GUIDANCE = `
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

const FLOW_BUDGET_RULES = `
GOOGLE FLOW BUDGET RULES (user has a free account with limited generations):
- Keep the total number of scenes LOW (given by the caller). Every scene = one video generation.
- Prefer one strong shot per scene over coverage. Never plan B-rolls or extra angles.
- Default to footage that works as a still image too: image_prompt is the anchor frame, video_prompt animates it.
- Only require graphics (graphics_required=true) when a map, timeline or data graphic is genuinely necessary — each is an extra asset.
`.trim();

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

export const storyPrompt = (opts: {
  topic: string;
  storyType: string;
  guidance: string;
  custom?: string;
}) => `
You are the research desk and story architect of a premium editorial documentary studio, in one pass.

TOPIC: ${opts.topic}
STORY TYPE: ${opts.storyType}
${opts.guidance}
${opts.custom ? `CUSTOM DIRECTION: ${opts.custom}` : ""}

Do the research and the story architecture in a single response:
- summary: 3-5 sentence factual briefing on the topic. Facts only; never invent dates, names, numbers or quotes. If a claim is disputed, say so inline ("disputed").
- key_facts: 6-10 crisp, verifiable facts that would surprise an intelligent viewer.
- central_question: the most interesting question this topic begs.
- hook: 1-2 sentences that create instant curiosity. NO generic openings like "Have you ever wondered".
- narrative_structure: 4-6 stages (HOOK, QUESTION, DEVELOPMENT, REVEAL, PAYOFF at minimum), each { stage, description }.
- key_reveals: 2-4 insights ordered for escalating impact.
- ending_payoff: answers the central question with a satisfying, factual resolution.
Return JSON only.
`.trim();

export const scriptPrompt = (opts: {
  story: string;
  duration: number;
  sceneCount: number;
}) => `
You are the scriptwriter of a premium editorial documentary studio.

STORY ARCHITECTURE:
${opts.story}

${FLOW_BUDGET_RULES}

RULES:
- Target total duration: ${opts.duration} seconds across EXACTLY ${opts.sceneCount} scenes.
- Conversational, intelligent, concise. No filler, no greetings, no repetition.
- Every sentence advances the story. End with the ending_payoff.
- Word budget: roughly ${Math.round(opts.duration * 2.3)} spoken words total (±10%).
- Distribute time continuously: scene 1 starts at 0, each scene's start equals the previous end. No gaps or overlaps. Last scene ends at ${opts.duration}.
- Each scene's narration should be 1-3 sentences, narratable aloud.
Return JSON only. total_word_count = actual word count of all narration combined; estimated_duration = ${opts.duration}.
`.trim();

export const scenePlannerPrompt = (opts: {
  story: string;
  scriptSections: string;
  aspectRatio: string;
}) => `
You are the scene planner of a premium editorial documentary studio.

STORY ARCHITECTURE (for tone and continuity):
${opts.story}

SCRIPT SECTIONS (narration and timings are fixed — do not rewrite them):
${opts.scriptSections}

STYLE BIBLE (every prompt inherits this): premium editorial documentary. Photorealistic, physically believable, real materials. Naturalistic cinematic lighting, restrained editorial color palette, tactile texture. Period-appropriate architecture, clothing, objects for historical scenes. Avoid: baked-in text overlays, logos, modern objects in historical scenes, anatomy errors, glossy AI sheen.

${VISUAL_TYPE_GUIDANCE}

${FLOW_BUDGET_RULES}

ASPECT RATIO: ${opts.aspectRatio} — compose frames for this shape.

For EACH script section produce one scene with the same scene_number, start_time, end_time and narration.
- visual_goal: what the viewer should understand from this frame, one sentence.
- image_prompt: self-contained still-image prompt. Structure: SUBJECT + CONTEXT + ENVIRONMENT + (CHARACTERS + WARDROBE if any) + OBJECTS + COMPOSITION + CAMERA + LENS + LIGHTING + TEXTURE + REALISM + AVOIDANCES. 60-120 words. Explicitly forbid baked-in text/logos and anachronisms relevant to the period.
- video_prompt: MOTION ONLY. Never restate the still composition. Structure: SUBJECT MOVEMENT + ENVIRONMENTAL MOVEMENT + CAMERA MOVEMENT + FOCUS BEHAVIOR + PACING + PHYSICAL REALISM. 40-80 words. One camera move maximum; no slow motion unless meaningful.
- graphics_required: true only when a graphic communicates better than footage (maps, timelines, data). graphic_type: MAP | TIMELINE | FLOW_DIAGRAM | DATA_VISUALIZATION | COMPARISON | LABELED_OBJECT | STATISTIC | TEXT_REVEAL | PROCESS_DIAGRAM. graphic_prompt: full spec. graphic_animation: how it animates. graphic_labels: on-screen labels.
- on_screen_text: maximum 4-6 words, ONLY if it improves comprehension (location, date). Often empty.
- transition: how this scene hands off to the next. HARD_CUT | MATCH_CUT | MAP_MORPH | OBJECT_MATCH | WHIP_PAN | DISSOLVE | PUSH_IN | GRAPHIC_TRANSITION | ARCHIVAL_TO_MODERN. Last scene use HARD_CUT.
- sound_effects: 1-3 concrete diegetic sounds. music_direction: mood + intensity arc. narration_emphasis: word/phrase to stress, if any. ambient: environmental bed, if any.
- continuity_notes: how this scene matches neighbors (palette, location, subject).
Return JSON only: { "scenes": [ ... ] }.
`.trim();

export const regenerateScenePrompt = (opts: {
  scene: string;
  instruction?: string;
  neighbors: string;
}) => `
You are regenerating ONE scene of a premium editorial documentary.

CURRENT SCENE:
${opts.scene}

NEIGHBORING SCENES (for continuity):
${opts.neighbors}

${opts.instruction ? `USER INSTRUCTION (highest priority): ${opts.instruction}` : ""}

Rewrite this scene to a higher standard. Keep scene_number, start_time, end_time and narration unchanged.
Style bible: premium editorial documentary. Photorealistic, naturalistic lighting, restrained palette, period-accurate. Avoid baked-in text, logos, anachronisms, anatomy errors.
${VISUAL_TYPE_GUIDANCE}
image_prompt is a self-contained still prompt (subject, environment, period detail, composition, camera, lens, lighting, texture, realism, avoidances); video_prompt describes motion only, never restating composition.
Return JSON only: a single scene object.
`.trim();
