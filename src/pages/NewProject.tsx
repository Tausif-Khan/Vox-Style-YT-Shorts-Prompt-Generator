import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { getClientUserId } from "../lib/client-user";
import { STORY_TYPE_LABELS, type DurationOption, type SceneCount, type StoryType, type AspectRatio } from "../lib/types";
import { Loader2, Sparkles, Aperture } from "lucide-react";

const DURATIONS: DurationOption[] = [30, 60, 90];
const RATIOS: AspectRatio[] = ["9:16", "16:9"];
const SCENE_COUNTS: (SceneCount)[] = ["auto", 8, 10, 12, 15];
const STORY_TYPES = Object.keys(STORY_TYPE_LABELS) as StoryType[];

export default function NewProject() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const userId = getClientUserId();
  const createProject = useMutation(api.projects.create);
  const runPipeline = useAction(api.pipeline.startPipeline);

  const [topic, setTopic] = useState(params.get("topic") ?? "");
  const [duration, setDuration] = useState<DurationOption>(60);
  const [aspect, setAspect] = useState<AspectRatio>("9:16");
  const [sceneCount, setSceneCount] = useState<SceneCount>("auto");
  const [storyType, setStoryType] = useState<StoryType>("auto");
  const [customDirection, setCustomDirection] = useState("");
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
        aspect_ratio: aspect,
        language: "English",
        scene_count: sceneCount,
        story_type: storyType,
        custom_story_direction: customDirection.trim() || undefined,
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

  const Chip = ({
    active,
    onClick,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      className={`rounded-lg border px-4 py-2 text-sm transition-all duration-150 ${
        active
          ? "border-amber-film bg-amber-film/10 font-medium text-amber-film shadow-[0_0_0_3px_rgba(232,163,61,0.08)]"
          : "border-ink-600 bg-ink-850/70 text-bone-300 hover:-translate-y-px hover:border-bone-400/30 hover:text-bone-100"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <p className="label-xs mb-2">Configure</p>
      <h1 className="mb-8 font-serif text-4xl text-bone-50">New Documentary</h1>

      <div className="panel relative mb-6 overflow-hidden p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_100%_at_50%_-30%,rgba(232,163,61,0.06),transparent)]"
        />
        <label className="label-xs relative mb-3 block">What should this documentary explain?</label>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="The History of Pizza"
          rows={2}
          className="input-dark relative resize-none font-serif text-xl leading-relaxed"
        />
      </div>

      <div className="panel mb-6 space-y-5 p-6">
        <div>
          <label className="label-xs mb-2 block">Duration</label>
          <div className="flex gap-2">
            {DURATIONS.map((d) => (
              <Chip key={d} active={duration === d} onClick={() => setDuration(d)}>
                {d} sec
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <label className="label-xs mb-2 block">Aspect Ratio</label>
          <div className="flex gap-2">
            {RATIOS.map((r) => (
              <Chip key={r} active={aspect === r} onClick={() => setAspect(r)}>
                {r}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <label className="label-xs mb-2 block">Scenes</label>
          <div className="flex flex-wrap gap-2">
            {SCENE_COUNTS.map((s) => (
              <Chip key={String(s)} active={sceneCount === s} onClick={() => setSceneCount(s)}>
                {s === "auto" ? "Auto" : s}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <label className="label-xs mb-2 block">Story Type</label>
          <div className="flex flex-wrap gap-2">
            {STORY_TYPES.map((st) => (
              <Chip key={st} active={storyType === st} onClick={() => setStoryType(st)}>
                {STORY_TYPE_LABELS[st]}
              </Chip>
            ))}
          </div>
          {storyType === "custom" && (
            <textarea
              value={customDirection}
              onChange={(e) => setCustomDirection(e.target.value)}
              placeholder="Describe the angle you want…"
              rows={2}
              className="input-dark mt-3"
            />
          )}
        </div>

        <div>
          <label className="label-xs mb-2 block">Visual Style</label>
          <div className="flex items-center gap-2.5 rounded-lg border border-amber-film/25 bg-amber-film/5 px-4 py-3 text-sm font-medium text-amber-film">
            <Aperture className="h-4 w-4" strokeWidth={1.75} /> Premium Editorial Explainer
          </div>
        </div>
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
        Research → Story → Script → Scenes → Visuals → Edit — every stage is reviewable and re-runnable.
      </p>
    </div>
  );
}
