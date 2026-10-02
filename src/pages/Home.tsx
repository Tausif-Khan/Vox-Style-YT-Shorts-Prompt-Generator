import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useAction } from "convex/react";
import { motion } from "framer-motion";
import { api } from "../convex/_generated/api";
import { getClientUserId } from "../lib/client-user";
import type { DurationOption, VideoFormat } from "../lib/types";
import {
  FORMAT_ASPECT,
  FORMAT_DURATIONS,
  FORMAT_LABELS,
  durationLabel,
  resolveSceneCount,
} from "../lib/types";
import AdSlot from "../components/AdSlot";
import StudioMark from "../components/StudioMark";
import ProjectWorkspace from "./ProjectWorkspace";
import {
  Sparkles,
  Loader2,
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
    q: "Is Papercut Studio really free?",
    a: "Yes. Provide your name and email and the full package is free — no credit card, no trial period, no limits on ideas.",
  },
  {
    q: "Why do I need to provide my email?",
    a: "Just your name and email — no password. It keeps the tool spam-free (temporary email addresses are blocked) and lets you pick up your recent projects on any visit.",
  },
  {
    q: "What do you do with my email?",
    a: "Nothing besides keeping your projects tied to you. No spam, no selling data, no password to leak — because none is ever stored.",
  },
  {
    q: "What do I get from one topic?",
    a: "A complete production package: story architecture, a timed script broken into scenes, and copy-paste-ready image + video prompts for Google Flow — as a short or a long-form video, your choice.",
  },
  {
    q: "How long does generation take?",
    a: "Usually 1–3 minutes for all three steps. Results appear as each step finishes — you can watch the progress bar while you wait.",
  },
  {
    q: "Do I need experience with video editing or AI?",
    a: "Only a little. The tool generates multiple short videos — one clip per scene — plus separate images, so basic editing knowledge is needed to combine them into a single video with the narration. You don't need any AI experience: copy the prompts, paste them into Google Flow, and follow the four steps above.",
  },
  {
    q: "Can I edit or regenerate what it gives me?",
    a: "Yes. Every step can be regenerated on its own, and each scene can be regenerated individually until it's right.",
  },
  {
    q: "Can I use the videos I make commercially?",
    a: "Yes — everything the tool produces (scripts, prompts, text) is yours to publish on your channels, monetized or not.",
  },
];

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: [0.21, 0.47, 0.32, 0.98] as const },
});

// Format → duration options live in lib/types (shorts 60/90 @9:16,
// long-form 120/180 @16:9 with a much bigger prompt budget).

