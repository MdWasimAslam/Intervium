import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Flame,
  Gauge,
  LineChart,
  ListChecks,
  Rocket,
  Trophy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/Container";
import { requireAuth } from "@/lib/session";
import { getDashboardData } from "@/lib/dashboard";
import { getInsights } from "@/lib/insights";
import { Greeting } from "@/components/dashboard/Greeting";
import { PrimaryAction } from "@/components/dashboard/PrimaryAction";
import { StatTile } from "@/components/dashboard/StatTile";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { ProfileSummary } from "@/components/dashboard/ProfileSummary";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { QuickLinks } from "@/components/dashboard/QuickLinks";
import { MilestoneBanner } from "@/components/dashboard/MilestoneBanner";
import { WeakAreaCard } from "@/components/dashboard/WeakAreaCard";
import { RetryWeakCard } from "@/components/dashboard/RetryWeakCard";
import { LatestResult } from "@/components/interview/LatestResult";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireAuth();

  // Respect the onboarding guard — same rule as the interview setup page.
  const data = await getDashboardData(user.id);
  if (!data) redirect("/onboarding");

  const {
    profile,
    stats,
    recent,
    latest,
    trend,
    scoredCount,
    resumeId,
    streaks,
    milestone,
  } = data;
  const hasResults = scoredCount > 0;
  const isAdmin = user.role === "admin";

  // Study insights (weak-area + retry) — only meaningful once there are scores.
  const insights = hasResults ? await getInsights(user.id) : null;

  const level = profile.band
    ? `${profile.band}-level`
    : `${profile.yearsExperience} yr${profile.yearsExperience === 1 ? "" : "s"} experience`;
  const subline = profile.roleName ? `${profile.roleName} · ${level}` : level;

  return (
    <Container className="py-10 sm:py-12">
      <div className="space-y-8">
        {/* Greeting */}
        <header className="animate-fade-up">
          <Greeting name={profile.displayName} />
          <p className="mt-2 text-[var(--muted-foreground)]">{subline}</p>
        </header>

        {/* Hero + latest result */}
        <section
          className="animate-fade-up grid gap-5 lg:grid-cols-3"
          style={{ animationDelay: "60ms" }}
        >
          <div
            className={hasResults && latest ? "lg:col-span-2" : "lg:col-span-3"}
          >
            <PrimaryAction isFirst={!hasResults} resumeId={resumeId} />
          </div>
          {hasResults && latest && (
            <div className="lg:col-span-1">
              <LatestResult
                variant="highlight"
                latest={{
                  totalScore: latest.totalScore,
                  maxScore: latest.maxScore,
                  interviewType: latest.interviewType,
                  techStack: latest.tech,
                }}
                role={latest.role}
                date={latest.date}
                href={`/interview/${latest.id}/results`}
              />
            </div>
          )}
        </section>

        {/* Stats */}
        <section
          className="animate-fade-up"
          style={{ animationDelay: "120ms" }}
        >
          <h2 className="mb-3 text-lg font-semibold">Your progress</h2>
          {hasResults ? (
            <div className="space-y-5">
              {milestone.isNewBest && (
                <MilestoneBanner
                  bestPct={milestone.bestPct}
                  sessionId={milestone.sessionId}
                />
              )}

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                <StatTile
                  icon={<CheckCircle2 />}
                  label="Interviews"
                  value={String(stats.completed)}
                  hint="completed"
                />
                <StatTile
                  icon={<Gauge />}
                  label="Avg score"
                  value={String(stats.avgPct ?? 0)}
                  suffix="%"
                />
                <StatTile
                  icon={<Trophy />}
                  label="Best score"
                  value={String(stats.bestPct ?? 0)}
                  suffix="%"
                />
                <StatTile
                  icon={<Flame />}
                  label="Current streak"
                  value={String(streaks.current)}
                  suffix={streaks.current === 1 ? " day" : " days"}
                  hint={`longest ${streaks.longest}`}
                />
                <StatTile
                  icon={<CalendarDays />}
                  label="This week"
                  value={String(streaks.thisWeek)}
                  hint="interviews"
                />
                <StatTile
                  icon={<ListChecks />}
                  label="Questions"
                  value={String(stats.questionsAnswered)}
                  hint="answered"
                />
              </div>

              {trend.length >= 3 && (
                <Card>
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <LineChart className="h-4 w-4 text-[var(--primary)]" />
                      Score trend
                    </CardTitle>
                    <span className="text-sm text-[var(--muted-foreground)]">
                      Last {trend.length} · most recent{" "}
                      <span className="font-semibold text-[var(--foreground)]">
                        {trend[trend.length - 1]}%
                      </span>
                    </span>
                  </CardHeader>
                  <CardContent>
                    <Sparkline points={trend} className="w-full" />
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--primary)]">
                  <Rocket className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold">Your stats start here</h3>
                  <p className="mx-auto max-w-sm text-sm text-[var(--muted-foreground)]">
                    Complete your first interview to unlock your average score,
                    personal best, and progress over time.
                  </p>
                </div>
                <Link href="/interview/new">
                  <Button>Start your first interview</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Focus & improve — weak-area detection + retry weakest answers */}
        {hasResults && insights && (
          <section
            className="animate-fade-up"
            style={{ animationDelay: "180ms" }}
          >
            <h2 className="mb-3 text-lg font-semibold">Focus &amp; improve</h2>
            <div className="grid gap-5 lg:grid-cols-2">
              <WeakAreaCard
                weakest={insights.weakest}
                ranked={insights.ranked}
              />
              <RetryWeakCard retry={insights.retry} />
            </div>
          </section>
        )}

        {/* Recent activity + profile */}
        <section
          className="animate-fade-up grid gap-5 lg:grid-cols-3"
          style={{ animationDelay: "240ms" }}
        >
          <div className="lg:col-span-2">
            <RecentActivity
              sessions={recent}
              showViewAll={scoredCount > recent.length}
            />
          </div>
          <div className="lg:col-span-1">
            <ProfileSummary profile={profile} />
          </div>
        </section>

        {/* Shortcuts */}
        <section
          className="animate-fade-up"
          style={{ animationDelay: "300ms" }}
        >
          <QuickLinks isAdmin={isAdmin} />
        </section>
      </div>
    </Container>
  );
}
