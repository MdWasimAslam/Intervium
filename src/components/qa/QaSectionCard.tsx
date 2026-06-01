"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SectionResult } from "@/lib/qa/types";
import { QaStatusChip } from "./QaStatusChip";

export function QaSectionCard({
  section,
  rerunning,
  onRerun,
}: {
  section: SectionResult;
  rerunning: boolean;
  onRerun: (id: SectionResult["id"]) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <QaStatusChip status={section.status} />
          <h3 className="text-base font-semibold tracking-tight">{section.title}</h3>
          {section.informational ? (
            <Chip tone="neutral">informational</Chip>
          ) : (
            <Chip tone="neutral">weight {section.weight}</Chip>
          )}
          {section.critical && <Chip tone="warning">critical</Chip>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--muted-foreground)]">
            {section.durationMs}ms
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRerun(section.id)}
            disabled={rerunning}
            className="print:hidden"
          >
            {rerunning ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RefreshCw />
            )}
            Re-run
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {section.note && (
          <p className="mb-3 text-xs text-[var(--muted-foreground)]">{section.note}</p>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Status</TableHead>
              <TableHead>Check</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {section.checks.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <QaStatusChip status={c.status} />
                </TableCell>
                <TableCell>
                  <div className="font-medium">{c.label}</div>
                  {c.recommendation && (
                    <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                      💡 {c.recommendation}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {c.detail && <span>{c.detail}</span>}
                  {(c.expected !== undefined || c.actual !== undefined) && (
                    <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                      expected {c.expected ?? "—"} · actual {c.actual ?? "—"}
                    </div>
                  )}
                  {typeof c.latencyMs === "number" && (
                    <div className="mt-0.5 text-xs text-[var(--muted-foreground)] tabular-nums">
                      {c.latencyMs}ms
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
