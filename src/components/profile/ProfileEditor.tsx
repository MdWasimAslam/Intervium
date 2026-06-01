"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  FileText,
  Palette,
  Plus,
  Sparkles,
  TrendingUp,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
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
import {
  AVATAR_BACKGROUNDS,
  AVATAR_ICONS,
  type AvatarConfig,
} from "@/components/ui/avatar-options";
import { cn } from "@/lib/utils";
import { isCvJson } from "@/lib/cv/parse";
import { CvImportButton } from "@/components/cv/CvImportButton";
import { updateProfile, type ProfileUpdate } from "@/lib/actions/profile";
import type {
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
  avatar: AvatarConfig;
}

interface Props {
  roles: RoleOption[];
  stacks: StackOption[];
  initial: ProfileValues;
  /** Stable seed for the user's generated avatar (their user id). */
  seed: string;
}

type SectionKey = "avatar" | "identity" | "role" | "skills" | "cv";
type Status = "idle" | "saving" | "saved" | "error";

const sameSkills = (a: string[], b: string[]) =>
  a.length === b.length && a.every((s, i) => s === b[i]);

export function ProfileEditor({ roles, stacks, initial, seed }: Props) {
  const [values, setValues] = useState<ProfileValues>(initial);
  const [saved, setSaved] = useState<ProfileValues>(initial);
  const [status, setStatus] = useState<Record<SectionKey, Status>>({
    avatar: "idle",
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

  const setAvatar = (patch: Partial<AvatarConfig>) =>
    setValues((v) => ({ ...v, avatar: { ...v.avatar, ...patch } }));

  const roleStacks = useMemo(
    () => stacks.filter((s) => s.jobRoleId === values.primaryRoleId),
    [stacks, values.primaryRoleId],
  );

  const dirty: Record<SectionKey, boolean> = {
    avatar:
      values.avatar.bg !== saved.avatar.bg ||
      values.avatar.icon !== saved.avatar.icon,
    identity: values.displayName.trim() !== saved.displayName,
    role:
      values.primaryRoleId !== saved.primaryRoleId ||
      values.yearsExperience !== saved.yearsExperience,
    skills: !sameSkills(values.skills, saved.skills),
    cv: values.cvText !== saved.cvText,
  };

  function partialFor(key: SectionKey): ProfileUpdate {
    switch (key) {
      case "avatar":
        return { avatar: values.avatar };
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
    // CVs are JSON-only; block a non-JSON value before it reaches the server.
    if (key === "cv" && cvIsJson === false) {
      setStatus((s) => ({ ...s, cv: "error" }));
      setErrors((e) => ({
        ...e,
        cv: "Your CV must be valid JSON. Paste JSON only, or leave it empty.",
      }));
      return;
    }
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
      ...(key === "avatar" && { avatar: values.avatar }),
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

  // null = empty (allowed, CV is optional), true = valid JSON object/array,
  // false = present but not JSON. We accept JSON-format CVs only.
  // Cheap enough to compute each render; the React Compiler memoizes as needed.
  const cvTrimmed = values.cvText.trim();
  const cvIsJson = cvTrimmed ? isCvJson(cvTrimmed) : null;

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
          name={values.displayName || initial.displayName}
          bg={values.avatar.bg}
          icon={values.avatar.icon}
          size={56}
          alt={`Avatar for ${values.displayName || initial.displayName || "you"}`}
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
        {/* Avatar */}
        <Section
          icon={Palette}
          title="Avatar"
          description="Pick an icon and background colour, or keep your initials."
          dirty={dirty.avatar}
          status={status.avatar}
          error={errors.avatar}
          onSave={() => saveSection("avatar")}
        >
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar
                seed={seed}
                name={values.displayName || initial.displayName}
                bg={values.avatar.bg}
                icon={values.avatar.icon}
                size={64}
                alt="Avatar preview"
                className="shrink-0"
              />
              <p className="text-sm text-[var(--muted-foreground)]">
                Live preview — this is how you appear across the app.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2">
                <SwatchButton
                  selected={!values.avatar.icon}
                  label="Initials"
                  onClick={() => setAvatar({ icon: null })}
                >
                  <span className="text-xs font-semibold">Aa</span>
                </SwatchButton>
                {AVATAR_ICONS.map(({ id, label, Icon }) => (
                  <SwatchButton
                    key={id}
                    selected={values.avatar.icon === id}
                    label={label}
                    onClick={() => setAvatar({ icon: id })}
                  >
                    <Icon className="h-5 w-5" />
                  </SwatchButton>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Background</Label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_BACKGROUNDS.map(({ id, label, base }) => (
                  <button
                    key={id}
                    type="button"
                    aria-label={label}
                    aria-pressed={values.avatar.bg === id}
                    title={label}
                    onClick={() => setAvatar({ bg: id })}
                    style={{ backgroundColor: base }}
                    className={cn(
                      "h-8 w-8 rounded-full ring-offset-2 ring-offset-[var(--card)] transition-transform hover:scale-110",
                      values.avatar.bg === id
                        ? "ring-2 ring-[var(--foreground)]"
                        : "ring-1 ring-black/10",
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </Section>

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
          title="Profession & experience"
          description="Used to tailor your AI interviews and set a default skill level."
          dirty={dirty.role}
          status={status.role}
          error={errors.role}
          onSave={() => saveSection("role")}
        >
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Primary profession</Label>
              <Select
                value={values.primaryRoleId || undefined}
                onValueChange={(v) => set("primaryRoleId", v)}
              >
                <SelectTrigger className="max-w-sm">
                  <SelectValue placeholder="Choose a profession" />
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
          description="Paste your CV as JSON for sharper, tailored questions."
          dirty={dirty.cv}
          status={status.cv}
          error={errors.cv}
          onSave={() => saveSection("cv")}
        >
          <div className="space-y-2">
            <div className="flex justify-end">
              <CvImportButton onImported={(json) => set("cvText", json)} />
            </div>
            <Textarea
              rows={8}
              value={values.cvText}
              onChange={(e) => set("cvText", e.target.value)}
              placeholder="Paste your CV as JSON, or upload a PDF…"
            />
            <p className="text-sm text-[var(--muted-foreground)]">
              Optional. JSON only.
              {cvIsJson === true && (
                <span className="ml-1 font-medium text-[var(--primary)]">
                  Detected valid JSON ✓
                </span>
              )}
              {cvIsJson === false && (
                <span className="ml-1 font-medium text-[var(--destructive)]">
                  Not valid JSON — paste JSON only.
                </span>
              )}
            </p>
          </div>
        </Section>
      </div>
    </Container>
  );
}

/** Square, selectable button used by the avatar icon picker. */
function SwatchButton({
  selected,
  label,
  onClick,
  children,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-xl border transition-colors",
        selected
          ? "border-[var(--primary)] bg-[var(--accent)] text-[var(--primary)]"
          : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
      )}
    >
      {children}
    </button>
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

        <LoadingButton
          type="button"
          size="sm"
          onClick={onSave}
          loading={saving}
          loadingText="Saving…"
          disabled={!dirty}
        >
          Save changes
        </LoadingButton>
      </div>
    </section>
  );
}
