"use client";

import { useState, useTransition } from "react";
import { FileJson, Loader2, Pencil, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TabButton } from "@/components/ui/TabButton";
import { FormError } from "@/components/auth/FormError";
import { TestResults } from "@/components/code/TestResults";
import { useJsRunner } from "@/components/code/useJsRunner";
import {
  createPersonalDojoQuestion,
  importPersonalDojoQuestions,
} from "@/lib/actions/dojo";
import type { DojoDifficulty } from "@/lib/dojo/types";
import type { TestCase } from "@/components/code/types";

const DIFFICULTIES: DojoDifficulty[] = ["easy", "medium", "hard"];
const STARTER_TEMPLATE = "function solve(input) {\n  // your solution\n}\n";
const TESTS_TEMPLATE = `[
  { "input": [1, 2], "expected": 3 }
]`;

/** Copyable sample for the JSON import (a single object or an array works). */
const SAMPLE_JSON = `[
  {
    "title": "Sum Two Numbers",
    "difficulty": "easy",
    "fnName": "add",
    "topics": ["Math"],
    "prompt": "Return the sum of two numbers.\\n\\nExample:\\n  add(2, 3) -> 5",
    "starterCode": "function add(a, b) {\\n  // your solution\\n}\\n",
    "testCases": [
      { "input": [2, 3], "expected": 5 },
      { "input": [-1, 1], "expected": 0 }
    ]
  }
]`;

interface FormValue {
  title: string;
  difficulty: DojoDifficulty;
  fnName: string;
  topicsText: string;
  prompt: string;
  starterCode: string;
  testCasesJson: string;
}

const EMPTY: FormValue = {
  title: "",
  difficulty: "easy",
  fnName: "solve",
  topicsText: "",
  prompt: "",
  starterCode: STARTER_TEMPLATE,
  testCasesJson: TESTS_TEMPLATE,
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </span>
      {children}
      {hint && <span className="block text-xs text-[var(--muted-foreground)]">{hint}</span>}
    </label>
  );
}

/**
 * Manually author a personal practice problem, or import one/many from JSON.
 * The Write tab includes a "validate cases against a reference solution" panel;
 * the Import tab takes a single object or an array (a copyable sample is shown).
 */
