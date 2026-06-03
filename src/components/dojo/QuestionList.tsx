"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Check,
  Circle,
  CircleDot,
  Loader2,
  Search,
  Shuffle,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { randomDojoQuestion } from "@/lib/actions/dojo";
import type { DojoListItem, DojoTopicRef } from "@/lib/dojo/types";
import { DifficultyBadge } from "./DifficultyBadge";

/** LeetCode-style problem list: search + topic/difficulty/status filters + random. */
export function QuestionList({
  items,
  topics,
  onSelect,
  loadingSlug,
  headerAction,
}: {
  items: DojoListItem[];
  topics: DojoTopicRef[];
  /** Open a problem in the editor tab (in-place, no navigation). `fresh` opens
   * on starter code (random roll) rather than restoring the saved draft. */
  onSelect: (slug: string, opts?: { fresh?: boolean }) => void;
  /** Slug currently being loaded — shows a spinner on that row. */
  loadingSlug?: string | null;
  /** Extra control rendered in the filter row (e.g. "Add problem"). */
  headerAction?: React.ReactNode;
}) {
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState<string>();

  const filtered = useMemo(
    () =>
      items.filter((it) => {
        if (query && !it.title.toLowerCase().includes(query.toLowerCase()))
          return false;
        if (topic !== "all" && !it.topics.some((t) => t.slug === topic))
          return false;
        if (difficulty !== "all" && it.difficulty !== difficulty) return false;
        if (status === "solved" && !it.solved) return false;
        if (status === "unsolved" && it.solved) return false;
        if (status === "attempted" && !(it.attempted && !it.solved))
          return false;
        if (status === "mine" && !it.isMine) return false;
        return true;
      }),
    [items, query, topic, difficulty, status],
  );

  const solvedCount = items.filter((i) => i.solved).length;

  function surprise() {
    setError(undefined);
    start(async () => {
      const res = await randomDojoQuestion({
        topicSlug: topic === "all" ? undefined : topic,
        difficulty:
          difficulty === "all"
            ? undefined
            : (difficulty as "easy" | "medium" | "hard"),
      });
      if (res.ok) onSelect(res.data.slug, { fresh: true });
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search problems…"
            className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          />
        </div>

        <Select value={topic} onValueChange={setTopic}>
          <SelectTrigger className="h-9 w-[140px]" aria-label="Filter by topic">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All topics</SelectItem>
            {topics.map((t) => (
              <SelectItem key={t.slug} value={t.slug}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={difficulty} onValueChange={setDifficulty}>
          <SelectTrigger
            className="h-9 w-[130px]"
            aria-label="Filter by difficulty"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any difficulty</SelectItem>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger
            className="h-9 w-[130px]"
            aria-label="Filter by status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="solved">Solved</SelectItem>
            <SelectItem value="attempted">Attempted</SelectItem>
            <SelectItem value="unsolved">Unsolved</SelectItem>
            <SelectItem value="mine">Mine</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={surprise} disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Shuffle className="h-4 w-4" />
          )}
          Surprise me
        </Button>
        {headerAction}
      </div>

      <div className="flex items-center justify-between text-sm text-[var(--muted-foreground)]">
        <span>
          {filtered.length} of {items.length} problems
        </span>
        <span>
          {solvedCount} / {items.length} solved
        </span>
      </div>
      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No problems match"
          description="Try clearing a filter, or generate your own with AI."
        />
      ) : (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
          {filtered.map((it) => (
            <li key={it.slug}>
              <button
                type="button"
                onClick={() => onSelect(it.slug)}
                disabled={loadingSlug != null}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--muted)]/50 disabled:opacity-60"
              >
                {loadingSlug === it.slug ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[var(--primary)]" />
                ) : (
                  <StatusIcon solved={it.solved} attempted={it.attempted} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{it.title}</span>
                    {it.isMine && (
                      <span className="shrink-0 rounded-full bg-[var(--primary)]/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--primary)]">
                        Mine
                      </span>
                    )}
                  </span>
                  {it.topics.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {it.topics.map((t) => (
                        <Chip key={t.slug} className="text-xs">
                          {t.name}
                        </Chip>
                      ))}
                    </span>
                  )}
                </span>
                <DifficultyBadge difficulty={it.difficulty} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusIcon({
  solved,
  attempted,
}: {
  solved: boolean;
  attempted: boolean;
}) {
  if (solved)
    return (
      <Check className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
    );
  if (attempted)
    return <CircleDot className="h-5 w-5 shrink-0 text-amber-500" />;
  return (
    <Circle
      className={cn("h-5 w-5 shrink-0 text-[var(--muted-foreground)]/40")}
    />
  );
}
