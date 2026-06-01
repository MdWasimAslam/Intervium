import Link from "next/link";
import {
  Check,
  GraduationCap,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import type { GapAnalysis } from "@/lib/gap-analysis";

function scoreColor(pct: number): string {
  if (pct >= 70) return "text-[var(--primary)]";
  if (pct >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-[var(--destructive)]";
}
function barColor(pct: number): string {
  if (pct >= 70) return "bg-[var(--primary)]";
  if (pct >= 50) return "bg-amber-500";
  return "bg-[var(--destructive)]";
}

/** Resume-vs-Interview gap analysis (Feature 3), read-only. */
export function GapAnalysisView({ data }: { data: GapAnalysis }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Resume vs Interview
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          How your claimed skills compare to what you&apos;ve actually
          demonstrated in interviews.
        </p>
      </div>

      {!data.hasData ? (
        <EmptyState
          icon={<Target className="h-6 w-6" />}
          title="No interview data yet"
          description={data.note}
          action={
            <Link href="/interview/new">
              <Button>Start an interview</Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* Demonstrated performance per specialization */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Demonstrated performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.tested.map((t) => (
                <div key={t.name}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{t.name}</span>
                    <span className="text-[var(--muted-foreground)]">
                      <span className={cn("font-bold tabular-nums", scoreColor(t.avgScore))}>
                        {t.avgScore}%
                      </span>{" "}
                      · {t.sessionCount} interview{t.sessionCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--secondary)]">
                    <div
                      className={cn("h-full rounded-full", barColor(t.avgScore))}
                      style={{ width: `${t.avgScore}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Claimed skills */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Skills you claim</CardTitle>
            </CardHeader>
            <CardContent>
              {data.resumeSkills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {data.resumeSkills.map((s) => (
                    <Chip key={s}>{s}</Chip>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted-foreground)]">
                  No skills listed yet — add them in your profile.
                </p>
              )}
            </CardContent>
          </Card>

          {data.report ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-[var(--primary)]" /> Gap
                    analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm leading-relaxed">{data.report.summary}</p>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <SkillList
                      title="Validated by interviews"
                      items={data.report.validatedSkills}
                      icon={<Check className="h-3.5 w-3.5 text-[var(--primary)]" />}
                      empty="Nothing validated strongly yet."
                    />
                    <SkillList
                      title="Claimed but not validated"
                      items={data.report.unvalidatedSkills}
                      icon={<X className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
                      empty="Everything you claim is backed up."
                    />
                    <SkillList
                      title="Strengths"
                      items={data.report.strengths}
                      icon={<TrendingUp className="h-3.5 w-3.5 text-[var(--primary)]" />}
                    />
                    <SkillList
                      title="Weak areas"
                      items={data.report.weakAreas}
                      icon={<Target className="h-3.5 w-3.5 text-[var(--destructive)]" />}
                      empty="No weak areas flagged."
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <GraduationCap className="h-4 w-4 text-[var(--primary)]" />{" "}
                    Recommended learning path
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-2">
                    {data.report.learningPath.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--primary)]">
                          {i + 1}
                        </span>
                        <span className="pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            </>
          ) : (
            data.note && (
              <p className="text-sm text-[var(--muted-foreground)]">{data.note}</p>
            )
          )}
        </>
      )}
    </div>
  );
}

function SkillList({
  title,
  items,
  icon,
  empty,
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
  empty?: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        {title}
      </p>
      {items.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">{icon}</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--muted-foreground)]">{empty ?? "—"}</p>
      )}
    </div>
  );
}
