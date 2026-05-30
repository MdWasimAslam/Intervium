/**
 * Minimal score-over-time sparkline.
 *
 * Pure SVG (no client JS). Values are score percentages (0–100) plotted oldest
 * → newest on a fixed 0–100 y-axis, so the line reads truthfully. The stroke
 * uses `non-scaling-stroke` so it stays crisp when the SVG flexes to its
 * container width. No animation, so it's inherently reduced-motion safe.
 */
export function Sparkline({
  points,
  height = 64,
  className,
}: {
  points: number[];
  height?: number;
  className?: string;
}) {
  if (points.length < 2) return null;

  const width = 600;
  const pad = 6;
  const n = points.length;
  const x = (i: number) => pad + (i * (width - 2 * pad)) / (n - 1);
  const y = (v: number) =>
    pad + (1 - Math.max(0, Math.min(100, v)) / 100) * (height - 2 * pad);

  const line = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${height - pad} L${x(0).toFixed(
    1,
  )},${height - pad} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      height={height}
      className={className}
      role="img"
      aria-label={`Score trend across ${n} interviews, most recent ${points[n - 1]}%`}
    >
      <defs>
        <linearGradient id="intervium-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#intervium-spark)" stroke="none" />
      <path
        d={line}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
