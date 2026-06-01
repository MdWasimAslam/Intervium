"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  Lightbulb,
  Loader2,
  Sparkles,
  ThumbsUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreRing, type ScoreTone } from "@/components/interview/ScoreRing";
import { cn } from "@/lib/utils";
import { assessCv } from "@/lib/cv/completeness";
import { cvFingerprint } from "@/lib/cv/parse";
import { analyzeCvAtsAction } from "@/lib/actions/cv";
import {
  type AtsLevel,
  type AtsReviewSnapshot,
  type CvData,
  type StoredAtsReview,
} from "@/lib/cv/types";

/**
 * Reputable third-party ATS resume scanners users can cross-check against —
 * shown on the initial screen so the AI score isn't the only data point.
 */
const ATS_CHECKERS: { label: string; href: string }[] = [
  { label: "Jobscan", href: "https://www.jobscan.co/" },
  { label: "Resume Worded", href: "https://resumeworded.com/" },
  { label: "Enhancv", href: "https://enhancv.com/resume-checker/" },
];

const LEVEL_LABEL: Record<AtsLevel, string> = {
  strong: "Strong",
  good: "Good",
  "needs-work": "Needs work",
};

const LEVEL_CLS: Record<AtsLevel, string> = {
  strong: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  good: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "needs-work": "bg-[var(--destructive)]/15 text-[var(--destructive)]",
};

/** Keep the score ring's arc color in step with the level badge. */
const LEVEL_TONE: Record<AtsLevel, ScoreTone> = {
  strong: "good",
  good: "warn",
  "needs-work": "bad",
};

type Tone = "good" | "warn" | "info";

/** Per-tone theming: container wash, accent for icon + heading, bullet marker. */
const TONE_CLS: Record<Tone, { card: string; accent: string; marker: string }> =
  {
    good: {
      card: "border-emerald-500/20 bg-emerald-500/[0.06]",
      accent: "text-emerald-600 dark:text-emerald-400",
      marker: "bg-emerald-500",
    },
    warn: {
      card: "border-amber-500/20 bg-amber-500/[0.06]",
      accent: "text-amber-600 dark:text-amber-400",
      marker: "bg-amber-500",
    },
    info: {
      card: "border-[var(--primary)]/20 bg-[var(--primary)]/[0.06]",
      accent: "text-[var(--primary)]",
      marker: "bg-[var(--primary)]",
    },
  };

/**
 * On-demand AI ATS review of the CV. Before analysis we show a lightweight
 * deterministic completeness hint and the "Analyse CV with AI" button; once
 * the user runs it, the AI's ATS score sits on top with its honest remarks,
 * strengths, issues, and actionable suggestions.
 */
export function CvAiReview({
  cv,
  initial,
}: {
  cv: CvData;
  initial: AtsReviewSnapshot | null;
}) {
  // Hydrate from the stored review so the score shows on load with no AI call.
  const [review, setReview] = useState<StoredAtsReview | null>(
    initial?.review ?? null,
  );
  const [checkedAt, setCheckedAt] = useState<string | null>(
    initial?.checkedAt ?? null,
  );
  // The CV fingerprint the current review was generated against — compared to
  // the live CV to flag a stored score as stale after edits.
  const [reviewHash, setReviewHash] = useState<string | null>(
    initial?.cvHash ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  // Free, instant baseline shown until the AI review is run.
  const baseline = assessCv(cv);
  const stale =
    review !== null && reviewHash !== null && reviewHash !== cvFingerprint(cv);

  async function analyze() {
    setLoading(true);
    setError(undefined);
    const res = await analyzeCvAtsAction(cv);
    setLoading(false);
    if (res.ok) {
      setReview(res.data.review);
      setCheckedAt(res.data.checkedAt);
      setReviewHash(res.data.cvHash);
    } else {
      setError(res.error);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--primary)]" />
            <span className="text-sm font-semibold">AI ATS review</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void analyze()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {review ? "Re-analyse" : "Analyse CV with AI"}
          </Button>
        </div>

        {review && checkedAt && (
          <p className="text-xs text-[var(--muted-foreground)]">
            Last checked {formatCheckedAt(checkedAt)}
          </p>
        )}

        {stale && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Your CV changed since this check — re-analyse to update the score.
          </p>
        )}

        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

        {loading && !review && (
          <p className="text-sm text-[var(--muted-foreground)]">
            Analysing your CV…
          </p>
        )}

        {!review && !loading && !error && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--muted-foreground)]">
              Get an AI ATS score and tailored remarks for your CV. Quick check:{" "}
              <span className="font-medium text-[var(--foreground)]">
                {baseline.score}%
              </span>{" "}
              of the expected fields are filled in.
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-[var(--muted-foreground)]">
              <span>
                Want a second opinion? Verify on a trusted ATS scanner:
              </span>
              {ATS_CHECKERS.map((checker) => (
                <a
                  key={checker.href}
                  href={checker.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 font-medium text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                >
                  {checker.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          </div>
        )}

        {review && (
          <div className="space-y-4">
            {/* ATS score on top */}
            <div className="flex flex-col items-center gap-4 rounded-lg border bg-[var(--secondary)]/40 p-4 sm:flex-row sm:items-start">
              <ScoreRing
                score={review.atsScore}
                max={100}
                size={104}
                showPercent={false}
                tone={LEVEL_TONE[review.level]}
              />
              <div className="space-y-1.5 text-center sm:text-left">
                <div className="flex items-center justify-center gap-2 sm:justify-start">
                  <span className="text-sm font-semibold">ATS score</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      LEVEL_CLS[review.level],
                    )}
                  >
                    {LEVEL_LABEL[review.level]}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
                  {review.remarks}
                </p>
              </div>
            </div>

            {review.strengths.length > 0 && (
              <ReviewList
                icon={<ThumbsUp className="h-3.5 w-3.5" />}
                title="Strengths"
                items={review.strengths}
                tone="good"
              />
            )}
            {review.issues.length > 0 && (
              <ReviewList
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
                title="Issues"
                items={review.issues}
                tone="warn"
              />
            )}
            <ReviewList
              icon={<Lightbulb className="h-3.5 w-3.5" />}
              title="Suggestions"
              items={review.suggestions}
              tone="info"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Format the stored review timestamp for the "Last checked …" line. */
function formatCheckedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "recently";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReviewList({
  icon,
  title,
  items,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone: Tone;
}) {
  const t = TONE_CLS[tone];
  return (
    <div className={cn("rounded-lg border p-3", t.card)}>
      <div
        className={cn(
          "mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide",
          t.accent,
        )}
      >
        {icon}
        {title}
        <span className="text-[var(--muted-foreground)]">({items.length})</span>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 text-sm leading-relaxed"
          >
            <span
              className={cn(
                "mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full",
                t.marker,
              )}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
