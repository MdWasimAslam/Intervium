"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  Code2,
  HelpCircle,
  MessagesSquare,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ProgressShield } from "@/components/dashboard/ProgressShield";
import {
  POINTS,
  type ProgressScore,
  type ProgressSource,
} from "@/lib/progress-types";
import { toRoman, type TierInfo } from "@/lib/progress-tiers";

const STORAGE_KEY = "intervium:progress-tier";
const MEDALLION = 188; // ring outer box
const SHIELD = 112; // shield inside the ring

interface SourceMeta {
  key: ProgressSource;
  label: string;
  color: string;
  icon: typeof Code2;
  earn: string;
}

const SOURCES: SourceMeta[] = [
  {
    key: "interviews",
    label: "Interviews",
    color: "var(--chart-3)",
    icon: MessagesSquare,
    earn: "an interview answer",
  },
  {
    key: "dojo",
    label: "Dojo",
    color: "var(--primary)",
    icon: Code2,
    earn: "a Dojo solve",
  },
  {
    key: "notes",
    label: "Notes",
    color: "var(--chart-5)",
    icon: BookOpen,
    earn: "a study note",
  },
];

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/** Animate 0 → target on mount; instant when reduced motion is requested. */
function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    if (prefersReducedMotion()) {
      raf = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(raf);
    }
    let start = 0;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

export interface ProgressShieldCardProps {
  score: ProgressScore;
  tier: TierInfo;
  /** Tech stack with the lowest average score, for the next-action nudge. */
  weakestArea: string | null;
}

