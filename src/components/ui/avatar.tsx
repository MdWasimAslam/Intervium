import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Deterministic, dependency-free identicon avatar.
 *
 * Renders a GitHub-style 5×5 symmetric block pattern derived purely from a
 * `seed` (use a stable value like the user id or email). The same seed always
 * produces the same pattern + colour, so a user keeps one avatar everywhere
 * without storing anything. Pure SVG — safe in both server and client
 * components.
 */

/** Cheap, stable 32-bit string hash (FNV-1a style). */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Build the symmetric 5×5 fill grid + foreground colour for a seed. */
function identicon(seed: string): { cells: boolean[]; color: string } {
  const hash = hashSeed(seed);

  // Hue from the top byte; fixed saturation/lightness keeps colours legible.
  const hue = hash % 360;
  const color = `hsl(${hue} 62% 48%)`;

  // 5 columns, but mirror the outer two so the result is left-right symmetric.
  // Only 15 cells (3 columns × 5 rows) are independently decided.
  const cells: boolean[] = new Array(25);
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 5; row++) {
      // Spread the hash bits across the 15 decisions.
      const bit = (hash >> (col * 5 + row)) & 1;
      const on = bit === 1;
      cells[row * 5 + col] = on;
      cells[row * 5 + (4 - col)] = on; // mirror
    }
  }
  return { cells, color };
}

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Stable identity value — user id or email. */
  seed: string;
  /** Pixel size of the (square) avatar. Defaults to 36. */
  size?: number;
  /** Accessible label; defaults to a generic description. */
  alt?: string;
}

export function Avatar({
  seed,
  size = 36,
  alt,
  className,
  ...props
}: AvatarProps) {
  const { cells, color } = identicon(seed || "?");
  const grid = 5;
  const cell = 100 / grid;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-full border border-[var(--border)] bg-[var(--accent)]",
        className,
      )}
      style={{ width: size, height: size }}
      role="img"
      aria-label={alt ?? "User avatar"}
      {...props}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
        {cells.map((on, i) =>
          on ? (
            <rect
              key={i}
              x={(i % grid) * cell}
              y={Math.floor(i / grid) * cell}
              width={cell}
              height={cell}
              fill={color}
            />
          ) : null,
        )}
      </svg>
    </div>
  );
}
