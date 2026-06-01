"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/chip";
import { FormError } from "@/components/auth/FormError";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDelete } from "@/components/admin/ConfirmDelete";
import {
  bulkDelete,
  bulkSetActive,
  createQuestion,
  deleteQuestion,
  importQuestionsFromJson,
  toggleQuestion,
  updateQuestion,
} from "@/lib/actions/admin/questions";
import type { ImportReport } from "@/lib/questions/import";

/* --------------------------------- Types ---------------------------------- */

type Category = "technical" | "behavioral";
type Modality = "text" | "coding";

interface Taxon {
  id: string;
  jobRoleId: string;
  name: string;
}
interface RoleRef {
  id: string;
  name: string;
}
export interface QuestionRow {
  id: string;
  roleId: string;
  techStackId: string;
  roleName: string;
  techName: string;
  category: Category;
  modality: Modality;
  isActive: boolean;
  questionText: string;
  idealAnswer: string;
}
export interface QuestionFilters {
  role: string;
  tech: string;
  category: string;
  q: string;
}
interface Props {
  roles: RoleRef[];
  techStacks: Taxon[];
  questions: QuestionRow[];
  filters: QuestionFilters;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const CATEGORIES = [
  { value: "technical", label: "Technical" },
  { value: "behavioral", label: "Behavioral" },
] as const;

const MODALITIES = [
  { value: "text", label: "Text" },
  { value: "coding", label: "Code" },
] as const;

const label = (
  opts: readonly { value: string; label: string }[],
  v: string,
) => opts.find((o) => o.value === v)?.label ?? v;

/* ------------------------------- Component -------------------------------- */

export function QuestionsAdmin({
  roles,
  techStacks,
  questions,
  filters,
  total,
  page,
  pageSize,
  totalPages,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === "all" || value === "") params.delete(key);
        else params.set(key, value);
      }
      if (!("page" in updates)) params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const roleScope = filters.role === "all" ? null : filters.role;
  const techOptions = useMemo(
    () => techStacks.filter((t) => !roleScope || t.jobRoleId === roleScope),
    [techStacks, roleScope],
  );

  function onRoleChange(value: string) {
    setParams({ role: value, tech: "all" });
  }

  // Debounced search → URL.
  const [searchText, setSearchText] = useState(filters.q);
  const [prevQ, setPrevQ] = useState(filters.q);
  if (prevQ !== filters.q) {
    setPrevQ(filters.q);
    setSearchText(filters.q);
  }
  useEffect(() => {
    if (searchText === filters.q) return;
    const t = setTimeout(() => setParams({ q: searchText }), 400);
    return () => clearTimeout(t);
  }, [searchText, filters.q, setParams]);

