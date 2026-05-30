"use client";

import { useMemo, useState, useTransition } from "react";
import { Code2, Loader2, Mic, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormError } from "@/components/auth/FormError";
import { LogoMark } from "@/components/brand/Logo";
import { startInterview } from "@/lib/actions/interview";
import type { BandOption } from "@/components/onboarding/types";

interface RoleOption {
  id: string;
  name: string;
}
interface FocusOption {
  id: string;
  jobRoleId: string;
  name: string;
}
type StackOption = FocusOption;

const INTERVIEW_TYPES = [
  { value: "technical", label: "Technical" },
  { value: "behavioral", label: "Behavioral" },
  { value: "mixed", label: "Mixed" },
  { value: "coding", label: "Coding" },
] as const;

const MAX_YEARS = 20;

interface Props {
  roles: RoleOption[];
  focusAreas: FocusOption[];
  techStacks: StackOption[];
  bands: BandOption[];
  defaultRoleId: string;
  defaultYears: number;
  questionCounts: number[];
  timerSeconds: number;
}

function bandFor(bands: BandOption[], roleId: string, years: number) {
  return (
    bands
      .filter((b) => b.jobRoleId === roleId)
      .find(
        (b) =>
          years >= (b.minYears ?? 0) &&
          years <= (b.maxYears ?? Number.MAX_SAFE_INTEGER),
      )?.label ?? ""
  );
}

