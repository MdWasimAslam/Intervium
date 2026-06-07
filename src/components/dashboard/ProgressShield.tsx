import { cn } from "@/lib/utils";
import {
  RANKS,
  toRoman,
  type RankName,
  type TierInfo,
} from "@/lib/progress-tiers";

/**
 * Procedural inline-SVG Progress Shield — premium edition.
 *
 * Crisp at any size (single 100×120 viewBox, scaled by `size`). Themed entirely
 * through design tokens + the chart-ramp, so it reads correctly in light and
 * dark with the brand-green palette. Appearance is fully derived from the tier:
 *
 *   - `rankName` picks one of exactly EIGHT designs (hue + center emblem) that
 *     repeat across every prestige cycle — no infinite art.
 *   - `cycle` is shown as a roman-numeral ribbon banner and drives a "prestige"
 *     glow ring + gem studs that intensify with higher cycles.
 *   - Higher-tier shields progressively unlock: ornamental border nodes,
 *     metallic highlights, filigree curls, laurel wings, animated sparkle
 *     particles, holographic color-shift overlays, and layered glows.
 *
 * Not color-only: each rank has a distinct emblem silhouette, the cycle numeral
 * is always rendered, and the whole thing carries an `aria-label`.
 */

interface RankDesign {
  /** Primary accent (CSS token). */
  accent: string;
  /** Deeper shade for the gradient floor. */
  accentDeep: string;
  /** Secondary accent for richer bi-tonal shields. */
  accentAlt: string;
  /** Visual tier weight 0–7 (drives decorative layers). */
  weight: number;
  /** Emblem, drawn in shield coordinates (center ≈ 50,58), painted in `ink`. */
  emblem: (ink: string) => React.ReactNode;
}

