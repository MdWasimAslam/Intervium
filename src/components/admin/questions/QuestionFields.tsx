"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATEGORIES,
  MODALITIES,
  type Category,
  type Modality,
  type RoleRef,
  type Taxon,
} from "@/components/admin/QuestionsAdmin";

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            isCoding
              ? "State the task, inputs/outputs, and an example…"
              : undefined
          }
        />
      </Field>
      <Field label={isCoding ? "Ideal solution" : "Ideal answer"}>
        <Textarea
          rows={isCoding ? 6 : 3}
          value={value.idealAnswer}
          onChange={(e) => set({ idealAnswer: e.target.value })}
          className={isCoding ? "font-mono text-sm" : undefined}
          placeholder={
            isCoding ? "A complete reference solution (JavaScript)…" : undefined
          }
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

export { QuestionFields, Field, type QuestionFormValue };
