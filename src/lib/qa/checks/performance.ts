import "server-only";
import { analyzeMatch } from "@/lib/cv/ats";
import { buildPrompt, type GenerationContext } from "@/lib/groq";
import { sql } from "drizzle-orm";
import { db } from "@db";
import { ATS_FIXTURES } from "../fixtures";
import type { CheckResult, SectionOutput } from "../types";
import { readProjectFile } from "./shared";

/**
 * §11 Performance Audit. Microbenchmarks the deterministic engines and the live
 * DB ping, then rates each Good/Moderate/Poor. (No AI; timings are local CPU +
 * one SQL round-trip.)
 */

function rate(
  ms: number,
  good: number,
  moderate: number,
): { status: CheckResult["status"]; word: string } {
  if (ms <= good) return { status: "pass", word: "Good" };
  if (ms <= moderate) return { status: "warning", word: "Moderate" };
  return { status: "warning", word: "Poor" };
}

/** Average ms per call over `iterations`, so a single GC blip can't skew it. */
function timeAvg(fn: () => void, iterations: number): number {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  return (performance.now() - start) / iterations;
}

export async function checkPerformance(): Promise<SectionOutput> {
  const checks: CheckResult[] = [];

  // ATS analysis time.
  const atsFx = ATS_FIXTURES[0];
  const atsMs = timeAvg(() => void analyzeMatch(atsFx.cv, atsFx.jd), 50);
  const atsRating = rate(atsMs, 25, 100);
  checks.push({
    id: "ats-time",
    label: "ATS analysis time",
    status: atsRating.status,
    detail: `${atsMs.toFixed(2)}ms/run — ${atsRating.word}`,
    latencyMs: Math.round(atsMs),
    recommendation:
      atsRating.status === "pass" ? undefined : "ATS matching is slower than expected.",
  });

  // Prompt assembly time.
  const genCtx: GenerationContext = {
    roleName: "Perf",
    techStack: "React",
    skillLevel: "advanced",
    count: 5,
    yearsExperience: 3,
    skills: ["React", "TypeScript"],
    targetRole: "Engineer",
    cvText: "",
    professionType: "technical",
  };
  const promptMs = timeAvg(() => void buildPrompt(genCtx, true), 50);
  const promptRating = rate(promptMs, 5, 25);
  checks.push({
    id: "prompt-time",
    label: "Prompt assembly time",
    status: promptRating.status,
    detail: `${promptMs.toFixed(3)}ms/build — ${promptRating.word}`,
    latencyMs: Math.round(promptMs),
  });

  // Live DB round-trip.
  const dbStart = performance.now();
  try {
    await db.execute(sql`SELECT 1`);
    const dbMs = Math.round(performance.now() - dbStart);
    const dbRating = rate(dbMs, 150, 500);
    checks.push({
      id: "db-time",
      label: "DB round-trip time",
      status: dbRating.status,
      detail: `${dbMs}ms — ${dbRating.word}`,
      latencyMs: dbMs,
      recommendation:
        dbRating.status === "pass" ? undefined : "Check DB region and pooling.",
    });
  } catch {
    checks.push({
      id: "db-time",
      label: "DB round-trip time",
      status: "skip",
      detail: "DB unreachable (see Database Health)",
    });
  }

  // Best-effort bundle insight.
  const manifest = readProjectFile(".next/build-manifest.json");
  checks.push({
    id: "bundle",
    label: "Bundle size",
    status: "skip",
    detail: manifest
      ? "Build present — inspect `next build` output for bundle/route sizes"
      : "No production build found (.next) — run `npm run build` to measure",
    recommendation:
      "Use `next build` output and `@next/bundle-analyzer` for precise bundle sizes.",
  });

  return {
    note: "Timings are environment-dependent; treat as a smoke test, not a benchmark.",
    checks,
  };
}
