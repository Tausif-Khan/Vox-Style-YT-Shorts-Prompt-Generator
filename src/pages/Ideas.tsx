import { useMemo, useState } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { getClientUserId } from "../lib/client-user";
import { Search, Plus, Copy, Trash2, Pencil, Filter, Sparkles } from "lucide-react";

const CATEGORIES = ["why", "history", "world", "other"] as const;
const STATUSES = ["IDEA", "IN_PROGRESS", "DRAFT", "READY", "PUBLISHED"] as const;

const CATEGORY_LABELS: Record<string, string> = {
  why: "Why / Explanation",
  history: "History",
  world: "How It Changed the World",
  other: "Other",
};

export default function Ideas() {
  const userId = getClientUserId();
  const navigate = useNavigate();
  const ideas = useQuery(api.ideas.list, { userId }) ?? [];
  const seedIdeas = useMutation(api.ideas.seed);
  const addIdea = useMutation(api.ideas.add);
  const removeIdea = useMutation(api.ideas.remove);
  const renameIdea = useMutation(api.ideas.rename);
  const runPipeline = useAction(api.pipeline.startPipeline);
  const createProject = useMutation(api.projects.create);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<string>("why");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    void seedIdeas({ userId });
  }, [seedIdeas, userId]);

  const filtered = useMemo(
    () =>
      ideas
        .filter((i) =>
          search ? i.title.toLowerCase().includes(search.toLowerCase()) : true
        )
        .filter((i) => (category === "all" ? true : i.category === category))
        .filter((i) => (status === "all" ? true : i.status === status))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [ideas, search, category, status]
  );

  const generate = async (title: string) => {
    const id = await createProject({
      userId,
      title,
      topic: title,
      duration: 60,
      aspect_ratio: "9:16",
      language: "English",
      scene_count: "auto",
      story_type: "auto",
    });
    navigate(`/project/${id}`);
    void runPipeline({ projectId: id }).catch((e) =>
      console.error("Generation failed", e)
    );
  };

  const saveTitleEdit = async (ideaId: string, title: string) => {
    if (!title.trim()) {
      setEditingId(null);
      return;
    }
    await renameIdea({ id: ideaId as any, title: title.trim() });
    setEditingId(null);
  };

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <h1 className="mb-1 font-serif text-4xl text-bone-50">Idea Library</h1>
      <p className="mb-8 text-sm text-bone-400">
        {ideas.length} topics ready to become documentaries.
      </p>

      {/* Add topic */}
      <div className="panel mb-6 flex flex-wrap items-center gap-2 p-4">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a new topic…"
          className="input-dark flex-1 min-w-48"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newTitle.trim()) {
              void addIdea({ userId, title: newTitle.trim(), category: newCategory });
              setNewTitle("");
            }
          }}
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="input-dark w-auto"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <button
          className="btn-secondary"
          disabled={!newTitle.trim()}
          onClick={() => {
            void addIdea({ userId, title: newTitle.trim(), category: newCategory });
            setNewTitle("");
          }}
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bone-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search topics…"
            className="input-dark pl-9"
          />
        </div>
        <Filter className="h-4 w-4 text-bone-400" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-dark w-auto">
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-dark w-auto">
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      {/* Grid */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((idea) => (
          <div key={idea._id} className="panel panel-hover group flex flex-col p-4">
            {editingId === idea._id ? (
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="input-dark mb-2"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveTitleEdit(idea._id, editTitle);
                  if (e.key === "Escape") setEditingId(null);
                }}
              />
            ) : (
              <h3 className="mb-1.5 flex-1 font-serif text-base leading-snug text-bone-50 transition-colors group-hover:text-amber-100">
                {idea.title}
              </h3>
            )}
            <div className="mb-3.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em]">
              <span className="text-bone-400/80">{CATEGORY_LABELS[idea.category] ?? idea.category}</span>
              <span className="rounded-full bg-ink-700/80 px-2 py-0.5 tracking-[0.1em] text-bone-300">
                {idea.status.replace("_", " ")}
              </span>
            </div>
            <div className="flex items-center gap-1 border-t border-ink-700/60 pt-2.5">
              <button
                className="btn-ghost font-semibold text-amber-film"
                onClick={() => generate(idea.title)}
              >
                <Sparkles className="h-3.5 w-3.5" /> Generate
              </button>
              <button
                className="btn-ghost"
                onClick={() => {
                  void addIdea({ userId, title: `${idea.title} (copy)`, category: idea.category });
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button
                className="btn-ghost"
                onClick={() => {
                  setEditingId(idea._id);
                  setEditTitle(idea.title);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                className="btn-ghost text-red-400/70 hover:text-red-400"
                onClick={() => void removeIdea({ id: idea._id })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-bone-400">
          No topics match your filters.
        </p>
      )}
    </div>
  );
}