function fmtDur(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export default function Home() {
  const userId = getClientUserId();
  const createProject = useMutation(api.projects.create);
  const runPipeline = useAction(api.pipeline.startPipeline);
  const removeProject = useMutation(api.projects.remove);
  const projects = useQuery(api.projects.list, { userId }) ?? [];
  const registerLead = useMutation(api.leads.register);

  // Sign-in gate: name + email, stored locally (no passwords).
  const [user, setUser] = useState<{ name: string; email: string } | null>(() => {
    try {
      const raw = localStorage.getItem("docstudio_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  // Welcome popup: shown immediately on first load until name+email are saved.
  const [welcomeOpen, setWelcomeOpen] = useState(() => {
    try {
      return !localStorage.getItem("docstudio_user");
    } catch {
      return true;
    }
  });
  const [signInName, setSignInName] = useState("");
  const [signInEmail, setSignInEmail] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [signInError, setSignInError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    if (signingIn) return;
    setSignInError("");
    setSigningIn(true);
    try {
      const email = signInEmail.trim();
      const name = signInName.trim();
      if (!name) throw new Error("Please enter your name.");
      // COPPA age gate: the service is not directed to children under 13,
      // so we require an affirmative 13+ confirmation before collecting email.
      if (!ageConfirmed) {
        throw new Error("Please confirm you are 18 or older to continue.");
      }
      // Client-side domain check for instant feedback; server re-validates.
      const domain = email.toLowerCase().split("@")[1] ?? "";
      const allowed = [
        "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "yahoo.co.uk", "yahoo.ca", "yahoo.de", "yahoo.fr",
        "hotmail.com", "hotmail.co.uk", "outlook.com", "live.com", "msn.com", "icloud.com", "me.com", "mac.com",
        "aol.com", "proton.me", "protonmail.com", "gmx.com", "gmx.de", "mail.com", "zoho.com", "yandex.com", "yandex.ru", "rediffmail.com",
      ];
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !allowed.includes(domain)) {
        throw new Error(
          "Please use an email address from a well-known provider (Gmail, Yahoo, Hotmail/Outlook, iCloud, etc.)."
        );
      }
      await registerLead({ name, email, ageConfirmed });
      const session = { name, email: email.toLowerCase() };
      localStorage.setItem("docstudio_user", JSON.stringify(session));
      setUser(session);
      setWelcomeOpen(false);
    } catch (err) {
      setSignInError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSigningIn(false);
    }
  };

  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState<VideoFormat>("short");
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

  // Live elapsed timer for the end-to-end pipeline run.
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    if (!generating) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [generating]);

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
        aspect_ratio: FORMAT_ASPECT[format],
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
      {/* ── Welcome modal: the FIRST thing shown on first load ── */}
      {welcomeOpen && !user && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0e0b15]/80 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Start creating"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="panel relative w-full max-w-md overflow-hidden p-6 text-left"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_100%_at_50%_-30%,rgba(232,163,61,0.09),transparent)]"
            />
            <h2 className="relative mb-1 font-serif text-2xl text-bone-50">Start creating</h2>
            <p className="relative mb-5 text-sm leading-relaxed text-bone-300">
              Free forever — just your name and email. No password, ever.
            </p>
            <label className="label-xs relative mb-2 block">Your name</label>
            <input
              autoFocus
              value={signInName}
              onChange={(e) => setSignInName(e.target.value)}
              placeholder="Jane Creator"
              className="input-dark relative mb-4 w-full"
              maxLength={80}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSignIn();
              }}
            />
            <label className="label-xs relative mb-2 block">Email address</label>
            <input
              value={signInEmail}
              onChange={(e) => setSignInEmail(e.target.value)}
              placeholder="you@gmail.com"
              type="email"
              className="input-dark relative mb-1 w-full"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSignIn();
              }}
            />
            <p className="relative mb-4 text-[11px] leading-relaxed text-bone-400/80">
              Gmail, Yahoo, Hotmail/Outlook, iCloud or other major providers —
              temporary email addresses are blocked.
            </p>
            {signInError && (
              <p className="relative mb-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-300">
                {signInError}
              </p>
            )}
            {/* COPPA age gate (required before we collect an email) */}
            <label className="relative mb-4 flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#e8a33d]"
              />
              <span className="text-[11px] leading-relaxed text-bone-400">
                I confirm I am <span className="font-semibold text-bone-200">18 years of age or older</span>.
                This service is not intended for children under 13, and we do not knowingly
                collect information from them.
              </span>
            </label>
            <button
              className="btn-primary relative h-12 w-full text-base"
              disabled={signingIn}
              onClick={() => void handleSignIn()}
            >
              {signingIn ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Start creating
                </>
              )}
            </button>
            <p className="relative mt-3 text-center text-[11px] text-bone-400/70">
              By continuing you agree to our{" "}
              <Link to="/legal" className="underline underline-offset-2 hover:text-bone-200">Terms</Link>{" "}
              and{" "}
              <Link to="/legal#privacy" className="underline underline-offset-2 hover:text-bone-200">Privacy Policy</Link>.
            </p>
          </motion.div>
        </div>
      )}

      {/* Nav */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-film/10 ring-1 ring-amber-film/30">
              <StudioMark className="h-5 w-5 text-amber-film" />
            </span>
            <span className="text-[13px] font-bold tracking-[0.16em] text-bone-100">
              PAPERCUT STUDIO
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
          <AdSlot unit="sidebar" className="w-40" minHeight={450} />
        </div>
      </div>
      {/* Right ad rail (desktop only) */}
      <div className="pointer-events-none fixed right-4 top-1/2 z-10 hidden -translate-y-1/2 xl:block">
        <div className="pointer-events-auto">
          <AdSlot unit="sidebar" className="w-40" minHeight={450} />
        </div>
      </div>

      {/* Hero + Generator */}
      <div className="rules-bg relative">
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 pb-16 pt-32 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-1/3 -z-10 h-[28rem] rounded-full bg-[#e8a33d]/[0.08] blur-[130px]"
          />
          <motion.h1
            {...fade(0)}
            className="max-w-6xl font-serif text-5xl font-bold leading-[1.05] tracking-tight text-bone-50 md:text-7xl"
          >
            One topic. One complete <span className="italic text-amber-film">documentary.</span>
          </motion.h1>

          <motion.p
            {...fade(0.16)}
            className="mt-6 max-w-2xl text-lg leading-relaxed text-bone-300"
          >
            Free tool. Share your name and email, then get the story, the timed
            script, and Flow-ready image + video prompts — everything you need,
            from shorts to long-form videos.
          </motion.p>

          {/* ── THE GENERATOR (tool section) ── */}
          <section id="generator" className="w-full scroll-mt-24 pt-14">
            {!user ? (
              /* ── Gate teaser — the full form opens in the welcome modal ── */
              <div className="panel relative mx-auto max-w-md overflow-hidden p-6 text-center">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_100%_at_50%_-30%,rgba(232,163,61,0.09),transparent)]"
                />
                <h2 className="relative mb-1 font-serif text-2xl text-bone-50">Start creating</h2>
                <p className="relative mb-5 text-sm leading-relaxed text-bone-300">
                  Free forever — just your name and email. No password, ever.
                </p>
                <button
                  className="btn-primary relative h-12 w-full text-base"
                  onClick={() => setWelcomeOpen(true)}
                >
                  <Sparkles className="h-4 w-4" /> Start creating
                </button>
                <p className="relative mt-3 text-center text-[11px] text-bone-400/70">
                  By continuing you agree to our{" "}
                  <Link to="/legal" className="underline underline-offset-2 hover:text-bone-200">Terms</Link>{" "}
                  and{" "}
                  <Link to="/legal#privacy" className="underline underline-offset-2 hover:text-bone-200">Privacy Policy</Link>.
                </p>
              </div>
            ) : (
              /* ── The generator (unlocked) ── */
              <div className="panel relative mx-auto max-w-2xl overflow-hidden p-6 text-left">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_100%_at_50%_-30%,rgba(232,163,61,0.09),transparent)]"
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
                <div className="flex flex-wrap gap-5">
                  <div>
                    <label className="label-xs mb-2 block">Format</label>
                    <div className="flex gap-2">
                      {(Object.keys(FORMAT_DURATIONS) as VideoFormat[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => {
                            setFormat(f);
                            setDuration(FORMAT_DURATIONS[f][0]);
                          }}
                          className={`rounded-lg border px-4 py-2 text-sm transition-all duration-150 ${
                            format === f
                              ? "border-white/70 bg-white/15 font-medium text-white shadow-[0_0_0_3px_rgba(232,163,61,0.18)]"
                              : "border-ink-600 bg-ink-850/70 text-bone-300 hover:-translate-y-px hover:border-bone-400/30 hover:text-bone-100"
                          }`}
                        >
                          {FORMAT_LABELS[f]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label-xs mb-2 block">Duration</label>
                    <div className="flex gap-2">
                      {FORMAT_DURATIONS[format].map((d) => (
                        <button
                          key={d}
                          onClick={() => setDuration(d)}
                          className={`rounded-lg border px-4 py-2 text-sm transition-all duration-150 ${
                            duration === d
                              ? "border-white/70 bg-white/15 font-medium text-white shadow-[0_0_0_3px_rgba(232,163,61,0.18)]"
                              : "border-ink-600 bg-ink-850/70 text-bone-300 hover:-translate-y-px hover:border-bone-400/30 hover:text-bone-100"
                          }`}
                        >
                          {durationLabel(d)}
                        </button>
                      ))}
                    </div>
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
                {format === "short" ? (
                  <>
                    Sized for Google Flow's free plan — {resolveSceneCount(duration)} papercut scenes
                    on Veo Light leaves daily credits to spare.
                  </>
                ) : (
                  <>
                    Long-form 16:9 — {resolveSceneCount(duration)} papercut scenes for a deeper cut.
                    At ~5 credits per clip that's about {resolveSceneCount(duration) * 5} of your ~50
                    daily free credits, so render it across a day or two.
                  </>
                )}
              </p>
              </div>
            )}

            {/* Live pipeline progress — visible while generating */}
            {activeId && generating && (
              <div id="progress-card" className="panel sheen mx-auto mt-6 max-w-2xl border-white/30 p-5 shadow-[0_0_40px_-12px_rgba(232,163,61,0.35)]">
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
                  {activeProject?.pipeline_completed_at && activeProject?.pipeline_started_at
                    ? `Pipeline finished in ${fmtDur(activeProject.pipeline_completed_at - activeProject.pipeline_started_at)}.`
                    : activeProject?.pipeline_started_at
                      ? `${fmtDur(nowTick - activeProject.pipeline_started_at)} elapsed — results appear as each step finishes.`
                      : "This usually takes 1–3 minutes — you can scroll below, results appear as each step finishes."}
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
          <AdSlot unit="banner" className="mt-12 w-full max-w-4xl" minHeight={110} />
        </div>
      </div>

      {/* Recent projects */}
      {projects.length > 0 && (
        <div className="mx-auto max-w-6xl px-6 pb-4">
          <div className="mb-5 text-center">
            <p className="label-xs mb-2">Your Projects</p>
            <h2 className="font-serif text-3xl text-bone-50">Pick up where you left off</h2>
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
                    {durationLabel(p.duration)} · {p.status}
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

      {/* ── HOW TO USE IN GOOGLE FLOW ── (between the two ad blocks) */}
      <div id="how-to-flow" className="mx-auto max-w-6xl scroll-mt-24 px-6 pb-8">
        <div className="mb-10 max-w-2xl mx-auto text-center">
          <p className="label-xs mb-3">From Prompts to Video</p>
          <h2            className="mx-auto max-w-3xl font-serif text-4xl leading-tight text-bone-50 md:text-5xl"
          >
            Turn your prompts into a finished short — <span className="italic text-amber-film">in Google Flow.</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-bone-300">
            Every scene is a VOX-style paper cut animation, built for Google Flow's free
            plan. Here is the exact workflow, scene by scene:
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
              title: "2 · Generate the image (nano banana)",
              body: "At labs.google/flow, start a new project and set the aspect ratio to match your format — 9:16 for shorts, 16:9 for long-form. Click on the image and select the nano banana model, then paste the image prompt and generate. This is your scene's opening frame.",
            },
            {
              icon: Video,
              title: "3 · Turn the frame into a video (Veo Light)",
              body: "Add your generated still as an ingredient or frame in a new Flow shot. Select the frame, pick the Veo Light model, paste the video prompt, and generate. At ~5 credits per clip, a 6-scene short costs about 30 of your ~50 daily free credits — leaving room for retries.",
            },
            {
              icon: Clapperboard,
              title: "4 · Assemble & voice it",
              body: "Repeat for each scene, then stitch the clips in any editor (CapCut works). Record the narration from the Script tab and export.",
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
            generate your stills first — they cost fewer credits than video. Scene counts (4–8)
            are sized so a full papercut short on Veo Light fits within Flow's ~50 free daily credits.
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

      {/* In-content ad (between the guide and the system section) */}
      <div className="mx-auto max-w-6xl px-6 pb-24">
        <AdSlot unit="banner" className="w-full" minHeight={110} />
      </div>

      {/* Features */}
      <div className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-14 max-w-2xl mx-auto text-center">
          <p className="label-xs mb-3">The System</p>
          <h2            className="mx-auto max-w-3xl font-serif text-4xl leading-tight text-bone-50 md:text-5xl"
          >
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

        {/* In-content ad (below recent projects) */}
        <AdSlot unit="banner" className="mt-14 w-full" minHeight={110} />
      </div>


      <div className="mx-auto max-w-3xl px-6 pb-24">
        <p className="label-xs mb-3 text-center">Questions</p>
        <h2 className="mb-10 text-center font-serif text-4xl text-bone-50">FAQ</h2>        <div className="space-y-3">
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
            <StudioMark className="h-4 w-4 text-amber-film" />
            Papercut Studio — Free VOX-Style Shorts Generator
          </span>
          <nav className="flex items-center gap-4 text-xs text-bone-400">
            <Link to="/legal" className="hover:text-bone-200">Privacy & Terms</Link>
            <Link to="/legal#dmca" className="hover:text-bone-200">DMCA</Link>
            <Link to="/contact" className="hover:text-bone-200">Contact Us</Link>
          </nav>
          <span className="text-xs text-bone-400/60">
            Free forever · V2.0
          </span>
        </div>
      </footer>
    </div>
  );
}
