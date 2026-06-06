"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/auth/FormError";
import { ConfirmDelete } from "@/components/admin/ConfirmDelete";
import {
  resetDemoAccountAction,
  setDemoMode,
  updateSettings,
} from "@/lib/actions/admin/settings";
import type { ScoringProvider } from "@/lib/settings";
import type { DemoRequestStats } from "@/lib/demo-analytics";
import type { LengthPreset, TimerPreset } from "@db";

interface Props {
  timerPresets: TimerPreset[];
  defaultTimerPresetId: string;
  lengthPresets: LengthPreset[];
  defaultLengthPresetId: string;
  scoringProvider: ScoringProvider;
  demoMode: boolean;
  demoStats: DemoRequestStats;
}

const SCORING_PROVIDERS: {
  id: ScoringProvider;
  label: string;
  description: string;
}[] = [
  {
    id: "groq",
    label: "Groq (Llama)",
    description:
      "Default. Runs every AI feature on Llama. Fastest responses; subject to Groq plan limits.",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    description:
      "Stronger model for all AI features — grading, summaries, and CV & Code Dojo. Requires DEEPSEEK_API_KEY; slightly slower.",
  },
];

/** Stable client-side id for a freshly-added preset row. */
function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.floor(performance.now()).toString(36);
  return `${prefix}-${rand}`;
}

