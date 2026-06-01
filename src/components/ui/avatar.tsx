import * as React from "react";
import { cn } from "@/lib/utils";
import {
  AVATAR_ICONS,
  AVATAR_PALETTE,
  backgroundBaseById,
} from "@/components/ui/avatar-options";

/**
 * Avatar with a sensible generated default and optional user customization.
 *
 * By default it renders the user's initials on a stable gradient derived from
 * a `seed` (their user id), so the same user looks identical everywhere with
 * nothing stored. When the user has customized their avatar, `bg` picks the
 * background colour and `icon` swaps the initials for a line icon — both from
 * the curated sets in `avatar-options`. Pure markup — safe in server and
 * client components.
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

/** "#rrggbb" → sRGB triplet in 0-1. */
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** WCAG relative luminance of an sRGB triplet. */
function luminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Mix a hex colour toward white by `amount` (0-1) → "rgb(...)". */
function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const ch = (c: number) => Math.round((c + (1 - c) * amount) * 255);
  return `rgb(${ch(r)}, ${ch(g)}, ${ch(b)})`;
}

/** Mix a hex colour toward black by `amount` (0-1) → "rgb(...)". */
function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const ch = (c: number) => Math.round(c * (1 - amount) * 255);
  return `rgb(${ch(r)}, ${ch(g)}, ${ch(b)})`;
}

/** Soft top-lit gradient from a base colour. */
function gradientFor(base: string): string {
  return `linear-gradient(180deg, ${lighten(base, 0.22)} 0%, ${base} 58%, ${darken(base, 0.08)} 100%)`;
}

/** Contrast-safe foreground colour for a base. */
function textOn(base: string): string {
  return luminance(hexToRgb(base)) > 0.45 ? "#0a0f0d" : "#ffffff";
}

/**
 * The avatar's base colour: the user's chosen background when set, otherwise a
 * stable pick from the palette by seed (so unconfigured users keep one colour).
 */
function baseColor(seed: string, bg: string | null | undefined): string {
  return (
    backgroundBaseById(bg) ?? AVATAR_PALETTE[hashSeed(seed) % AVATAR_PALETTE.length]
  );
}

/** A uuid/hex-only string makes meaningless initials — treat as "no name". */
const looksLikeId = (s: string) => /^[0-9a-f-]{12,}$/i.test(s.trim());

/**
 * Derive 1-2 uppercase initials from a display name, falling back to an email
 * local part, then to the seed. Returns "?" when nothing usable is found.
 */
function deriveInitials(name: string | undefined, seed: string): string {
  const trimmedName = name?.trim();
  let source = trimmedName ?? "";
  if (!source) {
    const local = seed.includes("@") ? seed.split("@")[0] : seed;
    source = looksLikeId(local) ? "" : local;
  } else if (source.includes("@")) {
    // A display name that's really an email → use its local part for initials.
    source = source.split("@")[0];
  }
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last || first || "?").toUpperCase().slice(0, 2);
}

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Stable identity value — user id or email. Drives the default colour. */
  seed: string;
  /** Display name; initials are derived from it when present. */
  name?: string;
  /** Pixel size of the (square) avatar. Defaults to 36. */
  size?: number;
  /** Chosen background colour id (overrides the seed-derived colour). */
  bg?: string | null;
  /** Chosen line-icon id; when set, replaces the initials. */
  icon?: string | null;
  /** Accessible label; defaults to a generic description. */
  alt?: string;
}

export function Avatar({
  seed,
  name,
  size = 36,
  bg,
  icon,
  alt,
  className,
  style,
  ...props
}: AvatarProps) {
  const base = baseColor(seed || "?", bg);
  const text = textOn(base);
  // Member-expression render (`<glyph.Icon/>`) keeps the icon a stable
  // reference rather than a component "created during render".
  const glyph = icon ? AVATAR_ICONS.find((i) => i.id === icon) : undefined;

  return (
    <div
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-medium shadow-sm ring-1 ring-black/5 dark:ring-white/10",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size * 0.4)),
        color: text,
        backgroundImage: gradientFor(base),
        ...style,
      }}
      role="img"
      aria-label={alt ?? (name ? `Avatar for ${name}` : "User avatar")}
      {...props}
    >
      {glyph ? (
        <glyph.Icon size={Math.round(size * 0.5)} strokeWidth={2} aria-hidden="true" />
      ) : (
        <span aria-hidden="true">{deriveInitials(name, seed || "?")}</span>
      )}
    </div>
  );
}
