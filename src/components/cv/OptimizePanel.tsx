"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { CvPreview } from "./CvPreview";
import { analyzeMatch } from "@/lib/cv/ats";
import { optimizeCvAction } from "@/lib/actions/cv";
import { type CvData } from "@/lib/cv/types";

/**
 * "Improve my CV for this job" — one Groq call produces an ATS-friendlier
 * rewrite, shown as a preview with the new (in-app) score and the added
 * keywords. Accepting swaps it into the live CV and persists it.
 */
export function OptimizePanel({
  cv,
  jd,
  baseScore,
  onApply,
}: {
  cv: CvData;
  jd: string;
  baseScore: number;
  onApply: (cv: CvData) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [optimized, setOptimized] = useState<CvData | null>(null);
  const [accepted, setAccepted] = useState(false);

  const newScore = optimized ? analyzeMatch(optimized, jd).score : 0;
  const delta = newScore - baseScore;

  // Skills present in the optimized CV but not the original.
  const addedSkills = optimized
    ? optimized.skills.filter(
        (s) => !cv.skills.some((o) => o.toLowerCase() === s.toLowerCase()),
      )
    : [];

  const optimize = async () => {
    setLoading(true);
    setError(undefined);
    setAccepted(false);
    const res = await optimizeCvAction(jd, cv);
    setLoading(false);
    if (res.ok) setOptimized(res.data.optimized);
    else setError(res.error);
  };

  const accept = () => {
    if (!optimized) return;
    if (
      !window.confirm(
        "This will replace your current CV. Continue?",
      )
    ) {
      return;
    }
    onApply(optimized);
    setAccepted(true);
  };

  return (
    <Card className="border-[var(--primary)]/40 bg-[var(--accent)]/30">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-[var(--primary)]" /> Optimize CV for this job
        </CardTitle>
        {!optimized && (
          <Button size="lg" onClick={() => void optimize()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Optimizing…" : "Optimize my CV"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

        {!optimized && !error && (
          <p className="text-sm text-[var(--muted-foreground)]">
            Let AI rewrite your CV for this exact role — weaving in the missing keywords
            and sharpening every bullet with strong action verbs, truthfully and without
            inventing experience. You preview the result and the new score before
            anything is saved.
          </p>
        )}

        {optimized && (
          <>
            {/* Score improvement */}
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-4">
              <div className="flex items-center gap-3">
                <ScorePill value={baseScore} label="Before" muted />
                <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)]" />
                <ScorePill value={newScore} label="After" />
              </div>
              <span
                className={
                  "inline-flex items-center gap-1 text-sm font-semibold " +
                  (delta >= 0 ? "text-[var(--primary)]" : "text-[var(--destructive)]")
                }
              >
                <TrendingUp className="h-4 w-4" />
                {delta >= 0 ? `+${delta}` : delta} points
              </span>
            </div>

            {addedSkills.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-medium">Keywords added</span>
                <div className="flex flex-wrap gap-1.5">
                  {addedSkills.map((s) => (
                    <Chip key={s}>{s}</Chip>
                  ))}
                </div>
              </div>
            )}

            <div>
              <span className="mb-2 block text-sm font-medium">Optimized preview</span>
              <CvPreview cv={optimized} />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={accept} disabled={accepted}>
                <Check className="h-4 w-4" />
                {accepted ? "Applied & saved" : "Accept & save"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setOptimized(null);
                  setAccepted(false);
                }}
              >
                Discard
              </Button>
              {accepted && (
                <span className="text-sm text-[var(--muted-foreground)]">
                  Your CV is updated — switch to Edit &amp; Preview to download it.
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ScorePill({
  value,
  label,
  muted,
}: {
  value: number;
  label: string;
  muted?: boolean;
}) {
  return (
    <div className="text-center">
      <div
        className={
          "text-2xl font-bold " +
          (muted ? "text-[var(--muted-foreground)]" : "text-[var(--primary)]")
        }
      >
        {value}%
      </div>
      <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
    </div>
  );
}