export function SettingsAdmin(initial: Props) {
  const router = useRouter();
  const [timers, setTimers] = useState<TimerPreset[]>(initial.timerPresets);
  const [defaultTimer, setDefaultTimer] = useState(
    initial.defaultTimerPresetId,
  );
  const [lengths, setLengths] = useState<LengthPreset[]>(initial.lengthPresets);
  const [defaultLength, setDefaultLength] = useState(
    initial.defaultLengthPresetId,
  );
  const [scoringProvider, setScoringProvider] = useState<ScoringProvider>(
    initial.scoringProvider,
  );
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const [demoMode, setDemoModeState] = useState(initial.demoMode);
  const [demoPending, startDemo] = useTransition();
  const toggleDemo = (next: boolean) => {
    setDemoModeState(next);
    startDemo(async () => {
      const res = await setDemoMode({ enabled: next });
      if (res.ok) router.refresh();
      else {
        setDemoModeState(!next); // revert on failure
        setError(res.error);
      }
    });
  };

  // Reset uses the shared ConfirmDelete dialog (which manages its own pending/
  // error/refresh); we only track the post-success confirmation line here.
  const [resetDone, setResetDone] = useState(false);

  const updateTimer = (id: string, patch: Partial<TimerPreset>) =>
    setTimers((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  const removeTimer = (id: string) =>
    setTimers((rows) => rows.filter((r) => r.id !== id));
  const addTimer = () =>
    setTimers((rows) => [
      ...rows,
      { id: newId("timer"), label: "", seconds: 60 },
    ]);

  const updateLength = (id: string, patch: Partial<LengthPreset>) =>
    setLengths((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  const removeLength = (id: string) =>
    setLengths((rows) => rows.filter((r) => r.id !== id));
  const addLength = () =>
    setLengths((rows) => [
      ...rows,
      { id: newId("len"), label: "", questionCount: 10 },
    ]);

  function submit() {
    setError(undefined);
    setSaved(false);

    // Client-side guards mirror the server validation for friendlier messages.
    if (timers.some((t) => !t.label.trim())) {
      return setError("Every timer preset needs a label.");
    }
    if (lengths.some((l) => !l.label.trim())) {
      return setError("Every length preset needs a label.");
    }
    if (!timers.some((t) => t.id === defaultTimer)) {
      return setError("Pick a default timer preset.");
    }
    if (!lengths.some((l) => l.id === defaultLength)) {
      return setError("Pick a default length preset.");
    }

    start(async () => {
      const res = await updateSettings({
        timerPresets: timers.map((t) => ({
          id: t.id,
          label: t.label.trim(),
          seconds: t.seconds,
        })),
        defaultTimerPresetId: defaultTimer,
        lengthPresets: lengths.map((l) => ({
          id: l.id,
          label: l.label.trim(),
          questionCount: l.questionCount,
        })),
        defaultLengthPresetId: defaultLength,
        scoringProvider,
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">Settings</h1>
      <p className="mb-6 text-sm text-[var(--muted-foreground)]">
        Configure the timer and interview-length options users pick from.
        Changes apply immediately to new interviews.
      </p>

      <div className="space-y-6">
        {/* Timer presets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timer presets</CardTitle>
            <p className="text-sm text-[var(--muted-foreground)]">
              Per-question time limits. Leave seconds blank for “No Timer”. The
              selected row is the default in interview setup.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_8rem_auto] items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              <span className="px-1">Default</span>
              <span>Label</span>
              <span>Seconds</span>
              <span className="sr-only">Remove</span>
            </div>
            {timers.map((t) => (
              <div
                key={t.id}
                className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_8rem_auto] items-center gap-2"
              >
                <input
                  type="radio"
                  name="default-timer"
                  aria-label={`Make ${t.label || "this preset"} the default timer`}
                  checked={defaultTimer === t.id}
                  onChange={() => setDefaultTimer(t.id)}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                <Input
                  value={t.label}
                  placeholder="e.g. 2 min"
                  onChange={(e) => updateTimer(t.id, { label: e.target.value })}
                />
                <Input
                  type="number"
                  min={5}
                  max={7200}
                  value={t.seconds ?? ""}
                  placeholder="No timer"
                  onChange={(e) =>
                    updateTimer(t.id, {
                      seconds:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove timer preset"
                  disabled={timers.length <= 1}
                  onClick={() => removeTimer(t.id)}
                  className="text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addTimer}
            >
              <Plus className="h-4 w-4" />
              Add timer preset
            </Button>
          </CardContent>
        </Card>

        {/* Length presets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Interview length presets
            </CardTitle>
            <p className="text-sm text-[var(--muted-foreground)]">
              Named lengths (Quick / Standard / Full) mapped to a question
              count.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_8rem_auto] items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              <span className="px-1">Default</span>
              <span>Label</span>
              <span>Questions</span>
              <span className="sr-only">Remove</span>
            </div>
            {lengths.map((l) => (
              <div
                key={l.id}
                className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_8rem_auto] items-center gap-2"
              >
                <input
                  type="radio"
                  name="default-length"
                  aria-label={`Make ${l.label || "this preset"} the default length`}
                  checked={defaultLength === l.id}
                  onChange={() => setDefaultLength(l.id)}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                <Input
                  value={l.label}
                  placeholder="e.g. Standard"
                  onChange={(e) =>
                    updateLength(l.id, { label: e.target.value })
                  }
                />
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={l.questionCount}
                  onChange={(e) =>
                    updateLength(l.id, {
                      questionCount: Number(e.target.value) || 1,
                    })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove length preset"
                  disabled={lengths.length <= 1}
                  onClick={() => removeLength(l.id)}
                  className="text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLength}
            >
              <Plus className="h-4 w-4" />
              Add length preset
            </Button>
          </CardContent>
        </Card>

        {/* AI provider */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI provider</CardTitle>
            <p className="text-sm text-[var(--muted-foreground)]">
              Which AI backend powers every smart feature — interview grading,
              result summaries, and all CV &amp; Code Dojo AI. Applies to new
              runs immediately. Interview question generation always uses Groq
              for speed.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {SCORING_PROVIDERS.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] p-3 hover:bg-[var(--muted)]"
              >
                <input
                  type="radio"
                  name="scoring-provider"
                  checked={scoringProvider === p.id}
                  onChange={() => setScoringProvider(p.id)}
                  className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{p.label}</span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {p.description}
                  </span>
                </span>
              </label>
            ))}
          </CardContent>
        </Card>

        {/* Demo mode */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Demo access</CardTitle>
            <p className="text-sm text-[var(--muted-foreground)]">
              When on, visitors can request demo credentials from the landing
              page — we email them the shared demo login (set via{" "}
              <code className="rounded bg-[var(--muted)] px-1 py-0.5 text-xs">
                DEMO_USER_EMAIL
              </code>
              ). Turn off to hide that offer. The demo account&apos;s AI and
              deletes stay locked either way. Saves immediately.
            </p>
          </CardHeader>
          <CardContent>
            <label className="flex items-center gap-3">
              <Switch
                checked={demoMode}
                disabled={demoPending}
                onCheckedChange={toggleDemo}
                aria-label="Toggle demo mode"
              />
              <span className="text-sm font-medium">
                {demoMode
                  ? "On — visitors can request demo access"
                  : "Off — demo access offer is hidden"}
              </span>
            </label>

            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <p className="mb-2 text-sm text-[var(--muted-foreground)]">
                Reset the demo account&apos;s data to its pristine seeded state
                — clears any edits visitors made (keeps the login).
              </p>
              <ConfirmDelete
                action={resetDemoAccountAction}
                title="Reset demo account?"
                description="This clears any edits visitors made and re-seeds the shared demo account to its pristine showcase state. The login is preserved."
                confirmLabel="Reset"
                confirmingLabel="Resetting…"
                onSuccess={() => setResetDone(true)}
                trigger={
                  <Button type="button" variant="outline" size="sm">
                    Reset demo account
                  </Button>
                }
              />
              {resetDone && (
                <p className="mt-2 text-sm text-[var(--primary)]">
                  Demo account reset ✓
                </p>
              )}
            </div>

            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <p className="text-sm font-medium">Access requests</p>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                {initial.demoStats.people}{" "}
                {initial.demoStats.people === 1 ? "person has" : "people have"}{" "}
                asked for demo access · {initial.demoStats.requests} total
                request{initial.demoStats.requests === 1 ? "" : "s"}
              </p>
              {initial.demoStats.recent.length > 0 && (
                <ul className="mt-2 max-h-44 divide-y divide-[var(--border)] overflow-auto rounded-lg border border-[var(--border)] text-xs">
                  {initial.demoStats.recent.map((r) => (
                    <li
                      key={r.email}
                      className="flex items-center justify-between gap-2 px-3 py-1.5"
                    >
                      <span className="truncate">{r.email}</span>
                      <span className="shrink-0 text-[var(--muted-foreground)]">
                        {r.count}× · {r.lastRequestedAt.slice(0, 10)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        {error && <FormError message={error} />}
        {saved && (
          <p className="text-sm text-[var(--primary)]">Settings saved ✓</p>
        )}

        <LoadingButton onClick={submit} loading={pending} loadingText="Saving…">
          Save settings
        </LoadingButton>
      </div>
    </div>
  );
}