  // Row selection (current page only).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const pageIds = useMemo(() => questions.map((q) => q.id), [questions]);
  const pageKey = pageIds.join(",");
  const [prevPageKey, setPrevPageKey] = useState(pageKey);
  if (prevPageKey !== pageKey) {
    setPrevPageKey(pageKey);
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => pageIds.includes(id)));
      return next.size === prev.size ? prev : next;
    });
  }
  const allSelected = questions.length > 0 && selected.size === questions.length;

  const hasFilters =
    filters.role !== "all" ||
    filters.tech !== "all" ||
    filters.category !== "all" ||
    filters.q !== "";

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Question Bank</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Curated questions served in Question Bank interviews. Inactive ones
            are skipped.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportDialog />
          <QuestionDialog
            roles={roles}
            techStacks={techStacks}
            trigger={
              <Button>
                <Plus /> Add question
              </Button>
            }
          />
        </div>
      </div>

      {/* Filters: Role · Tech · Category · Search */}
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect
          label="Profession"
          value={filters.role}
          onChange={onRoleChange}
          allLabel="All professions"
          options={roles.map((r) => ({ value: r.id, label: r.name }))}
        />
        <FilterSelect
          label="Specialization"
          value={filters.tech}
          onChange={(v) => setParams({ tech: v })}
          allLabel="All specializations"
          options={techOptions.map((t) => ({ value: t.id, label: t.name }))}
        />
        <FilterSelect
          label="Category"
          value={filters.category}
          onChange={(v) => setParams({ category: v })}
          allLabel="All categories"
          options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
        />
        <div className="space-y-1.5">
          <Label>Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search question text…"
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--muted-foreground)]">
        <span>
          {total === 0
            ? "No matching questions"
            : `Showing ${start}–${end} of ${total} question${total === 1 ? "" : "s"}`}
        </span>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
            <X className="h-4 w-4" /> Clear filters
          </Button>
        )}
      </div>

      {selected.size > 0 && (
        <BulkBar ids={[...selected]} onCleared={() => setSelected(new Set())} />
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <CheckBox
                  checked={allSelected}
                  onChange={() =>
                    setSelected(allSelected ? new Set() : new Set(pageIds))
                  }
                  aria-label="Select all on page"
                />
              </TableHead>
              <TableHead className="w-full">Question</TableHead>
              <TableHead className="whitespace-nowrap">Category</TableHead>
              <TableHead className="whitespace-nowrap">Answers</TableHead>
              <TableHead className="whitespace-nowrap">Active</TableHead>
              <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.map((q) => (
              <TableRow key={q.id} data-selected={selected.has(q.id)}>
                <TableCell className="align-top">
                  <CheckBox
                    checked={selected.has(q.id)}
                    onChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        next.has(q.id) ? next.delete(q.id) : next.add(q.id);
                        return next;
                      })
                    }
                    aria-label="Select question"
                  />
                </TableCell>
                <TableCell className="py-3">
                  <span className="line-clamp-2 text-sm font-medium">
                    {q.questionText}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--muted-foreground)]">
                    {q.roleName} · {q.techName}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap align-top">
                  <Chip tone={q.category === "behavioral" ? "neutral" : "accent"}>
                    {label(CATEGORIES, q.category)}
                  </Chip>
                </TableCell>
                <TableCell className="align-top text-xs">
                  {label(MODALITIES, q.modality)}
                </TableCell>
                <TableCell className="align-top">
                  <ToggleActive id={q.id} isActive={q.isActive} />
                </TableCell>
                <TableCell className="align-top">
                  <div className="flex justify-end gap-0.5">
                    <EditQuestionDialog
                      question={q}
                      roles={roles}
                      techStacks={techStacks}
                    />
                    <ConfirmDelete
                      title="Delete this question?"
                      action={() => deleteQuestion({ id: q.id })}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {questions.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-[var(--muted-foreground)]"
                >
                  No questions match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-[var(--muted-foreground)]">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setParams({ page: String(page - 1) })}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setParams({ page: String(page + 1) })}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Sub-components ----------------------------- */

function FilterSelect({
  label,
  value,
  onChange,
  allLabel,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={`Filter by ${label}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CheckBox({
  checked,
  onChange,
  ...props
}: {
  checked: boolean;
  onChange: () => void;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 cursor-pointer rounded border-[var(--border)] accent-[var(--primary)]"
      {...props}
    />
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
          try {
            const res = await toggleQuestion({ id, isActive: v });
            if (!res.ok) {
              window.alert(res.error ?? "Could not update the question.");
              return;
            }
            router.refresh();
          } catch {
            window.alert("Could not update the question.");
          }
        })
      }
    />
  );
}

function BulkBar({ ids, onCleared }: { ids: string[]; onCleared: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string>();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setMessage(undefined);
    start(async () => {
      const res = await fn();
      if (res.error) setMessage(res.error);
      if (res.ok) {
        if (!res.error) onCleared();
        router.refresh();
      }
    });
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-2">
      <span className="text-sm font-medium">{ids.length} selected</span>
      <div className="ml-auto flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run(() => bulkSetActive({ ids, isActive: true }))}
        >
          Activate
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run(() => bulkSetActive({ ids, isActive: false }))}
        >
          Deactivate
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-[var(--destructive)] text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
          disabled={pending}
          onClick={() => run(() => bulkDelete({ ids }))}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>
      {message && (
        <p className="w-full text-xs text-[var(--muted-foreground)]">{message}</p>
      )}
    </div>
  );
}

/* --------------------------- Add / Edit dialogs ---------------------------- */

interface QuestionFormValue {
  roleId: string;
  techStackId: string;
  category: Category;
  modality: Modality;
  questionText: string;
  idealAnswer: string;
}

function QuestionFields({
  roles,
  techStacks,
  value,
  onChange,
}: {
  roles: RoleRef[];
  techStacks: Taxon[];
  value: QuestionFormValue;
  onChange: (v: QuestionFormValue) => void;
}) {
  const roleTech = techStacks.filter((t) => t.jobRoleId === value.roleId);
  const isCoding = value.modality === "coding";
  const set = (patch: Partial<QuestionFormValue>) =>
    onChange({ ...value, ...patch });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Role">
          <Select
            value={value.roleId}
            onValueChange={(v) =>
              set({
                roleId: v,
                techStackId:
                  techStacks.find((t) => t.jobRoleId === v)?.id ?? "",
              })
            }
          >
            <SelectTrigger aria-label="Profession">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Specialization">
          <Select
            value={value.techStackId}
            onValueChange={(v) => set({ techStackId: v })}
          >
            <SelectTrigger aria-label="Specialization">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {roleTech.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Category">
          <Select
            value={value.category}
            onValueChange={(v) => set({ category: v as Category })}
          >
            <SelectTrigger aria-label="Category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="How candidate answers">
          <Select
            value={value.modality}
            onValueChange={(v) => set({ modality: v as Modality })}
          >
            <SelectTrigger aria-label="Modality">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODALITIES.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label={isCoding ? "Problem prompt" : "Question"}>
        <Textarea
          rows={3}
          value={value.questionText}
          onChange={(e) => set({ questionText: e.target.value })}
          placeholder={
            isCoding ? "State the task, inputs/outputs, and an example…" : undefined
          }
        />
      </Field>
      <Field label={isCoding ? "Ideal solution" : "Ideal answer"}>
        <Textarea
          rows={isCoding ? 6 : 3}
          value={value.idealAnswer}
          onChange={(e) => set({ idealAnswer: e.target.value })}
          className={isCoding ? "font-mono text-sm" : undefined}
          placeholder={isCoding ? "A complete reference solution (JavaScript)…" : undefined}
        />
      </Field>
      {isCoding && (
        <p className="text-xs text-[var(--muted-foreground)]">
          Coding questions are answered in a JavaScript editor.
        </p>
      )}
    </div>
  );
}

function QuestionDialog({
  roles,
  techStacks,
  trigger,
}: {
  roles: RoleRef[];
  techStacks: Taxon[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [value, setValue] = useState<QuestionFormValue>(() => ({
    roleId: roles[0]?.id ?? "",
    techStackId: techStacks.find((t) => t.jobRoleId === roles[0]?.id)?.id ?? "",
    category: "technical",
    modality: "text",
    questionText: "",
    idealAnswer: "",
  }));

  function submit() {
    setError(undefined);
    start(async () => {
      const res = await createQuestion(value);
      if (res.ok) {
        setOpen(false);
        setValue((v) => ({ ...v, questionText: "", idealAnswer: "" }));
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add question</DialogTitle>
        </DialogHeader>
        <QuestionFields
          roles={roles}
          techStacks={techStacks}
          value={value}
          onChange={setValue}
        />
        {error && <FormError message={error} />}
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={pending || !value.techStackId}
          >
            Create question
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditQuestionDialog({
  question,
  roles,
  techStacks,
}: {
  question: QuestionRow;
  roles: RoleRef[];
  techStacks: Taxon[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [isActive, setIsActive] = useState(question.isActive);
  const [value, setValue] = useState<QuestionFormValue>({
    roleId: question.roleId,
    techStackId: question.techStackId,
    category: question.category,
    modality: question.modality,
    questionText: question.questionText,
    idealAnswer: question.idealAnswer,
  });

  function submit() {
    setError(undefined);
    start(async () => {
      const res = await updateQuestion({ id: question.id, ...value, isActive });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit question</DialogTitle>
        </DialogHeader>
        <QuestionFields
          roles={roles}
          techStacks={techStacks}
          value={value}
          onChange={setValue}
        />
        <div className="mt-3 flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <span className="text-sm">Active</span>
        </div>
        {error && <FormError message={error} />}
        <DialogFooter>
          <Button onClick={submit} disabled={pending || !value.techStackId}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Import dialog ------------------------------ */

const IMPORT_SAMPLE = `[
  {
    "role": "Software Developer",
    "techStack": "React",
    "category": "technical",
    "modality": "text",
    "questions": [
      { "questionText": "…", "idealAnswer": "…" }
    ]
  }
]`;

function ImportDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [json, setJson] = useState("");
  const [report, setReport] = useState<ImportReport>();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function run(dryRun: boolean) {
    setError(undefined);
    start(async () => {
      const res = await importQuestionsFromJson({ json, dryRun });
      if (!res.ok) {
        setError(res.error);
        setReport(undefined);
        return;
      }
      setReport(res.report);
      if (!dryRun) router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setReport(undefined);
          setError(undefined);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload /> Bulk JSON import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import questions from JSON</DialogTitle>
          <DialogDescription>
            Paste an array of blocks. Profession and specialization are matched{" "}
            <strong>by name</strong> (case-insensitive). Re-importing the same
            file inserts nothing new. Validate first to preview.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            rows={10}
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder={IMPORT_SAMPLE}
            className="font-mono text-xs"
            aria-label="Import JSON"
          />
          <details className="text-xs text-[var(--muted-foreground)]">
            <summary className="cursor-pointer">Expected format</summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--muted)] p-2">
              {IMPORT_SAMPLE}
            </pre>
            <p className="mt-1">
              <code>category</code>: technical · behavioral.{" "}
              <code>modality</code> (optional): text · coding (default text).
            </p>
          </details>
          {report && <ImportReportView report={report} />}
          {error && <FormError message={error} />}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Close</Button>
          </DialogClose>
          <Button
            variant="outline"
            disabled={pending || !json.trim()}
            onClick={() => run(true)}
          >
            {pending ? "Working…" : "Validate (dry run)"}
          </Button>
          <Button disabled={pending || !json.trim()} onClick={() => run(false)}>
            {pending ? "Working…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportReportView({ report }: { report: ImportReport }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3 text-sm">
      <p className="font-medium">
        {report.dryRun ? "Dry run — nothing written." : "Imported."}{" "}
        <span className="text-[var(--primary)]">
          {report.dryRun ? "Would insert" : "Inserted"} {report.inserted}
        </span>
        , {report.duplicates} duplicate(s) skipped
        {report.blocksFailed > 0 && (
          <span className="text-[var(--destructive)]">
            , {report.blocksFailed} block(s) failed
          </span>
        )}
        .
      </p>
      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
        {report.blocks.map((b) => (
          <li
            key={b.index}
            className={
              b.status === "error" ? "text-[var(--destructive)]" : undefined
            }
          >
            {b.status === "ok" && `✓ ${b.label}: +${b.inserted}`}
            {b.status === "empty" && `• ${b.label}: nothing new`}
            {b.status === "error" && `✗ ${b.label}: ${b.error}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
