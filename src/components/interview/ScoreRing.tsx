interface ScoreRingProps {
  score: number;
  max: number;
  size?: number;
}

/** Circular score gauge: brand-green arc with the score in the center. */
export function ScoreRing({ score, max, size = 160 }: ScoreRingProps) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--secondary)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold">
          {score}
          <span className="text-lg text-[var(--muted-foreground)]">/{max}</span>
        </span>
        <span className="text-sm text-[var(--muted-foreground)]">{pct}%</span>
      </div>
    </div>
  );
}
