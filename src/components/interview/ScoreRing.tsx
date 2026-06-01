/** Arc color: `brand` (default) stays on-brand; the rest signal a score band. */
export type ScoreTone = "brand" | "good" | "warn" | "bad";

const TONE_STROKE: Record<ScoreTone, string> = {
  brand: "var(--primary)",
  good: "var(--primary)",
  warn: "#f59e0b", // amber-500
  bad: "var(--destructive)",
};

interface ScoreRingProps {
  score: number;
  max: number;
  size?: number;
  /** Hide the redundant percentage sub-label (e.g. when max is already 100). */
  showPercent?: boolean;
  /** Color the arc by band; defaults to the brand green. */
  tone?: ScoreTone;
}

/** Circular score gauge: a colored arc with the score in the center. */
export function ScoreRing({
  score,
  max,
  size = 160,
  showPercent = true,
  tone = "brand",
}: ScoreRingProps) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  // Fraction of the ring to fill, clamped so an out-of-range score can't draw
  // a malformed arc.
  const fraction = Math.max(0, Math.min(1, pct / 100));

  // Scale the stroke with the ring instead of a fixed width so small rings
  // (104px) don't look chunky next to large ones (160px).
  const stroke = Math.max(8, Math.round(size * 0.08));
  // Inset by half the stroke (to keep the ring inside the box) plus a couple of
  // pixels so the rounded line caps never clip against the SVG edge — that
  // clipping is what made the arc look lopsided.
  const radius = size / 2 - stroke / 2 - 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - fraction);

  return (
    <div
      role="img"
      aria-label={`Score ${score} out of ${max}, ${pct} percent`}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--secondary)"
          strokeWidth={stroke}
        />
        {fraction > 0 && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={TONE_STROKE[tone]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 700ms ease" }}
          />
        )}
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="font-bold tracking-tight" style={{ fontSize: size * 0.26 }}>
          {score}
          <span
            className="font-medium text-[var(--muted-foreground)]"
            style={{ fontSize: size * 0.14 }}
          >
            /{max}
          </span>
        </span>
        {showPercent && (
          <span
            className="mt-1 text-[var(--muted-foreground)]"
            style={{ fontSize: size * 0.1 }}
          >
            {pct}%
          </span>
        )}
      </div>
    </div>
  );
}
