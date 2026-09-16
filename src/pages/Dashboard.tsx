import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { getClientUserId } from "../lib/client-user";
import { Plus, Clock, Film, ArrowUpRight, Trash2, Sparkles } from "lucide-react";
import { STORY_TYPE_LABELS, type StoryType } from "../lib/types";

const STATUS_STYLES: Record<string, { chip: string; dot: string }> = {
  draft: { chip: "bg-ink-700 text-bone-300", dot: "bg-bone-400" },
  generating: { chip: "bg-amber-film/15 text-amber-film", dot: "bg-amber-film animate-pulse" },
  ready: { chip: "bg-emerald-500/15 text-emerald-400", dot: "bg-emerald-400" },
  failed: { chip: "bg-red-500/15 text-red-400", dot: "bg-red-400" },
};

export default function Dashboard() {
  const userId = getClientUserId();
  const projects = useQuery(api.projects.list, { userId }) ?? [];
  const seedIdeas = useMutation(api.ideas.seed);
  const removeProject = useMutation(api.projects.remove);
  const navigate = useNavigate();

  useEffect(() => {
    void seedIdeas({ userId });
  }, [seedIdeas, userId]);

  const readyCount = projects.filter((p) => p.status === "ready").length;
  const activeCount = projects.filter((p) => p.status === "generating").length;

  return (
    <div className="mx-auto max-w-6xl px-8 py-12">
      {/* Header */}
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-xs mb-2">Workspace</p>
          <h1 className="font-serif text-4xl text-bone-50">Dashboard</h1>
          <p className="mt-1.5 text-sm text-bone-400">
            Create cinematic editorial documentaries.
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="font-serif text-2xl text-bone-50">{projects.length}</p>
            <p className="label-xs">Projects</p>
          </div>
          <div className="text-right">
            <p className="font-serif text-2xl text-amber-film">{readyCount}</p>
            <p className="label-xs">Ready</p>
          </div>
          {activeCount > 0 && (
            <div className="text-right">
              <p className="font-serif text-2xl text-bone-100">{activeCount}</p>
              <p className="label-xs">Generating</p>
            </div>
          )}
          <Link to="/new" className="btn-primary">
            <Plus className="h-4 w-4" /> New Documentary
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="panel relative flex flex-col items-center gap-3 overflow-hidden px-8 py-20 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_0%,rgba(232,163,61,0.07),transparent)]"
          />
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-film/10 ring-1 ring-amber-film/25">
            <Film className="h-6 w-6 text-amber-film" strokeWidth={1.5} />
          </span>
          <p className="mt-2 font-serif text-2xl text-bone-100">
            No documentaries yet
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-bone-400">
            Pick a topic from the idea library or start from scratch — the studio
            builds the whole production package.
          </p>
          <Link to="/new?topic=The%20History%20of%20Pizza" className="btn-primary mt-3">
            <Sparkles className="h-4 w-4" /> Generate "The History of Pizza"
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const scenes = p.stage_status.scenes === "COMPLETED";
            const status = STATUS_STYLES[p.status] ?? STATUS_STYLES.draft;
            return (
              <div
                key={p._id}
                className="panel panel-hover group relative cursor-pointer overflow-hidden p-5"
                onClick={() => navigate(`/project/${p._id}`)}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-film/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h3 className="font-serif text-lg leading-snug text-bone-50 transition-colors group-hover:text-amber-100">
                    {p.title}
                  </h3>
                  <span className={`badge shrink-0 ${status.chip}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                    {p.status}
                  </span>
                </div>
                <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-bone-400">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" /> {p.duration} sec
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Film className="h-3 w-3" />{" "}
                    {scenes ? `${p.scene_count} scenes` : "— scenes"}
                  </span>
                  <span className="text-bone-400/80">
                    {STORY_TYPE_LABELS[p.story_type as StoryType] ?? p.story_type}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-ink-700/80 pt-3.5">
                  <span className="text-xs text-bone-400">
                    {new Date(p._creationTime).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <button
                      className="btn-ghost text-red-400/70 hover:text-red-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${p.title}"?`)) {
                          void removeProject({ id: p._id, userId });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <span className="btn-ghost font-semibold text-amber-film">
                      Open <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
