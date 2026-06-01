"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CodeEditor as SharedEditor } from "@/components/code/CodeEditor";

/** Languages offered in the editor's selector (kept small to start). */
export const EDITOR_LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
] as const;

export type EditorLanguage = (typeof EDITOR_LANGUAGES)[number]["value"];

interface Props {
  /** Initial code. The editor stays uncontrolled to callers — reads flow via onChange. */
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
 * Interview coding editor — a thin adapter over the shared {@link SharedEditor}
 * so interviews get its keyboard shortcuts, Format/Copy, mobile + offline
 * fallback, and polished theme. Keeps the language selector and the original
 * uncontrolled (`defaultValue` + `onChange`) contract so `InterviewRunner`'s
 * answer queue / per-question remount are unchanged.
 */
export function CodeEditor({
  defaultValue,
  defaultLanguage = "javascript",
  onChange,
  readOnly = false,
  disabled = false,
  height = 360,
}: Props) {
  const [code, setCode] = useState(defaultValue);
  const [language, setLanguage] = useState<string>(defaultLanguage);

  function change(value: string) {
    setCode(value);
    onChange(value);
  }

  return (
    <div className="space-y-2">
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

      <div
        className="overflow-hidden rounded-xl border border-[var(--border)]"
        style={{ height }}
      >
        <SharedEditor
          value={code}
          onChange={change}
          language={language}
          readOnly={readOnly || disabled}
          height="100%"
        />
      </div>
    </div>
  );
}
