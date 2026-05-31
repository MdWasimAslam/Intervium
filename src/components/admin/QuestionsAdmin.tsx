"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
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
  duplicateQuestion,
  generateForConfig,
  toggleQuestion,
  updateQuestion,
} from "@/lib/actions/admin/questions";

/* --------------------------------- Types ---------------------------------- */

interface Taxon {
  id: string;
  jobRoleId: string;
  name: string;
}
interface BandRef {
  jobRoleId: string;
  label: string;
}
interface RoleRef {
  id: string;
  name: string;
}
export interface QuestionRow {
  id: string;
  jobRoleId: string;
  techStackId: string;
  focusAreaId: string;
  roleName: string;
  techName: string;
  focusName: string;
  difficulty: string;
  type: "text" | "coding";
  language: string | null;
  source: "ai" | "admin";
  isActive: boolean;
  questionText: string;
  idealAnswer: string;
}
export interface QuestionFilters {
  role: string;
  tech: string;
  focus: string;
  difficulty: string;
  type: string;
  source: string;
  active: string;
  q: string;
}
interface Props {
  roles: RoleRef[];
  techStacks: Taxon[];
  focusAreas: Taxon[];
  bands: BandRef[];
  questions: QuestionRow[];
  filters: QuestionFilters;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const INTERVIEW_TYPES = [
  { value: "technical", label: "Technical" },
  { value: "behavioral", label: "Behavioral" },
  { value: "mixed", label: "Mixed" },
  { value: "coding", label: "Coding" },
] as const;

/** Editor languages offered for coding questions (mirrors the interview editor). */
const CODE_LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
] as const;

/* ------------------------------- Component -------------------------------- */

