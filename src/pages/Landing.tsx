import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Clapperboard,
  Film,
  Map,
  ScrollText,
  Sparkles,
  Timer,
  Volume2,
  Aperture,
  Layers,
  Clapperboard as Cut,
} from "lucide-react";

const PIPELINE = [
  { label: "Research", icon: ScrollText },
  { label: "Story", icon: Sparkles },
  { label: "Script", icon: Timer },
  { label: "Scenes", icon: Film },
  { label: "Visuals", icon: Map },
  { label: "Audio", icon: Volume2 },
  { label: "Edit", icon: Clapperboard },
];

const TOPICS = [
  "The History of Pizza",
  "Why Gold Is Valuable",
  "How Venice Was Built on Water",
  "Why Maps Put North at the Top",
  "How GPS Changed the World",
  "The History of Blue Jeans",
  "Why We Shake Hands",
  "How Dubai Became a Global City",
  "Why Diamonds Are So Expensive",
  "The History of Money",
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

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: [0.21, 0.47, 0.32, 0.98] as const },
});

export default function Landing() {
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
          <Link to="/dashboard" className="btn-secondary">
            Open Studio
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="rules-bg relative">
        <div className="relative mx-auto flex min-h-[96vh] max-w-6xl flex-col items-center justify-center px-6 pb-24 pt-32 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-1/3 -z-10 h-[28rem] rounded-full bg-amber-film/[0.07] blur-[130px]"
          />
          <motion.div {...fade(0)} className="mb-7 flex items-center gap-2.5 rounded-full border border-ink-600/80 bg-ink-900/70 px-4 py-1.5 backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-film opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-film" />
            </span>
            <span className="label-xs">AI Editorial Production System</span>
          </motion.div>

          <motion.h1
            {...fade(0.08)}
            className="max-w-5xl font-serif text-6xl font-bold leading-[1.04] tracking-tight text-bone-50 md:text-8xl"
          >
            One topic.
            <br />
            One complete{" "}
            <span className="italic text-amber-film">documentary.</span>
          </motion.h1>

          <motion.p
            {...fade(0.16)}
            className="mt-7 max-w-xl text-lg leading-relaxed text-bone-300"
          >
            Documentary Studio turns a single idea into a full production package —
            research, story, script, storyboard, visual bible, and camera-ready
            prompts for cinematic editorial shorts.
          </motion.p>

          <motion.div {...fade(0.24)} className="mt-10 flex flex-wrap items-center justify-center gap-3.5">
            <Link to="/dashboard" className="btn-primary h-11 px-7 text-[15px]">
              Open the Studio <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/new?topic=The%20History%20of%20Pizza" className="btn-secondary h-11 px-7 text-[15px]">
              <Cut className="h-4 w-4" /> Produce "The History of Pizza"
            </Link>
          </motion.div>

          {/* Pipeline strip */}
          <motion.div {...fade(0.38)} className="mt-24 w-full">
            <p className="label-xs mb-5">The production line</p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {PIPELINE.map((step, i) => (
                <div key={step.label} className="flex items-center gap-2.5">
                  <div className="group flex items-center gap-2 rounded-full border border-ink-700/80 bg-ink-900/70 py-2 pl-3 pr-4 backdrop-blur transition hover:border-amber-film/40">
                    <step.icon className="h-3.5 w-3.5 text-amber-film" strokeWidth={1.75} />
                    <span className="text-xs font-medium tracking-wide text-bone-200">
                      {step.label}
                    </span>
                  </div>
                  {i < PIPELINE.length - 1 && (
                    <span className="hidden text-ink-500 md:inline">→</span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Ticker */}
      <div className="relative border-y border-ink-700/80 bg-ink-900/40 py-4 backdrop-blur-sm">
        <div className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
          <div className="animate-ticker flex shrink-0 items-center gap-10 pr-10">
            {[...TOPICS, ...TOPICS].map((t, i) => (
              <span key={i} className="flex items-center gap-10 whitespace-nowrap">
                <span className="font-serif text-sm italic text-bone-300">{t}</span>
                <span className="h-1 w-1 rounded-full bg-amber-film/60" />
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-24">
        <div className="mb-14 max-w-2xl">
          <p className="label-xs mb-3">The System</p>
          <h2 className="font-serif text-4xl leading-tight text-bone-50 md:text-5xl">
            An AI production team,{" "}
            <span className="italic text-amber-film">on demand.</span>
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
              <Layers className="mb-4 h-4 w-4 text-amber-film" strokeWidth={1.75} />
              <h3 className="mb-2 font-serif text-xl text-bone-50">{f.title}</h3>
              <p className="relative text-sm leading-relaxed text-bone-300">{f.body}</p>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="panel relative mt-24 overflow-hidden px-8 py-16 text-center"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_120%,rgba(232,163,61,0.12),transparent)]"
          />
          <p className="label-xs mb-3">Start with a classic</p>
          <p className="mb-2 font-serif text-3xl italic text-bone-100 md:text-4xl">
            "The History of Pizza"
          </p>
          <p className="mx-auto mb-9 max-w-md text-sm text-bone-400">
            From topic to full production package in one run — research, script,
            storyboard, and prompts ready for the edit.
          </p>
          <Link to="/new?topic=The%20History%20of%20Pizza" className="btn-primary h-11 px-7 text-[15px]">
            Generate Your First Documentary <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="border-t border-ink-700/80 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <span className="flex items-center gap-2 text-xs text-bone-400">
            <Aperture className="h-3.5 w-3.5 text-amber-film" />
            Documentary Studio — Premium Editorial Explainer
          </span>
          <span className="text-xs text-bone-400">V1.1</span>
        </div>
      </footer>
    </div>
  );
}
