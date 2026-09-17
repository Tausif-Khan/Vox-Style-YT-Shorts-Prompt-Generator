import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useAction } from "convex/react";
import { motion } from "framer-motion";
import { api } from "../convex/_generated/api";
import { getClientUserId } from "../lib/client-user";
import type { DurationOption } from "../lib/types";
import AdSlot from "../components/AdSlot";
import ProjectWorkspace from "./ProjectWorkspace";
import {
  Sparkles,
  Loader2,
  Aperture,
  Film,
  Timer,
  Trash2,
  Copy,
  Image,
  Video,
  Clapperboard,
  ExternalLink,
} from "lucide-react";

const PIPELINE = [
  { label: "Story", icon: Sparkles },
  { label: "Script", icon: Timer },
  { label: "Scene Prompts", icon: Film },
];

const FEATURES = [
  {
    num: "01",
    title: "Editorial Research",
    body: "A rigorous fact dossier before a single frame is planned — timelines, key events, misconceptions, and disputed claims flagged honestly.",
  },
  {
    num: "02",
    title: "Story Architecture",
    body: "A hook, a central question, escalating reveals, and a payoff. The system thinks like an editorial team, not a chatbot.",
  },
  {
    num: "03",
    title: "Scene-by-Scene Direction",
    body: "Maps for migration, macro for detail, archival for history. The right visual method for every beat — never generic footage.",
  },
  {
    num: "04",
    title: "Flow-Ready Prompts",
    body: "Detailed image prompts and motion-only video prompts, composed for your frame and ready for Google Flow.",
  },
];

const FAQ = [
  {
    q: "Is Documentary Studio really free?",
    a: "Yes. The tool is free to use — the site is supported by advertising. AI generation runs on a free DeepSeek model via TokenHarbor.",
  },
  {
    q: "What do I get from one topic?",
    a: "A complete production package: story architecture, a timed script broken into scenes, and copy-paste-ready image + video prompts for Google Flow.",
  },
  {
    q: "How many scenes per documentary?",
    a: "Scenes are scaled to respect free Google Flow generation limits: 6 scenes for 30 seconds, 8 for 60 seconds, 10 for 90 seconds.",
  },
  {
    q: "Where do the prompts work best?",
    a: "Google Flow (free tier supported). Image prompts are self-contained stills; video prompts describe motion only, ready to paste directly.",
  },
];

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: [0.21, 0.47, 0.32, 0.98] as const },
});

const DURATIONS: DurationOption[] = [30, 60, 90];
function resolveSceneCount(duration: number): number {
  if (duration <= 30) return 6;
  if (duration <= 60) return 8;
  return 10;
}

