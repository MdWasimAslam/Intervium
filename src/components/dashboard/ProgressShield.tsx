import { cn } from "@/lib/utils";
import {
  RANKS,
  toRoman,
  type RankName,
  type TierInfo,
} from "@/lib/progress-tiers";

/**
 * Procedural inline-SVG Progress Shield.
 *
 * Crisp at any size (single 100×120 viewBox, scaled by `size`). Themed entirely
 * through design tokens + the chart-ramp, so it reads correctly in light and
 * dark with the brand-green palette. Appearance is fully derived from the tier:
 *
 *   - `rankName` picks one of exactly FIVE designs (hue + center emblem) that
 *     repeat across every prestige cycle — no infinite art.
 *   - `cycle` is shown as a roman-numeral banner and drives a "prestige" glow
 *     ring + gem studs that intensify with higher cycles, so a Master · V
 *     shield clearly outranks a Master · I.
 *
 * Not color-only: each rank has a distinct emblem silhouette, the cycle numeral
 * is always rendered, and the whole thing carries an `aria-label`.
 */

interface RankDesign {
  /** Primary accent (CSS token). */
  accent: string;
  /** Deeper shade for the gradient floor. */
  accentDeep: string;
  /** Emblem, drawn in shield coordinates (center ≈ 50,58), painted in `ink`. */
  emblem: (ink: string) => React.ReactNode;
}

// Five fixed designs, keyed by rank name, escalating in visual weight.
const RANK_DESIGN: Record<RankName, RankDesign> = {
  Apprentice: {
    accent: "var(--chart-2)",
    accentDeep: "color-mix(in srgb, var(--chart-2) 55%, #000)",
    // A sprout — growth / beginnings.
    emblem: (ink) => (
      <g
        fill="none"
        stroke={ink}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M50 74 V52" />
        <path
          d="M50 58 C40 58 34 50 34 42 C44 42 50 50 50 58 Z"
          fill={ink}
          stroke="none"
        />
        <path
          d="M50 54 C60 54 66 46 66 38 C56 38 50 46 50 54 Z"
          fill={ink}
          stroke="none"
        />
      </g>
    ),
  },
  Candidate: {
    accent: "var(--chart-3)",
    accentDeep: "color-mix(in srgb, var(--chart-3) 55%, #000)",
    // Double chevron — moving up.
    emblem: (ink) => (
      <g
        fill="none"
        stroke={ink}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M34 58 L50 44 L66 58" />
        <path d="M34 72 L50 58 L66 72" />
      </g>
    ),
  },
  Specialist: {
    accent: "var(--primary)",
    accentDeep: "color-mix(in srgb, var(--primary) 55%, #000)",
    // Faceted gem.
    emblem: (ink) => (
      <g fill={ink} stroke="none">
        <path d="M50 42 L68 58 L50 78 L32 58 Z" opacity={0.95} />
        <path
          d="M50 42 L68 58 L50 58 Z M50 42 L32 58 L50 58 Z"
          fill="color-mix(in srgb, #fff 35%, transparent)"
        />
      </g>
    ),
  },
  Expert: {
    accent: "var(--chart-5)",
    accentDeep: "color-mix(in srgb, var(--chart-5) 55%, #000)",
    // Five-point star.
    emblem: (ink) => (
      <path
        fill={ink}
        d="M50 42 L54.7 53.5 L67.1 54.4 L57.6 62.5 L60.6 74.6 L50 68 L39.4 74.6 L42.4 62.5 L32.9 54.4 L45.3 53.5 Z"
      />
    ),
  },
  Master: {
    accent: "var(--chart-4)",
    accentDeep: "color-mix(in srgb, var(--chart-4) 55%, #000)",
    // Crown.
    emblem: (ink) => (
      <g fill={ink} stroke="none">
        <path d="M33 72 L33 52 L42 62 L50 48 L58 62 L67 52 L67 72 Z" />
        <circle cx="33" cy="50" r="3.5" />
        <circle cx="50" cy="45" r="4" />
        <circle cx="67" cy="50" r="3.5" />
      </g>
    ),
  },
};

// Classic heater-shield outline in the 100×120 viewBox.
const SHIELD_PATH =
  "M50 6 L92 20 V60 C92 92 72 108 50 116 C28 108 8 92 8 60 V20 Z";

