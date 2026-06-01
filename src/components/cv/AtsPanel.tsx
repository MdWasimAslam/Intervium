"use client";

import { useState } from "react";
import { Check, Loader2, Search, Sparkles, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { LoadingButton } from "@/components/ui/loading-button";
import { Chip } from "@/components/ui/chip";
import { ScoreRing } from "@/components/interview/ScoreRing";
import {
  analyzeMatch,
  fitLevelFromScore,
  type AtsResult,
  type FitLevel,
} from "@/lib/cv/ats";
import { analyzeJobMatchAction } from "@/lib/actions/cv";
import { type CvMatchAnalysis } from "@/lib/groq";
import { type CvData } from "@/lib/cv/types";
import { OptimizePanel } from "./OptimizePanel";

/**
 * ATS Match tab. Keyword scoring runs entirely in-app (instant, no AI). One
 * optional AI call produces a holistic semantic match analysis (fit verdict,
 * strengths, gaps, suggestions), cached per JD so re-viewing never re-calls.
 *
 * The job description is lifted to the parent workspace so the Cover Letter tab
 * can reuse whatever was pasted here.
 */
export function AtsPanel({
  cv,
  jd,
  onJdChange,
}: {
  cv: CvData;
  jd: string;
  onJdChange: (jd: string) => void;
}) {
  const [analysis, setAnalysis] = useState<AtsResult | null>(null);
  const [analyzedJd, setAnalyzedJd] = useState("");

  // AI analysis cache: keyed by the JD it was generated for.
  const [ai, setAi] = useState<CvMatchAnalysis | null>(null);
  const [aiForJd, setAiForJd] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string>();

  const runAiAnalysis = async (targetJd: string) => {
    setAiLoading(true);
    setAiError(undefined);
    const res = await analyzeJobMatchAction(targetJd, cv);
    setAiLoading(false);
    if (res.ok) {
      setAi(res.data);
      setAiForJd(targetJd);
    } else {
      setAiError(res.error);
    }
  };

  // One click: instant in-app keyword score + the AI semantic analysis.
  const analyze = () => {
    const trimmed = jd.trim();
    if (!trimmed) return;
    setAnalysis(analyzeMatch(cv, trimmed));
    setAnalyzedJd(trimmed);
    // Reuse a cached AI analysis for the exact same JD; otherwise run it.
    if (aiForJd === trimmed && ai) {
      setAiError(undefined);
    } else {
      setAi(null);
      void runAiAnalysis(trimmed);
    }
  };

  const stale = analysis !== null && jd.trim() !== analyzedJd;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paste a job description</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={8}
            value={jd}
            onChange={(e) => onJdChange(e.target.value)}
            placeholder="Paste the full job description here…"
          />
          <div className="flex items-center gap-3">
            <LoadingButton
              onClick={analyze}
              disabled={!jd.trim()}
              loading={aiLoading}
              loadingText="Analyzing…"
            >
              <Search className="h-4 w-4" />
              Analyze match
            </LoadingButton>
            <span className="text-sm text-[var(--muted-foreground)]">
              {stale
                ? "Job description changed — re-analyze to update."
                : "Instant keyword score + AI fit analysis."}
            </span>
          </div>
        </CardContent>
      </Card>

      {analysis && (
        <>
          <Card>
            <CardContent className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-center">
              <div className="flex flex-col items-center gap-1">
                <ScoreRing score={analysis.score} max={100} size={132} />
                <span className="text-sm text-[var(--muted-foreground)]">ATS keyword match</span>
              </div>
              <div className="flex-1 space-y-4">
                <KeywordGroup
                  label={`Matched (${analysis.matched.length})`}
                  icon={<Check className="h-3.5 w-3.5 text-[var(--primary)]" />}
                  words={analysis.matched}
                  tone="matched"
                  empty="No JD keywords found in your CV yet."
                />
                <KeywordGroup
                  label={`Missing (${analysis.missing.length})`}
                  icon={<X className="h-3.5 w-3.5 text-[var(--destructive)]" />}
                  words={analysis.missing}
                  tone="missing"
                  empty="Great — every keyword is covered!"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-[var(--primary)]" /> AI match analysis
              </CardTitle>
              <LoadingButton
                variant="outline"
                size="sm"
                onClick={() => {
                  setAi(null);
                  void runAiAnalysis(analyzedJd);
                }}
                loading={aiLoading}
              >
                Refresh
              </LoadingButton>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiError && <p className="text-sm text-[var(--destructive)]">{aiError}</p>}
              {aiLoading && !ai && (
                <p className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI is analyzing your fit for this role…
                </p>
              )}
              {!aiError && !ai && !aiLoading && (
                <p className="text-sm text-[var(--muted-foreground)]">
                  The score above is literal keyword overlap. The AI adds a semantic
                  read of your fit — transferable experience, seniority, and domain —
                  with strengths, real gaps, and how to improve.
                </p>
              )}
              {ai && (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <FitBadge score={ai.fitScore} />
                    <span className="text-sm">
                      <span className="font-semibold">AI fit estimate: {ai.fitScore}%</span>
                      <span className="text-[var(--muted-foreground)]">
                        {" "}
                        · keyword match {analysis.score}%
                      </span>
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{ai.verdict}</p>

                  {ai.strengths.length > 0 && (
                    <AnalysisList
                      title="Strengths"
                      items={ai.strengths}
                      icon={<Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />}
                    />
                  )}
                  {ai.gaps.length > 0 && (
                    <AnalysisList
                      title="Gaps"
                      items={ai.gaps}
                      icon={<X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--destructive)]" />}
                    />
                  )}
                  {ai.suggestions.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                        Suggestions
                      </p>
                      <ul className="space-y-1.5">
                        {ai.suggestions.map((s, i) => (
                          <li key={i} className="flex gap-2 text-sm">
                            <span className="mt-0.5 text-[var(--primary)]">•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <OptimizePanel cv={cv} jd={analyzedJd} baseScore={analysis.score} />
        </>
      )}
    </div>
  );
}

/**
 * Deterministic fit badge: the band and label are derived from the score via
 * {@link fitLevelFromScore}, never self-reported by the model — so a "72%" can
 * never render as "Moderate".
 */
function FitBadge({ score }: { score: number }) {
  const { key, label } = fitLevelFromScore(score);
  const styles: Record<FitLevel, string> = {
    strong: "bg-[var(--primary)]/15 text-[var(--primary)]",
    good: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    moderate: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    weak: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    poor: "bg-[var(--destructive)]/15 text-[var(--destructive)]",
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[key]}`}>
      {label}
    </span>
  );
}

function AnalysisList({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm">
            {icon}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KeywordGroup({
  label,
  icon,
  words,
  tone,
  empty,
}: {
  label: string;
  icon: React.ReactNode;
  words: string[];
  tone: "matched" | "missing";
  empty: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        {icon}
        {label}
      </div>
      {words.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {words.map((w) => (
            <Chip
              key={w}
              className={
                tone === "missing"
                  ? "border-[var(--destructive)]/30 bg-[var(--destructive)]/10 text-[var(--destructive)]"
                  : ""
              }
            >
              {w}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
