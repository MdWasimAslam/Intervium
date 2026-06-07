"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
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
import {
  RANKS,
  RANKS_PER_CYCLE,
  thresholdForTier,
  toRoman,
  type TierInfo,
} from "@/lib/progress-tiers";

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
      const prestiged = Math.floor(tier.tierIndex / RANKS_PER_CYCLE) > Math.floor(stored / RANKS_PER_CYCLE);
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

  // Info popover with tabs.
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!infoOpen) return;
    const onDown = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setInfoOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInfoOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [infoOpen]);
  const [infoTab, setInfoTab] = useState<"journey" | "earn">("journey");

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
  const posInCycle = tier.tierIndex % RANKS_PER_CYCLE;

  // Percentage string for the ring.
  const pct = Math.round(tier.progressToNext * 100);

  return (
    <Card className="progress-card relative flex h-full flex-col overflow-hidden">
      {/* Accent top edge glow — wider spread for a more premium look */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
        style={{ background: "linear-gradient(90deg, transparent, var(--primary), color-mix(in srgb, var(--primary) 60%, var(--chart-2)), transparent)" }}
      />

      {/* Ambient glow behind the card top — scaled by tier weight */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2"
        style={{
          width: 300,
          height: 200,
          borderRadius: "50%",
          background: `radial-gradient(closest-side, color-mix(in srgb, var(--primary) ${10 + tier.tierIndex * 2}%, transparent), transparent)`,
          filter: "blur(40px)",
        }}
      />

      {/* Header row */}
      <div className="relative flex items-center justify-between px-6 pt-5 pb-0">
        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase text-[var(--muted-foreground)]">
          <Sparkles className="h-3.5 w-3.5 text-[var(--primary)]" />
          Milestone
        </h3>
        <div ref={infoRef} className="relative">
          <button
            type="button"
            onClick={() => setInfoOpen((v) => !v)}
            aria-expanded={infoOpen}
            aria-label="Progress info"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
          {infoOpen && (
            <div
              role="dialog"
              aria-label="Progress info"
              className="animate-fade-up absolute right-0 top-9 z-20 w-64 rounded-xl border border-[var(--border)] bg-[var(--popover)] text-sm text-[var(--popover-foreground)] elev-3"
            >
              {/* Tab bar */}
              <div className="flex border-b border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setInfoTab("journey")}
                  className={cn(
                    "flex-1 rounded-tl-xl px-3 py-2 text-xs font-semibold transition-colors",
                    infoTab === "journey"
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                  )}
                >
                  Your Journey
                </button>
                <button
                  type="button"
                  onClick={() => setInfoTab("earn")}
                  className={cn(
                    "flex-1 rounded-tr-xl px-3 py-2 text-xs font-semibold transition-colors",
                    infoTab === "earn"
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                  )}
                >
                  How to Earn
                </button>
              </div>

              {infoTab === "journey" && (
                <div className="space-y-2 p-3">
                  {RANKS.map((name, i) => {
                    const isCompleted = i < posInCycle;
                    const isCurrent = i === posInCycle;
                    const ptsNeeded = thresholdForTier(
                      tier.tierIndex - posInCycle + i,
                    );
                    return (
                      <div
                        key={name}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs",
                          isCurrent &&
                            "border border-[var(--primary)]/30 bg-[var(--accent)]",
                          isCompleted && "text-[var(--muted-foreground)]",
                          !isCompleted &&
                            !isCurrent &&
                            "text-[var(--muted-foreground)] opacity-50",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full",
                            isCompleted &&
                              "bg-[var(--primary)] text-[var(--primary-foreground)]",
                            isCurrent &&
                              "border-2 border-[var(--primary)] text-[var(--primary)]",
                            !isCompleted &&
                              !isCurrent &&
                              "border border-[var(--border)]",
                          )}
                        >
                          {isCompleted ? (
                            <Check className="h-3 w-3" />
                          ) : isCurrent ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                          ) : null}
                        </span>
                        <span className="flex-1">{name}</span>
                        <span className="tabular-nums opacity-60">
                          {ptsNeeded.toLocaleString()} pts
                        </span>
                      </div>
                    );
                  })}
                  <p className="pt-1 text-[11px] text-[var(--muted-foreground)]">
                    Next: {RANKS[Math.min(posInCycle + 1, RANKS.length - 1)]}{" "}
                    · {tier.ptsToNext.toLocaleString()} pts away
                  </p>
                </div>
              )}

              {infoTab === "earn" && (
                <div className="p-3">
                  <p className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">
                    How to earn points
                  </p>
                  <ul className="space-y-1.5 text-[var(--muted-foreground)]">
                    <li className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <MessagesSquare className="h-3.5 w-3.5" /> Scored
                        answer
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
          )}
        </div>
      </div>

      <CardContent className="relative flex flex-1 flex-col items-center gap-5 p-6 pt-4 text-center">
        {/* Medallion: progress ring wrapping the shield */}
        <div
          className="relative"
          style={{ width: MEDALLION, height: MEDALLION }}
        >
          <ProgressRing fraction={ringFrac} size={MEDALLION} tierIndex={tier.tierIndex} />
          <div className="absolute inset-0 flex items-center justify-center">
            <ProgressShield
              tier={tier}
              points={score.total}
              size={SHIELD}
              className={shieldClasses}
            />
          </div>
          {/* Ring percentage label */}
          {!isEmpty && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
              <span
                className="inline-block rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--muted-foreground)] elev-1"
              >
                {pct}%
              </span>
            </div>
          )}
        </div>

        {/* Rank label — gradient text for higher tiers */}
        <div className="space-y-1">
          <p className="text-2xl font-extrabold tracking-tight leading-none">
            <span className="bg-gradient-to-br from-[var(--foreground)] to-[var(--muted-foreground)] bg-clip-text text-transparent">
              {tier.rankName}
            </span>
            <span className="ml-1.5 text-sm font-semibold text-[var(--muted-foreground)]">
              · {toRoman(tier.cycle)}
            </span>
          </p>
          <div className="flex items-baseline justify-center gap-1.5">
            <span className="text-3xl font-extrabold tabular-nums tracking-tight text-[var(--foreground)]">
              {displayTotal.toLocaleString()}
            </span>
            <span className="text-sm font-medium text-[var(--muted-foreground)]">
              XP
            </span>
          </div>
        </div>

        {isEmpty ? (
          <p className="max-w-xs text-sm leading-relaxed text-[var(--muted-foreground)]">
            Answer your first question, solve a Dojo problem, or add a study
            note to start earning XP and level up your shield.
          </p>
        ) : (
          <>
            {/* 3-source breakdown */}
            <div className="w-full space-y-3">
              {/* Segmented bar */}
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--secondary)]">
                {SOURCES.map((s) => {
                  const pts = score.bySource[s.key].points;
                  const share = score.total > 0 ? (pts / score.total) * 100 : 0;
                  if (share <= 0) return null;
                  return (
                    <div
                      key={s.key}
                      style={{ width: `${share}%`, backgroundColor: s.color }}
                      className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                    />
                  );
                })}
              </div>

              {/* Source cards with colored accent border */}
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
                        "group relative overflow-hidden rounded-xl border p-2.5 text-left transition-all duration-200 hover:-translate-y-0.5",
                        isNeglected
                          ? "border-dashed border-[var(--border-strong)] bg-[var(--surface-hover)]"
                          : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-1)]",
                      )}
                    >
                      {/* Colored left accent bar */}
                      <div
                        className="absolute inset-y-0 left-0 w-[3px] rounded-l-xl"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="flex items-center gap-1.5 pl-1 text-xs font-medium text-[var(--muted-foreground)]">
                        <Icon
                          className="h-3.5 w-3.5"
                          style={{ color: s.color }}
                        />
                        {s.label}
                      </span>
                      <span className="mt-1 block pl-1 text-lg font-extrabold leading-none tracking-tight text-[var(--foreground)]">
                        {count}
                      </span>
                      <span className="pl-1 text-[11px] text-[var(--muted-foreground)]">
                        {isNeglected ? "grow this →" : `${share}% · ${points} XP`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

          </>
        )}

      </CardContent>

      {/* Tier-up celebration — with shimmer effect */}
      {celebration && (
        <div
          role="status"
          aria-live="polite"
          className="animate-fade-up pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center p-3"
        >
          <span className="progress-celebrate-badge inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/40 bg-[var(--card)] px-4 py-1.5 text-sm font-bold elev-3">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--chart-2)] bg-clip-text text-transparent">
              {celebration === "prestige"
                ? `Prestige! ${tier.rankName} · Cycle ${toRoman(tier.cycle)}`
                : `Ranked up to ${tier.rankName}!`}
            </span>
          </span>
        </div>
      )}
    </Card>
  );
}

