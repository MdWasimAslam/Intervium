"use client";

import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/** Languages offered in the editor's selector (kept small to start). */
export const EDITOR_LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
] as const;

export type EditorLanguage = (typeof EDITOR_LANGUAGES)[number]["value"];

interface Props {
  /** Initial code. The editor is uncontrolled after mount; reads flow via onChange. */
  defaultValue: string;
  /** Initial language (drives syntax highlighting). */
  defaultLanguage?: string;
  /** Called on every edit with the current code. */
  onChange: (value: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
  height?: number;
}

/**
 * Detect a touch / small-screen device once on the client. Monaco is heavy and
 * awkward on phones, so we fall back to a plain monospace textarea there.
 * Starts `false` to match SSR, then corrects after mount.
 */
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse), (max-width: 640px)");
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return coarse;
}

/**
 * Code editor used for coding-type questions. Renders Monaco
 * (`@monaco-editor/react`) with a language selector and theme-matched colours
 * on capable devices, and a syntax-free monospace textarea on touch / small
 * screens so the flow still works on mobile.
 */
export function CodeEditor({
  defaultValue,
  defaultLanguage = "javascript",
  onChange,
  readOnly = false,
  disabled = false,
  height = 360,
}: Props) {
  const { resolvedTheme } = useTheme();
  const [language, setLanguage] = useState<string>(defaultLanguage);
  const coarse = useCoarsePointer();

  const selector = (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        Language
      </span>
      <div className="w-40">
        <Select
          value={language}
          onValueChange={setLanguage}
          disabled={disabled || readOnly}
        >
          <SelectTrigger aria-label="Editor language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EDITOR_LANGUAGES.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  // Mobile / touch fallback — no Monaco, just a monospace textarea.
  if (coarse) {
    return (
      <div className="space-y-2">
        {selector}
        <Textarea
          defaultValue={defaultValue}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
          disabled={disabled}
          spellCheck={false}
          rows={14}
          className="font-mono text-sm"
          placeholder="Write your solution here…"
        />
        <p className="text-xs text-[var(--muted-foreground)]">
          Simplified editor on small screens — open on a laptop for full syntax
          highlighting.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {selector}
      <div className="overflow-hidden rounded-xl border border-[var(--border)]">
        <Editor
          height={height}
          language={language}
          defaultValue={defaultValue}
          theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
          onChange={(value) => onChange(value ?? "")}
          loading={
            <div className="flex h-full items-center justify-center text-[var(--muted-foreground)]">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          }
          options={{
            readOnly: readOnly || disabled,
            domReadOnly: readOnly || disabled,
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: "on",
            padding: { top: 12, bottom: 12 },
            scrollbar: { alwaysConsumeMouseWheel: false },
          }}
        />
      </div>
    </div>
  );
}