export function ProgressShieldCard({
  score,
  tier,
  weakestArea,
}: ProgressShieldCardProps) {
  const isEmpty = score.total === 0;
  const displayTotal = useCountUp(score.total);

  // Ring sweep — start empty, animate to the real fraction after mount. (The
  // CSS transition collapses to 0ms under prefers-reduced-motion via globals.)
  const [ringFrac, setRingFrac] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setRingFrac(tier.progressToNext));
    return () => cancelAnimationFrame(id);
  }, [tier.progressToNext]);

  // One-time tier-up celebration, tracked in localStorage (no DB).
  const [celebration, setCelebration] = useState<null | "tier" | "prestige">(
    null,
  );
  useEffect(() => {
    let stored: number | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      stored = raw === null ? null : Number.parseInt(raw, 10);
      if (stored !== null && Number.isNaN(stored)) stored = null;
    } catch {
      stored = null;
    }

    // Only celebrate a genuine increase for a returning user — never on the
    // very first load (no stored value yet).
    if (stored !== null && tier.tierIndex > stored) {
      const prestiged = Math.floor(tier.tierIndex / 5) > Math.floor(stored / 5);
      // Defer the state update out of the effect body (rAF), then auto-dismiss.
      const raf = requestAnimationFrame(() =>
        setCelebration(prestiged ? "prestige" : "tier"),
      );
      const timer = setTimeout(
        () => setCelebration(null),
        prestiged ? 4500 : 3200,
      );
      // Persist the new high-water mark immediately so it fires once.
      try {
        window.localStorage.setItem(STORAGE_KEY, String(tier.tierIndex));
      } catch {
        /* ignore quota/availability errors */
      }
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, String(tier.tierIndex));
    } catch {
      /* ignore */
    }
  }, [tier.tierIndex]);

  // Legend popover (click/tap toggled — no hover dependency).
  const [legendOpen, setLegendOpen] = useState(false);
  const legendRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!legendOpen) return;
    const onDown = (e: MouseEvent) => {
      if (legendRef.current && !legendRef.current.contains(e.target as Node)) {
        setLegendOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLegendOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [legendOpen]);

  // Most-neglected source (lowest points, then lowest count) — a gentle nudge.
  const neglected = isEmpty
    ? null
    : SOURCES.reduce<ProgressSource>((min, s) => {
        const a = score.bySource[s.key];
        const b = score.bySource[min];
        if (a.points < b.points) return s.key;
        if (a.points === b.points && a.count < b.count) return s.key;
        return min;
      }, SOURCES[0].key);

  const shieldClasses = cn(
    celebration && "progress-shield-celebrate",
    celebration === "prestige" && "progress-shield-prestige",
  );

  const lastEarned = score.lastEarned;
  const lastEarnedMeta =
    lastEarned && SOURCES.find((s) => s.key === lastEarned.source);

  const nextHref = "/interview/new";

  return (
    <Card className="relative flex h-full flex-col overflow-hidden">
      {/* Header row: title + how-to-earn legend */}
      <div className="flex items-center justify-between p-6 pb-0">
        <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <Sparkles className="h-4 w-4 text-[var(--primary)]" />
          Progress
        </h3>
        <div ref={legendRef} className="relative">
          <button
            type="button"
            onClick={() => setLegendOpen((v) => !v)}
            aria-expanded={legendOpen}
            aria-label="How points are earned"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
          {legendOpen && (
            <div
              role="dialog"
              aria-label="How to earn points"
              className="animate-fade-up absolute right-0 top-9 z-20 w-56 rounded-xl border border-[var(--border)] bg-[var(--popover)] p-3 text-sm text-[var(--popover-foreground)] elev-3"
            >
              <p className="mb-2 font-medium">How to earn points</p>
              <ul className="space-y-1.5 text-[var(--muted-foreground)]">
                <li className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <MessagesSquare className="h-3.5 w-3.5" /> Scored answer
                  </span>
                  <span className="font-semibold text-[var(--foreground)]">
                    +{POINTS.interviews}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Code2 className="h-3.5 w-3.5" /> Dojo solve
                  </span>
                  <span className="font-semibold text-[var(--foreground)]">
                    +{POINTS.dojo}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5" /> Study note
                  </span>
                  <span className="font-semibold text-[var(--foreground)]">
                    +{POINTS.notes}
                  </span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      <CardContent className="flex flex-1 flex-col items-center gap-4 p-6 pt-4 text-center">
        {/* Medallion: progress ring wrapping the shield */}
        <div
          className="relative"
          style={{ width: MEDALLION, height: MEDALLION }}
        >
          <ProgressRing fraction={ringFrac} size={MEDALLION} />
          <div className="absolute inset-0 flex items-center justify-center">
            <ProgressShield
              tier={tier}
              points={score.total}
              size={SHIELD}
              className={shieldClasses}
            />
          </div>
        </div>

        {/* Rank label */}
        <div className="space-y-1">
          <p className="text-lg font-semibold tracking-tight">
            {tier.rankName}
            <span className="text-[var(--muted-foreground)]">
              {" "}
              · Cycle {toRoman(tier.cycle)}
            </span>
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">
            <span className="text-2xl font-bold text-[var(--foreground)]">
              {displayTotal.toLocaleString()}
            </span>{" "}
            pts
          </p>
        </div>

        {isEmpty ? (
          <p className="max-w-xs text-sm text-[var(--muted-foreground)]">
            Answer your first question, solve a Dojo problem, or add a study
            note to start earning points and level up your shield.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
              <span className="text-[var(--muted-foreground)]">
                <span className="font-semibold text-[var(--foreground)]">
                  {tier.ptsToNext.toLocaleString()}
                </span>{" "}
                pts to {nextRankName(tier)}
              </span>
              {score.last7days > 0 && (
                <span className="inline-flex items-center gap-1 font-medium text-[var(--success)]">
                  <ArrowUp className="h-3.5 w-3.5" />+{score.last7days} this
                  week
                </span>
              )}
            </div>

            {/* 3-source breakdown — segmented bar */}
            <div className="w-full space-y-3">
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--secondary)]">
                {SOURCES.map((s) => {
                  const pts = score.bySource[s.key].points;
                  const share = score.total > 0 ? (pts / score.total) * 100 : 0;
                  if (share <= 0) return null;
                  return (
                    <div
                      key={s.key}
                      style={{ width: `${share}%`, backgroundColor: s.color }}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                    />
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {SOURCES.map((s) => {
                  const { count, points } = score.bySource[s.key];
                  const share =
                    score.total > 0
                      ? Math.round((points / score.total) * 100)
                      : 0;
                  const Icon = s.icon;
                  const isNeglected = neglected === s.key && score.total > 0;
                  return (
                    <div
                      key={s.key}
                      className={cn(
                        "rounded-xl border p-2.5 text-left transition-colors",
                        isNeglected
                          ? "border-dashed border-[var(--border-strong)] bg-[var(--surface-hover)]"
                          : "border-[var(--border)] bg-[var(--surface-2)]",
                      )}
                    >
                      <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
                        <Icon
                          className="h-3.5 w-3.5"
                          style={{ color: s.color }}
                        />
                        {s.label}
                      </span>
                      <span className="mt-1 block text-base font-semibold leading-none">
                        {count}
                      </span>
                      <span className="text-[11px] text-[var(--muted-foreground)]">
                        {isNeglected ? "grow this →" : `${share}% of pts`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Folded-in latest signal */}
            {lastEarned && lastEarnedMeta && (
              <p className="text-xs text-[var(--muted-foreground)]">
                Last: +{lastEarned.points} from {lastEarnedMeta.earn}
              </p>
            )}
          </>
        )}

        {/* Next action — pinned to the bottom */}
        <Link
          href={nextHref}
          className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-medium text-[var(--primary)] transition-opacity hover:opacity-80"
        >
          {isEmpty
            ? "Start your first interview"
            : weakestArea
              ? `Practice your weakest area: ${weakestArea}`
              : "Start an interview"}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>

      {/* Tier-up celebration — announced politely, auto-dismisses */}
      {celebration && (
        <div
          role="status"
          aria-live="polite"
          className="animate-fade-up pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center p-3"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--primary)]/30 bg-[var(--success-subtle)] px-3 py-1 text-sm font-semibold text-[var(--success)] elev-2">
            <Sparkles className="h-4 w-4" />
            {celebration === "prestige"
              ? `Prestige! ${tier.rankName} · Cycle ${toRoman(tier.cycle)}`
              : `Leveled up to ${tier.rankName}!`}
          </span>
        </div>
      )}
    </Card>
  );
}

/** Name of the tier the user is climbing toward (handles prestige rollover). */
function nextRankName(tier: TierInfo): string {
  const RANK_ORDER = [
    "Apprentice",
    "Candidate",
    "Specialist",
    "Expert",
    "Master",
  ];
  const nextIndex = (tier.tierIndex + 1) % RANK_ORDER.length;
  const nextCycle = Math.floor((tier.tierIndex + 1) / RANK_ORDER.length) + 1;
  const name = RANK_ORDER[nextIndex];
  return nextCycle > tier.cycle
    ? `${name} · Cycle ${toRoman(nextCycle)}`
    : name;
}

/** Circular progress ring rendered behind the shield. */
function ProgressRing({ fraction, size }: { fraction: number; size: number }) {
  const stroke = 7;
  const r = size / 2 - stroke / 2 - 1;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, fraction));
  const offset = circumference * (1 - frac);
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="var(--secondary)"
        strokeWidth={stroke}
      />
      {frac > 0 && (
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 800ms cubic-bezier(0.16,1,0.3,1)",
          }}
        />
      )}
    </svg>
  );
}
