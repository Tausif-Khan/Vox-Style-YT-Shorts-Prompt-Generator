import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { getClientUserId } from "../lib/client-user";
import {
  STORY_TYPE_LABELS,
  type StoryType,
  type ResearchData,
  type StoryArchitecture,
  type ScriptData,
  type Scene,
  type VisualBible,
  type EditingPlan,
  type ProjectStage,
} from "../lib/types";
import {
  ArrowLeft,
  RefreshCw,
  Download,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  Pencil,
} from "lucide-react";

const TABS = ["Story", "Script", "Scenes", "Visuals", "Edit", "Export"] as const;
type Tab = (typeof TABS)[number];

const STAGES: { key: ProjectStage; label: string }[] = [
  { key: "research", label: "1 · Research" },
  { key: "story", label: "2 · Story" },
  { key: "script", label: "3 · Script" },
  { key: "visuals", label: "4 · Visual Style" },
  { key: "scenes", label: "5 · Scenes" },
  { key: "editing", label: "6 · Edit Plan" },
];

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.round(t % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn-ghost"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function StageBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    QUEUED: "bg-ink-700 text-bone-400",
    GENERATING: "bg-amber-film/15 text-amber-film",
    COMPLETED: "bg-emerald-500/15 text-emerald-400",
    FAILED: "bg-red-500/15 text-red-400",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles[status] ?? styles.QUEUED}`}>
      {status === "GENERATING" ? "…" : status === "COMPLETED" ? "✓" : status === "FAILED" ? "✕" : "—"}
    </span>
  );
}

function SceneRegenPanel({
  headline,
  onConfirm,
  onCancel,
  busy,
}: {
  headline?: string;
  onConfirm: (instruction: string) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [instruction, setInstruction] = useState("");
  return (
    <div className="mt-3 rounded-lg border border-amber-film/25 bg-amber-film/[0.04] p-3.5">
      {headline && <p className="mb-2 text-xs font-medium text-amber-film">{headline}</p>}
      <input
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="What would you like changed? (optional)"
        className="input-dark mb-2.5"
      />
      <div className="flex items-center gap-2">
        <button className="btn-primary px-3.5 py-1.5 text-xs" disabled={busy} onClick={() => onConfirm(instruction)}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Regenerate Scene"}
        </button>
        <button className="btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>();
  const userId = getClientUserId();
  const [tab, setTab] = useState<Tab>("Story");
  const runStage = useAction(api.pipeline.runStage);
  const regenScene = useAction(api.pipeline.regenerateScene);
  const updateNarration = useMutation(api.editing.updateNarration);
  const [running, setRunning] = useState<ProjectStage | null>(null);
  const [regenTarget, setRegenTarget] = useState<number | null>(null);
  const [regenInstruction, setRegenInstruction] = useState("");
  const [editingScene, setEditingScene] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingNarration, setSavingNarration] = useState(false);
  const [resyncScene, setResyncScene] = useState<number | null>(null);
  const [resyncInstruction, setResyncInstruction] = useState("");

  const project = useQuery(api.projects.get, { id: id as any, userId });
  const research = useQuery(api.stages.getStagePublic, { projectId: id as any, table: "research" });
  const story = useQuery(api.stages.getStagePublic, { projectId: id as any, table: "story" });
  const script = useQuery(api.stages.getStagePublic, { projectId: id as any, table: "script" });
  const bible = useQuery(api.stages.getStagePublic, { projectId: id as any, table: "visual_bible" });
  const scenes = useQuery(api.stages.getScenesPublic, { projectId: id as any });
  const editPlan = useQuery(api.stages.getStagePublic, { projectId: id as any, table: "editing_plan" });

  const sortedScenes = useMemo(
    () => [...(scenes ?? [])].sort((a, b) => a.scene_number - b.scene_number),
    [scenes]
  );

  if (!project) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-bone-400">
        <Loader2 className="h-5 w-5 animate-spin text-amber-film" /> Loading project…
      </div>
    );
  }

  const stageStatus = project.stage_status as Record<ProjectStage, string>;

  const startEdit = (sceneNumber: number, narration: string) => {
    setEditingScene(sceneNumber);
    setEditDraft(narration);
  };

  const saveNarration = async (sceneNumber: number, narration: string) => {
    setSavingNarration(true);
    try {
      await updateNarration({ projectId: project._id, sceneNumber, narration });
      setEditingScene(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingNarration(false);
    }
  };

  const handleResyncScene = async (sceneNumber: number) => {
    try {
      await regenScene({
        projectId: project._id,
        sceneNumber,
        instruction: resyncInstruction.trim() || undefined,
      });
      setResyncScene(null);
      setResyncInstruction("");
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunStage = async (stage: ProjectStage) => {
    if (running) return;
    setRunning(stage);
    try {
      await runStage({ projectId: project._id, stage });
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(null);
    }
  };

  const handleRegenerateScene = async (sceneNumber: number) => {
    try {
      await regenScene({
        projectId: project._id,
        sceneNumber,
        instruction: regenInstruction.trim() || undefined,
      });
      setRegenTarget(null);
      setRegenInstruction("");
    } catch (e) {
      console.error(e);
    }
  };

  const allPromptsText = () =>
    sortedScenes
      .map(
        (s) =>
          `=== SCENE ${s.scene_number} (${fmt(s.data.start_time)}–${fmt(s.data.end_time)}) ===\n` +
          `NARRATION: ${s.data.narration}\n\n` +
          `IMAGE PROMPT:\n${s.data.image_prompt}\n\n` +
          `VIDEO PROMPT:\n${s.data.video_prompt}\n`
      )
      .join("\n");

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      {/* Header */}
      <div className="mb-6">
        <Link to="/dashboard" className="btn-ghost mb-3 -ml-2.5 inline-flex">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="label-xs mb-2">Project</p>
            <h1 className="font-serif text-3xl leading-tight text-bone-50">{project.title}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-bone-400">
              <span className="text-amber-film">{project.duration} sec</span>
              <span className="text-ink-500">·</span>
              <span>{project.aspect_ratio}</span>
              <span className="text-ink-500">·</span>
              <span>{STORY_TYPE_LABELS[project.story_type as StoryType] ?? project.story_type}</span>
            </p>
          </div>
          <button className="btn-secondary" onClick={() => setTab("Export")}>
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      </div>

      {/* Stage tracker */}
      <div className="panel mb-3 flex flex-wrap items-center gap-2 p-3">
        <span className="label-xs mr-1">Pipeline</span>
        {STAGES.map((s) => (
          <button
            key={s.key}
            className="group flex items-center gap-2 rounded-full border border-ink-600 bg-ink-850 px-3.5 py-2 text-xs font-medium text-bone-200 shadow-sm transition hover:-translate-y-px hover:border-amber-film/50 hover:text-bone-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            onClick={() => handleRunStage(s.key)}
            disabled={running !== null}
            title={`Click to generate or regenerate ${s.label.toLowerCase()}`}
          >
            {running === s.key ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-film" />
            ) : (
              <StageBadge status={stageStatus[s.key]} />
            )}
            {s.label}
            <RefreshCw className="h-3 w-3 text-bone-400 opacity-40 transition group-hover:opacity-100 group-hover:text-amber-film" />
          </button>
        ))}
        <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-bone-400 md:flex">
          <RefreshCw className="h-3 w-3" /> Click any step to generate or redo it
        </span>
      </div>

      {project.last_error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-xs leading-relaxed text-red-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 break-words">{project.last_error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-ink-700/80">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              tab === t ? "tab-active" : "text-bone-400 hover:text-bone-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* STORY */}
      {tab === "Story" && (
        <div className="space-y-6">
          {research ? (
            <>
              <section className="panel relative overflow-hidden p-6">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_100%_at_50%_-30%,rgba(232,163,61,0.05),transparent)]"
                />
                <p className="label-xs relative mb-2">Central Question</p>
                <p className="relative font-serif text-2xl leading-relaxed text-bone-50">
                  {(research.data as ResearchData).central_question}
                </p>
                <div className="divider-fade relative my-5" />
                <p className="label-xs relative mb-2">Summary</p>
                <p className="relative text-sm leading-relaxed text-bone-300">
                  {(research.data as ResearchData).summary}
                </p>
              </section>
              <section className="panel p-6">
                <p className="label-xs mb-3">Timeline</p>
                <div className="space-y-2">
                  {(research.data as ResearchData).timeline.map((t, i) => (
                    <div key={i} className="flex gap-4 text-sm">
                      <span className="w-32 shrink-0 font-semibold text-amber-film">{t.period}</span>
                      <span className="text-bone-300">{t.event}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="panel grid gap-6 p-6 md:grid-cols-2">
                <div>
                  <p className="label-xs mb-3">Key Facts</p>
                  <ul className="space-y-1.5 text-sm text-bone-300">
                    {(research.data as ResearchData).key_facts.map((f, i) => (
                      <li key={i}>• {f}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="label-xs mb-3">Misconceptions & Disputed Claims</p>
                  <ul className="space-y-1.5 text-sm text-bone-300">
                    {[...(research.data as ResearchData).common_misconceptions,
                      ...(research.data as ResearchData).controversial_or_disputed_claims].map((f, i) => (
                      <li key={i}>• {f}</li>
                    ))}
                  </ul>
                </div>
              </section>
              {story && (
                <section className="panel p-6">
                  <p className="label-xs mb-2">Story Angle</p>
                  <p className="mb-4 font-serif text-lg text-bone-50">{(story.data as StoryArchitecture).story_angle}</p>
                  <p className="label-xs mb-2">Hook</p>
                  <p className="mb-4 text-sm text-bone-300">{(story.data as StoryArchitecture).hook}</p>
                  <p className="label-xs mb-2">Ending Payoff</p>
                  <p className="text-sm text-bone-300">{(story.data as StoryArchitecture).ending_payoff}</p>
                  <p className="label-xs mb-2 mt-6">Narrative Structure</p>
                  <div className="space-y-2">
                    {(story.data as StoryArchitecture).narrative_structure.map((n, i) => (
                      <div key={i} className="flex gap-3 text-sm">
                        <span className="w-28 shrink-0 font-semibold uppercase text-amber-film">{n.stage}</span>
                        <span className="text-bone-300">{n.description}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <div className="panel p-10 text-center text-sm text-bone-400">
              {stageStatus.research === "GENERATING"
                ? "Building your research dossier…"
                : "No research yet. Click Research in the tracker above."}
            </div>
          )}
        </div>
      )}

      {/* SCRIPT */}
      {tab === "Script" && (
        <div className="space-y-3">
          {script ? (
            (script.data as ScriptData).sections.map((sec) => {
              const scene = sortedScenes.find((s) => s.scene_number === sec.scene_number);
              const isEditing = editingScene === sec.scene_number;
              const dirty = isEditing && editDraft !== sec.narration;
              const wordCount = sec.narration.trim().split(/\s+/).filter(Boolean).length;
              return (
                <div key={sec.scene_number} className="panel p-5">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="scene-num">
                      SC {String(sec.scene_number).padStart(2, "0")} · {fmt(sec.start_time)}–{fmt(sec.end_time)}
                      <span className="ml-3 text-bone-400">{wordCount}w</span>
                    </p>
                    <div className="flex items-center gap-1">
                      {!isEditing && <CopyButton text={sec.narration} label="Copy" />}
                      {!isEditing && (
                        <button
                          className="btn-ghost"
                          onClick={() => startEdit(sec.scene_number, sec.narration)}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                      )}
                    </div>
                  </div>
                  {isEditing ? (
                    <>
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={3}
                        autoFocus
                        className="input-dark resize-y font-serif text-lg leading-relaxed"
                      />
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          className="btn-primary px-3.5 py-1.5 text-xs"
                          disabled={!dirty || savingNarration}
                          onClick={() => saveNarration(sec.scene_number, editDraft.trim())}
                        >
                          {savingNarration ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Update Scene"
                          )}
                        </button>
                        {scene && dirty && (
                          <button
                            className="btn-secondary px-3.5 py-1.5 text-xs"
                            onClick={() => {
                              void saveNarration(sec.scene_number, editDraft.trim()).then(() => {
                                setResyncScene(sec.scene_number);
                                setResyncInstruction("");
                              });
                            }}
                          >
                            Update & Replan Visuals
                          </button>
                        )}
                        <button className="btn-ghost" onClick={() => setEditingScene(null)}>
                          Cancel
                        </button>
                      </div>
                      {scene && dirty && (
                        <p className="mt-2 text-xs text-bone-400/80">
                          {scene.data.visual_type.replace(/_/g, " ")} visuals were planned for the
                          original narration — replan them to match your edit.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="font-serif text-lg leading-relaxed text-bone-100">{sec.narration}</p>
                  )}
                </div>
              );
            })
          ) : (
            <div className="panel p-10 text-center text-sm text-bone-400">
              {stageStatus.script === "GENERATING"
                ? "Writing your narration…"
                : "No script yet."}
            </div>
          )}
        </div>
      )}

      {/* SCENES */}
      {tab === "Scenes" && (
        <div className="space-y-4">
          {sortedScenes.map((s) => {
            const sc = s.data as Scene;
            return (
              <div key={s._id} className="panel p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="scene-num">
                    SC {String(sc.scene_number).padStart(2, "0")} · {fmt(sc.start_time)}–{fmt(sc.end_time)}
                  </p>
                  <span className="badge bg-amber-film/10 text-amber-film">
                    {sc.visual_type.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mb-4 border-b border-ink-700/80 pb-4 font-serif text-base leading-relaxed text-bone-100">
                  {sc.narration}
                </p>
                <p className="label-xs mb-1">Visual Goal</p>
                <p className="mb-4 text-sm leading-relaxed text-bone-300">{sc.visual_goal}</p>
                <div className="mb-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <p className="label-xs">Image Prompt</p>
                      <CopyButton text={sc.image_prompt} label="Copy" />
                    </div>
                    <p className="rounded-lg border border-ink-700/60 bg-ink-850/70 p-3.5 text-xs leading-relaxed text-bone-300">
                      {sc.image_prompt}
                    </p>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <p className="label-xs">Video Prompt</p>
                      <CopyButton text={sc.video_prompt} label="Copy" />
                    </div>
                    <p className="rounded-lg border border-ink-700/60 bg-ink-850/70 p-3.5 text-xs leading-relaxed text-bone-300">
                      {sc.video_prompt}
                    </p>
                  </div>
                </div>
                {(sc.graphics_required && sc.graphic_prompt) && (
                  <div className="mb-4 rounded-lg border border-amber-film/20 bg-amber-film/5 p-3">
                    <p className="label-xs mb-1">Graphic · {sc.graphic_type}</p>
                    <p className="text-xs text-bone-300">{sc.graphic_prompt}</p>
                    {sc.graphic_animation && (
                      <p className="mt-1 text-xs text-bone-400">Animation: {sc.graphic_animation}</p>
                    )}
                    {sc.graphic_labels && sc.graphic_labels.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {sc.graphic_labels.map((l, i) => (
                          <span key={i} className="rounded bg-ink-700 px-2 py-0.5 text-[10px] text-bone-200">
                            {l}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-4 text-xs text-bone-400">
                  {sc.on_screen_text && <span>Text: <span className="text-bone-200">{sc.on_screen_text}</span></span>}
                  <span>Transition: <span className="text-bone-200">{sc.transition.replace(/_/g, " ")}</span></span>
                  {sc.sound_effects && <span>SFX: <span className="text-bone-200">{sc.sound_effects}</span></span>}
                  {sc.music_direction && <span>Music: <span className="text-bone-200">{sc.music_direction}</span></span>}
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-ink-700 pt-3">
                  <button className="btn-ghost" onClick={() => setRegenTarget(sc.scene_number)}>
                    <RefreshCw className="h-3.5 w-3.5" /> Regenerate Scene
                  </button>
                </div>
                {regenTarget === sc.scene_number && (
                  <SceneRegenPanel
                    onConfirm={(instruction) => {
                      setRegenInstruction(instruction);
                      handleRegenerateScene(sc.scene_number);
                    }}
                    onCancel={() => setRegenTarget(null)}
                    busy={running !== null || resyncScene !== null}
                  />
                )}
                {resyncScene === sc.scene_number && (
                  <SceneRegenPanel
                    headline="Visuals were planned for the previous narration"
                    onConfirm={(instruction) => {
                      setResyncInstruction(instruction);
                      handleResyncScene(sc.scene_number);
                    }}
                    onCancel={() => setResyncScene(null)}
                    busy={running !== null || regenTarget !== null}
                  />
                )}
              </div>
            );
          })}
          {sortedScenes.length === 0 && (
            <div className="panel p-10 text-center text-sm text-bone-400">
              {stageStatus.scenes === "GENERATING"
                ? "Planning your scenes…"
                : "No scenes yet."}
            </div>
          )}
        </div>
      )}

      {/* VISUALS */}
      {tab === "Visuals" && (
        <div className="space-y-6">
          {bible ? (
            <section className="panel p-6">
              <p className="label-xs mb-4">Project Visual Bible</p>
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(bible.data as VisualBible)
                  .filter(([k]) => k !== "things_to_avoid")
                  .map(([k, v]) => (
                    <div key={k}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-film">
                        {k.replace(/_/g, " ")}
                      </p>
                      <p className="text-sm text-bone-300">{String(v)}</p>
                    </div>
                  ))}
              </div>
              <p className="label-xs mb-2 mt-6">Things to Avoid</p>
              <ul className="space-y-1 text-sm text-bone-300">
                {(bible.data as VisualBible).things_to_avoid.map((a, i) => (
                  <li key={i}>• {a}</li>
                ))}
              </ul>
            </section>
          ) : (
            <div className="panel p-6 text-center text-sm text-bone-400">
              Visual bible not generated yet.
            </div>
          )}
          <section className="panel p-6">
            <p className="label-xs mb-4">Visual Assets Checklist</p>
            <div className="space-y-2">
              {sortedScenes.map((s) => {
                const sc = s.data as Scene;
                return (
                  <div key={s._id} className="flex items-center justify-between rounded-lg bg-ink-850 px-4 py-2.5 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="w-16 font-mono text-xs text-bone-400">
                        {fmt(sc.start_time)}
                      </span>
                      <span className="text-bone-200">{sc.visual_type.replace(/_/g, " ")}</span>
                      {sc.graphics_required && (
                        <span className="rounded bg-amber-film/10 px-1.5 py-0.5 text-[10px] text-amber-film">
                          + {sc.graphic_type}
                        </span>
                      )}
                    </div>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                      PROMPT READY
                    </span>
                    <CopyButton text={`${sc.image_prompt}\n\n${sc.video_prompt}`} label="Prompts" />
                  </div>
                );
              })}
              {sortedScenes.length === 0 && (
                <p className="text-sm text-bone-400">No scenes yet.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {/* EDIT */}
      {tab === "Edit" && (
        <div className="space-y-2">
          {editPlan ? (
            (editPlan.data as EditingPlan).scenes.map((row) => (
              <div key={row.scene} className="panel flex flex-wrap items-baseline gap-x-4 gap-y-1 p-4 text-sm">
                <span className="font-mono text-xs text-amber-film">
                  {fmt(row.start)}–{fmt(row.end)}
                </span>
                <span className="font-semibold text-bone-100">{row.visual}</span>
                <span className="text-bone-300">{row.narration}</span>
                <span className="ml-auto text-xs text-bone-400">
                  {row.transition.replace(/_/g, " ")} · {row.audio}
                </span>
              </div>
            ))
          ) : (
            <div className="panel p-10 text-center text-sm text-bone-400">
              {stageStatus.editing === "GENERATING"
                ? "Assembling your edit plan…"
                : "No editing plan yet."}
            </div>
          )}
        </div>
      )}

      {/* EXPORT */}
      {tab === "Export" && (
        <div className="space-y-4">
          <section className="panel p-6">
            <p className="label-xs mb-4">Copy</p>
            <div className="flex flex-wrap gap-2">
              <CopyButton
                label="Copy Script"
                text={
                  script
                    ? (script.data as ScriptData).sections
                        .map((s) => `SCENE ${String(s.scene_number).padStart(2, "0")} (${fmt(s.start_time)}–${fmt(s.end_time)}):\n${s.narration}`)
                        .join("\n\n")
                    : ""
                }
              />
              <CopyButton label="Copy All Image Prompts" text={sortedScenes.map((s) => `Scene ${s.scene_number}: ${(s.data as Scene).image_prompt}`).join("\n\n")} />
              <CopyButton label="Copy All Video Prompts" text={sortedScenes.map((s) => `Scene ${s.scene_number}: ${(s.data as Scene).video_prompt}`).join("\n\n")} />
              <CopyButton label="Copy All Prompts" text={allPromptsText()} />
            </div>
          </section>
          <section className="panel p-6">
            <p className="label-xs mb-4">Download</p>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn-secondary"
                onClick={() => {
                  const data = {
                    project: {
                      title: project.title,
                      duration: project.duration,
                      aspect_ratio: project.aspect_ratio,
                      language: project.language,
                      story_type: project.story_type,
                      visual_style: project.visual_style,
                    },
                    research: research?.data,
                    story: story?.data,
                    script: script?.data,
                    visual_bible: bible?.data,
                    scenes: sortedScenes.map((s) => s.data),
                    editing_plan: editPlan?.data,
                  };
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `${project.title.replace(/\s+/g, "-").toLowerCase()}.json`;
                  a.click();
                }}
              >
                Full Project (JSON)
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  const lines: string[] = [
                    project.title.toUpperCase(),
                    `${project.duration} sec · ${project.aspect_ratio} · ${project.language}`,
                    "".padEnd(50, "="),
                    "",
                    "SCRIPT",
                  ];
                  if (script) {
                    for (const s of (script.data as ScriptData).sections) {
                      lines.push(`\nSCENE ${String(s.scene_number).padStart(2, "0")}  ${fmt(s.start_time)}–${fmt(s.end_time)}`);
                      lines.push(s.narration);
                    }
                  }
                  lines.push("\n" + "".padEnd(50, "=") + "\nSCENE PROMPTS");
                  for (const s of sortedScenes) {
                    const sc = s.data as Scene;
                    lines.push(`\n--- Scene ${sc.scene_number} (${fmt(sc.start_time)}–${fmt(sc.end_time)}) · ${sc.visual_type} ---`);
                    lines.push(`VISUAL GOAL: ${sc.visual_goal}`);
                    lines.push(`IMAGE: ${sc.image_prompt}`);
                    lines.push(`VIDEO: ${sc.video_prompt}`);
                    if (sc.graphics_required && sc.graphic_prompt) lines.push(`GRAPHIC (${sc.graphic_type}): ${sc.graphic_prompt}`);
                    if (sc.on_screen_text) lines.push(`ON-SCREEN TEXT: ${sc.on_screen_text}`);
                    lines.push(`TRANSITION: ${sc.transition}`);
                    lines.push(`AUDIO: ${sc.music_direction} | SFX: ${sc.sound_effects}`);
                  }
                  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `${project.title.replace(/\s+/g, "-").toLowerCase()}.txt`;
                  a.click();
                }}
              >
                Production Package (TXT)
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