// Eight fixed designs, keyed by rank name, escalating in visual weight.
const RANK_DESIGN: Record<RankName, RankDesign> = {
  Initiate: {
    accent: "var(--chart-2)",
    accentDeep: "color-mix(in srgb, var(--chart-2) 55%, #000)",
    accentAlt: "color-mix(in srgb, var(--chart-2) 70%, var(--chart-1))",
    weight: 0,
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
  Aspirant: {
    accent: "var(--chart-3)",
    accentDeep: "color-mix(in srgb, var(--chart-3) 55%, #000)",
    accentAlt: "color-mix(in srgb, var(--chart-3) 70%, var(--chart-5))",
    weight: 1,
    emblem: (ink) => (
      <g
        fill="none"
        stroke={ink}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M34 62 L50 48 L66 62" />
        <path d="M34 72 L50 58 L66 72" />
        <circle cx="50" cy="42" r="2.5" fill={ink} stroke="none" />
      </g>
    ),
  },
  Contender: {
    accent: "var(--chart-1)",
    accentDeep: "color-mix(in srgb, var(--chart-1) 55%, #000)",
    accentAlt: "color-mix(in srgb, var(--chart-1) 60%, var(--chart-2))",
    weight: 2,
    emblem: (ink) => (
      <g
        fill="none"
        stroke={ink}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M34 72 L66 42" />
        <path d="M66 72 L34 42" />
        {/* Hilts */}
        <path d="M30 46 L38 38" strokeWidth={3} />
        <path d="M70 46 L62 38" strokeWidth={3} />
        <circle cx="50" cy="57" r="6" fill={ink} stroke="none" opacity={0.9} />
        <circle
          cx="50"
          cy="57"
          r="3"
          fill="color-mix(in srgb, #000 25%, transparent)"
          stroke="none"
        />
      </g>
    ),
  },
  Strategist: {
    accent: "var(--primary)",
    accentDeep: "color-mix(in srgb, var(--primary) 50%, #000)",
    accentAlt: "color-mix(in srgb, var(--primary) 65%, var(--chart-2))",
    weight: 3,
    emblem: (ink) => (
      <g fill={ink} stroke="none">
        {/* Outer diamond */}
        <path d="M50 40 L70 58 L50 80 L30 58 Z" opacity={0.85} />
        {/* Facet highlights */}
        <path
          d="M50 40 L70 58 L50 58 Z"
          fill="color-mix(in srgb, #fff 30%, transparent)"
        />
        <path
          d="M50 40 L30 58 L50 58 Z"
          fill="color-mix(in srgb, #fff 15%, transparent)"
        />
        {/* Inner gleam */}
        <path
          d="M50 48 L58 58 L50 68 L42 58 Z"
          fill="color-mix(in srgb, #fff 40%, transparent)"
        />
      </g>
    ),
  },
  Sentinel: {
    accent: "var(--chart-5)",
    accentDeep: "color-mix(in srgb, var(--chart-5) 50%, #000)",
    accentAlt: "color-mix(in srgb, var(--chart-5) 60%, var(--chart-3))",
    weight: 4,
    emblem: (ink) => (
      <g>
        {/* Outer eye shape */}
        <path
          d="M50 46 C36 46 26 57 26 57 C26 57 36 68 50 68 C64 68 74 57 74 57 C74 57 64 46 50 46 Z"
          fill={ink}
          opacity={0.85}
        />
        {/* Dark iris */}
        <circle
          cx="50"
          cy="57"
          r="8"
          fill="color-mix(in srgb, #000 35%, transparent)"
        />
        {/* Bright pupil */}
        <circle
          cx="50"
          cy="57"
          r="4"
          fill="color-mix(in srgb, #fff 92%, transparent)"
        />
        {/* Pupil gleam */}
        <circle
          cx="48"
          cy="55"
          r="1.5"
          fill="color-mix(in srgb, #fff 70%, transparent)"
        />
        {/* Eyelash accents */}
        <path
          d="M30 52 L26 48 M38 48 L36 43 M50 46 L50 41 M62 48 L64 43 M70 52 L74 48"
          stroke={ink}
          strokeWidth={1.5}
          strokeLinecap="round"
          fill="none"
          opacity={0.5}
        />
      </g>
    ),
  },
  Architect: {
    accent: "var(--chart-4)",
    accentDeep: "color-mix(in srgb, var(--chart-4) 48%, #000)",
    accentAlt: "color-mix(in srgb, var(--chart-4) 65%, var(--chart-3))",
    weight: 5,
    emblem: (ink) => (
      <g>
        {/* Outer triangle frame */}
        <path
          d="M50 38 L72 76 L28 76 Z"
          fill="none"
          stroke={ink}
          strokeWidth={3.5}
          strokeLinejoin="round"
        />
        {/* Inner filled triangle */}
        <path d="M50 50 L62 76 L38 76 Z" fill={ink} opacity={0.45} />
        {/* Top beacon */}
        <circle cx="50" cy="38" r="4" fill={ink} />
        <circle
          cx="50"
          cy="38"
          r="2"
          fill="color-mix(in srgb, #fff 60%, transparent)"
        />
        {/* Corner nodes */}
        <circle cx="28" cy="76" r="2.5" fill={ink} opacity={0.6} />
        <circle cx="72" cy="76" r="2.5" fill={ink} opacity={0.6} />
        {/* Internal cross-beams */}
        <line
          x1="39"
          y1="57"
          x2="61"
          y2="57"
          stroke={ink}
          strokeWidth={1.2}
          opacity={0.3}
        />
        <line
          x1="50"
          y1="50"
          x2="50"
          y2="76"
          stroke={ink}
          strokeWidth={1.2}
          opacity={0.3}
        />
      </g>
    ),
  },
  Virtuoso: {
    accent: "color-mix(in srgb, var(--chart-5) 55%, var(--chart-3))",
    accentDeep: "color-mix(in srgb, var(--chart-5) 35%, #000)",
    accentAlt: "var(--chart-3)",
    weight: 6,
    emblem: (ink) => (
      <g fill={ink} stroke="none">
        {/* Outer flame */}
        <path
          d="M50 36 C43 48 34 54 36 66 C38 74 44 78 50 78 C56 78 62 74 64 66 C66 54 57 48 50 36 Z"
          opacity={0.9}
        />
        {/* Inner bright flame */}
        <path
          d="M50 48 C46 56 42 60 44 68 C45 72 48 74 50 74 C52 74 55 72 56 68 C58 60 54 56 50 48 Z"
          fill="color-mix(in srgb, #fff 55%, transparent)"
        />
        {/* Core */}
        <path
          d="M50 56 C48 60 47 63 48 67 C49 69 50 70 50 70 C50 70 51 69 52 67 C53 63 52 60 50 56 Z"
          fill="color-mix(in srgb, #fff 80%, transparent)"
        />
        {/* Spark offshoots */}
        <circle
          cx="40"
          cy="52"
          r="1.5"
          fill="color-mix(in srgb, #fff 40%, transparent)"
        />
        <circle
          cx="60"
          cy="52"
          r="1.5"
          fill="color-mix(in srgb, #fff 40%, transparent)"
        />
      </g>
    ),
  },
  Sovereign: {
    accent: "color-mix(in srgb, var(--chart-4) 65%, var(--chart-3))",
    accentDeep: "color-mix(in srgb, var(--chart-4) 38%, #000)",
    accentAlt: "var(--chart-4)",
    weight: 7,
    emblem: (ink) => (
      <g>
        {/* Crown body */}
        <path
          d="M30 74 L30 50 L40 62 L50 46 L60 62 L70 50 L70 74 Z"
          fill={ink}
        />
        {/* Crown band */}
        <rect
          x="30"
          y="70"
          width="40"
          height="5"
          rx="1"
          fill="color-mix(in srgb, #fff 20%, transparent)"
        />
        {/* Point jewels */}
        <circle cx="30" cy="48" r="4" fill={ink} />
        <circle
          cx="30"
          cy="48"
          r="2"
          fill="color-mix(in srgb, #fff 60%, transparent)"
        />
        <circle cx="50" cy="43" r="5" fill={ink} />
        <circle
          cx="50"
          cy="43"
          r="2.8"
          fill="color-mix(in srgb, #fff 65%, transparent)"
        />
        <circle cx="70" cy="48" r="4" fill={ink} />
        <circle
          cx="70"
          cy="48"
          r="2"
          fill="color-mix(in srgb, #fff 60%, transparent)"
        />
        {/* Mid-peak jewels */}
        <circle
          cx="40"
          cy="60"
          r="2"
          fill="color-mix(in srgb, #fff 50%, transparent)"
        />
        <circle
          cx="60"
          cy="60"
          r="2"
          fill="color-mix(in srgb, #fff 50%, transparent)"
        />
      </g>
    ),
  },
};

// Classic heater-shield outline in the 100×120 viewBox.
const SHIELD_PATH =
  "M50 6 L92 20 V60 C92 92 72 108 50 116 C28 108 8 92 8 60 V20 Z";

// Ornamental inner crest for decorative border.
const INNER_CREST =
  "M50 14 L84 26 V58 C84 86 68 100 50 106 C32 100 16 86 16 58 V26 Z";

// Left laurel wing path (mirrored for right).
const LAUREL_LEFT =
  "M8 42 C-2 38 -4 26 2 18 C4 22 6 30 8 34 C6 28 2 20 6 14 C10 18 10 26 10 30 C10 24 8 16 12 12 C14 16 14 24 12 32";

const LAUREL_RIGHT =
  "M92 42 C102 38 104 26 98 18 C96 22 94 30 92 34 C94 28 98 20 94 14 C90 18 90 26 90 30 C90 24 92 16 88 12 C86 16 86 24 88 32";

// Ribbon banner path segments for the cycle numeral display.
const RIBBON_BODY = "M26 95 L74 95 L72 103 L74 111 L26 111 L28 103 Z";
const RIBBON_FOLD_L = "M26 95 L20 98 L26 101";
const RIBBON_FOLD_R = "M74 95 L80 98 L74 101";

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
    : "Initiate";
  const design = RANK_DESIGN[rank];
  const cycle = Math.max(1, tier.cycle);
  const w = design.weight; // 0-7

  // Prestige intensity 0..1 — richer accents the further you've prestiged.
  const prestige = Math.min((cycle - 1) / 4, 1);

  // Progressive visual unlocks.
  const showBorderNodes = w >= 1;
  const showFiligree = w >= 2;
  const showInnerGlow = w >= 3;
  const showEdgeHighlight = w >= 4;
  const showLaurels = w >= 5;
  const showSparkles = w >= 6;
  const showHolographic = w >= 7;

  const uid = `shield-${rank}-${cycle}`;
  const fillId = `${uid}-fill`;
  const sheenId = `${uid}-sheen`;
  const glowId = `${uid}-glow`;
  const innerGlowId = `${uid}-iglow`;
  const edgeId = `${uid}-edge`;
  const holoId = `${uid}-holo`;

  return (
    <div
      role="img"
      aria-label={`${rank} shield, cycle ${cycle} (${toRoman(cycle)}), ${points} points`}
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size * 1.2 }}
    >
      <svg
        viewBox="-12 -2 124 130"
        width={size}
        height={size * 1.2}
        aria-hidden
        className="overflow-visible"
      >
        <defs>
          {/* Primary body gradient. */}
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={design.accent} />
            <stop offset="50%" stopColor={design.accentDeep} />
            <stop offset="100%" stopColor={design.accentDeep} />
          </linearGradient>

          {/* Diagonal sheen band for the tier-up shine animation. */}
          <linearGradient id={sheenId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="40%" stopColor="#fff" stopOpacity="0.65" />
            <stop offset="60%" stopColor="#fff" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>

          {/* Outer prestige aura glow. */}
          <radialGradient id={glowId} cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor={design.accent} stopOpacity="0.6" />
            <stop offset="55%" stopColor={design.accentAlt} stopOpacity="0.2" />
            <stop offset="100%" stopColor={design.accent} stopOpacity="0" />
          </radialGradient>

          {/* Inner emblem glow (weight ≥ 3). */}
          {showInnerGlow && (
            <radialGradient id={innerGlowId} cx="50%" cy="48%" r="40%">
              <stop
                offset="0%"
                stopColor={design.accentAlt}
                stopOpacity="0.4"
              />
              <stop
                offset="100%"
                stopColor={design.accentAlt}
                stopOpacity="0"
              />
            </radialGradient>
          )}

          {/* Metallic edge highlight gradient (weight ≥ 4). */}
          {showEdgeHighlight && (
            <linearGradient id={edgeId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
              <stop offset="40%" stopColor="#fff" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          )}

          {/* Holographic rainbow gradient (weight 7 only). */}
          {showHolographic && (
            <linearGradient id={holoId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ff6b9d" stopOpacity="0.12" />
              <stop offset="25%" stopColor="#c084fc" stopOpacity="0.12" />
              <stop offset="50%" stopColor="#67e8f9" stopOpacity="0.12" />
              <stop offset="75%" stopColor="#86efac" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.12" />
            </linearGradient>
          )}

          <clipPath id={`${uid}-clip`}>
            <path d={SHIELD_PATH} />
          </clipPath>
        </defs>

        {/* ═══ Layer 0: Laurel wings (weight ≥ 5) ═══ */}
        {showLaurels && (
          <g
            stroke={design.accent}
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
            opacity={0.5 + prestige * 0.3}
          >
            <path d={LAUREL_LEFT} />
            <path d={LAUREL_RIGHT} />
            {/* Leaf tips */}
            <circle
              cx="2"
              cy="16"
              r="1.6"
              fill={design.accent}
              stroke="none"
              opacity={0.6}
            />
            <circle
              cx="98"
              cy="16"
              r="1.6"
              fill={design.accent}
              stroke="none"
              opacity={0.6}
            />
          </g>
        )}

        {/* ═══ Layer 1: Prestige aura ═══ */}
        {prestige > 0 && (
          <>
            <path
              d={SHIELD_PATH}
              fill={`url(#${glowId})`}
              transform="translate(50 60) scale(1.25) translate(-50 -60)"
              opacity={0.3 + prestige * 0.6}
            />
            {/* Second, softer aura ring */}
            <path
              d={SHIELD_PATH}
              fill="none"
              stroke={design.accent}
              strokeWidth={0.8}
              strokeOpacity={0.15 + prestige * 0.2}
              transform="translate(50 60) scale(1.18) translate(-50 -60)"
            />
          </>
        )}

        {/* ═══ Layer 1b: Pulsing aura ring (weight ≥ 6) ═══ */}
        {showSparkles && (
          <path
            d={SHIELD_PATH}
            fill="none"
            stroke={design.accentAlt}
            strokeWidth={1.2}
            strokeOpacity={0.3 + prestige * 0.3}
            transform="translate(50 60) scale(1.14) translate(-50 -60)"
            className="progress-shield-aura"
          />
        )}

        {/* ═══ Layer 2: Drop shadow ═══ */}
        <path
          d={SHIELD_PATH}
          fill="color-mix(in srgb, #000 22%, transparent)"
          transform="translate(0.5 2.5)"
        />

        {/* ═══ Layer 3: Shield body ═══ */}
        <path
          d={SHIELD_PATH}
          fill={`url(#${fillId})`}
          stroke="color-mix(in srgb, #fff 26%, transparent)"
          strokeWidth={2.4}
        />

        {/* ═══ Layer 3b: Holographic overlay (Sovereign only) ═══ */}
        {showHolographic && (
          <path
            d={SHIELD_PATH}
            fill={`url(#${holoId})`}
            clipPath={`url(#${uid}-clip)`}
            className="progress-shield-holo"
          />
        )}

        {/* ═══ Layer 4: Metallic top highlight ═══ */}
        {showEdgeHighlight && (
          <path
            d={SHIELD_PATH}
            fill={`url(#${edgeId})`}
            clipPath={`url(#${uid}-clip)`}
            opacity={0.5}
            transform="translate(50 60) scale(1 0.38) translate(-50 -60)"
          />
        )}

        {/* ═══ Layer 5: Inner crest border ═══ */}
        <path
          d={INNER_CREST}
          fill="none"
          stroke="color-mix(in srgb, #fff 16%, transparent)"
          strokeWidth={0.9}
        />

        {/* ═══ Layer 5b: Border node ornaments (weight ≥ 1) ═══ */}
        {showBorderNodes && (
          <g fill="color-mix(in srgb, #fff 22%, transparent)">
            {/* Top center node */}
            <circle cx="50" cy="14" r="1.8" />
            {/* Shoulder nodes */}
            <circle cx="22" cy="24" r="1.4" />
            <circle cx="78" cy="24" r="1.4" />
            {/* Mid-side nodes */}
            <circle cx="16" cy="48" r="1.2" opacity={0.7} />
            <circle cx="84" cy="48" r="1.2" opacity={0.7} />
          </g>
        )}

        {/* ═══ Layer 5c: Filigree curls (weight ≥ 2) ═══ */}
        {showFiligree && (
          <g
            stroke="color-mix(in srgb, #fff 20%, transparent)"
            strokeWidth={0.7}
            fill="none"
            strokeLinecap="round"
          >
            {/* Top-left scroll */}
            <path d="M22 27 C18 32 18 38 22 42" />
            <path d="M20 29 C16 33 16 37 20 40" opacity={0.5} />
            {/* Top-right scroll */}
            <path d="M78 27 C82 32 82 38 78 42" />
            <path d="M80 29 C84 33 84 37 80 40" opacity={0.5} />
            {/* Lower scrolls */}
            <path
              d="M26 82 C22 78 24 72 28 70"
              opacity={w >= 3 ? 0.5 : 0.25}
            />
            <path
              d="M74 82 C78 78 76 72 72 70"
              opacity={w >= 3 ? 0.5 : 0.25}
            />
            {/* Bottom crest accent */}
            <path d="M34 94 Q42 90 50 92 Q58 90 66 94" opacity={0.35} />
          </g>
        )}

        {/* ═══ Layer 6: Inner emblem glow ═══ */}
        {showInnerGlow && (
          <circle
            cx="50"
            cy="57"
            r="24"
            fill={`url(#${innerGlowId})`}
            clipPath={`url(#${uid}-clip)`}
          />
        )}

        {/* ═══ Layer 7: Center emblem ═══ */}
        <g clipPath={`url(#${uid}-clip)`}>
          {design.emblem("color-mix(in srgb, #fff 92%, transparent)")}

          {/* Shine sweep (driven by celebrate class). */}
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

        {/* ═══ Layer 8: Floating sparkle particles (weight ≥ 6) ═══ */}
        {showSparkles && (
          <g className="progress-shield-sparkles">
            <circle
              cx="20"
              cy="30"
              r="1.2"
              fill="#fff"
              className="progress-sparkle progress-sparkle-1"
            />
            <circle
              cx="80"
              cy="25"
              r="1"
              fill="#fff"
              className="progress-sparkle progress-sparkle-2"
            />
            <circle
              cx="14"
              cy="55"
              r="0.9"
              fill="#fff"
              className="progress-sparkle progress-sparkle-3"
            />
            <circle
              cx="86"
              cy="60"
              r="1.1"
              fill="#fff"
              className="progress-sparkle progress-sparkle-4"
            />
            <circle
              cx="30"
              cy="16"
              r="0.8"
              fill="#fff"
              className="progress-sparkle progress-sparkle-5"
            />
            <circle
              cx="70"
              cy="14"
              r="0.8"
              fill="#fff"
              className="progress-sparkle progress-sparkle-6"
            />
          </g>
        )}

        {/* ═══ Layer 9: Prestige gems (cycle ≥ 2) ═══ */}
        {cycle >= 2 && (
          <g>
            {/* Center crown gem glow */}
            <circle
              cx="50"
              cy="8"
              r={5 + prestige * 3}
              fill={design.accent}
              opacity={0.15}
            />
            {/* Gem trio with faceted look */}
            {[
              { cx: 28, cy: 20, r: 2.2 },
              { cx: 50, cy: 12, r: 2.8 },
              { cx: 72, cy: 20, r: 2.2 },
            ].map((g, i) => (
              <g key={i}>
                <circle
                  cx={g.cx}
                  cy={g.cy}
                  r={g.r + prestige * 0.6}
                  fill="color-mix(in srgb, #fff 88%, transparent)"
                />
                <circle
                  cx={g.cx}
                  cy={g.cy}
                  r={(g.r + prestige * 0.6) * 0.5}
                  fill={design.accent}
                  opacity={0.65}
                />
                {/* Gleam dot */}
                <circle
                  cx={g.cx - 0.6}
                  cy={g.cy - 0.6}
                  r={0.6}
                  fill="#fff"
                  opacity={0.8}
                />
              </g>
            ))}
            {/* Extra gems at cycle ≥ 3 */}
            {cycle >= 3 && (
              <>
                {[
                  { cx: 16, cy: 30, r: 1.6 },
                  { cx: 84, cy: 30, r: 1.6 },
                ].map((g, i) => (
                  <g key={`ext-${i}`}>
                    <circle
                      cx={g.cx}
                      cy={g.cy}
                      r={g.r + prestige * 0.3}
                      fill="color-mix(in srgb, #fff 82%, transparent)"
                    />
                    <circle
                      cx={g.cx}
                      cy={g.cy}
                      r={g.r * 0.45}
                      fill={design.accent}
                      opacity={0.5}
                    />
                  </g>
                ))}
              </>
            )}
            {/* Even more gems at cycle ≥ 4 */}
            {cycle >= 4 && (
              <>
                <circle
                  cx="10"
                  cy="42"
                  r={1.3}
                  fill="color-mix(in srgb, #fff 75%, transparent)"
                />
                <circle
                  cx="90"
                  cy="42"
                  r={1.3}
                  fill="color-mix(in srgb, #fff 75%, transparent)"
                />
              </>
            )}
          </g>
        )}

        {/* ═══ Layer 10: Ribbon banner ═══ */}
        <g>
          {/* Ribbon fold shadows */}
          <path
            d={RIBBON_FOLD_L}
            fill="color-mix(in srgb, #000 50%, transparent)"
            stroke="none"
          />
          <path
            d={RIBBON_FOLD_R}
            fill="color-mix(in srgb, #000 50%, transparent)"
            stroke="none"
          />
          {/* Ribbon body shadow */}
          <path
            d={RIBBON_BODY}
            fill="color-mix(in srgb, #000 20%, transparent)"
            transform="translate(0 1)"
          />
          {/* Ribbon body */}
          <path
            d={RIBBON_BODY}
            fill="color-mix(in srgb, #000 45%, transparent)"
            stroke="color-mix(in srgb, #fff 22%, transparent)"
            strokeWidth="0.6"
          />
          {/* Ribbon top highlight */}
          <rect
            x="30"
            y="95.5"
            width="40"
            height="4"
            rx="1"
            fill="color-mix(in srgb, #fff 8%, transparent)"
          />
          {/* Cycle numeral */}
          <text
            x="50"
            y="106"
            textAnchor="middle"
            fontSize="10"
            fontWeight="800"
            fill="#fff"
            letterSpacing="1"
            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
          >
            {toRoman(cycle)}
          </text>
        </g>
      </svg>
    </div>
  );
}