export function InterviewSetup({
  roles,
  focusAreas,
  techStacks,
  bands,
  defaultRoleId,
  defaultYears,
  questionCounts,
  timerSeconds,
}: Props) {
  const firstFocus = (roleId: string) =>
    focusAreas.find((f) => f.jobRoleId === roleId)?.id ?? "";
  const firstStack = (roleId: string) =>
    techStacks.find((s) => s.jobRoleId === roleId)?.id ?? "";

  const [jobRoleId, setJobRoleId] = useState(defaultRoleId);
  const [interviewType, setInterviewType] =
    useState<(typeof INTERVIEW_TYPES)[number]["value"]>("technical");
  const [years, setYears] = useState(defaultYears);
  const [difficulty, setDifficulty] = useState(() =>
    bandFor(bands, defaultRoleId, defaultYears),
  );
  const [focusAreaId, setFocusAreaId] = useState(() =>
    firstFocus(defaultRoleId),
  );
  const [techStackId, setTechStackId] = useState(() =>
    firstStack(defaultRoleId),
  );
  const [questionCount, setQuestionCount] = useState(
    questionCounts.includes(5) ? 5 : (questionCounts[0] ?? 5),
  );
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"text" | "voice">("text");

  const roleFocus = useMemo(
    () => focusAreas.filter((f) => f.jobRoleId === jobRoleId),
    [focusAreas, jobRoleId],
  );
  const roleStacks = useMemo(
    () => techStacks.filter((s) => s.jobRoleId === jobRoleId),
    [techStacks, jobRoleId],
  );
  const roleBands = useMemo(
    () =>
      bands
        .filter((b) => b.jobRoleId === jobRoleId)
        .sort((a, b) => (a.minYears ?? 0) - (b.minYears ?? 0)),
    [bands, jobRoleId],
  );

  const resolvedBand = bandFor(bands, jobRoleId, years);

  // Role change → refilter & reset focus/stack/difficulty for the new role.
  function handleRoleChange(roleId: string) {
    setJobRoleId(roleId);
    setFocusAreaId(firstFocus(roleId));
    setTechStackId(firstStack(roleId));
    setDifficulty(bandFor(bands, roleId, years));
  }

  // Slider change → update resolved difficulty band live.
  function handleYearsChange(value: number) {
    setYears(value);
    setDifficulty(bandFor(bands, jobRoleId, value));
  }

  const roleName = roles.find((r) => r.id === jobRoleId)?.name ?? "—";
  const focusName = roleFocus.find((f) => f.id === focusAreaId)?.name ?? "—";
  const typeLabel =
    INTERVIEW_TYPES.find((t) => t.value === interviewType)?.label ?? "—";

  const pills = [
    roleName,
    typeLabel,
    focusName,
    `${years}${years >= MAX_YEARS ? "+" : ""} yrs${resolvedBand ? ` · ${resolvedBand}` : ""}`,
    difficulty || "—",
    `${questionCount} questions`,
  ];

  function handleStart(selectedMode: "text" | "voice") {
    setError(undefined);
    setMode(selectedMode);
    startTransition(async () => {
      const res = await startInterview({
        jobRoleId,
        interviewType,
        difficulty,
        focusAreaId,
        techStackId,
        questionCount,
        timerEnabled,
        mode: selectedMode,
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
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Role">
            <Select value={jobRoleId} onValueChange={handleRoleChange}>
              <SelectTrigger aria-label="Role">
                <SelectValue placeholder="Select a role" />
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
              value={interviewType}
              onValueChange={(v) => setInterviewType(v as typeof interviewType)}
            >
              <SelectTrigger aria-label="Interview type">
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

          <Field label="Focus area">
            <Select value={focusAreaId} onValueChange={setFocusAreaId}>
              <SelectTrigger aria-label="Focus area">
                <SelectValue placeholder="Select a focus area" />
              </SelectTrigger>
              <SelectContent>
                {roleFocus.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Tech stack">
            <Select value={techStackId} onValueChange={setTechStackId}>
              <SelectTrigger aria-label="Tech stack">
                <SelectValue placeholder="Select a tech stack" />
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

          <Field label="Difficulty">
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger aria-label="Difficulty">
                <SelectValue placeholder="Select difficulty" />
              </SelectTrigger>
              <SelectContent>
                {roleBands.map((b) => (
                  <SelectItem key={b.label} value={b.label}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Number of questions">
            <Select
              value={String(questionCount)}
              onValueChange={(v) => setQuestionCount(Number(v))}
            >
              <SelectTrigger aria-label="Number of questions">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {questionCounts.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} questions
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {/* Experience slider */}
        <Field
          label={`Experience level — ${years}${years >= MAX_YEARS ? "+" : ""} years${resolvedBand ? ` (${resolvedBand})` : ""}`}
        >
          <Slider
            className="py-2"
            min={0}
            max={MAX_YEARS}
            step={1}
            value={[years]}
            onValueChange={([v]) => handleYearsChange(v)}
          />
        </Field>

        {/* Timer toggle */}
        <div className="flex items-center justify-between rounded-xl border border-[var(--border)] px-4 py-3">
          <div>
            <p className="text-sm font-medium">Timed mode</p>
            <p className="text-sm text-[var(--muted-foreground)]">
              {Math.round((timerSeconds / 60) * 10) / 10} minutes per question
              when enabled.
            </p>
          </div>
          <Switch
            checked={timerEnabled}
            onCheckedChange={setTimerEnabled}
            aria-label="Toggle timed mode"
          />
        </div>

        {/* Setup summary */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Setup
          </p>
          <div className="flex flex-wrap gap-2">
            {pills.map((p, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent-foreground)]"
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        {error && <FormError message={error} />}

        {/* Start actions. Coding interviews are editor-only (no speech). */}
        {interviewType === "coding" ? (
          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              disabled={pending}
              onClick={() => handleStart("text")}
            >
              {pending ? <Loader2 className="animate-spin" /> : <Code2 />}
              Start Coding Interview
            </Button>
            <p className="text-center text-xs text-[var(--muted-foreground)]">
              You&apos;ll solve problems in a code editor. Best on a laptop.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="flex-1"
              disabled={pending}
              onClick={() => handleStart("text")}
            >
              {pending && mode === "text" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Zap />
              )}
              Start Interview
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={() => handleStart("voice")}
            >
              {pending && mode === "voice" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Mic />
              )}
              Speech Interview
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
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
