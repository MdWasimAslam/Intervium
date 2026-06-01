"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/ui/chip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDelete } from "@/components/admin/ConfirmDelete";
import { deleteQuestion } from "@/lib/actions/admin/questions";
import {
  BulkBar,
  CheckBox,
  FilterSelect,
  ToggleActive,
} from "@/components/admin/questions/controls";
import { QuestionDialog } from "@/components/admin/questions/QuestionDialog";
import { EditQuestionDialog } from "@/components/admin/questions/EditQuestionDialog";
import { ImportDialog } from "@/components/admin/questions/ImportDialog";

/* --------------------------------- Types ---------------------------------- */

export type Category = "technical" | "behavioral";
export type Modality = "text" | "coding";

export interface Taxon {
  id: string;
  jobRoleId: string;
  name: string;
}
export interface RoleRef {
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

export const CATEGORIES = [
  { value: "technical", label: "Technical" },
  { value: "behavioral", label: "Behavioral" },
] as const;

export const MODALITIES = [
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