export function QuestionsAdmin({
  roles,
  techStacks,
  focusAreas,
  bands,
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

  /** Merge updates into the URL query. Any filter change resets to page 1. */
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

  // Dependent option lists — narrow to the selected role when one is chosen.
  const roleScope = filters.role === "all" ? null : filters.role;
  const techOptions = useMemo(
    () => techStacks.filter((t) => !roleScope || t.jobRoleId === roleScope),
    [techStacks, roleScope],
  );
  const focusOptions = useMemo(
    () => focusAreas.filter((f) => !roleScope || f.jobRoleId === roleScope),
    [focusAreas, roleScope],
  );
  const difficultyOptions = useMemo(
    () =>
      Array.from(
        new Set(
          bands
            .filter((b) => !roleScope || b.jobRoleId === roleScope)
            .map((b) => b.label),
        ),
      ),
    [bands, roleScope],
  );

  // When the role changes, drop now-invalid tech/focus/difficulty selections.
  function onRoleChange(value: string) {
    setParams({
      role: value,
      tech: "all",
      focus: "all",
      difficulty: "all",
    });
  }

  // ---- Search box (debounced → URL) -------------------------------------
  const [searchText, setSearchText] = useState(filters.q);
  // Re-sync the box when the URL's q changes externally (e.g. "Clear filters").
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

  // ---- Row selection (current page only) --------------------------------
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const pageIds = useMemo(() => questions.map((q) => q.id), [questions]);
  // Drop selections that left the page (filter/page change) — done during
  // render rather than in an effect to avoid a cascading re-render.
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
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(pageIds));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const hasFilters =
    filters.role !== "all" ||
    filters.tech !== "all" ||
    filters.focus !== "all" ||
    filters.difficulty !== "all" ||
    filters.type !== "all" ||
    filters.source !== "all" ||
    filters.active !== "all" ||
    filters.q !== "";

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Question Bank</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Curate questions. Hand-authored ones join the matching pool by
            signature; inactive ones are skipped during interviews.
          </p>
        </div>
        <div className="flex gap-2">
          <AiGenerateDialog
            roles={roles}
            techStacks={techStacks}
            focusAreas={focusAreas}
            bands={bands}
          />
          <QuestionDialog
            roles={roles}
            techStacks={techStacks}
            focusAreas={focusAreas}
            bands={bands}
            trigger={
              <Button>
                <Plus /> Add question
              </Button>
            }
          />
        </div>
      </div>

      {/* Filters ---------------------------------------------------------- */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <FilterSelect
          label="Role"
          value={filters.role}
          onChange={onRoleChange}
          allLabel="All roles"
          options={roles.map((r) => ({ value: r.id, label: r.name }))}
        />
        <FilterSelect
          label="Tech stack"
          value={filters.tech}
          onChange={(v) => setParams({ tech: v })}
          allLabel="All tech stacks"
          options={techOptions.map((t) => ({ value: t.id, label: t.name }))}
        />
        <FilterSelect
          label="Focus area"
          value={filters.focus}
          onChange={(v) => setParams({ focus: v })}
          allLabel="All focus areas"
          options={focusOptions.map((f) => ({ value: f.id, label: f.name }))}
        />
        <FilterSelect
          label="Difficulty"
          value={filters.difficulty}
          onChange={(v) => setParams({ difficulty: v })}
          allLabel="All difficulties"
          options={difficultyOptions.map((d) => ({ value: d, label: d }))}
        />
        <FilterSelect
          label="Interview type"
          value={filters.type}
          onChange={(v) => setParams({ type: v })}
          allLabel="All types"
          options={INTERVIEW_TYPES.map((t) => ({ value: t.value, label: t.label }))}
        />
        <FilterSelect
          label="Source"
          value={filters.source}
          onChange={(v) => setParams({ source: v })}
          allLabel="All sources"
          options={[
            { value: "admin", label: "Admin" },
            { value: "ai", label: "AI" },
          ]}
        />
        <FilterSelect
          label="Status"
          value={filters.active}
          onChange={(v) => setParams({ active: v })}
          allLabel="Active & inactive"
          options={[
            { value: "active", label: "Active only" },
            { value: "inactive", label: "Inactive only" },
          ]}
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

      {/* Result count + clear --------------------------------------------- */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--muted-foreground)]">
        <span>
          {total === 0
            ? "No matching questions"
            : `Showing ${start}–${end} of ${total} question${total === 1 ? "" : "s"}`}
        </span>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(pathname)}
          >
            <X className="h-4 w-4" /> Clear filters
          </Button>
        )}
      </div>

      {/* Bulk action bar -------------------------------------------------- */}
      {selected.size > 0 && (
        <BulkBar ids={[...selected]} onCleared={() => setSelected(new Set())} />
      )}

      {/* Table ------------------------------------------------------------ */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <CheckBox
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Select all on page"
              />
            </TableHead>
            <TableHead>Question</TableHead>
            <TableHead>Role / Tech / Focus</TableHead>
            <TableHead>Difficulty</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Active</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {questions.map((q) => (
            <TableRow key={q.id} data-selected={selected.has(q.id)}>
              <TableCell>
                <CheckBox
                  checked={selected.has(q.id)}
                  onChange={() => toggleOne(q.id)}
                  aria-label="Select question"
                />
              </TableCell>
              <TableCell className="max-w-xs">
                <span className="line-clamp-2 text-sm">{q.questionText}</span>
              </TableCell>
              <TableCell className="text-xs text-[var(--muted-foreground)]">
                {q.roleName} · {q.techName} · {q.focusName}
              </TableCell>
              <TableCell>{q.difficulty}</TableCell>
              <TableCell>
                <Chip>{q.source}</Chip>
              </TableCell>
              <TableCell>
                <Switch
                  checked={q.isActive}
                  onCheckedChange={(v) =>
                    toggleQuestion({ id: q.id, isActive: v }).then((res) => {
                      if (!res.ok) {
                        window.alert(res.error ?? "Could not update the question.");
                        return;
                      }
                      router.refresh();
                    })
                  }
                  aria-label="Toggle active"
                />
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <DuplicateButton id={q.id} />
                  <EditQuestionDialog
                    question={q}
                    trigger={
                      <Button variant="ghost" size="sm" aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    }
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
                colSpan={7}
                className="py-8 text-center text-[var(--muted-foreground)]"
              >
                No questions match these filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Pagination ------------------------------------------------------- */}
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

/** Native checkbox styled to the design tokens (no checkbox primitive exists). */
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
        // Clear the selection only on a clean run. A partial result (e.g. some
        // rows kept because they're used in sessions) keeps those rows selected
        // so the explanatory message stays visible after the refresh.
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
        <BulkDeleteDialog
          count={ids.length}
          disabled={pending}
          onConfirm={() => run(() => bulkDelete({ ids }))}
        />
      </div>
      {message && (
        <p className="w-full text-xs text-[var(--muted-foreground)]">{message}</p>
      )}
    </div>
  );
}

function BulkDeleteDialog({
  count,
  disabled,
  onConfirm,
}: {
  count: number;
  disabled: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-[var(--destructive)] text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
          disabled={disabled}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {count} question{count === 1 ? "" : "s"}?</DialogTitle>
          <DialogDescription>
            Questions used in past sessions are kept automatically — only unused
            ones are removed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            variant="outline"
            className="border-[var(--destructive)] text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DuplicateButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Duplicate"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await duplicateQuestion({ id });
          if (!res.ok) {
            window.alert(res.error ?? "Could not duplicate the question.");
            return;
          }
          router.refresh();
        })
      }
    >
      <Copy className="h-4 w-4" />
    </Button>
  );
}

