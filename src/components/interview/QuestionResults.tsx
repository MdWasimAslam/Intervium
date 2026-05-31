"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { QuestionPrompt } from "@/components/interview/QuestionPrompt";
import { cn } from "@/lib/utils";

export interface QuestionResult {
  position: number;
  questionText: string;
  userAnswer: string;
  score: number;
  maxScore: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  /** Coding questions render the answer as code and show the ideal solution. */
  isCoding?: boolean;
  language?: string | null;
  idealSolution?: string | null;
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

/** Animated per-question breakdown cards. */
export function QuestionResults({ results }: { results: QuestionResult[] }) {
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
                : { duration: 0.3, delay: Math.min(i, 8) * 0.06, ease: "easeOut" }
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

                <div className="rounded-xl bg-[var(--muted)] p-3 text-sm">
                  {r.feedback}
                </div>

                {r.isCoding && r.idealSolution && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                      Ideal solution
                    </p>
                    <CodeBlock code={r.idealSolution} />
                  </div>
                )}

                {(r.strengths.length > 0 || r.improvements.length > 0) && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {r.strengths.length > 0 && (
                      <div>
                        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
                          <Check className="h-3.5 w-3.5" /> Strengths
                        </p>
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
                        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                          <TrendingUp className="h-3.5 w-3.5" /> To improve
                        </p>
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
