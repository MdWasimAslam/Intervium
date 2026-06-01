"use client";

import { useEffect, useRef, useState } from "react";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import type * as MonacoTypes from "monaco-editor";
import { Check, Copy, Loader2, Star, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { useCoarsePointer } from "./use-coarse-pointer";
import {
  EDITOR_BG,
  EDITOR_THEMES,
  defineEditorThemes,
  themeBg,
} from "./editor-themes";
import {
  saveDefaultTheme,
  setSessionTheme,
  useEditorTheme,
  useSavedDefaultTheme,
} from "./editor-theme-store";

export { EDITOR_BG } from "./editor-themes";

/** console.* + a few control-flow snippets (ES7-extension style). Once-only. */
let snippetsRegistered = false;
function registerSnippets(monaco: Monaco) {
  if (snippetsRegistered) return;
  snippetsRegistered = true;
  const Kind = monaco.languages.CompletionItemKind.Snippet;
  const asSnippet = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;

  const SNIPPETS: { label: string; insertText: string; detail: string }[] = [
    { label: "log", insertText: "console.log($1);", detail: "console.log()" },
    { label: "clg", insertText: "console.log($1);", detail: "console.log()" },
    { label: "cer", insertText: "console.error($1);", detail: "console.error()" },
    { label: "cwa", insertText: "console.warn($1);", detail: "console.warn()" },
    { label: "cin", insertText: "console.info($1);", detail: "console.info()" },
    { label: "cta", insertText: "console.table($1);", detail: "console.table()" },
    {
      label: "fn",
      insertText: "function ${1:name}(${2:args}) {\n\t$0\n}",
      detail: "function",
    },
    {
      label: "afn",
      insertText: "const ${1:name} = (${2:args}) => {\n\t$0\n};",
      detail: "arrow function",
    },
    {
      label: "fore",
      insertText:
        "for (let ${1:i} = 0; ${1:i} < ${2:arr}.length; ${1:i}++) {\n\t$0\n}",
      detail: "for loop",
    },
  ];

  const provider: MonacoTypes.languages.CompletionItemProvider = {
    provideCompletionItems(
      model: MonacoTypes.editor.ITextModel,
      position: MonacoTypes.Position,
    ) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      return {
        suggestions: SNIPPETS.map((s) => ({
          label: s.label,
          kind: Kind,
          insertText: s.insertText,
          insertTextRules: asSnippet,
          detail: s.detail,
          range,
        })),
      };
    },
  };
  for (const lang of ["javascript", "typescript"]) {
    monaco.languages.registerCompletionItemProvider(lang, provider);
  }
}

const MONACO_LOAD_TIMEOUT_MS = 10_000;

/**
 * Themed Monaco editor wrapper — keyboard shortcuts (Cmd/Ctrl+Enter → Run,
 * +Shift → Submit, Shift+Alt+F → Format, Cmd/Ctrl+S → Run), Format/Copy, a
 * theme switcher with "set as default", console.* snippets, a touch + offline
 * textarea fallback, and overflow-safe suggestion popups. Shared everywhere.
 */
export function CodeEditor({
  value,
  onChange,
  language = "javascript",
  readOnly = false,
  height = "100%",
  onRun,
  onSubmit,
  layoutSignal,
}: {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  height?: string | number;
  onRun?: () => void;
  onSubmit?: () => void;
  layoutSignal?: number;
}) {
  const coarse = useCoarsePointer();
  const theme = useEditorTheme();
  const savedTheme = useSavedDefaultTheme();
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const handlers = useRef({ onRun, onSubmit });
  useEffect(() => {
    handlers.current = { onRun, onSubmit };
  });

  useEffect(() => {
    if (coarse || loaded) return;
    const t = setTimeout(() => setLoadFailed(true), MONACO_LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [coarse, loaded]);

  useEffect(() => {
    if (layoutSignal === undefined) return;
    const id = requestAnimationFrame(() => editorRef.current?.layout());
    return () => cancelAnimationFrame(id);
  }, [layoutSignal]);

  function beforeMount(monaco: Monaco) {
    defineEditorThemes(monaco);
    registerSnippets(monaco);
  }

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    setLoaded(true);
    const format = () => editor.getAction("editor.action.formatDocument")?.run();
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
      handlers.current.onRun?.(),
    );
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
      () => handlers.current.onSubmit?.(),
    );
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () =>
      handlers.current.onRun?.(),
    );
    editor.addCommand(
      monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
      () => format(),
    );
  };

  function formatNow() {
    editorRef.current?.getAction("editor.action.formatDocument")?.run();
  }
  function copyNow() {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  const bg = themeBg(theme);

  // Touch / small screen, or Monaco failed to load → monospace textarea.
  if (coarse || loadFailed) {
    return (
      <div className="flex h-full flex-col" style={{ background: EDITOR_BG }}>
        <Textarea
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          spellCheck={false}
          className="h-full w-full resize-none rounded-none border-0 bg-transparent font-mono text-sm text-[#e5e7eb]"
        />
        {loadFailed && (
          <p className="px-3 py-1 text-xs text-[var(--muted-foreground)]">
            Simplified editor — the full editor couldn&apos;t load.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-full" style={{ background: bg }}>
      {loaded && (
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
          <select
            value={theme}
            onChange={(e) => setSessionTheme(e.target.value)}
            aria-label="Editor theme"
            className="h-7 rounded-md bg-[#1b1f29]/85 px-1.5 text-xs text-[#cbd5e1] ring-1 ring-white/10 outline-none backdrop-blur"
          >
            {EDITOR_THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          {theme !== savedTheme && (
            <button
              type="button"
              onClick={() => saveDefaultTheme(theme)}
              title="Save as your default theme"
              className="inline-flex h-7 items-center gap-1 rounded-md bg-[#1b1f29]/85 px-2 text-xs text-[#cbd5e1] ring-1 ring-white/10 backdrop-blur transition-colors hover:text-white"
            >
              <Star className="h-3.5 w-3.5" /> Set default
            </button>
          )}
          <ToolbarButton onClick={formatNow} title="Format (Shift+Alt+F)">
            <Wand2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={copyNow} title="Copy code">
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </ToolbarButton>
        </div>
      )}
      <Editor
        height={height}
        language={language}
        theme={theme}
        beforeMount={beforeMount}
        onMount={handleMount}
        value={value}
        onChange={(v) => onChange?.(v ?? "")}
        loading={
          <span className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading editor…
          </span>
        }
        options={{
          readOnly,
          fontSize: 14,
          fontFamily:
            "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace",
          fontLigatures: true,
          lineHeight: 1.6,
          tabSize: 2,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          fixedOverflowWidgets: true,
          padding: { top: 14, bottom: 14 },
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          renderLineHighlight: "all",
          roundedSelection: true,
          scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true },
          suggestSelection: "first",
          formatOnPaste: true,
        }}
      />
    </div>
  );
}

function ToolbarButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-[#9ca3af]",
        "bg-[#1b1f29]/80 ring-1 ring-white/10 backdrop-blur transition-colors hover:text-white hover:bg-[#252b38]",
      )}
    >
      {children}
    </button>
  );
}
