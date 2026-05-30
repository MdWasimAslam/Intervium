"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { FormError } from "@/components/auth/FormError";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateSettings } from "@/lib/actions/admin/settings";

interface Props {
  defaultTimerSeconds: number;
  questionCounts: number[];
  transcriptionProvider: "webspeech" | "whisper";
}

export function SettingsAdmin(initial: Props) {
  const router = useRouter();
  const [timer, setTimer] = useState(initial.defaultTimerSeconds);
  const [counts, setCounts] = useState(initial.questionCounts.join(", "));
  const [provider, setProvider] = useState(initial.transcriptionProvider);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function submit() {
    setError(undefined);
    setSaved(false);
    const parsedCounts = counts
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    start(async () => {
      const res = await updateSettings({
        defaultTimerSeconds: timer,
        questionCounts: parsedCounts,
        transcriptionProvider: provider,
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-2xl font-bold">Settings</h1>
      <p className="mb-6 text-sm text-[var(--muted-foreground)]">
        Global config. Changes apply immediately on the user-facing app.
      </p>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="space-y-1.5">
            <Label htmlFor="s-timer">
              Default timer (seconds per question)
            </Label>
            <Input
              id="s-timer"
              type="number"
              min={10}
              max={3600}
              value={timer}
              onChange={(e) => setTimer(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-counts">
              Question-count options (comma-separated)
            </Label>
            <Input
              id="s-counts"
              value={counts}
              onChange={(e) => setCounts(e.target.value)}
              placeholder="3, 5, 10"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Transcription provider</Label>
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as typeof provider)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="webspeech">
                  Web Speech (browser, needs Google)
                </SelectItem>
                <SelectItem value="whisper">
                  Local Whisper (server, offline)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <FormError message={error} />}
          {saved && (
            <p className="text-sm text-[var(--primary)]">Settings saved ✓</p>
          )}

          <Button onClick={submit} disabled={pending}>
            Save settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
