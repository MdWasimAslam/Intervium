"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BookOpenCheck,
  Check,
  Lightbulb,
  ListChecks,
  MessageSquareText,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { QuestionPrompt } from "@/components/interview/QuestionPrompt";
import { cn } from "@/lib/utils";

export interface TextRubric {
  technicalAccuracy: number;
  completeness: number;
  communicationClarity: number;
  interviewReadiness: number;
}

export interface CodeRubric {
  correctness: number;
  approach: number;
  edgeCases: number;
  readability: number;
}

export interface QuestionResult {
  position: number;
  questionText: string;
  userAnswer: string;
  score: number;
  maxScore: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  /** Concepts from the ideal answer the candidate missed (may be empty). */
  missingConcepts?: string[];
  /** Coding only: a stronger alternative solution, when the model suggested one. */
  betterApproach?: string | null;
  /** Interviewer rubric breakdown — one of these is set per question type. */
  rubric?: TextRubric | null;
  codeRubric?: CodeRubric | null;
  /** Coding questions render the answer as code and show the ideal solution. */
  isCoding?: boolean;
  language?: string | null;
  /** Expected/ideal answer for text questions (prose). */
  idealAnswer?: string | null;
  /** Ideal solution for coding questions (code). */
  idealSolution?: string | null;
}

/** Small uppercase section label with a leading icon. */
function SectionLabel({
  icon: Icon,
  children,
  className,
}: {
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </p>
  );
}

/** Monospace, scrollable code block used for coding answers and solutions. */
function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--muted)] p-3 text-xs leading-relaxed">
      <code className="font-mono whitespace-pre">{code}</code>
    </pre>
  );
}