/* --------------------------- Config picker (shared) ------------------------ */

function useConfigState(
  roles: RoleRef[],
  techStacks: Taxon[],
  focusAreas: Taxon[],
  bands: BandRef[],
) {
  const [jobRoleId, setJobRoleId] = useState(roles[0]?.id ?? "");
  const roleTech = techStacks.filter((t) => t.jobRoleId === jobRoleId);
  const roleFocus = focusAreas.filter((f) => f.jobRoleId === jobRoleId);
  const roleBands = bands.filter((b) => b.jobRoleId === jobRoleId);

  const [techStackId, setTechStackId] = useState(roleTech[0]?.id ?? "");
  const [focusAreaId, setFocusAreaId] = useState(roleFocus[0]?.id ?? "");
  const [difficulty, setDifficulty] = useState(roleBands[0]?.label ?? "");
  const [interviewType, setInterviewType] = useState<
    "technical" | "behavioral" | "mixed" | "coding"
  >("technical");

  function onRole(id: string) {
    setJobRoleId(id);
    setTechStackId(techStacks.find((t) => t.jobRoleId === id)?.id ?? "");
    setFocusAreaId(focusAreas.find((f) => f.jobRoleId === id)?.id ?? "");
    setDifficulty(bands.find((b) => b.jobRoleId === id)?.label ?? "");
  }

  return {
    jobRoleId,
    techStackId,
    focusAreaId,
    difficulty,
    interviewType,
    roleTech,
    roleFocus,
    roleBands,
    onRole,
    setTechStackId,
    setFocusAreaId,
    setDifficulty,
    setInterviewType,
  };
}

