"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Play, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { FormError } from "@/components/auth/FormError";
import { ConfirmDelete } from "@/components/admin/ConfirmDelete";
import { ImportDialog } from "@/components/admin/dojo/ImportDialog";
import { DifficultyBadge } from "@/components/dojo/DifficultyBadge";
import { useDojoDraft } from "@/components/dojo/useDojoDraft";
import { TestResults } from "@/components/code/TestResults";
import { useJsRunner } from "@/components/code/useJsRunner";
import type { DojoDifficulty } from "@/lib/dojo/types";
import type { TestCase } from "@/components/code/types";
import {
  createDojoQuestion,
  deleteDojoQuestion,
  toggleDojoQuestion,
  updateDojoQuestion,
} from "@/lib/actions/admin/dojo";

export interface DojoAdminRow {
  id: string;
  slug: string;
  title: string;
  prompt: string;
  difficulty: DojoDifficulty;
  fnName: string;
  starterCode: string;
  testCases: TestCase[];
  isActive: boolean;
  topics: string[];
}

const DIFFICULTIES: DojoDifficulty[] = ["easy", "medium", "hard"];

const STARTER_TEMPLATE = "function solve(input) {\n  // your solution\n}\n";
const TESTS_TEMPLATE = `[
  { "input": [1, 2], "expected": 3 }
]`;

