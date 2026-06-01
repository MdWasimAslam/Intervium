"use client";

import { useMemo, useState, useTransition } from "react";
import { Database, Sparkles, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Chip } from "@/components/ui/chip";
import { FormError } from "@/components/auth/FormError";
import { LogoMark } from "@/components/brand/Logo";
import { startInterview } from "@/lib/actions/interview";
import type { LengthPreset, TimerPreset } from "@db";

interface RoleOption {
  id: string;
  name: string;
}
interface StackOption {
  id: string;
  jobRoleId: string;
  name: string;
}

type Mode = "bank" | "ai";
type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";

/** Must match CUSTOM_TIMER_ID in src/lib/settings.ts (kept here to avoid
 *  importing the server-only settings module into this client component). */
const CUSTOM_TIMER_ID = "custom";
const MAX_CUSTOM_MINUTES = 120;

const SKILL_LEVELS: { value: SkillLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "expert", label: "Expert" },
];

interface Props {
  roles: RoleOption[];
  techStacks: StackOption[];
  defaultRoleId: string;
  defaultSkillLevel: SkillLevel;
  timerPresets: TimerPreset[];
  defaultTimerPresetId: string;
  lengthPresets: LengthPreset[];
  defaultLengthPresetId: string;
}

export function InterviewSetup({
  roles,
  techStacks,
  defaultRoleId,
  defaultSkillLevel,
  timerPresets,
  defaultTimerPresetId,
  lengthPresets,
  defaultLengthPresetId,
}: Props) {
  const firstStack = (roleId: string) =>
    techStacks.find((s) => s.jobRoleId === roleId)?.id ?? "";

  const [mode, setMode] = useState<Mode>("bank");
  const [jobRoleId, setJobRoleId] = useState(defaultRoleId);
  const [techStackId, setTechStackId] = useState(() =>
    firstStack(defaultRoleId),
  );
  const [skillLevel, setSkillLevel] = useState<SkillLevel>(defaultSkillLevel);
  const [lengthPresetId, setLengthPresetId] = useState(
    lengthPresets.some((l) => l.id === defaultLengthPresetId)
      ? defaultLengthPresetId
      : (lengthPresets[0]?.id ?? ""),
  );
  const [timerPresetId, setTimerPresetId] = useState(
    timerPresets.some((t) => t.id === defaultTimerPresetId)
      ? defaultTimerPresetId
      : (timerPresets[0]?.id ?? "no-timer"),
  );
  const [customMinutes, setCustomMinutes] = useState(2);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const roleStacks = useMemo(
    () => techStacks.filter((s) => s.jobRoleId === jobRoleId),
    [techStacks, jobRoleId],
  );

  function handleRoleChange(roleId: string) {
    setJobRoleId(roleId);
    setTechStackId(firstStack(roleId));
  }

  const roleName = roles.find((r) => r.id === jobRoleId)?.name ?? "—";
  const stackName = roleStacks.find((s) => s.id === techStackId)?.name ?? "—";

  const lengthPreset = lengthPresets.find((l) => l.id === lengthPresetId);
  const isCustomTimer = timerPresetId === CUSTOM_TIMER_ID;
  const timerPreset = timerPresets.find((t) => t.id === timerPresetId);
  const timerLabel = isCustomTimer
    ? `${customMinutes} min`
    : (timerPreset?.label ?? "No Timer");

  const pills = [
    mode === "bank" ? "Question Bank" : "AI",
    roleName,
    stackName,
    ...(mode === "ai"
      ? [SKILL_LEVELS.find((s) => s.value === skillLevel)?.label ?? skillLevel]
      : []),
    lengthPreset
      ? `${lengthPreset.label} · ${lengthPreset.questionCount} questions`
      : "Length",
    timerLabel,
  ];

  function handleStart() {
    setError(undefined);
    startTransition(async () => {
      const res = await startInterview({
        mode,
        jobRoleId,
        techStackId,
        skillLevel: mode === "ai" ? skillLevel : undefined,
        lengthPresetId,
        timerPresetId,
        customTimerSeconds: isCustomTimer
          ? Math.round(customMinutes * 60)
          : undefined,
      });
      if (res?.error) setError(res.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <LogoMark className="h-11 w-11" />
        <div>
          <CardTitle className="text-xl">Start a fresh interview</CardTitle>
          <p className="text-sm text-[var(--muted-foreground)]">
            Configure your mock interview and begin in seconds.
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Mode picker */}
        <div className="grid grid-cols-2 gap-3">
          <ModeCard
            active={mode === "bank"}
            onClick={() => setMode("bank")}
            icon={<Database className="h-5 w-5" />}
            title="Question Bank"
            subtitle="Curated questions for your role & stack."
          />
          <ModeCard
            active={mode === "ai"}
            onClick={() => setMode("ai")}
            icon={<Sparkles className="h-5 w-5" />}
            title="AI Interview"
            subtitle="Fresh questions generated for your level."
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Profession">
            <Select value={jobRoleId} onValueChange={handleRoleChange}>
              <SelectTrigger aria-label="Profession">
                <SelectValue placeholder="Select a profession" />
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
            <Select value={techStackId} onValueChange={setTechStackId}>
              <SelectTrigger aria-label="Specialization">
                <SelectValue placeholder="Select a specialization" />
              </SelectTrigger>
              <SelectContent>
                {roleStacks.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* Skill level — AI mode only */}
          {mode === "ai" && (
            <Field label="Skill level">
              <Select
                value={skillLevel}
                onValueChange={(v) => setSkillLevel(v as SkillLevel)}
              >
                <SelectTrigger aria-label="Skill level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SKILL_LEVELS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field label="Interview length">
            <Select value={lengthPresetId} onValueChange={setLengthPresetId}>
              <SelectTrigger aria-label="Interview length">
                <SelectValue placeholder="Choose a length" />
              </SelectTrigger>
              <SelectContent>
                {lengthPresets.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.label} · {l.questionCount} questions
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Timer">
            <Select value={timerPresetId} onValueChange={setTimerPresetId}>
              <SelectTrigger aria-label="Timer">
                <SelectValue placeholder="Choose a timer" />
              </SelectTrigger>
              <SelectContent>
                {timerPresets.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_TIMER_ID}>Custom…</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {/* Custom timer minutes — only when "Custom…" is chosen. */}
          {isCustomTimer && (
            <Field label="Custom minutes per question">
              <Input
                type="number"
                min={1}
                max={MAX_CUSTOM_MINUTES}
                value={customMinutes}
                onChange={(e) =>
                  setCustomMinutes(
                    Math.min(
                      MAX_CUSTOM_MINUTES,
                      Math.max(1, Number(e.target.value) || 1),
                    ),
                  )
                }
                aria-label="Custom minutes per question"
              />
            </Field>
          )}
        </div>

        {/* Setup summary */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Setup
          </p>
          <div className="flex flex-wrap gap-2">
            {pills.map((p, i) => (
              <Chip key={i}>{p}</Chip>
            ))}
          </div>
        </div>

        {error && <FormError message={error} />}

        <LoadingButton
          size="lg"
          className="w-full"
          loading={pending}
          disabled={!techStackId || !lengthPresetId}
          loadingText="Starting…"
          onClick={handleStart}
        >
          <Zap />
          Start Interview
        </LoadingButton>
      </CardContent>
    </Card>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col gap-1.5 rounded-xl border p-4 text-left transition-colors ${
        active
          ? "border-[var(--primary)] bg-[var(--accent)]"
          : "border-[var(--border)] hover:bg-[var(--muted)]/50"
      }`}
    >
      <span className="flex items-center gap-2 font-medium">
        {icon}
        {title}
      </span>
      <span className="text-xs text-[var(--muted-foreground)]">{subtitle}</span>
    </button>
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