export interface ProgressShieldProps {
  tier: Pick<TierInfo, "rankName" | "cycle" | "tierIndex">;
  /** Total points — used only for the accessible label. */
  points: number;
  size?: number;
  /** Extra classes (the card uses this to attach the tier-up flourish). */
  className?: string;
}

export function ProgressShield({
  tier,
  points,
  size = 168,
  className,
}: ProgressShieldProps) {
  const rank: RankName = RANKS.includes(tier.rankName)
    ? tier.rankName
    : "Apprentice";
  const design = RANK_DESIGN[rank];
  const cycle = Math.max(1, tier.cycle);

  // Prestige intensity 0..1 — richer accents the further you've prestiged.
  const prestige = Math.min((cycle - 1) / 4, 1);

  // Stable, instance-unique ids (one shield per dashboard, but keep it safe).
  const uid = `shield-${rank}-${cycle}`;
  const fillId = `${uid}-fill`;
  const sheenId = `${uid}-sheen`;
  const glowId = `${uid}-glow`;

  return (
    <div
      role="img"
      aria-label={`${rank} shield, cycle ${cycle} (${toRoman(cycle)}), ${points} points`}
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size * 1.2 }}
    >
      <svg
        viewBox="0 0 100 120"
        width={size}
        height={size * 1.2}
        aria-hidden
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={design.accent} />
            <stop offset="100%" stopColor={design.accentDeep} />
          </linearGradient>
          {/* Diagonal sheen band that the shine animation sweeps across. */}
          <linearGradient id={sheenId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={glowId} cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor={design.accent} stopOpacity="0.55" />
            <stop offset="100%" stopColor={design.accent} stopOpacity="0" />
          </radialGradient>
          <clipPath id={`${uid}-clip`}>
            <path d={SHIELD_PATH} />
          </clipPath>
        </defs>

        {/* Prestige aura — grows with cycle. */}
        {prestige > 0 && (
          <path
            d={SHIELD_PATH}
            fill={`url(#${glowId})`}
            transform="translate(50 60) scale(1.18) translate(-50 -60)"
            opacity={0.4 + prestige * 0.5}
          />
        )}

        {/* Shield body. */}
        <path
          d={SHIELD_PATH}
          fill={`url(#${fillId})`}
          stroke="color-mix(in srgb, #fff 22%, transparent)"
          strokeWidth={2}
        />

        {/* Inner bevel ring. */}
        <path
          d={SHIELD_PATH}
          fill="none"
          stroke="color-mix(in srgb, #000 18%, transparent)"
          strokeWidth={1.5}
          transform="translate(50 60) scale(0.86) translate(-50 -60)"
        />

        {/* Center emblem, in a near-white ink for contrast on any accent. */}
        <g clipPath={`url(#${uid}-clip)`}>
          {design.emblem("color-mix(in srgb, #fff 92%, transparent)")}

          {/* Animated shine sweep (driven by the parent's flourish class). The
              static tilt lives on the group so the CSS translateX animation on
              the rect composes with it instead of overriding it. */}
          <g transform="rotate(16 50 60)">
            <rect
              className="progress-shield-sheen"
              x="-40"
              y="-20"
              width="34"
              height="160"
              fill={`url(#${sheenId})`}
            />
          </g>
        </g>

        {/* Prestige gem studs along the top edge for cycle ≥ 2. */}
        {cycle >= 2 && (
          <g fill="color-mix(in srgb, #fff 85%, transparent)">
            <circle cx="26" cy="22" r={1.6 + prestige} />
            <circle cx="50" cy="16" r={1.8 + prestige} />
            <circle cx="74" cy="22" r={1.6 + prestige} />
          </g>
        )}

        {/* Cycle banner — roman numeral, always shown. */}
        <g>
          <rect
            x="34"
            y="92"
            width="32"
            height="16"
            rx="8"
            fill="color-mix(in srgb, #000 35%, transparent)"
            stroke="color-mix(in srgb, #fff 30%, transparent)"
            strokeWidth="1"
          />
          <text
            x="50"
            y="104"
            textAnchor="middle"
            fontSize="10"
            fontWeight="700"
            fill="#fff"
            letterSpacing="0.5"
          >
            {toRoman(cycle)}
          </text>
        </g>
      </svg>
    </div>
  );
}