function AiGenerateDialog({
  roles,
  techStacks,
  focusAreas,
  bands,
}: {
  roles: RoleRef[];
  techStacks: Taxon[];
  focusAreas: Taxon[];
  bands: BandRef[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [count, setCount] = useState(5);
  const [pending, start] = useTransition();
  const c = useConfigState(roles, techStacks, focusAreas, bands);

  function submit() {
    setError(undefined);
    setNotice(undefined);
    start(async () => {
      const res = await generateForConfig({
        jobRoleId: c.jobRoleId,
        techStackId: c.techStackId,
        focusAreaId: c.focusAreaId,
        difficulty: c.difficulty,
        interviewType: c.interviewType,
        count,
      });
      if (res.ok) {
        setNotice(`Added ${res.inserted ?? 0} question(s) to the bank.`);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles /> AI generate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>AI-generate questions</DialogTitle>
          <DialogDescription>
            Generate new questions for one exact config and write them into the
            bank (source: AI). Duplicates are skipped automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role">
              <Select value={c.jobRoleId} onValueChange={c.onRole}>
                <SelectTrigger aria-label="Gen Role">
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
            <Field label="Interview type">
              <Select
                value={c.interviewType}
                onValueChange={(v) =>
                  c.setInterviewType(v as typeof c.interviewType)
                }
              >
                <SelectTrigger aria-label="Gen Type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVIEW_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tech stack">
              <Select value={c.techStackId} onValueChange={c.setTechStackId}>
                <SelectTrigger aria-label="Gen Tech">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {c.roleTech.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Focus area">
              <Select value={c.focusAreaId} onValueChange={c.setFocusAreaId}>
                <SelectTrigger aria-label="Gen Focus">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {c.roleFocus.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Difficulty">
              <Select value={c.difficulty} onValueChange={c.setDifficulty}>
                <SelectTrigger aria-label="Gen Difficulty">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {c.roleBands.map((b) => (
                    <SelectItem key={b.label} value={b.label}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="How many (1–20)">
              <Input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) =>
                  setCount(
                    Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                  )
                }
              />
            </Field>
          </div>
          {notice && <p className="text-sm text-[var(--primary)]">{notice}</p>}
          {error && <FormError message={error} />}
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={pending || !c.techStackId || !c.focusAreaId || !c.difficulty}
          >
            {pending ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuestionDialog({
  roles,
  techStacks,
  focusAreas,
  bands,
  trigger,
}: {
  roles: RoleRef[];
  techStacks: Taxon[];
  focusAreas: Taxon[];
  bands: BandRef[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const c = useConfigState(roles, techStacks, focusAreas, bands);
  const [type, setType] = useState<"text" | "coding">("text");
  const [language, setLanguage] = useState<string>("javascript");
  const [questionText, setQuestionText] = useState("");
  const [idealAnswer, setIdealAnswer] = useState("");
  const isCoding = type === "coding";

  function submit() {
    setError(undefined);
    start(async () => {
      const res = await createQuestion({
        jobRoleId: c.jobRoleId,
        techStackId: c.techStackId,
        focusAreaId: c.focusAreaId,
        difficulty: c.difficulty,
        interviewType: c.interviewType,
        type,
        language: isCoding ? language : undefined,
        questionText,
        idealAnswer,
      });
      if (res.ok) {
        setOpen(false);
        setQuestionText("");
        setIdealAnswer("");
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
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role">
              <Select value={c.jobRoleId} onValueChange={c.onRole}>
                <SelectTrigger aria-label="Q Role">
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
            <Field label="Interview type (pool)">
              <Select
                value={c.interviewType}
                onValueChange={(v) =>
                  c.setInterviewType(v as typeof c.interviewType)
                }
              >
                <SelectTrigger aria-label="Q Type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVIEW_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tech stack">
              <Select value={c.techStackId} onValueChange={c.setTechStackId}>
                <SelectTrigger aria-label="Q Tech">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {c.roleTech.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Focus area">
              <Select value={c.focusAreaId} onValueChange={c.setFocusAreaId}>
                <SelectTrigger aria-label="Q Focus">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {c.roleFocus.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Difficulty">
              <Select value={c.difficulty} onValueChange={c.setDifficulty}>
                <SelectTrigger aria-label="Q Difficulty">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {c.roleBands.map((b) => (
                    <SelectItem key={b.label} value={b.label}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Answer modality">
              <Select
                value={type}
                onValueChange={(v) => setType(v as typeof type)}
              >
                <SelectTrigger aria-label="Q Modality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="coding">Coding</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {isCoding && (
              <Field label="Language">
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger aria-label="Q Language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CODE_LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
          <Field label={isCoding ? "Problem prompt" : "Question"}>
            <Textarea
              rows={3}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder={
                isCoding
                  ? "State the task, inputs/outputs, and an example…"
                  : undefined
              }
            />
          </Field>
          <Field label={isCoding ? "Ideal solution" : "Ideal answer"}>
            <Textarea
              rows={isCoding ? 6 : 3}
              value={idealAnswer}
              onChange={(e) => setIdealAnswer(e.target.value)}
              className={isCoding ? "font-mono text-sm" : undefined}
              placeholder={
                isCoding ? "A complete reference solution…" : undefined
              }
            />
          </Field>
          {error && <FormError message={error} />}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            Create question
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditQuestionDialog({
  question,
  trigger,
}: {
  question: QuestionRow;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [questionText, setQuestionText] = useState(question.questionText);
  const [idealAnswer, setIdealAnswer] = useState(question.idealAnswer);
  const [type, setType] = useState(question.type);
  const [language, setLanguage] = useState<string>(
    question.language ?? "javascript",
  );
  const [isActive, setIsActive] = useState(question.isActive);
  const isCoding = type === "coding";

  function submit() {
    setError(undefined);
    start(async () => {
      const res = await updateQuestion({
        id: question.id,
        questionText,
        idealAnswer,
        type,
        language: isCoding ? language : undefined,
        isActive,
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit question</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {isCoding && (
            <Field label="Language">
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger aria-label="Edit Q Language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CODE_LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label={isCoding ? "Problem prompt" : "Question"}>
            <Textarea
              rows={3}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
            />
          </Field>
          <Field label={isCoding ? "Ideal solution" : "Ideal answer"}>
            <Textarea
              rows={isCoding ? 6 : 3}
              value={idealAnswer}
              onChange={(e) => setIdealAnswer(e.target.value)}
              className={isCoding ? "font-mono text-sm" : undefined}
            />
          </Field>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-sm">Active</span>
          </div>
          {error && <FormError message={error} />}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
