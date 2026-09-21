/**
 * Server-side prompt system. Prompts never live in UI code.
 * 3-stage pipeline: story (research+story merged), script, scenes.
 *
 * Visual style: VOX-style PAPER CUT animation (layered paper collage,
 * stop-motion feel). Every scene's prompts are built for Google Flow.
 */

export const PROMPT_VERSIONS = {
  story: "story_v3",
  script: "script_v3",
  scene_planner: "papercut_scene_v1",
} as const;

/**
 * Google Flow budget rules — tuned so a full video fits a FREE account's
 * daily credits (~50/day). Veo 3 costs ~20 credits/clip; Veo 3 Fast ~5.
 * 6 scenes → ~30 credits with Veo 3 Fast, leaving room for regenerations.
 */
const FLOW_BUDGET_RULES = `
GOOGLE FLOW FREE-ACCOUNT BUDGET RULES (hard constraints):
- The user has a FREE Google Flow account with roughly 50 credits per day.
- RECOMMENDED MODEL FOR THE USER: Veo 3 Fast (default in Flow). It costs about 5 credits per video clip; the premium Veo 3 costs about 20.
- Scene count is FIXED by the caller (4-8 scenes). Each scene = exactly ONE video clip (~8s). One clip per scene, never B-rolls or extra angles.
- Budget math must work: 6 clips x ~5 credits = ~30 credits, leaving ~20 credits of headroom for retries within the daily free allowance.
- Every scene must be producible as: ONE still image (Text-to-Image) + ONE video (Frames-to-Video animating that still). Never require more than one generation per step.
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
You are the research desk and story architect of a premium documentary studio, in one pass.

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
You are the scriptwriter of a premium documentary studio.

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

const PAPERCUT_STYLE_BIBLE = `
STYLE BIBLE — VOX-STYLE PAPER CUT ANIMATION (every prompt inherits this, non-negotiable):
The visual language is layered paper cutout collage, like classic VOX explainer videos:
- Everything in frame looks CUT FROM PAPER: flat colored paper shapes with visible white torn/deckled edges, subtle drop shadows between layers, slight hand-made imperfection.
- Collage composition: characters, objects and buildings are simplified iconic paper cutouts arranged on a textured paper background (kraft paper, old map paper, or plain card stock).
- Optional mixed-media accents: paper labels, printed ephemera snippets, stamped textures, string-and-pushpin details — all rendered as paper.
- Faces are simplified (no photorealistic features); if a face is shown it is stylized, minimal, papercraft.
- Depth comes from stacked paper layers and shadows, NOT from photographic perspective or lens blur.
- Lighting is even and flat (studio light on a paper set) — no dramatic cinematic lighting, no lens flare, no photorealism, no 3D render look, no anime, no watercolor.
- In the VIDEO prompt, motion should feel like stop-motion paper animation: elements slide/slide/rise/settle in steps, layers shift with parallax, paper pieces rotate slightly, hands-off mechanical ease. No morphing, no fluid camera work.
`.trim();

export const scenePlannerPrompt = (opts: {
  story: string;
  scriptSections: string;
  aspectRatio: string;
}) => `
You are the scene planner of a premium documentary studio producing a VOX-style paper cut animation short for Google Flow.

STORY ARCHITECTURE (for tone and continuity):
${opts.story}

SCRIPT SECTIONS (narration and timings are fixed — do not rewrite them):
${opts.scriptSections}

${PAPERCUT_STYLE_BIBLE}

${FLOW_BUDGET_RULES}

ASPECT RATIO: ${opts.aspectRatio} — compose frames for this shape.

For EACH script section produce exactly ONE scene object with the same scene_number, start_time, end_time and narration.
Each scene object contains ONLY these fields — nothing else:
- scene_number, start_time, end_time, duration, narration (copy from the script section).
- visual_goal: what the viewer should understand from this frame, one sentence.
- image_prompt: the still frame, cut-from-paper collage style. Structure in one flowing paragraph: what is shown as paper cutouts (subject + supporting pieces) → the paper background it sits on → arrangement/depth (which layer overlaps which) → texture details (torn edges, paper grain, drop shadows) → flat even lighting → end with "paper cutout collage style, stop-motion papercraft, textured paper, ${opts.aspectRatio}". Self-contained: someone pasting it into Flow's Text-to-Image needs nothing else. 50-90 words. No real photography terms (no lens, no bokeh, no cinematic lighting).
- video_prompt: motion ONLY, animating that paper still, as a stop-motion paper animation. Structure in one short paragraph: which paper elements move and how (slide in, rise up, rotate slightly, stack) → paper-layer parallax → gentle push-in or drift if any (one move maximum) → end with "stop-motion paper animation, smooth stepped motion, ${opts.aspectRatio}". 30-60 words. Never restate the composition. No sound, no music, no text.

Return JSON only: { "scenes": [ { scene_number, start_time, end_time, duration, narration, visual_goal, image_prompt, video_prompt } ] } — the scenes array must contain one object per script section, in order, with NO additional fields.
`.trim();

export const regenerateScenePrompt = (opts: {
  scene: string;
  instruction?: string;
  neighbors: string;
}) => `
You are regenerating ONE scene of a VOX-style paper cut animation documentary.

CURRENT SCENE:
${opts.scene}

NEIGHBORING SCENES (for continuity):
${opts.neighbors}

${opts.instruction ? `USER INSTRUCTION (highest priority): ${opts.instruction}` : ""}

${PAPERCUT_STYLE_BIBLE}

Rewrite this scene to a higher standard. Keep scene_number, start_time, end_time and narration unchanged.
Return JSON only: a single scene object with ONLY these fields: scene_number, start_time, end_time, duration, narration, visual_goal, image_prompt, video_prompt.
- image_prompt: still frame as a layered paper cutout collage (cut paper shapes, torn edges, drop shadows, textured paper background, flat even lighting), ending with "paper cutout collage style, stop-motion papercraft".
- video_prompt: motion only, as stop-motion paper animation (sliding/rising/rotating paper pieces, layer parallax, one gentle camera move max), never restating the composition.
`.trim();
