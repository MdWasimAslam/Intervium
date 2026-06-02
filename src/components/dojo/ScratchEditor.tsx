"use client";

import { useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/components/code/CodeEditor";
import { CodeScratchpad } from "@/components/code/CodeScratchpad";
import { useFullscreen } from "@/components/code/useFullscreen";
import { readDraft, useEditorDraft } from "@/components/code/useEditorDraft";

const SCRATCH_TEMPLATE =
  "// Scratchpad — write and run JavaScript.\n// Pick a problem from the Problems tab to practice.\n\n";
const DRAFT_KEY = "dojo:scratch";

/**
 * A free JavaScript editor shown on the Editor tab when no problem is selected.
 * Reuses the shared Monaco editor + the sandbox Run (console output only), and
 * autosaves to localStorage so a refresh doesn't lose scratch work. The editor
 * can go fullscreen for a roomier writing surface.
 */
export function ScratchEditor() {
  const [code, setCode] = useState(() => readDraft(DRAFT_KEY) ?? SCRATCH_TEMPLATE);
  const draft = useEditorDraft(DRAFT_KEY, SCRATCH_TEMPLATE);
  const { fullscreen, toggle: toggleFullscreen, layoutSignal } = useFullscreen();

  function changeCode(v: string) {
    setCode(v);
    draft.save(v);
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        fullscreen &&
          "fixed inset-0 z-50 overflow-auto bg-[var(--background)] p-4 sm:p-6",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[var(--muted-foreground)]">
          JavaScript scratchpad
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleFullscreen}
          aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {fullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
      </div>
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-[var(--border)]",
          fullscreen ? "h-[60vh]" : "h-[440px]",
        )}
      >
        <CodeEditor value={code} onChange={changeCode} layoutSignal={layoutSignal} />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
        <CodeScratchpad getCode={() => code} />
      </div>
    </div>
  );
}
