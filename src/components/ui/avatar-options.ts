import {
  Award,
  Briefcase,
  Code2,
  Compass,
  Cpu,
  Flame,
  Globe,
  GraduationCap,
  Heart,
  Lightbulb,
  Palette,
  PenTool,
  Rocket,
  Sparkles,
  Star,
  Target,
  Terminal,
  Trophy,
  User,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Avatar customization options — a fixed, curated set the user picks from in
 * the profile editor. No custom uploads: a chosen background colour plus an
 * optional line icon (or the user's initials). Everything is rendered from
 * these tables, so the same choice looks identical everywhere and validates
 * cleanly on the server.
 */

/* -------------------------------------------------------------------------- */
/* Backgrounds                                                                */
/* -------------------------------------------------------------------------- */

export interface AvatarBackground {
  id: string;
  label: string;
  /** Mid-tone base; the avatar renders a soft top-lit gradient from it. */
  base: string;
}

/** Calm, slightly-desaturated monogram tones (Apple-style). */
export const AVATAR_BACKGROUNDS: AvatarBackground[] = [
  { id: "indigo", label: "Indigo", base: "#6b73d6" },
  { id: "blue", label: "Blue", base: "#4f86c6" },
  { id: "teal", label: "Teal", base: "#3a9e98" },
  { id: "green", label: "Green", base: "#4a9d6f" },
  { id: "ochre", label: "Ochre", base: "#c08a3e" },
  { id: "terracotta", label: "Terracotta", base: "#cf7a52" },
  { id: "rose", label: "Rose", base: "#cb5f6b" },
  { id: "magenta", label: "Magenta", base: "#a86a96" },
  { id: "violet", label: "Violet", base: "#7d6bc0" },
  { id: "cyan", label: "Cyan", base: "#3f8fa6" },
  { id: "olive", label: "Olive", base: "#6e9150" },
  { id: "slate", label: "Slate", base: "#64748b" },
];

/** All base colours, in palette order — used for the deterministic fallback. */
export const AVATAR_PALETTE = AVATAR_BACKGROUNDS.map((b) => b.base);

const BACKGROUND_BY_ID = new Map(AVATAR_BACKGROUNDS.map((b) => [b.id, b]));

/** Resolve a background id to its base colour, or `null` if unknown. */
export function backgroundBaseById(id: string | null | undefined): string | null {
  const bg = id ? BACKGROUND_BY_ID.get(id) : undefined;
  return bg ? bg.base : null;
}

/* -------------------------------------------------------------------------- */
/* Icons                                                                      */
/* -------------------------------------------------------------------------- */

export interface AvatarIcon {
  id: string;
  label: string;
  Icon: LucideIcon;
}

/** Curated, professional-leaning line icons. */
export const AVATAR_ICONS: AvatarIcon[] = [
  { id: "user", label: "Person", Icon: User },
  { id: "briefcase", label: "Briefcase", Icon: Briefcase },
  { id: "code", label: "Code", Icon: Code2 },
  { id: "terminal", label: "Terminal", Icon: Terminal },
  { id: "cpu", label: "Chip", Icon: Cpu },
  { id: "rocket", label: "Rocket", Icon: Rocket },
  { id: "target", label: "Target", Icon: Target },
  { id: "lightbulb", label: "Idea", Icon: Lightbulb },
  { id: "zap", label: "Bolt", Icon: Zap },
  { id: "flame", label: "Flame", Icon: Flame },
  { id: "star", label: "Star", Icon: Star },
  { id: "sparkles", label: "Sparkles", Icon: Sparkles },
  { id: "trophy", label: "Trophy", Icon: Trophy },
  { id: "award", label: "Award", Icon: Award },
  { id: "graduation", label: "Graduate", Icon: GraduationCap },
  { id: "compass", label: "Compass", Icon: Compass },
  { id: "globe", label: "Globe", Icon: Globe },
  { id: "pen", label: "Pen", Icon: PenTool },
  { id: "palette", label: "Palette", Icon: Palette },
  { id: "heart", label: "Heart", Icon: Heart },
];

const ICON_BY_ID = new Map(AVATAR_ICONS.map((i) => [i.id, i.Icon]));

/** Resolve an icon id to its component, or `null` (→ render initials). */
export function avatarIconById(id: string | null | undefined): LucideIcon | null {
  return id ? (ICON_BY_ID.get(id) ?? null) : null;
}

/* -------------------------------------------------------------------------- */
/* Config                                                                     */
/* -------------------------------------------------------------------------- */

/** Persisted avatar choice. Empty/absent fields fall back to the generated look. */
export interface AvatarConfig {
  /** Background colour id from {@link AVATAR_BACKGROUNDS}. */
  bg?: string | null;
  /** Line-icon id from {@link AVATAR_ICONS}; absent → show initials. */
  icon?: string | null;
}

export const VALID_BACKGROUND_IDS = AVATAR_BACKGROUNDS.map((b) => b.id);
export const VALID_ICON_IDS = AVATAR_ICONS.map((i) => i.id);

/** Read an unknown value (e.g. from the DB jsonb) into a safe AvatarConfig. */
export function toAvatarConfig(value: unknown): AvatarConfig {
  const o = (value ?? {}) as Record<string, unknown>;
  const bg = typeof o.bg === "string" && BACKGROUND_BY_ID.has(o.bg) ? o.bg : null;
  const icon = typeof o.icon === "string" && ICON_BY_ID.has(o.icon) ? o.icon : null;
  return { bg, icon };
}
