"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  TrendingUp,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormError } from "@/components/auth/FormError";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { updateProfile, type ProfileUpdate } from "@/lib/actions/profile";
import type {
  BandOption,
  RoleOption,
  StackOption,
} from "@/components/onboarding/types";

const MAX_YEARS = 20;
const YEAR_PRESETS = [0, 1, 2, 3, 5, 8, 12, 20];

interface ProfileValues {
  displayName: string;
  primaryRoleId: string;
  yearsExperience: number;
  skills: string[];
  cvText: string;
}

interface Props {
  roles: RoleOption[];
  stacks: StackOption[];
  bands: BandOption[];
  initial: ProfileValues;
  /** Stable seed for the user's generated avatar (their user id). */
  seed: string;
}

type SectionKey = "identity" | "role" | "skills" | "cv";
type Status = "idle" | "saving" | "saved" | "error";

function bandFor(
  bands: BandOption[],
  roleId: string,
  years: number,
): string | null {
  return (
    bands
      .filter((b) => b.jobRoleId === roleId)
      .find(
        (b) =>
          years >= (b.minYears ?? 0) &&
          years <= (b.maxYears ?? Number.MAX_SAFE_INTEGER),
      )?.label ?? null
  );
}

const sameSkills = (a: string[], b: string[]) =>
  a.length === b.length && a.every((s, i) => s === b[i]);

