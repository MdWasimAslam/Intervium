"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/auth/FormError";
import { updateSettings } from "@/lib/actions/admin/settings";
import type { ScoringProvider } from "@/lib/settings";
import type { LengthPreset, TimerPreset } from "@db";

interface Props {
  timerPresets: TimerPreset[];
  defaultTimerPresetId: string;
  lengthPresets: LengthPreset[];
  defaultLengthPresetId: string;
  scoringProvider: ScoringProvider;
}

const SCORING_PROVIDERS: {
  id: ScoringProvider;
  label: string;
  description: string;
}[] = [
  {
    id: "groq",
    label: "Groq (Llama)",
    description: "Default. Fastest responses; subject to Groq plan limits.",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    description:
      "Stronger grading model. Requires DEEPSEEK_API_KEY; slightly slower.",
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
  const [defaultTimer, setDefaultTimer] = useState(initial.defaultTimerPresetId);
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

  const updateTimer = (id: string, patch: Partial<TimerPreset>) =>
    setTimers((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeTimer = (id: string) =>
    setTimers((rows) => rows.filter((r) => r.id !== id));
  const addTimer = () =>
    setTimers((rows) => [...rows, { id: newId("timer"), label: "", seconds: 60 }]);

  const updateLength = (id: string, patch: Partial<LengthPreset>) =>
    setLengths((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
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
        Configure the timer and interview-length options users pick from. Changes
        apply immediately to new interviews.
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
            <div className="grid grid-cols-[auto_1fr_8rem_auto] items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              <span className="px-1">Default</span>
              <span>Label</span>
              <span>Seconds</span>
              <span className="sr-only">Remove</span>
            </div>
            {timers.map((t) => (
              <div
                key={t.id}
                className="grid grid-cols-[auto_1fr_8rem_auto] items-center gap-2"
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
                      seconds: e.target.value === "" ? null : Number(e.target.value),
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
            <Button type="button" variant="outline" size="sm" onClick={addTimer}>
              <Plus className="h-4 w-4" />
              Add timer preset
            </Button>
          </CardContent>
        </Card>

        {/* Length presets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Interview length presets</CardTitle>
            <p className="text-sm text-[var(--muted-foreground)]">
              Named lengths (Quick / Standard / Full) mapped to a question count.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-[auto_1fr_8rem_auto] items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              <span className="px-1">Default</span>
              <span>Label</span>
              <span>Questions</span>
              <span className="sr-only">Remove</span>
            </div>
            {lengths.map((l) => (
              <div
                key={l.id}
                className="grid grid-cols-[auto_1fr_8rem_auto] items-center gap-2"
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
                  onChange={(e) => updateLength(l.id, { label: e.target.value })}
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
            <Button type="button" variant="outline" size="sm" onClick={addLength}>
              <Plus className="h-4 w-4" />
              Add length preset
            </Button>
          </CardContent>
        </Card>

        {/* Interview scoring provider */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Interview scoring</CardTitle>
            <p className="text-sm text-[var(--muted-foreground)]">
              Which AI backend grades interview answers. Applies to new scoring
              runs immediately. Question generation and summaries always use Groq.
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
