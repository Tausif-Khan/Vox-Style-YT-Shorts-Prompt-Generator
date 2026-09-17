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
    a: "Yes. The tool is free to use — the site is supported by advertising. You provide your own Google API key for AI generation.",
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

      {/* Hero + Generator */}
      <div className="rules-bg relative">
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 pb-16 pt-32 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-1/3 -z-10 h-[28rem] rounded-full bg-amber-film/[0.07] blur-[130px]"
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
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_100%_at_50%_-30%,rgba(232,163,61,0.06),transparent)]"
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
                            ? "border-amber-film bg-amber-film/10 font-medium text-amber-film shadow-[0_0_0_3px_rgba(232,163,61,0.08)]"
                            : "border-ink-600 bg-ink-850/70 text-bone-300 hover:-translate-y-px hover:border-bone-400/30 hover:text-bone-100"
                        }`}
                      >
                        {d} sec
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  className="btn-primary h-12 px-6 text-base"
                  disabled={!topic.trim() || submitting}
                  onClick={submit}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Starting…
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

            {/* Pipeline strip */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
              {PIPELINE.map((step, i) => (
                <div key={step.label} className="flex items-center gap-2.5">
                  <div className="group flex items-center gap-2 rounded-full border border-ink-700/80 bg-ink-900/70 py-2 pl-3 pr-4 backdrop-blur transition hover:border-amber-film/40">
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
                  className="btn-ghost text-red-400/60 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
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
