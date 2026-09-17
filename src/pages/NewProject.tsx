import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { getClientUserId } from "../lib/client-user";
import type { DurationOption } from "../lib/types";
import { Loader2, Sparkles } from "lucide-react";

const DURATIONS: DurationOption[] = [30, 60, 90];

/** ponytail: mirror of server-side resolveSceneCount — resolve "auto" to the free-Flow budget. */
function resolveSceneCount(duration: number): number {
  if (duration <= 30) return 6;
  if (duration <= 60) return 8;
  return 10;
}

export default function NewProject() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const userId = getClientUserId();
  const createProject = useMutation(api.projects.create);
  const runPipeline = useAction(api.pipeline.startPipeline);

  const [topic, setTopic] = useState(params.get("topic") ?? "");
  const [duration, setDuration] = useState<DurationOption>(60);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const t = params.get("topic");
    if (t) setTopic(t);
  }, [params]);

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
      // Navigate immediately — the workspace shows live stage progress;
      // generation continues in the background and failures are retryable there.
      navigate(`/project/${newId}`);
      void runPipeline({ projectId: newId }).catch((err) => {
        console.error("Generation failed", err);
      });
    } catch (err) {
      console.error("Project creation failed", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-8 py-12">
      <p className="label-xs mb-2">New Documentary</p>
      <h1 className="mb-8 font-serif text-4xl text-bone-50">What's your topic?</h1>

      <div className="panel relative mb-6 overflow-hidden p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_100%_at_50%_-30%,rgba(232,163,61,0.06),transparent)]"
        />
        <label className="label-xs relative mb-3 block">One topic in. A full production package out.</label>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="The History of Pizza"
          rows={2}
          autoFocus
          className="input-dark relative resize-none font-serif text-xl leading-relaxed"
        />
      </div>

      <div className="panel mb-6 p-6">
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
        <p className="mt-3 text-xs text-bone-400/80">
          Scenes stay lean to respect free Google Flow generation limits —
          {resolveSceneCount(duration)} prompts for {duration} sec.
        </p>
      </div>

      <button
        className="btn-primary h-12 w-full text-base"
        disabled={!topic.trim() || submitting}
        onClick={submit}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Building your documentary…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" /> Generate Documentary
          </>
        )}
      </button>
      <p className="mt-3 text-center text-xs text-bone-400/70">
        Story → Script → Scene prompts. Every stage is reviewable and re-runnable.
      </p>
    </div>
  );
}
