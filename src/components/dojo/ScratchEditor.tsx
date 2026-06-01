"use client";

import { useState } from "react";
import { CodeEditor } from "@/components/code/CodeEditor";
import { CodeScratchpad } from "@/components/code/CodeScratchpad";
import { readDraft, useEditorDraft } from "@/components/code/use-editor-draft";

const SCRATCH_TEMPLATE =
  "// Scratchpad — write and run JavaScript.\n// Pick a problem from the Problems tab to practice.\n\n";
const DRAFT_KEY = "dojo:scratch";

/**
 * A free JavaScript editor shown on the Editor tab when no problem is selected.
 * Reuses the shared Monaco editor + the sandbox Run (console output only), and
 * autosaves to localStorage so a refresh doesn't lose scratch work.
 */
export function ScratchEditor() {
  const [code, setCode] = useState(() => readDraft(DRAFT_KEY) ?? SCRATCH_TEMPLATE);
  const draft = useEditorDraft(DRAFT_KEY, SCRATCH_TEMPLATE);

  function changeCode(v: string) {
    setCode(v);
    draft.save(v);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="h-[440px] overflow-hidden rounded-xl border border-[var(--border)]">
        <CodeEditor value={code} onChange={changeCode} />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
        <CodeScratchpad getCode={() => code} />
      </div>
    </div>
  );
}