export function AddProblemDialog({
  trigger,
  topicSuggestions = [],
  onCreated,
}: {
  trigger: React.ReactNode;
  topicSuggestions?: string[];
  onCreated?: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"write" | "import">("write");
  const [value, setValue] = useState<FormValue>(EMPTY);
  const [refSolution, setRefSolution] = useState("");
  const [importJson, setImportJson] = useState("");
  const [importReport, setImportReport] = useState<{
    created: number;
    failed: number;
  } | null>(null);
  const [error, setError] = useState<string>();
  const [saving, startSave] = useTransition();
  const [importing, startImport] = useTransition();
  const { state: runState, run, reset: resetRun } = useJsRunner();

  const set = (patch: Partial<FormValue>) => setValue((v) => ({ ...v, ...patch }));

  function onOpenChange(next: boolean) {
    if (saving || importing) return;
    setOpen(next);
    if (next) {
      setMode("write");
      setValue(EMPTY);
      setRefSolution("");
      setImportJson("");
      setImportReport(null);
      setError(undefined);
    } else {
      resetRun(); // cancel any in-flight "Run reference solution" worker
    }
  }

  function parseTests(): TestCase[] | null {
    try {
      const parsed = JSON.parse(value.testCasesJson);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setError("Test cases must be a non-empty JSON array.");
        return null;
      }
      return parsed as TestCase[];
    } catch (e) {
      setError(`Invalid test-cases JSON: ${(e as Error).message}`);
      return null;
    }
  }

  function validate() {
    setError(undefined);
    const tests = parseTests();
    if (!tests) return;
    run(refSolution || value.starterCode, value.fnName.trim(), tests);
  }

  function submit() {
    setError(undefined);
    const tests = parseTests();
    if (!tests) return;
    const topics = value.topicsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    startSave(async () => {
      const res = await createPersonalDojoQuestion({
        title: value.title.trim(),
        prompt: value.prompt,
        difficulty: value.difficulty,
        fnName: value.fnName.trim(),
        starterCode: value.starterCode,
        testCases: tests,
        topics,
      });
      if (res.ok) {
        onOpenChange(false);
        onCreated?.(res.data.slug);
      } else {
        setError(res.error);
      }
    });
  }

  function doImport() {
    setError(undefined);
    setImportReport(null);
    startImport(async () => {
      const res = await importPersonalDojoQuestions({ json: importJson });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const { created, failed, firstSlug } = res.data;
      if (created > 0 && failed === 0) {
        onOpenChange(false);
        if (firstSlug) onCreated?.(firstSlug);
      } else {
        setImportReport({ created, failed });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a problem</DialogTitle>
        </DialogHeader>

        <nav className="inline-flex w-fit rounded-full border border-[var(--border)] bg-[var(--card)] p-1">
          <TabButton
            active={mode === "write"}
            onClick={() => setMode("write")}
            icon={<Pencil className="h-4 w-4" />}
          >
            Write
          </TabButton>
          <TabButton
            active={mode === "import"}
            onClick={() => setMode("import")}
            icon={<FileJson className="h-4 w-4" />}
          >
            Import JSON
          </TabButton>
        </nav>

        {mode === "write" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Title">
                <Input
                  value={value.title}
                  onChange={(e) => set({ title: e.target.value })}
                  placeholder="Two Sum"
                />
              </Field>
              <Field label="Difficulty">
                <Select
                  value={value.difficulty}
                  onValueChange={(v) => set({ difficulty: v as DojoDifficulty })}
                >
                  <SelectTrigger aria-label="Difficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d[0].toUpperCase() + d.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Function name" hint="Must match starter code">
                <Input
                  value={value.fnName}
                  onChange={(e) => set({ fnName: e.target.value })}
                  placeholder="twoSum"
                  className="font-mono"
                />
              </Field>
              <Field label="Topics" hint="Comma-separated">
                <Input
                  value={value.topicsText}
                  onChange={(e) => set({ topicsText: e.target.value })}
                  placeholder="Arrays, Hash Map"
                  list="dojo-add-topics"
                />
                <datalist id="dojo-add-topics">
                  {topicSuggestions.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </Field>
            </div>

            <Field label="Prompt" hint="Problem statement (examples welcome)">
              <Textarea
                rows={4}
                value={value.prompt}
                onChange={(e) => set({ prompt: e.target.value })}
                placeholder="Given an array…"
              />
            </Field>

            <Field label="Starter code">
              <Textarea
                rows={4}
                spellCheck={false}
                value={value.starterCode}
                onChange={(e) => set({ starterCode: e.target.value })}
                className="font-mono text-xs"
              />
            </Field>

            <Field
              label="Test cases (JSON)"
              hint='Array of { "input": [args...], "expected": value }'
            >
              <Textarea
                rows={4}
                spellCheck={false}
                value={value.testCasesJson}
                onChange={(e) => set({ testCasesJson: e.target.value })}
                className="font-mono text-xs"
              />
            </Field>

            {/* Optional: verify the cases against a known-good solution. */}
            <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                  Validate cases (optional)
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={validate}
                  disabled={runState.status === "running"}
                >
                  {runState.status === "running" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Run reference solution
                </Button>
              </div>
              <Textarea
                rows={3}
                spellCheck={false}
                value={refSolution}
                onChange={(e) => setRefSolution(e.target.value)}
                placeholder={`Paste a correct solution to verify the cases (defaults to starter code). Must define ${value.fnName || "your function"}().`}
                className="font-mono text-xs"
              />
              {runState.status !== "idle" && <TestResults state={runState} />}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-[var(--muted-foreground)]">
                Paste a single problem object or an array of them.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setImportJson(SAMPLE_JSON)}
              >
                Insert sample
              </Button>
            </div>
            <Textarea
              rows={14}
              spellCheck={false}
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder='[ { "title": "...", "difficulty": "easy", "fnName": "...", "topics": ["..."], "prompt": "...", "starterCode": "...", "testCases": [ { "input": [...], "expected": ... } ] } ]'
              className="font-mono text-xs"
            />
            {importReport && (
              <p className="text-sm text-[var(--foreground)]">
                Imported {importReport.created} problem
                {importReport.created === 1 ? "" : "s"}
                {importReport.failed > 0 && (
                  <span className="text-[var(--destructive)]">
                    {" "}
                    · {importReport.failed} failed validation
                  </span>
                )}
                .
              </p>
            )}
          </div>
        )}

        {error && <FormError message={error} />}

        <DialogFooter>
          <Button
            variant="outline"
            disabled={saving || importing}
            onClick={() => onOpenChange(false)}
          >
            {mode === "import" && importReport ? "Done" : "Cancel"}
          </Button>
          {mode === "write" ? (
            <LoadingButton loading={saving} loadingText="Saving…" onClick={submit}>
              Add to my problems
            </LoadingButton>
          ) : (
            <LoadingButton
              loading={importing}
              loadingText="Importing…"
              disabled={!importJson.trim()}
              onClick={doImport}
            >
              Import
            </LoadingButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
