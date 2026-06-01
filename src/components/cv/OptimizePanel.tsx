"use client";

import { useState } from "react";
import { ArrowRight, Download, Sparkles, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Chip } from "@/components/ui/chip";
import { CvDocument } from "./CvDocument";
import { CvPrintPortal } from "./CvPrintPortal";
import { usePreferredDesignId } from "./cv-design-store";
import { getCvDesign } from "./designs";
import { analyzeMatch } from "@/lib/cv/ats";
import { optimizeCvAction } from "@/lib/actions/cv";
import { printCv } from "./print";
import { type CvData } from "@/lib/cv/types";

/**
 * "Improve my CV for this job" — one Groq call produces an ATS-friendlier
 * rewrite, shown as a side-by-side preview with the new (in-app) score and the
 * added keywords. The optimized CV is a DOWNLOAD-ONLY artifact tailored to this
 * one job: it is never saved over the user's stored CV, so the original is left
 * exactly as it was. Both the preview and the downloaded PDF render in the
 * user's chosen default template.
 */
export function OptimizePanel({
  cv,
  jd,
  baseScore,
}: {
  cv: CvData;
  jd: string;
  baseScore: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [optimized, setOptimized] = useState<CvData | null>(null);

  // Render the preview AND the downloaded PDF in the user's saved default
  // template — not a hardcoded theme.
  const design = getCvDesign(usePreferredDesignId());

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
    const res = await optimizeCvAction(jd, cv);
    setLoading(false);
    if (res.ok) setOptimized(res.data.optimized);
    else setError(res.error);
  };

  return (
    <Card className="border-[var(--primary)]/40 bg-[var(--accent)]/30">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-[var(--primary)]" /> Optimize CV for this job
        </CardTitle>
        {!optimized && (
          <LoadingButton
            size="lg"
            onClick={() => void optimize()}
            loading={loading}
            loadingText="Optimizing…"
          >
            <Sparkles className="h-4 w-4" />
            Optimize my CV
          </LoadingButton>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

        {!optimized && !error && (
          <p className="text-sm text-[var(--muted-foreground)]">
            Let AI rewrite your CV for this exact role — weaving in the missing keywords
            and sharpening every bullet with strong action verbs, truthfully and without
            inventing experience. You preview the result and download it as a tailored
            copy. <span className="font-medium text-[var(--foreground)]">Your saved CV
            is never changed</span> — this only produces a job-specific version to
            download.
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
              <span className="mb-2 block text-sm font-medium">
                Side-by-side comparison
              </span>
              {/* Split only when there's room for two A4-width docs; below xl
                  they stack, so each renders at its true print width. */}
              <div className="grid gap-4 xl:grid-cols-2">
                <ComparePane label="Your saved CV" cv={cv} design={design} muted />
                <ComparePane
                  label="Optimized for this job"
                  cv={optimized}
                  design={design}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void printCv()}>
                <Download className="h-4 w-4" />
                Download optimized CV (PDF)
              </Button>
              <Button variant="outline" onClick={() => setOptimized(null)}>
                Discard
              </Button>
              <span className="text-sm text-[var(--muted-foreground)]">
                This tailored copy is download-only — your saved CV stays untouched.
              </span>
            </div>

            {/* Print-only copy of the OPTIMIZED CV, in the default template. The
                "Download" button above triggers window.print() against this. */}
            <CvPrintPortal cv={optimized} design={design} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ComparePane({
  label,
  cv,
  design,
  muted,
}: {
  label: string;
  cv: CvData;
  design: ReturnType<typeof getCvDesign>;
  muted?: boolean;
}) {
  return (
    <div>
      <p
        className={
          "mb-2 text-xs font-semibold uppercase tracking-wide " +
          (muted ? "text-[var(--muted-foreground)]" : "text-[var(--primary)]")
        }
      >
        {label}
      </p>
      <div className="max-h-[560px] overflow-auto rounded-xl border border-[var(--border)] bg-white p-5">
        <CvDocument cv={cv} design={design} />
      </div>
    </div>
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
