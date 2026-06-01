"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileText, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { buildOverview, summarize } from "@/lib/qa/scoring";
import { reportFilename, reportToMarkdown } from "@/lib/qa/export";
import type { CheckResult, QaReport, SectionId } from "@/lib/qa/types";
import { QaHealthHeader } from "./QaHealthHeader";
import { QaSectionCard } from "./QaSectionCard";

async function callRun(body: {
  sections?: SectionId[];
  liveProbe?: boolean;
}): Promise<QaReport> {
  const res = await fetch("/api/qa/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Audit request failed (HTTP ${res.status})`);
  }
  return (await res.json()) as QaReport;
}

/** Browser/runtime info can only be read on the client; injected into §1. */
function browserChecks(): CheckResult[] {
  if (typeof navigator === "undefined") return [];
  return [
    { id: "browser-ua", label: "Browser", status: "pass", detail: navigator.userAgent },
    { id: "browser-lang", label: "Language", status: "pass", detail: navigator.language },
    {
      id: "browser-viewport",
      label: "Viewport",
      status: "pass",
      detail: `${window.innerWidth}×${window.innerHeight}`,
    },
  ];
}

function enrich(report: QaReport): QaReport {
  const extra = browserChecks();
  if (extra.length === 0) return report;
  return {
    ...report,
    sections: report.sections.map((s) =>
      s.id === "app-info"
        ? {
            ...s,
            checks: [
              ...s.checks.filter((c) => !c.id.startsWith("browser-")),
              ...extra,
            ],
          }
        : s,
    ),
  };
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function QaDashboard() {
  const [report, setReport] = useState<QaReport | null>(null);
  const [runningFull, setRunningFull] = useState(false);
  const [rerunning, setRerunning] = useState<SectionId | null>(null);
  const [liveProbe, setLiveProbe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didAutoRun = useRef(false);

  const runFull = useCallback(async () => {
    setRunningFull(true);
    setError(null);
    try {
      setReport(enrich(await callRun({ liveProbe })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audit failed");
    } finally {
      setRunningFull(false);
    }
  }, [liveProbe]);

  const rerun = useCallback(
    async (id: SectionId) => {
      setRerunning(id);
      setError(null);
      try {
        const partial = await callRun({ sections: [id], liveProbe });
        const updated = partial.sections.find((s) => s.id === id);
        setReport((prev) => {
          if (!prev || !updated) return prev;
          const sections = prev.sections.map((s) => (s.id === id ? updated : s));
          return enrich({
            ...prev,
            sections,
            summary: summarize(sections),
            overview: buildOverview(sections),
            generatedAt: partial.generatedAt,
            durationMs: sections.reduce((sum, s) => sum + s.durationMs, 0),
          });
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Re-run failed");
      } finally {
        setRerunning(null);
      }
    },
    [liveProbe],
  );

  // Auto-run a full audit once on mount.
  useEffect(() => {
    if (didAutoRun.current) return;
    didAutoRun.current = true;
    void runFull();
  }, [runFull]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-4">
          <Button onClick={() => void runFull()} disabled={runningFull}>
            {runningFull ? <Loader2 className="animate-spin" /> : <Play />}
            Run Full Audit
          </Button>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch
              checked={liveProbe}
              onCheckedChange={setLiveProbe}
              disabled={runningFull}
            />
            Live probes (DB + Groq /models, no tokens)
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!report}
            onClick={() =>
              report &&
              download(
                reportFilename(report, "json"),
                JSON.stringify(report, null, 2),
                "application/json",
              )
            }
          >
            <Download /> JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!report}
            onClick={() =>
              report &&
              download(
                reportFilename(report, "md"),
                reportToMarkdown(report),
                "text/markdown",
              )
            }
          >
            <FileText /> Markdown
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!report}
            onClick={() => window.print()}
          >
            <FileText /> PDF
          </Button>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-[var(--destructive)]">
            {error}
          </CardContent>
        </Card>
      )}

      {!report && runningFull && (
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-sm text-[var(--muted-foreground)]">
            <Loader2 className="animate-spin" />
            Running production readiness checks…
          </CardContent>
        </Card>
      )}

      {report && (
        <div id="qa-report" className="space-y-6">
          <QaHealthHeader report={report} />
          {report.sections.map((section) => (
            <QaSectionCard
              key={section.id}
              section={section}
              rerunning={rerunning === section.id}
              onRerun={rerun}
            />
          ))}
        </div>
      )}
    </div>
  );
}