export default function Home() {
  const userId = getClientUserId();
  const createProject = useMutation(api.projects.create);
  const runPipeline = useAction(api.pipeline.startPipeline);
  const removeProject = useMutation(api.projects.remove);
  const projects = useQuery(api.projects.list, { userId }) ?? [];

  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState<DurationOption>(60);
  const [submitting, setSubmitting] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Live progress: watch the active project's stage statuses.
  const activeProject = useQuery(
    api.projects.get,
    activeId ? { id: activeId as any, userId } : "skip"
  );
  const stages = activeProject?.stage_status as Record<string, string> | undefined;
  const completedCount = stages
    ? ["story", "script", "scenes"].filter((k) => stages[k] === "COMPLETED").length
    : 0;
  const anyGenerating = stages
    ? ["story", "script", "scenes"].some((k) => stages[k] === "GENERATING")
    : false;
  const anyFailed = stages
    ? ["story", "script", "scenes"].some((k) => stages[k] === "FAILED")
    : false;
  // Progress bar: completed/3, plus partial credit while the current stage runs.
  const progress = Math.min(100, Math.round(((completedCount + (anyGenerating ? 0.5 : 0)) / 3) * 100));
  const generating =
    submitting || (activeId !== null && (anyGenerating || (progress < 100 && !anyFailed && stages !== undefined)));
  const [justStarted, setJustStarted] = useState(false);

  // Scroll the progress card into view when a generation kicks off.
  useEffect(() => {
    if (justStarted) {
      document.getElementById("progress-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
      setJustStarted(false);
    }
  }, [justStarted, activeId]);

  // Show the workspace inline when arriving at /?project=<id> or when just created.
  useEffect(() => {
    const qp = new URLSearchParams(window.location.search).get("project");
    if (qp) setActiveId(qp);
  }, []);

  const submit = async () => {
    if (!topic.trim() || submitting) return;
    setSubmitting(true);
    try {
      const newId = await createProject({
        userId,
        title: topic.trim(),
        topic: topic.trim(),
        duration,
        aspect_ratio: "9:16",
        language: "English",
        scene_count: resolveSceneCount(duration),
        story_type: "auto",
      });
      setActiveId(newId);
      setJustStarted(true);
      window.history.replaceState(null, "", `/?project=${newId}`);
      void runPipeline({ projectId: newId }).catch((err) =>
        console.error("Generation failed", err)
      );
    } catch (err) {
      console.error("Project creation failed", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative overflow-x-clip">
      {/* Nav */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-film/10 ring-1 ring-amber-film/30">
              <Aperture className="h-4 w-4 text-amber-film" strokeWidth={1.75} />
            </span>
            <span className="text-[13px] font-bold tracking-[0.16em] text-bone-100">
              DOCUMENTARY STUDIO
            </span>
          </Link>
          <a href="#generator" className="btn-secondary">
            Open the Tool
          </a>
        </div>
      </header>

      {/* Left ad rail (desktop only) */}
      <div className="pointer-events-none fixed left-4 top-1/2 z-10 hidden -translate-y-1/2 xl:block">
        <div className="pointer-events-auto">
          <AdSlot slot={import.meta.env.VITE_ADSENSE_SLOT_LEFT} format="vertical" className="w-40" minHeight={450} />
        </div>
      </div>
      {/* Right ad rail (desktop only) */}
      <div className="pointer-events-none fixed right-4 top-1/2 z-10 hidden -translate-y-1/2 xl:block">
        <div className="pointer-events-auto">
          <AdSlot slot={import.meta.env.VITE_ADSENSE_SLOT_RIGHT} format="vertical" className="w-40" minHeight={450} />
        </div>
      </div>

      {/* Hero + Generator */}
      <div className="rules-bg relative">
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 pb-16 pt-32 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-1/3 -z-10 h-[28rem] rounded-full bg-[#7dd3c8]/[0.09] blur-[130px]"
          />
          <motion.div
            {...fade(0)}
            className="mb-7 flex items-center gap-2.5 rounded-full border border-ink-600/80 bg-ink-900/70 px-4 py-1.5 backdrop-blur"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-film opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-film" />
            </span>
            <span className="label-xs">Free AI Editorial Production System</span>
          </motion.div>

          <motion.h1
            {...fade(0.08)}
            className="max-w-5xl font-serif text-5xl font-bold leading-[1.05] tracking-tight text-bone-50 md:text-7xl"
          >
            One topic.
            <br />
            One complete <span className="italic text-amber-film">documentary.</span>
          </motion.h1>

          <motion.p
            {...fade(0.16)}
            className="mt-6 max-w-xl text-lg leading-relaxed text-bone-300"
          >
            Free tool, no sign-up. Get the story, the timed script, and Flow-ready
            image + video prompts — everything you need for a cinematic editorial short.
          </motion.p>

          {/* ── THE GENERATOR (tool section) ── */}
          <section id="generator" className="w-full scroll-mt-24 pt-14">
            <div className="panel relative mx-auto max-w-2xl overflow-hidden p-6 text-left">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_100%_at_50%_-30%,rgba(125,211,200,0.08),transparent)]"
              />
              <label className="label-xs relative mb-3 block">Your topic</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="The History of Pizza"
                rows={2}
                className="input-dark relative resize-none font-serif text-xl leading-relaxed"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                }}
              />

              <div className="relative mt-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <label className="label-xs mb-2 block">Duration</label>
                  <div className="flex gap-2">
                    {DURATIONS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        className={`rounded-lg border px-4 py-2 text-sm transition-all duration-150 ${
                          duration === d
                            ? "border-white/70 bg-white/15 font-medium text-white shadow-[0_0_0_3px_rgba(125,211,200,0.15)]"
                            : "border-ink-600 bg-ink-850/70 text-bone-300 hover:-translate-y-px hover:border-bone-400/30 hover:text-bone-100"
                        }`}
                      >
                        {d} sec
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  className={`btn-primary h-12 px-6 text-base ${generating ? "btn-generating" : ""}`}
                  disabled={!topic.trim() || submitting}
                  onClick={submit}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Starting…
                    </>
                  ) : generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Working…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Generate
                    </>
                  )}
                </button>
              </div>
              <p className="relative mt-4 text-xs text-bone-400/80">
                Scenes stay lean to respect free Google Flow generation limits —{" "}
                {resolveSceneCount(duration)} prompts for {duration} sec.
              </p>
            </div>

            {/* Live pipeline progress — visible while generating */}
            {activeId && generating && (
              <div id="progress-card" className="panel sheen mx-auto mt-6 max-w-2xl border-white/30 p-5 shadow-[0_0_40px_-12px_rgba(125,211,200,0.35)]">
                <div className="mb-3 flex items-center justify-between">
                  <p className="label-xs">Generating your documentary</p>
                  <span className="text-xs font-semibold text-amber-film">{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink-700">
                  <div className="progress-fill h-full rounded-full" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-3 flex justify-between text-[11px]">
                  {PIPELINE.map((step, i) => {
                    const done = completedCount > i;
                    const active = !done && (anyGenerating ? completedCount === i : false);
                    return (
                      <span
                        key={step.label}
                        className={`flex items-center gap-1.5 ${done ? "text-emerald-300" : active ? "text-amber-film" : "text-bone-400/60"}`}
                      >
                        {done ? "✓" : active ? <Loader2 className="h-3 w-3 animate-spin" /> : "○"}
                        {step.label}
                      </span>
                    );
                  })}
                </div>
                <p className="mt-3 text-center text-[11px] text-bone-400/80">
                  This usually takes 1–3 minutes — you can scroll below, results appear as each step finishes.
                </p>
              </div>
            )}

            {/* Pipeline strip */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
              {PIPELINE.map((step, i) => (
                <div key={step.label} className="flex items-center gap-2.5">
                  <div className="group flex items-center gap-2 rounded-full border border-white/20 bg-white/10 py-2 pl-3 pr-4 backdrop-blur transition hover:border-white/40">
                    <step.icon className="h-3.5 w-3.5 text-amber-film" strokeWidth={1.75} />
                    <span className="text-xs font-medium tracking-wide text-bone-200">
                      {step.label}
                    </span>
                  </div>
                  {i < PIPELINE.length - 1 && <span className="hidden text-ink-500 md:inline">→</span>}
                </div>
              ))}
            </div>
          </section>

          {/* ── INLINE WORKSPACE (active generation) ── */}
          {activeId && (
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mx-auto w-full max-w-5xl scroll-mt-24 pt-14 text-left"
            >
              <ProjectWorkspace projectId={activeId} compact />
            </motion.section>
          )}

          {/* Leaderboard ad — below the fold of the tool */}
          <AdSlot className="mt-12 w-full max-w-4xl" minHeight={110} />
        </div>
      </div>

      {/* Recent projects */}
      {projects.length > 0 && (
        <div className="mx-auto max-w-6xl px-6 pb-4">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="label-xs mb-2">Your Projects</p>
              <h2 className="font-serif text-3xl text-bone-50">Pick up where you left off</h2>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {projects.slice(0, 6).map((p) => (
              <div
                key={p._id}
                className="panel panel-hover group flex cursor-pointer items-center justify-between p-4"
                onClick={() => {
                  setActiveId(p._id);
                  window.history.replaceState(null, "", `/?project=${p._id}`);
                  document.getElementById("generator")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <div className="min-w-0">
                  <h3 className="truncate font-serif text-base text-bone-50">{p.title}</h3>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-bone-400">
                    {p.duration} sec · {p.status}
                  </p>
                </div>
                <button
                  className="btn-ghost text-red-300/70 opacity-0 transition hover:text-red-300 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${p.title}"?`)) void removeProject({ id: p._id, userId });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* In-content ad */}
      <div className="mx-auto max-w-6xl px-6 py-8">
        <AdSlot className="w-full" minHeight={110} />
      </div>

      {/* Features */}
      <div className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-14 max-w-2xl">
          <p className="label-xs mb-3">The System</p>
          <h2 className="font-serif text-4xl leading-tight text-bone-50 md:text-5xl">
            An AI production team, <span className="italic text-amber-film">on demand.</span>
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: (i % 2) * 0.08 }}
              className="panel panel-hover relative overflow-hidden p-7"
            >
              <span className="pointer-events-none absolute -right-2 -top-4 select-none font-serif text-8xl font-bold text-ink-700/60">
                {f.num}
              </span>
              <h3 className="mb-2 font-serif text-xl text-bone-50">{f.title}</h3>
              <p className="relative text-sm leading-relaxed text-bone-300">{f.body}</p>
            </motion.div>
          ))}
        </div>

        {/* Ad between features and FAQ */}
        <AdSlot className="mt-14 w-full" minHeight={110} />
      </div>

      {/* ── HOW TO USE IN GOOGLE FLOW ── */}
      <div id="how-to-flow" className="mx-auto max-w-6xl scroll-mt-24 px-6 pb-24">
        <div className="mb-10 max-w-2xl">
          <p className="label-xs mb-3">From Prompts to Video</p>
          <h2 className="font-serif text-4xl leading-tight text-bone-50 md:text-5xl">
            Turn your prompts into a finished short — <span className="italic text-amber-film">in Google Flow.</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-bone-300">
            Every scene in the Scenes tab is built for Google Flow (free accounts work great).
            Here is the exact workflow, scene by scene:
          </p>
        </div>
        <ol className="grid gap-4 md:grid-cols-2">
          {[
            {
              icon: Copy,
              title: "1 · Copy a scene's prompts",
              body: "Open the Scenes tab (or Export for everything at once). Each scene card has a one-tap Copy button for its image prompt and video prompt.",
            },
            {
              icon: Image,
              title: "2 · Create the still in Flow",
              body: "At labs.google/flow, start a new project, set the aspect ratio to 9:16, and paste the image prompt into Text-to-Image. This is your scene's opening frame.",
            },
            {
              icon: Video,
              title: "3 · Animate it with the video prompt",
              body: "Use Flow's Frames-to-Video with the still you just made, then paste the video prompt. It describes motion only — camera drifts, flickers, movement — which is exactly what Flow wants.",
            },
            {
              icon: Clapperboard,
              title: "4 · Assemble & voice it",
              body: "Repeat for each scene, then stitch the clips in any editor (CapCut works). Record the narration from the Script tab, add the on-screen text and sound notes from each scene card, and export.",
            },
          ].map((step, i) => (
            <motion.li
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: (i % 2) * 0.08 }}
              className="panel panel-hover relative overflow-hidden p-7"
            >
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-film/10 ring-1 ring-amber-film/30">
                <step.icon className="h-5 w-5 text-amber-film" strokeWidth={1.75} />
              </span>
              <h3 className="mb-2 font-serif text-xl text-bone-50">{step.title}</h3>
              <p className="relative text-sm leading-relaxed text-bone-300">{step.body}</p>
            </motion.li>
          ))}
        </ol>
        <div className="panel-soft mt-4 flex flex-wrap items-center justify-between gap-4 p-5">
          <p className="text-sm leading-relaxed text-bone-300">
            <span className="font-semibold text-bone-100">Free-account tip:</span>{" "}
            generate your stills first — they cost fewer credits than video. Our scene counts (6–10)
            are sized so a full documentary fits comfortably within Flow's free daily generations.
          </p>
          <a
            href="https://labs.google/flow"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary shrink-0"
          >
            Open Google Flow <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* FAQ */}
      <div className="mx-auto max-w-3xl px-6 pb-24">
        <p className="label-xs mb-3 text-center">Questions</p>
        <h2 className="mb-10 text-center font-serif text-4xl text-bone-50">FAQ</h2>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="panel group p-5">
              <summary className="cursor-pointer list-none font-serif text-lg text-bone-50 marker:hidden">
                <span className="mr-2 text-amber-film group-open:hidden">+</span>
                <span className="mr-2 hidden text-amber-film group-open:inline">–</span>
                {f.q}
              </summary>
              <p className="mt-3 pl-6 text-sm leading-relaxed text-bone-300">{f.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-ink-700/80 py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6">
          <span className="flex items-center gap-2 text-xs text-bone-400">
            <Aperture className="h-3.5 w-3.5 text-amber-film" />
            Documentary Studio — Free AI Editorial Explainer
          </span>
          <span className="text-xs text-bone-400/60">
            Supported by advertising · V2.0
          </span>
        </div>
      </footer>
    </div>
  );
}