/** Name of the tier the user is climbing toward (handles prestige rollover). */
function nextRankName(tier: TierInfo): string {
  const RANK_ORDER = [
    "Initiate",
    "Aspirant",
    "Contender",
    "Strategist",
    "Sentinel",
    "Architect",
    "Virtuoso",
    "Sovereign",
  ];
  const nextIndex = (tier.tierIndex + 1) % RANK_ORDER.length;
  const nextCycle = Math.floor((tier.tierIndex + 1) / RANK_ORDER.length) + 1;
  const name = RANK_ORDER[nextIndex];
  return nextCycle > tier.cycle
    ? `${name} · Cycle ${toRoman(nextCycle)}`
    : name;
}

/** Circular progress ring with gradient stroke, glow, and tick marks. */
function ProgressRing({
  fraction,
  size,
  tierIndex,
}: {
  fraction: number;
  size: number;
  tierIndex: number;
}) {
  const stroke = 8;
  const r = size / 2 - stroke / 2 - 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, fraction));
  const offset = circumference * (1 - frac);
  const uid = `ring-${tierIndex}`;
  const tickCount = 24;
  const tickR = r + stroke / 2 + 3;

  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <defs>
        {/* Gradient stroke for the progress arc. */}
        <linearGradient id={`${uid}-grad`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--chart-2)" />
        </linearGradient>
        {/* Glow filter for the arc. */}
        <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Tick marks around the ring — rounded to 3 decimals to prevent
          server/client floating-point hydration mismatches. */}
      {Array.from({ length: tickCount }).map((_, i) => {
        const angle = (i / tickCount) * 2 * Math.PI;
        const x1 = +(c + Math.cos(angle) * (tickR - 2)).toFixed(3);
        const y1 = +(c + Math.sin(angle) * (tickR - 2)).toFixed(3);
        const x2 = +(c + Math.cos(angle) * (tickR + 1)).toFixed(3);
        const y2 = +(c + Math.sin(angle) * (tickR + 1)).toFixed(3);
        const isFilled = i / tickCount <= frac;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={isFilled ? "var(--primary)" : "var(--border)"}
            strokeWidth={1.2}
            strokeLinecap="round"
            opacity={isFilled ? 0.7 : 0.3}
          />
        );
      })}

      {/* Background track */}
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="var(--secondary)"
        strokeWidth={stroke}
      />

      {/* Progress arc with glow */}
      {frac > 0 && (
        <>
          {/* Glow layer */}
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={stroke + 6}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            opacity={0.15}
            filter={`url(#${uid}-glow)`}
            style={{
              transition: "stroke-dashoffset 800ms cubic-bezier(0.16,1,0.3,1)",
            }}
          />
          {/* Main arc */}
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={`url(#${uid}-grad)`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: "stroke-dashoffset 800ms cubic-bezier(0.16,1,0.3,1)",
            }}
          />
          {/* Leading dot at the arc tip */}
          {frac < 1 && (() => {
            const angle = frac * 2 * Math.PI;
            const dotX = c + Math.cos(angle - Math.PI / 2) * r;
            const dotY = c + Math.sin(angle - Math.PI / 2) * r;
            return (
              <>
                <circle cx={dotX} cy={dotY} r={stroke / 2 + 3} fill="var(--primary)" opacity={0.2} />
                <circle cx={dotX} cy={dotY} r={stroke / 2} fill="var(--card)" />
                <circle cx={dotX} cy={dotY} r={stroke / 2 - 1.5} fill="var(--primary)" />
              </>
            );
          })()}
        </>
      )}
    </svg>
  );
}