export function ProfileEditor({ roles, stacks, bands, initial, seed }: Props) {
  const [values, setValues] = useState<ProfileValues>(initial);
  const [saved, setSaved] = useState<ProfileValues>(initial);
  const [status, setStatus] = useState<Record<SectionKey, Status>>({
    identity: "idle",
    role: "idle",
    skills: "idle",
    cv: "idle",
  });
  const [errors, setErrors] = useState<Record<SectionKey, string | undefined>>(
    {} as Record<SectionKey, string | undefined>,
  );
  const [skillInput, setSkillInput] = useState("");
  const savedTimers = useRef<Partial<Record<SectionKey, ReturnType<typeof setTimeout>>>>(
    {},
  );

  const set = <K extends keyof ProfileValues>(
    key: K,
    value: ProfileValues[K],
  ) => setValues((v) => ({ ...v, [key]: value }));

  const roleStacks = useMemo(
    () => stacks.filter((s) => s.jobRoleId === values.primaryRoleId),
    [stacks, values.primaryRoleId],
  );
  const band = bandFor(bands, values.primaryRoleId, values.yearsExperience);

  const dirty: Record<SectionKey, boolean> = {
    identity: values.displayName.trim() !== saved.displayName,
    role:
      values.primaryRoleId !== saved.primaryRoleId ||
      values.yearsExperience !== saved.yearsExperience,
    skills: !sameSkills(values.skills, saved.skills),
    cv: values.cvText !== saved.cvText,
  };

  function partialFor(key: SectionKey): ProfileUpdate {
    switch (key) {
      case "identity":
        return { displayName: values.displayName.trim() };
      case "role":
        return {
          primaryRoleId: values.primaryRoleId,
          yearsExperience: values.yearsExperience,
        };
      case "skills":
        return { skills: values.skills };
      case "cv":
        return { cvText: values.cvText };
    }
  }

  async function saveSection(key: SectionKey) {
    if (savedTimers.current[key]) clearTimeout(savedTimers.current[key]);
    setErrors((e) => ({ ...e, [key]: undefined }));
    setStatus((s) => ({ ...s, [key]: "saving" }));

    const res = await updateProfile(partialFor(key));

    if (!res.ok) {
      setStatus((s) => ({ ...s, [key]: "error" }));
      setErrors((e) => ({ ...e, [key]: res.error }));
      return;
    }

    // Promote this section's edits into the saved baseline.
    setSaved((prev) => ({
      ...prev,
      ...(key === "identity" && { displayName: values.displayName.trim() }),
      ...(key === "role" && {
        primaryRoleId: values.primaryRoleId,
        yearsExperience: values.yearsExperience,
      }),
      ...(key === "skills" && { skills: values.skills }),
      ...(key === "cv" && { cvText: values.cvText }),
    }));
    if (key === "identity") set("displayName", values.displayName.trim());

    setStatus((s) => ({ ...s, [key]: "saved" }));
    savedTimers.current[key] = setTimeout(
      () => setStatus((s) => ({ ...s, [key]: "idle" })),
      2200,
    );
  }

  function toggleSkill(name: string) {
    setValues((v) => ({
      ...v,
      skills: v.skills.includes(name)
        ? v.skills.filter((s) => s !== name)
        : [...v.skills, name],
    }));
  }

  function addCustomSkill() {
    const name = skillInput.trim();
    if (name && !values.skills.includes(name)) {
      set("skills", [...values.skills, name]);
    }
    setSkillInput("");
  }

  const cvIsJson = useMemo(() => {
    const t = values.cvText.trim();
    if (!t) return null;
    try {
      JSON.parse(t);
      return true;
    } catch {
      return false;
    }
  }, [values.cvText]);

  return (
    <Container className="max-w-2xl py-10 sm:py-12">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <header className="mt-4 mb-8 flex items-center gap-4">
        <Avatar
          seed={seed}
          size={56}
          alt={`Avatar for ${initial.displayName || "you"}`}
          className="shrink-0"
        />
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Your profile
          </h1>
          <p className="mt-2 text-[var(--muted-foreground)]">
            Update how Intervium tailors your interviews. Each section saves on
            its own.
          </p>
        </div>
      </header>

      <div className="space-y-5">
        {/* Identity */}
        <Section
          icon={User}
          title="Identity"
          description="How we address you across the app."
          dirty={dirty.identity}
          status={status.identity}
          error={errors.identity}
          onSave={() => saveSection("identity")}
        >
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={values.displayName}
              onChange={(e) => set("displayName", e.target.value)}
              placeholder="e.g. Alex Carter"
              className="h-11 max-w-sm"
            />
          </div>
        </Section>

        {/* Role & experience */}
        <Section
          icon={TrendingUp}
          title="Role & experience"
          description="Sets the focus and difficulty of your sessions."
          dirty={dirty.role}
          status={status.role}
          error={errors.role}
          onSave={() => saveSection("role")}
        >
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Primary role</Label>
              <Select
                value={values.primaryRoleId || undefined}
                onValueChange={(v) => set("primaryRoleId", v)}
              >
                <SelectTrigger className="max-w-sm">
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Years of experience</Label>
                <span className="inline-flex items-center gap-2 text-sm">
                  <span className="font-semibold text-[var(--primary)]">
                    {values.yearsExperience}
                    {values.yearsExperience >= MAX_YEARS ? "+" : ""}{" "}
                    {values.yearsExperience === 1 ? "year" : "years"}
                  </span>
                  {band && (
                    <span className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent-foreground)]">
                      {band}
                    </span>
                  )}
                </span>
              </div>
              <Slider
                min={0}
                max={MAX_YEARS}
                step={1}
                value={[values.yearsExperience]}
                onValueChange={([v]) => set("yearsExperience", v)}
              />
              <div className="flex flex-wrap gap-2 pt-1">
                {YEAR_PRESETS.map((y) => {
                  const selected = values.yearsExperience === y;
                  return (
                    <button
                      key={y}
                      type="button"
                      onClick={() => set("yearsExperience", y)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                        selected
                          ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                          : "border-[var(--border)] hover:bg-[var(--muted)]",
                      )}
                    >
                      {y}
                      {y >= MAX_YEARS ? "+" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Section>

        {/* Skills */}
        <Section
          icon={Sparkles}
          title="Skills"
          description="The tech and topics we'll quiz you on."
          dirty={dirty.skills}
          status={status.skills}
          error={errors.skills}
          onSave={() => saveSection("skills")}
        >
          <div className="space-y-5">
            {roleStacks.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                  Suggested
                </p>
                <div className="flex flex-wrap gap-2">
                  {roleStacks.map((s) => {
                    const selected = values.skills.includes(s.name);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSkill(s.name)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                          selected
                            ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                            : "border-[var(--border)] hover:border-[var(--primary)]/40 hover:bg-[var(--muted)]",
                        )}
                      >
                        {selected ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Plus className="h-3.5 w-3.5 opacity-60" />
                        )}
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex max-w-sm gap-2">
              <Input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomSkill();
                  }
                }}
                placeholder="Add another skill…"
                className="h-11"
              />
              <Button type="button" variant="outline" onClick={addCustomSkill}>
                <Plus />
                Add
              </Button>
            </div>

            {values.skills.length > 0 ? (
              <div className="border-t border-[var(--border)] pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                  {values.skills.length} selected
                </p>
                <div className="flex flex-wrap gap-2">
                  <AnimatePresence initial={false}>
                    {values.skills.map((s) => (
                      <motion.span
                        key={s}
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-foreground)]"
                      >
                        {s}
                        <button
                          type="button"
                          aria-label={`Remove ${s}`}
                          onClick={() => toggleSkill(s)}
                          className="rounded-full transition-opacity hover:opacity-70"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">
                No skills added yet.
              </p>
            )}
          </div>
        </Section>

        {/* CV */}
        <Section
          icon={FileText}
          title="CV"
          description="Paste your CV for sharper, tailored questions."
          dirty={dirty.cv}
          status={status.cv}
          error={errors.cv}
          onSave={() => saveSection("cv")}
        >
          <div className="space-y-2">
            <Textarea
              rows={8}
              value={values.cvText}
              onChange={(e) => set("cvText", e.target.value)}
              placeholder="Paste plain text or JSON…"
            />
            <p className="text-sm text-[var(--muted-foreground)]">
              Optional. Plain text or JSON both work.
              {cvIsJson === true && (
                <span className="ml-1 font-medium text-[var(--primary)]">
                  Detected valid JSON ✓
                </span>
              )}
            </p>
          </div>
        </Section>
      </div>
    </Container>
  );
}

/* -------------------------------------------------------------------------- */
/* Section shell                                                              */
/* -------------------------------------------------------------------------- */

function Section({
  icon: Icon,
  title,
  description,
  dirty,
  status,
  error,
  onSave,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  dirty: boolean;
  status: Status;
  error?: string;
  onSave: () => void;
  children: React.ReactNode;
}) {
  const saving = status === "saving";

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-start gap-3 border-b border-[var(--border)] p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--primary)]">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
            {description}
          </p>
        </div>
      </div>

      <div className="p-5">{children}</div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-4">
        <div className="min-h-[1.25rem] text-sm">
          <AnimatePresence mode="wait" initial={false}>
            {error ? (
              <motion.span
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[var(--destructive)]"
              >
                {error}
              </motion.span>
            ) : status === "saved" ? (
              <motion.span
                key="saved"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="inline-flex items-center gap-1.5 font-medium text-[var(--primary)]"
              >
                <Check className="h-4 w-4" />
                Saved
              </motion.span>
            ) : dirty ? (
              <motion.span
                key="unsaved"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[var(--muted-foreground)]"
              >
                Unsaved changes
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={!dirty || saving}
        >
          {saving && <Loader2 className="animate-spin" />}
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </section>
  );
}
