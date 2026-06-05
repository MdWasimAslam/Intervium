import {
  BookOpen,
  Code2,
  FileText,
  History,
  LayoutDashboard,
  Pencil,
  Shield,
  Shuffle,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Visible only to admins (same role check the rest of the app uses). */
  adminOnly?: boolean;
  /** Surfaced as a tile in the dashboard "Shortcuts" grid. */
  inShortcuts?: boolean;
  /** Surfaced inline in the desktop header nav bar. */
  inHeader?: boolean;
}

/**
 * Single source of truth for primary app navigation. The dashboard shortcut
 * grid, the desktop header nav, and the account-menu dropdown all derive from
 * this list so the three surfaces never drift.
 */
export const NAV_LINKS: NavLink[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/interview/new",
    label: "Start interview",
    icon: Zap,
    inShortcuts: true,
  },
  {
    href: "/cv",
    label: "My CV",
    icon: FileText,
    inShortcuts: true,
    inHeader: true,
  },
  {
    href: "/dojo",
    label: "Code Dojo",
    icon: Code2,
    inShortcuts: true,
    inHeader: true,
  },
  {
    href: "/study",
    label: "Study Notes",
    icon: BookOpen,
    inShortcuts: true,
    inHeader: true,
  },
  {
    href: "/dojo?random=1",
    label: "Random DSA",
    icon: Shuffle,
    inShortcuts: true,
  },
  {
    href: "/gap-analysis",
    label: "Gap analysis",
    icon: Target,
    inShortcuts: true,
  },
  {
    href: "/history",
    label: "History",
    icon: History,
    inShortcuts: true,
  },
  { href: "/profile", label: "Edit profile", icon: Pencil, inShortcuts: true },
  {
    href: "/admin",
    label: "Admin",
    icon: Shield,
    adminOnly: true,
    inShortcuts: true,
    inHeader: true,
  },
];

/** All links visible to this user, in display order. */
export function navFor(isAdmin: boolean): NavLink[] {
  return NAV_LINKS.filter((l) => !l.adminOnly || isAdmin);
}