function scoreColor(pct: number): string {
  if (pct >= 70) return "text-[var(--primary)]";
  if (pct >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-[var(--destructive)]";
}

function barColor(pct: number): string {
  if (pct >= 70) return "bg-[var(--primary)]";
  if (pct >= 40) return "bg-amber-500";
  return "bg-[var(--destructive)]";
}

/** One rubric component shown as a labelled, colour-coded mini-bar. */
function RubricPill({
  label,
  value,
  max,
  weight,
}: {
  label: string;
  value: number;
  max: number;
  weight?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-2.5 py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium leading-tight text-[var(--muted-foreground)]">
          {label}
          {weight && <span className="ml-1 opacity-60">{weight}</span>}
        </span>
        <span className={cn("text-xs font-bold tabular-nums", scoreColor(pct))}>
          {value}/{max}
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className={cn("h-full rounded-full", barColor(pct))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Structured rubric breakdown — text (4/3/2/1) or weighted coding (each /10). */
function RubricBreakdown({
  result,
  isTechnical = true,
}: {
  result: QuestionResult;
  isTechnical?: boolean;
}) {
  if (result.codeRubric) {
    const c = result.codeRubric;
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <RubricPill
          label="Correctness"
          value={c.correctness}
          max={10}
          weight="40%"
        />
        <RubricPill label="Approach" value={c.approach} max={10} weight="25%" />
        <RubricPill
          label="Edge cases"
          value={c.edgeCases}
          max={10}
          weight="20%"
        />
        <RubricPill
          label="Readability"
          value={c.readability}
          max={10}
          weight="15%"
        />
      </div>
    );
  }
  if (result.rubric) {
    const r = result.rubric;
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <RubricPill
          label={isTechnical ? "Technical accuracy" : "Accuracy"}
          value={r.technicalAccuracy}
          max={4}
        />
        <RubricPill label="Completeness" value={r.completeness} max={3} />
        <RubricPill label="Clarity" value={r.communicationClarity} max={2} />
        <RubricPill
          label="Interview ready"
          value={r.interviewReadiness}
          max={1}
        />
      </div>
    );
  }
  return null;
}

/** Animated per-question breakdown cards. */
export function QuestionResults({
  results,
  isTechnical = true,
}: {
  results: QuestionResult[];
  isTechnical?: boolean;
}) {
  const reduced = useReducedMotion() ?? false;
  return (
    <div className="space-y-4">
      {results.map((r, i) => {
        const pct = r.maxScore > 0 ? (r.score / r.maxScore) * 100 : 0;
        return (
          <motion.div
            key={r.position}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : {
                    duration: 0.3,
                    delay: Math.min(i, 8) * 0.06,
                    ease: "easeOut",
                  }
            }
          >
            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="flex items-start justify-between gap-4">
                  <QuestionPrompt
                    text={`${r.position + 1}. ${r.questionText}`}
                    className="min-w-0 font-semibold leading-relaxed"
                  />
                  <span
                    className={cn(
                      "shrink-0 text-lg font-bold tabular-nums",
                      scoreColor(pct),
                    )}
                  >
                    {r.score}/{r.maxScore}
                  </span>
                </div>

                <div>
                  <p className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                    {r.isCoding ? "Your code" : "Your answer"}
                    {r.isCoding && r.language && (
                      <span className="rounded bg-[var(--secondary)] px-1.5 py-0.5 text-[10px] font-semibold normal-case text-[var(--secondary-foreground)]">
                        {r.language}
                      </span>
                    )}
                  </p>
                  {r.userAnswer.trim() ? (
                    r.isCoding ? (
                      <CodeBlock code={r.userAnswer} />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm">
                        {r.userAnswer}
                      </p>
                    )
                  ) : (
                    <p className="text-sm italic text-[var(--muted-foreground)]">
                      (no answer)
                    </p>
                  )}
                </div>

                <RubricBreakdown result={r} isTechnical={isTechnical} />

                {/* Why this score — the model's rationale for the breakdown. */}
                <div>
                  <SectionLabel icon={MessageSquareText}>
                    Why this score
                  </SectionLabel>
                  <div className="rounded-xl bg-[var(--muted)] p-3 text-sm">
                    {r.feedback}
                  </div>
                </div>

                {/* Missing concepts — what a complete answer would have covered. */}
                {r.missingConcepts && r.missingConcepts.length > 0 && (
                  <div>
                    <SectionLabel
                      icon={ListChecks}
                      className="text-amber-600 dark:text-amber-400"
                    >
                      Missing concepts
                    </SectionLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {r.missingConcepts.map((c, j) => (
                        <span
                          key={j}
                          className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expected / ideal answer (text questions). */}
                {!r.isCoding && r.idealAnswer?.trim() && (
                  <div>
                    <SectionLabel icon={BookOpenCheck}>
                      Expected answer
                    </SectionLabel>
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-sm leading-relaxed whitespace-pre-wrap text-[var(--muted-foreground)]">
                      {r.idealAnswer.trim()}
                    </div>
                  </div>
                )}

                {/* Ideal solution + better approach (coding questions). */}
                {r.isCoding && r.idealSolution && (
                  <div>
                    <SectionLabel icon={BookOpenCheck}>
                      Ideal solution
                    </SectionLabel>
                    <CodeBlock code={r.idealSolution} />
                  </div>
                )}
                {r.isCoding && r.betterApproach?.trim() && (
                  <div>
                    <SectionLabel icon={Lightbulb}>Better approach</SectionLabel>
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-sm leading-relaxed whitespace-pre-wrap text-[var(--muted-foreground)]">
                      {r.betterApproach.trim()}
                    </div>
                  </div>
                )}

                {(r.strengths.length > 0 || r.improvements.length > 0) && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {r.strengths.length > 0 && (
                      <div>
                        <SectionLabel
                          icon={Check}
                          className="text-[var(--primary)]"
                        >
                          Strengths
                        </SectionLabel>
                        <ul className="space-y-1 text-sm">
                          {r.strengths.map((s, j) => (
                            <li
                              key={j}
                              className="text-[var(--muted-foreground)]"
                            >
                              • {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {r.improvements.length > 0 && (
                      <div>
                        <SectionLabel
                          icon={TrendingUp}
                          className="text-amber-600 dark:text-amber-400"
                        >
                          Areas for improvement
                        </SectionLabel>
                        <ul className="space-y-1 text-sm">
                          {r.improvements.map((s, j) => (
                            <li
                              key={j}
                              className="text-[var(--muted-foreground)]"
                            >
                              • {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
