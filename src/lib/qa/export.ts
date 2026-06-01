/**
 * Report serialisers — pure and CLIENT-SAFE (imported by the dashboard for
 * download). JSON export is just `JSON.stringify(report)`; this module provides
 * the Markdown rendering and a filename helper.
 */

import type { CheckResult, CheckStatus, QaReport } from "./types";

const STATUS_LABEL: Record<CheckStatus, string> = {
  pass: "PASS",
  warning: "WARN",
  fail: "FAIL",
  skip: "SKIP",
};

const STATUS_ICON: Record<CheckStatus, string> = {
  pass: "✅",
  warning: "⚠️",
  fail: "❌",
  skip: "➖",
};

function checkLine(c: CheckResult): string {
  const bits = [`- ${STATUS_ICON[c.status]} **${c.label}** — ${STATUS_LABEL[c.status]}`];
  if (c.detail) bits.push(`: ${c.detail}`);
  if (c.expected !== undefined || c.actual !== undefined) {
    bits.push(` (expected: ${c.expected ?? "—"}, actual: ${c.actual ?? "—"})`);
  }
  if (typeof c.latencyMs === "number") bits.push(` [${c.latencyMs}ms]`);
  let line = bits.join("");
  if (c.recommendation) line += `\n  - 💡 ${c.recommendation}`;
  return line;
}

/** Render a full QA report as Markdown. */
export function reportToMarkdown(report: QaReport): string {
  const { summary } = report;
  const lines: string[] = [];

  lines.push(`# Intervium — Production QA Report`);
  lines.push("");
  lines.push(`- **Generated:** ${report.generatedAt}`);
  lines.push(`- **Environment:** ${report.environment}`);
  lines.push(`- **App version:** ${report.appVersion}`);
  lines.push(`- **Commit:** ${report.commit}`);
  lines.push(`- **Live network probes:** ${report.liveProbe ? "on" : "off"}`);
  lines.push(`- **Duration:** ${report.durationMs}ms`);
  lines.push("");

  lines.push(`## Overall Health: ${summary.score}/100 — ${summary.status}`);
  lines.push("");
  lines.push(`- Critical issues: ${summary.criticalIssues}`);
  lines.push(`- Failures: ${summary.failures}`);
  lines.push(`- Warnings: ${summary.warnings}`);
  lines.push(`- Recommendations: ${summary.recommendations}`);
  lines.push("");

  lines.push(`### Overview`);
  lines.push("");
  lines.push(`| Check | Status |`);
  lines.push(`| --- | --- |`);
  for (const item of report.overview) {
    lines.push(`| ${item.label} | ${STATUS_LABEL[item.status]} |`);
  }
  lines.push("");

  for (const section of report.sections) {
    const weightNote = section.informational
      ? "informational"
      : `weight ${section.weight}${section.critical ? ", critical" : ""}`;
    lines.push(
      `## ${STATUS_ICON[section.status]} ${section.title} — ${STATUS_LABEL[section.status]}`,
    );
    lines.push("");
    lines.push(`_${weightNote} · ${section.durationMs}ms_`);
    lines.push("");
    if (section.note) {
      lines.push(`> ${section.note}`);
      lines.push("");
    }
    for (const check of section.checks) lines.push(checkLine(check));
    lines.push("");
  }

  return lines.join("\n");
}

/** A timestamped, filesystem-safe filename for an export. */
export function reportFilename(report: QaReport, ext: "json" | "md"): string {
  const stamp = report.generatedAt.replace(/[:.]/g, "-");
  return `intervium-qa-${stamp}.${ext}`;
}
