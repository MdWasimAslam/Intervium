import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/EmptyState";
import { AI_FEATURE_LABELS } from "@/lib/ai-logging";
import type { AiUsageStats, ModelUsage } from "@/lib/actions/admin/ai-usage";

const featureLabel = (f: string) => AI_FEATURE_LABELS[f] ?? f;
const nf = new Intl.NumberFormat("en-US");

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Read-only AI usage visibility for admins (Feature 12). */
export function AiUsageAdmin({ stats }: { stats: AiUsageStats }) {
  const { summary, limits, appBudget, byFeature, byModel, tokens, log } = stats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Usage</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Groq consumption across the app. Read-only visibility — no limits are
          changed here.
        </p>
      </div>

      {summary.allTime === 0 ? (
        <EmptyState
          title="No AI usage yet"
          description="Once interviews are generated or scored, or resumes analyzed, calls will appear here."
        />
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard label="Requests today" value={summary.today} />
            <SummaryCard label="This month" value={summary.month} />
            <SummaryCard label="All time" value={summary.allTime} />
          </div>

          {/* Limits & remaining — today's consumption vs. Groq's caps. */}
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Limits &amp; remaining</h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                Today&apos;s consumption against Groq&apos;s per-model rate
                limits. Daily bars reset 00:00 UTC; per-minute gauges are live
                snapshots.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {limits.map((u) => (
                <ModelLimitsCard key={u.model} usage={u} />
              ))}
            </div>
            <AppBudgetCard used={appBudget.used} limit={appBudget.limit} />
          </section>

          {/* Token usage — hidden when Groq never returned token counts. */}
          {tokens && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Token usage</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Metric label="Input tokens" value={tokens.input} />
                <Metric label="Output tokens" value={tokens.output} />
                <Metric label="Total tokens" value={tokens.total} />
              </CardContent>
            </Card>
          )}

          {/* By feature */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Usage by feature</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byFeature.map((f) => (
                    <TableRow key={f.feature}>
                      <TableCell>{featureLabel(f.feature)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {nf.format(f.count)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {f.totalTokens > 0 ? nf.format(f.totalTokens) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* By model */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Usage by model</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Last used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byModel.map((m) => (
                    <TableRow key={m.model}>
                      <TableCell className="font-mono text-xs">
                        {m.model}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {nf.format(m.count)}
                      </TableCell>
                      <TableCell className="text-right text-[var(--muted-foreground)]">
                        {formatDateTime(m.lastUsed)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Request log */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Recent requests
                <span className="ml-2 text-xs font-normal text-[var(--muted-foreground)]">
                  latest {log.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Feature</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {log.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-[var(--muted-foreground)]">
                        {formatDateTime(r.createdAt)}
                      </TableCell>
                      <TableCell className="max-w-[14rem] truncate">
                        {r.email ?? "—"}
                      </TableCell>
                      <TableCell>{featureLabel(r.feature)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.model}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.totalTokens != null ? nf.format(r.totalTokens) : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/** Threshold colors: green < 70% used, amber 70–90%, red ≥ 90%. */
function barColor(pct: number): string {
  if (pct >= 90) return "var(--destructive)";
  if (pct >= 70) return "var(--warning)";
  return "var(--primary)";
}

/** A labeled linear usage bar: used / limit, percent, and optional remaining. */
function UsageBar({
  label,
  used,
  limit,
  showRemaining = false,
}: {
  label: string;
  used: number;
  limit: number;
  showRemaining?: boolean;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const remaining = Math.max(0, limit - used);

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-[var(--muted-foreground)]">{label}</span>
        <span className="tabular-nums">
          <span className="font-semibold">{nf.format(used)}</span>
          <span className="text-[var(--muted-foreground)]">
            {" "}
            / {nf.format(limit)}
          </span>
        </span>
      </div>
      <div
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--secondary)]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${pct}% used`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor(pct) }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-[var(--muted-foreground)]">
        <span className="tabular-nums">{pct}% used</span>
        {showRemaining && (
          <span className="tabular-nums">{nf.format(remaining)} left</span>
        )}
      </div>
    </div>
  );
}

function RoleChip({ role }: { role: ModelUsage["role"] }) {
  return (
    <span className="inline-flex rounded-full bg-[var(--primary)]/15 px-2 py-0.5 text-xs font-medium capitalize text-[var(--primary)]">
      {role}
    </span>
  );
}

/** Per-model limits card: daily budget bars + per-minute snapshot gauges. */
function ModelLimitsCard({ usage }: { usage: ModelUsage }) {
  const { model, role, limits } = usage;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="truncate font-mono text-sm">{model}</span>
          <RoleChip role={role} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {limits ? (
          <>
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                Daily budget · resets 00:00 UTC
              </p>
              <UsageBar
                label="Requests / day"
                used={usage.requestsToday}
                limit={limits.rpd}
                showRemaining
              />
              <UsageBar
                label="Tokens / day"
                used={usage.tokensToday}
                limit={limits.tpd}
                showRemaining
              />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                This minute · live snapshot
              </p>
              <UsageBar
                label="Requests / min"
                used={usage.requestsLastMinute}
                limit={limits.rpm}
              />
              <UsageBar
                label="Tokens / min"
                used={usage.tokensLastMinute}
                limit={limits.tpm}
              />
              <p className="text-xs text-[var(--muted-foreground)]">
                Snapshot of the last 60s — not a remaining budget.
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">
            No limit reference for this model. Today:{" "}
            {nf.format(usage.requestsToday)} requests,{" "}
            {nf.format(usage.tokensToday)} tokens.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** The app's own daily call-budget guard (calls, not tokens). */
function AppBudgetCard({ used, limit }: { used: number; limit: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">App daily call budget</CardTitle>
      </CardHeader>
      <CardContent>
        <UsageBar
          label="AI calls reserved today"
          used={used}
          limit={limit}
          showRemaining
        />
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          A soft guard on AI calls per day (override with{" "}
          <span className="font-mono">AI_DAILY_BUDGET</span>). It caps the
          number of calls, not tokens — the per-model Tokens / day bars above
          are the constraint you&apos;ll usually hit first.
        </p>
      </CardContent>
    </Card>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">
          {nf.format(value)}
        </p>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">
        {nf.format(value)}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const ok = status === "success";
  return (
    <span
      className={
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium " +
        (ok
          ? "bg-[var(--primary)]/15 text-[var(--primary)]"
          : "bg-[var(--destructive)]/15 text-[var(--destructive)]")
      }
    >
      {ok ? "Success" : "Error"}
    </span>
  );
}
