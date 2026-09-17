import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { getClientUserId } from "../lib/client-user";
import {
  type StoryData,
  type ScriptData,
  type Scene,
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

const TABS = ["Story", "Script", "Scenes", "Export"] as const;
type Tab = (typeof TABS)[number];

const STAGES: { key: ProjectStage; label: string }[] = [
  { key: "story", label: "1 · Story" },
  { key: "script", label: "2 · Script" },
  { key: "scenes", label: "3 · Scene Prompts" },
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

export default function ProjectWorkspace({
  projectId,
  compact = false,
}: {
  projectId?: string; // when omitted, read from the /project/:id route
  compact?: boolean; // inline (single-page) mode: no page chrome/back link
}) {
  const params = useParams<{ id: string }>();
  const id = projectId ?? params.id;
  const userId = getClientUserId();
  const [tab, setTab] = useState<Tab>("Story");
  const runStage = useAction(api.pipeline.runStage);
  const regenScene = useAction(api.pipeline.regenerateScene);
  const updateNarration = useMutation(api.editing.updateNarration);
  const [running, setRunning] = useState<ProjectStage | null>(null);
  const [regenTarget, setRegenTarget] = useState<number | null>(null);
  const [editingScene, setEditingScene] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingNarration, setSavingNarration] = useState(false);
  const [resyncScene, setResyncScene] = useState<number | null>(null);

  const project = useQuery(api.projects.get, { id: id as any, userId });
  const story = useQuery(api.stages.getStagePublic, { projectId: id as any, table: "story" });
  const script = useQuery(api.stages.getStagePublic, { projectId: id as any, table: "script" });
  const scenes = useQuery(api.stages.getScenesPublic, { projectId: id as any });

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

  const handleRegenerateScene = async (sceneNumber: number, instruction: string) => {
    try {
      await regenScene({
        projectId: project._id,
        sceneNumber,
        instruction: instruction.trim() || undefined,
      });
      setRegenTarget(null);
      setResyncScene(null);
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
    <div className={compact ? "" : "mx-auto max-w-5xl px-8 py-10"}>
      {/* Header */}
      <div className="mb-6">
        {!compact && (
          <Link to="/dashboard" className="btn-ghost mb-3 -ml-2.5 inline-flex">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="label-xs mb-2">Project</p>
            <h1 className="font-serif text-3xl leading-tight text-bone-50">{project.title}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-bone-400">
              <span className="text-amber-film">{project.duration} sec</span>
              <span className="text-ink-500">·</span>
              <span>{project.aspect_ratio}</span>
              <span className="text-ink-500">·</span>
              <span>{sortedScenes.length || ""} scenes</span>
            </p>
          </div>
          <button className="btn-secondary" onClick={() => setTab("Export")}>
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      </div>

      {/* Stage tracker */}
      <div className="panel mb-3 p-3">
        <div className="grid grid-cols-3 gap-2">
          {STAGES.map((s) => (
            <button
              key={s.key}
              className="group flex items-center justify-center gap-2 rounded-full border border-ink-600 bg-ink-850 px-3.5 py-2 text-xs font-medium text-bone-200 shadow-sm transition hover:-translate-y-px hover:border-amber-film/50 hover:text-bone-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
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
        </div>
        <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-bone-400">
          <RefreshCw className="h-3 w-3" /> Click any step to generate or redo it
        </p>
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
          {story ? (
            <section className="panel relative overflow-hidden p-6">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_100%_at_50%_-30%,rgba(232,163,61,0.05),transparent)]"
              />
              <p className="label-xs relative mb-2">Central Question</p>
              <p className="relative font-serif text-2xl leading-relaxed text-bone-50">
                {(story.data as StoryData).central_question}
              </p>
              <div className="divider-fade relative my-5" />
              <p className="label-xs relative mb-2">The Story</p>
              <p className="relative font-serif text-lg italic leading-relaxed text-amber-film">
                {(story.data as StoryData).hook}
              </p>
              <p className="relative mt-3 text-sm leading-relaxed text-bone-300">
                {(story.data as StoryData).summary}
              </p>
              <p className="label-xs mb-2 mt-6">Narrative Structure</p>
              <div className="space-y-2">
                {(story.data as StoryData).narrative_structure.map((n, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <span className="w-28 shrink-0 font-semibold uppercase text-amber-film">{n.stage}</span>
                    <span className="text-bone-300">{n.description}</span>
                  </div>
                ))}
              </div>
              <div className="divider-fade my-5" />
              <p className="label-xs mb-2">Key Facts</p>
              <ul className="grid gap-1.5 text-sm text-bone-300 md:grid-cols-2">
                {(story.data as StoryData).key_facts.map((f, i) => (
                  <li key={i}>• {f}</li>
                ))}
              </ul>
              <p className="label-xs mb-2 mt-6">Ending Payoff</p>
              <p className="text-sm leading-relaxed text-bone-300">
                {(story.data as StoryData).ending_payoff}
              </p>
            </section>
          ) : (
            <div className="panel p-10 text-center text-sm text-bone-400">
              {stageStatus.story === "GENERATING"
                ? "Researching and building your story…"
                : "No story yet. Click Story in the tracker above."}
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
                    headline="Visuals were planned for the previous narration"
                    onConfirm={(instruction) => handleRegenerateScene(sc.scene_number, instruction)}
                    onCancel={() => setRegenTarget(null)}
                    busy={running !== null}
                  />
                )}
                {resyncScene === sc.scene_number && (
                  <SceneRegenPanel
                    onConfirm={(instruction) => handleRegenerateScene(sc.scene_number, instruction)}
                    onCancel={() => setResyncScene(null)}
                    busy={running !== null}
                  />
                )}
              </div>
            );
          })}
          {sortedScenes.length === 0 && (
            <div className="panel p-10 text-center text-sm text-bone-400">
              {stageStatus.scenes === "GENERATING"
                ? "Planning your scene prompts…"
                : "No scenes yet."}
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
                    story: story?.data,
                    script: script?.data,
                    scenes: sortedScenes.map((s) => s.data),
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
