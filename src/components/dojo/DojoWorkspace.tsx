"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Code2, ListChecks, Plus } from "lucide-react";
import { TabButton } from "@/components/ui/TabButton";
import { Button } from "@/components/ui/button";
import { getDojoQuestionAction } from "@/lib/actions/dojo";
import type {
  DojoListItem,
  DojoQuestionDetail,
  DojoTopicRef,
} from "@/lib/dojo/types";
import { QuestionList } from "./QuestionList";
import { RandomPractice } from "./RandomPractice";
import { SolveShell } from "./SolveShell";
import { AddProblemDialog } from "./AddProblemDialog";
import { ScratchEditor } from "./ScratchEditor";

/**
 * Editor-first tabbed Dojo shell. Lands on the Editor (last-attempted problem,
 * or a placeholder) with a Problems tab beside it. Selecting a problem loads it
 * in-place — no page navigation — and switches to the Editor.
 */
export function DojoWorkspace({
  items,
  topics,
  initialDetail,
  initialFresh = false,
}: {
  items: DojoListItem[];
  topics: DojoTopicRef[];
  initialDetail: DojoQuestionDetail | null;
  /** Open the initial problem on starter code, not the saved draft/last attempt
   * (set by the random quick-start deep link). */
  initialFresh?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"editor" | "problems">("editor");
  const [detail, setDetail] = useState<DojoQuestionDetail | null>(
    initialDetail,
  );
  // Whether the current problem was opened "fresh" (random practice) — seeds the
  // editor with starter code instead of restoring saved work.
  const [fresh, setFresh] = useState(initialFresh);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  async function selectProblem(slug: string, opts?: { fresh?: boolean }) {
    setError(undefined);
    setLoadingSlug(slug);
    const res = await getDojoQuestionAction(slug);
    setLoadingSlug(null);
    if (res.ok) {
      setDetail(res.data);
      setFresh(opts?.fresh ?? false);
      setTab("editor");
    } else {
      setError(res.error);
    }
  }

  function afterCreate(slug: string) {
    router.refresh(); // pull the new problem into the list
    void selectProblem(slug);
  }

  const addButton = (
    <AddProblemDialog
      topicSuggestions={topics.map((t) => t.name)}
      onCreated={afterCreate}
      trigger={
        <Button size="sm">
          <Plus className="h-4 w-4" /> Add problem
        </Button>
      }
    />
  );

  return (
    <div className="space-y-4">
      <RandomPractice
        topics={topics}
        onPicked={(slug) => selectProblem(slug, { fresh: true })}
      />

      <nav className="inline-flex rounded-full border border-[var(--border)] bg-[var(--card)] p-1">
        <TabButton
          active={tab === "editor"}
          onClick={() => setTab("editor")}
          icon={<Code2 className="h-4 w-4" />}
        >
          Editor
        </TabButton>
        <TabButton
          active={tab === "problems"}
          onClick={() => setTab("problems")}
          icon={<ListChecks className="h-4 w-4" />}
        >
          Problems
        </TabButton>
      </nav>

      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

      {tab === "editor" ? (
        detail ? (
          <SolveShell
            key={`${detail.id}:${fresh}`}
            question={detail}
            fresh={fresh}
            onBack={() => setTab("problems")}
            onSolved={() => router.refresh()}
            onScratchpad={() => setDetail(null)}
            onDeleted={() => {
              setDetail(null);
              setTab("problems");
            }}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[var(--muted-foreground)]">
                Scratchpad — or pick a problem to practice.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTab("problems")}
                >
                  <ListChecks className="h-4 w-4" /> Browse problems
                </Button>
                {addButton}
              </div>
            </div>
            <ScratchEditor />
          </div>
        )
      ) : (
        <QuestionList
          items={items}
          topics={topics}
          onSelect={selectProblem}
          loadingSlug={loadingSlug}
          headerAction={addButton}
        />
      )}
    </div>
  );
}
