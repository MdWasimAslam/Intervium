import type * as MonacoTypes from "monaco-editor";

/** Background of the default dark theme — used as a wrapper fallback. */
export const EDITOR_BG = "#0f1117";

export interface EditorThemeDef {
  id: string;
  label: string;
  /** Editor background — drives the wrapper colour so there's no load seam. */
  bg: string;
  light?: boolean;
  /** Custom theme data; omitted for Monaco built-ins (id IS the built-in name). */
  data?: MonacoTypes.editor.IStandaloneThemeData;
}

/** Shared dark suggest-widget tint so popups read on any dark theme. */
function dark(
  bg: string,
  fg: string,
  p: {
    comment: string;
    keyword: string;
    string: string;
    number: string;
    type: string;
    cursor: string;
    line: string;
    selection: string;
    lineNumber: string;
    widget: string;
  },
): MonacoTypes.editor.IStandaloneThemeData {
  return {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: p.comment.slice(1), fontStyle: "italic" },
      { token: "keyword", foreground: p.keyword.slice(1) },
      { token: "string", foreground: p.string.slice(1) },
      { token: "number", foreground: p.number.slice(1) },
      { token: "type", foreground: p.type.slice(1) },
    ],
    colors: {
      "editor.background": bg,
      "editor.foreground": fg,
      "editorCursor.foreground": p.cursor,
      "editor.lineHighlightBackground": p.line,
      "editor.selectionBackground": p.selection,
      "editorLineNumber.foreground": p.lineNumber,
      "editorGutter.background": bg,
      "editorWidget.background": p.widget,
      "editorSuggestWidget.background": p.widget,
      "editorSuggestWidget.border": "#ffffff14",
      "scrollbarSlider.background": "#ffffff14",
      "scrollbarSlider.hoverBackground": "#ffffff22",
    },
  };
}

export const EDITOR_THEMES: EditorThemeDef[] = [
  {
    id: "dojo-dark",
    label: "Dojo Dark",
    bg: EDITOR_BG,
    data: dark(EDITOR_BG, "#e5e7eb", {
      comment: "#6b7280",
      keyword: "#7dd3fc",
      string: "#86efac",
      number: "#fca5a5",
      type: "#f0abfc",
      cursor: "#34d399",
      line: "#171a21",
      selection: "#2563eb40",
      lineNumber: "#3f4654",
      widget: "#161922",
    }),
  },
  {
    id: "github-dark",
    label: "GitHub Dark",
    bg: "#0d1117",
    data: dark("#0d1117", "#c9d1d9", {
      comment: "#8b949e",
      keyword: "#ff7b72",
      string: "#a5d6ff",
      number: "#79c0ff",
      type: "#ffa657",
      cursor: "#58a6ff",
      line: "#161b22",
      selection: "#264f7855",
      lineNumber: "#484f58",
      widget: "#161b22",
    }),
  },
  {
    id: "dracula",
    label: "Dracula",
    bg: "#282a36",
    data: dark("#282a36", "#f8f8f2", {
      comment: "#6272a4",
      keyword: "#ff79c6",
      string: "#f1fa8c",
      number: "#bd93f9",
      type: "#8be9fd",
      cursor: "#f8f8f0",
      line: "#44475a55",
      selection: "#44475a",
      lineNumber: "#6272a4",
      widget: "#343746",
    }),
  },
  {
    id: "nord",
    label: "Nord",
    bg: "#2e3440",
    data: dark("#2e3440", "#d8dee9", {
      comment: "#616e88",
      keyword: "#81a1c1",
      string: "#a3be8c",
      number: "#b48ead",
      type: "#8fbcbb",
      cursor: "#d8dee9",
      line: "#3b4252",
      selection: "#434c5e",
      lineNumber: "#4c566a",
      widget: "#3b4252",
    }),
  },
  {
    id: "monokai",
    label: "Monokai",
    bg: "#272822",
    data: dark("#272822", "#f8f8f2", {
      comment: "#88846f",
      keyword: "#f92672",
      string: "#e6db74",
      number: "#ae81ff",
      type: "#66d9ef",
      cursor: "#f8f8f0",
      line: "#3e3d32",
      selection: "#49483e",
      lineNumber: "#90908a",
      widget: "#34352c",
    }),
  },
  { id: "vs-dark", label: "VS Dark", bg: "#1e1e1e" },
  { id: "vs", label: "Light", bg: "#ffffff", light: true },
  { id: "hc-black", label: "High Contrast", bg: "#000000" },
];

/** Register every custom theme (built-ins are skipped). Idempotent per monaco. */
export function defineEditorThemes(monaco: typeof import("monaco-editor")) {
  for (const t of EDITOR_THEMES) {
    if (t.data) monaco.editor.defineTheme(t.id, t.data);
  }
}

export function themeBg(id: string): string {
  return EDITOR_THEMES.find((t) => t.id === id)?.bg ?? EDITOR_BG;
}

export function isLightTheme(id: string): boolean {
  return EDITOR_THEMES.find((t) => t.id === id)?.light ?? false;
}

export function isValidTheme(id: string): boolean {
  return EDITOR_THEMES.some((t) => t.id === id);
}
