/**
 * CV design presets for the document renderer. Each design varies real
 * STRUCTURE — header layout, section-heading style, skills rendering, bullet
 * markers, density — on top of font and accent colour, so the templates look
 * genuinely different (not just recoloured). All stay single-column with
 * standard headings and selectable text, so they remain ATS-friendly. Colour
 * classes are full literals so Tailwind's scanner keeps them in the build.
 */
export interface CvDesign {
  id: string;
  /** Shown in the design dropdown. */
  label: string;
  /** Body font family. */
  font: "font-serif" | "font-sans";
  /** Accent text colour (name / headings where applicable). */
  accentText: string;
  /** Accent border colour (header rule, left bars). */
  accentBorder: string;
  /** Accent fill colour (banner header, pill headings). */
  accentBg: string;
  /** Soft rule colour under "rule" headings. */
  accentSoft: string;
  /** Header arrangement. */
  headerLayout: "center" | "left" | "banner" | "split";
  /** Section-heading treatment. */
  headingStyle: "rule" | "bar" | "pill" | "caps" | "accent-underline";
  /** How the skills list renders. */
  skillsStyle: "comma" | "chips" | "pipes";
  /** Bullet marker shape. */
  bullet: "disc" | "dash" | "square" | "chevron";
  /** Vertical rhythm / type scale. */
  density: "compact" | "normal" | "spacious";
}

export const CV_DESIGNS: CvDesign[] = [
  {
    id: "classic",
    label: "Classic",
    font: "font-serif",
    accentText: "text-slate-900",
    accentBorder: "border-slate-800",
    accentBg: "bg-slate-800",
    accentSoft: "border-slate-300",
    headerLayout: "center",
    headingStyle: "rule",
    skillsStyle: "comma",
    bullet: "disc",
    density: "normal",
  },
  {
    id: "modern",
    label: "Modern",
    font: "font-sans",
    accentText: "text-slate-900",
    accentBorder: "border-slate-400",
    accentBg: "bg-slate-800",
    accentSoft: "border-slate-200",
    headerLayout: "left",
    headingStyle: "accent-underline",
    skillsStyle: "chips",
    bullet: "dash",
    density: "normal",
  },
  {
    id: "executive",
    label: "Executive",
    font: "font-serif",
    accentText: "text-blue-900",
    accentBorder: "border-blue-900",
    accentBg: "bg-blue-900",
    accentSoft: "border-blue-200",
    headerLayout: "banner",
    headingStyle: "rule",
    skillsStyle: "comma",
    bullet: "disc",
    density: "normal",
  },
  {
    id: "minimalist",
    label: "Minimalist",
    font: "font-sans",
    accentText: "text-slate-500",
    accentBorder: "border-slate-300",
    accentBg: "bg-slate-700",
    accentSoft: "border-slate-200",
    headerLayout: "left",
    headingStyle: "caps",
    skillsStyle: "pipes",
    bullet: "dash",
    density: "spacious",
  },
  {
    id: "technical",
    label: "Technical",
    font: "font-sans",
    accentText: "text-teal-700",
    accentBorder: "border-teal-600",
    accentBg: "bg-teal-700",
    accentSoft: "border-teal-200",
    headerLayout: "left",
    headingStyle: "bar",
    skillsStyle: "chips",
    bullet: "square",
    density: "compact",
  },
  {
    id: "elegant",
    label: "Elegant",
    font: "font-serif",
    accentText: "text-zinc-700",
    accentBorder: "border-zinc-400",
    accentBg: "bg-zinc-700",
    accentSoft: "border-zinc-300",
    headerLayout: "center",
    headingStyle: "caps",
    skillsStyle: "comma",
    bullet: "disc",
    density: "spacious",
  },
  {
    id: "indigo",
    label: "Indigo",
    font: "font-sans",
    accentText: "text-indigo-700",
    accentBorder: "border-indigo-500",
    accentBg: "bg-indigo-600",
    accentSoft: "border-indigo-200",
    headerLayout: "split",
    headingStyle: "pill",
    skillsStyle: "chips",
    bullet: "chevron",
    density: "normal",
  },
  {
    id: "burgundy",
    label: "Burgundy",
    font: "font-serif",
    accentText: "text-red-900",
    accentBorder: "border-red-900",
    accentBg: "bg-red-900",
    accentSoft: "border-red-200",
    headerLayout: "banner",
    headingStyle: "rule",
    skillsStyle: "comma",
    bullet: "disc",
    density: "normal",
  },
  {
    id: "forest",
    label: "Forest",
    font: "font-sans",
    accentText: "text-emerald-800",
    accentBorder: "border-emerald-700",
    accentBg: "bg-emerald-700",
    accentSoft: "border-emerald-200",
    headerLayout: "left",
    headingStyle: "bar",
    skillsStyle: "pipes",
    bullet: "dash",
    density: "normal",
  },
  {
    id: "compact",
    label: "Compact",
    font: "font-sans",
    accentText: "text-slate-800",
    accentBorder: "border-slate-400",
    accentBg: "bg-slate-700",
    accentSoft: "border-slate-300",
    headerLayout: "left",
    headingStyle: "rule",
    skillsStyle: "comma",
    bullet: "disc",
    density: "compact",
  },
];

export const DEFAULT_DESIGN_ID = "classic";

/** Resolve a design by id, falling back to the default (first) design. */
export function getCvDesign(id: string | undefined): CvDesign {
  return CV_DESIGNS.find((d) => d.id === id) ?? CV_DESIGNS[0];
}