export function DojoAdmin({
  rows,
  topicSuggestions,
}: {
  rows: DojoAdminRow[];
  topicSuggestions: string[];
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Code Dojo</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Practice problems for the personal coding ground. {rows.length} total.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportDialog />
          <QuestionDialog
            topicSuggestions={topicSuggestions}
            trigger={
              <Button>
                <Plus className="h-4 w-4" /> Add question
              </Button>
            }
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-[var(--muted)] text-left text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-2.5 font-medium">Problem</th>
              <th className="px-4 py-2.5 font-medium">Difficulty</th>
              <th className="px-4 py-2.5 font-medium">Topics</th>
              <th className="px-4 py-2.5 font-medium">Active</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                  No problems yet — add your first one.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="align-middle">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.title}</div>
                    <div className="font-mono text-xs text-[var(--muted-foreground)]">
                      {row.slug}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <DifficultyBadge difficulty={row.difficulty} />
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">
                    {row.topics.join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ToggleActive id={row.id} isActive={row.isActive} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <QuestionDialog
                        topicSuggestions={topicSuggestions}
                        row={row}
                        trigger={
                          <Button variant="ghost" size="sm" aria-label="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <ConfirmDelete
                        action={() => deleteDojoQuestion({ id: row.id })}
                        title="Delete this problem?"
                        description="This permanently removes the problem. Problems with practice history can't be deleted — deactivate them instead."
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ToggleActive({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Switch
      checked={isActive}
      disabled={pending}
      aria-label="Toggle active"
      onCheckedChange={(v) =>
        start(async () => {
          const res = await toggleDojoQuestion({ id, isActive: v });
          if (res.ok) router.refresh();
          else window.alert(res.error ?? "Could not update.");
        })
      }
    />
  );
}

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

interface FormValue {
  slug: string;
  title: string;
  difficulty: DojoDifficulty;
  fnName: string;
  topicsText: string;
  starterCode: string;
  prompt: string;
  testCasesJson: string;
}

function rowToForm(row?: DojoAdminRow): FormValue {
  if (!row) {
    return {
      slug: "",
      title: "",
      difficulty: "easy",
      fnName: "solve",
      topicsText: "",
      starterCode: STARTER_TEMPLATE,
      prompt: "",
      testCasesJson: TESTS_TEMPLATE,
    };
  }
  return {
    slug: row.slug,
    title: row.title,
    difficulty: row.difficulty,
    fnName: row.fnName,
    topicsText: row.topics.join(", "),
    starterCode: row.starterCode,
    prompt: row.prompt,
    testCasesJson: JSON.stringify(row.testCases, null, 2),
  };
}

/** Add/Edit dialog. `row` undefined → create mode. */
function QuestionDialog({
  trigger,
  row,
  topicSuggestions,
}: {
  trigger: React.ReactNode;
  row?: DojoAdminRow;
  topicSuggestions: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<FormValue>(() => rowToForm(row));
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  // Reference-solution validator (not saved — just confirms the test cases).
  const { state: runState, run } = useJsRunner();
  const [refSolution, setRefSolution] = useState("");

  // AI draft: fills the form fields (admin then verifies + saves as a built-in).
  const { generate: genDraft, generating, error: genError } = useDojoDraft();
  const [genTopic, setGenTopic] = useState("");
  const [genPrompt, setGenPrompt] = useState("");

  const set = (patch: Partial<FormValue>) => setValue((v) => ({ ...v, ...patch }));

  const kebab = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  async function aiDraft() {
    setError(undefined);
    const d = await genDraft({
      topic: genTopic.trim() || undefined,
      difficulty: value.difficulty,
      prompt: genPrompt.trim() || undefined,
    });
    if (!d) return;
    set({
      title: d.title,
      slug: kebab(d.title),
      prompt: d.prompt,
      difficulty: d.difficulty,
      fnName: d.fnName,
      starterCode: d.starterCode,
      topicsText: d.topics.join(", "),
      testCasesJson: JSON.stringify(d.testCases, null, 2),
    });
    setRefSolution(d.referenceSolution);
  }

  function onOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (next) {
      setValue(rowToForm(row));
      setError(undefined);
      setRefSolution("");
    }
  }

  /** Parse + validate the test-cases JSON, returning the array or null. */
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
    run(refSolution || value.starterCode, value.fnName, tests);
  }

  function submit() {
    setError(undefined);
    const tests = parseTests();
    if (!tests) return;
    const topics = value.topicsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      slug: value.slug.trim(),
      title: value.title.trim(),
      prompt: value.prompt,
      difficulty: value.difficulty,
      fnName: value.fnName.trim(),
      starterCode: value.starterCode,
      testCases: tests,
      topics,
    };

    start(async () => {
      const res = row
        ? await updateDojoQuestion({ ...payload, id: row.id, isActive: row.isActive })
        : await createDojoQuestion(payload);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error ?? "Could not save.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{row ? "Edit problem" : "Add problem"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* AI draft — fills the fields below; verify + save as usual. */}
          <div className="space-y-2 rounded-lg border border-[var(--primary)]/20 bg-[var(--primary)]/[0.05] p-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
              <Sparkles className="h-3.5 w-3.5" /> Draft with AI
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={genTopic}
                onChange={(e) => setGenTopic(e.target.value)}
                placeholder="Topic (optional)"
                className="h-9 flex-1"
              />
              <Input
                value={genPrompt}
                onChange={(e) => setGenPrompt(e.target.value)}
                placeholder="Describe it (optional)"
                className="h-9 flex-[2]"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void aiDraft()}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Draft
              </Button>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              Uses the difficulty selected below. Fills the fields + reference
              solution — then run it to verify before saving.
            </p>
            {genError && <p className="text-xs text-[var(--destructive)]">{genError}</p>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Title">
              <Input
                value={value.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="Two Sum"
              />
            </Field>
            <Field label="Slug" hint="URL id; lowercase-with-hyphens">
              <Input
                value={value.slug}
                onChange={(e) => set({ slug: e.target.value })}
                placeholder="two-sum"
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
          </div>

          <Field label="Topics" hint="Comma-separated; new ones are created automatically">
            <Input
              value={value.topicsText}
              onChange={(e) => set({ topicsText: e.target.value })}
              placeholder="Arrays, Hash Map"
              list="dojo-topic-suggestions"
            />
            <datalist id="dojo-topic-suggestions">
              {topicSuggestions.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>

          <Field label="Prompt" hint="Problem statement (plain text; examples welcome)">
            <Textarea
              rows={5}
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
            hint='Array of { "input": [args...], "expected": value, "hidden"?: bool }'
          >
            <Textarea
              rows={5}
              spellCheck={false}
              value={value.testCasesJson}
              onChange={(e) => set({ testCasesJson: e.target.value })}
              className="font-mono text-xs"
            />
          </Field>

          {/* Validate the cases against a known-good solution before saving. */}
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
              placeholder={`Paste a correct solution to verify the cases (defaults to the starter code). Must define ${value.fnName || "your function"}().`}
              className="font-mono text-xs"
            />
            {runState.status !== "idle" && <TestResults state={runState} />}
          </div>

          {error && <FormError message={error} />}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton loading={pending} loadingText="Saving…" onClick={submit}>
            {row ? "Save changes" : "Create problem"}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
