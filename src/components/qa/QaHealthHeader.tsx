import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DeploymentStatus, OverviewItem, QaReport } from "@/lib/qa/types";
import { QaStatusChip } from "./QaStatusChip";

function scoreColor(score: number): string {
  if (score >= 90) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 75) return "text-amber-600 dark:text-amber-400";
  if (score >= 50) return "text-orange-600 dark:text-orange-400";
  return "text-[var(--destructive)]";
}

function statusTone(status: DeploymentStatus): string {
  switch (status) {
    case "READY FOR DEPLOYMENT":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "READY WITH WARNINGS":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
    case "NEEDS ATTENTION":
      return "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400";
    default:
      return "border-[var(--destructive)]/30 bg-[var(--destructive)]/10 text-[var(--destructive)]";
  }
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-[var(--muted-foreground)]">{label}</span>
    </div>
  );
}

/** Top-of-dashboard summary: overall score, deployment status, overview chips. */
export function QaHealthHeader({ report }: { report: QaReport }) {
  const { summary, overview } = report;
  return (
    <Card>
      <CardContent className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="flex flex-col items-center">
              <span className={cn("text-4xl font-bold tabular-nums sm:text-5xl", scoreColor(summary.score))}>
                {summary.score}
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">/ 100</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-[var(--muted-foreground)]">Overall Health</span>
              <span
                className={cn(
                  "inline-flex w-fit rounded-full border px-3 py-1 text-sm font-semibold",
                  statusTone(summary.status),
                )}
              >
                {summary.status}
              </span>
            </div>
          </div>
          <div className="flex gap-3 sm:gap-6">
            <Stat value={summary.criticalIssues} label="Critical" />
            <Stat value={summary.failures} label="Failures" />
            <Stat value={summary.warnings} label="Warnings" />
            <Stat value={summary.recommendations} label="Recommendations" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
          {overview.map((item: OverviewItem) => (
            <span key={item.label} className="flex items-center gap-1.5 text-sm">
              <span className="text-[var(--muted-foreground)]">{item.label}</span>
              <QaStatusChip status={item.status} />
            </span>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--muted-foreground)]">
          <span>Generated {new Date(report.generatedAt).toLocaleString()}</span>
          <span>Env: {report.environment}</span>
          <span>Version: {report.appVersion}</span>
          <span>Commit: {report.commit}</span>
          <span>Live probes: {report.liveProbe ? "on" : "off"}</span>
          <span>Ran in {report.durationMs}ms</span>
        </div>
      </CardContent>
    </Card>
  );
}
