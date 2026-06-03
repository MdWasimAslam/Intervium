"use client";

import { useState, useTransition } from "react";
import { Loader2, Shuffle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { randomDojoQuestion } from "@/lib/actions/dojo";
import type { DojoTopicRef } from "@/lib/dojo/types";

/**
 * Prominent one-click quick-start: roll a random (preferring unsolved) problem,
 * optionally scoped by difficulty and topic, straight into the editor. Reuses
 * `randomDojoQuestion`; the parent's `onPicked` loads it in place.
 */
export function RandomPractice({
  topics,
  onPicked,
}: {
  topics: DojoTopicRef[];
  /** Open the rolled problem in the editor tab (in-place, no navigation). */
  onPicked: (slug: string) => void;
}) {
  const [pending, start] = useTransition();
  const [difficulty, setDifficulty] = useState("all");
  const [topic, setTopic] = useState("all");
  const [error, setError] = useState<string>();

  function roll() {
    setError(undefined);
    start(async () => {
      const res = await randomDojoQuestion({
        topicSlug: topic === "all" ? undefined : topic,
        difficulty:
          difficulty === "all"
            ? undefined
            : (difficulty as "easy" | "medium" | "hard"),
      });
      if (res.ok) onPicked(res.data.slug);
      else setError(res.error);
    });
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Random practice</p>
          <p className="text-sm text-[var(--muted-foreground)]">
            Roll a fresh problem and start solving — we prefer ones you
            haven&apos;t cracked yet.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger
              className="h-9 w-[130px]"
              aria-label="Random difficulty"
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

          <Select value={topic} onValueChange={setTopic}>
            <SelectTrigger className="h-9 w-[140px]" aria-label="Random topic">
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

          <Button onClick={roll} disabled={pending}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Shuffle className="h-4 w-4" />
            )}
            Random problem
          </Button>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-sm text-[var(--destructive)]">{error}</p>
      )}
    </div>
  );
}
