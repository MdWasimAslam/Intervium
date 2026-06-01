"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  Code2,
  Dumbbell,
  Gauge,
  KeyRound,
  ListChecks,
  Settings as SettingsIcon,
  Users as UsersIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin/roles", label: "Professions", icon: Briefcase },
  { href: "/admin/tech-stacks", label: "Specializations", icon: Code2 },
  { href: "/admin/access-codes", label: "Access Codes", icon: KeyRound },
  { href: "/admin/questions", label: "Question Bank", icon: ListChecks },
  { href: "/admin/dojo", label: "Code Dojo", icon: Dumbbell },
  { href: "/admin/ai-usage", label: "AI Usage", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
  { href: "/admin/users", label: "Users", icon: UsersIcon },
  // Developer-only Production Readiness Dashboard (admin-gated, outside /admin).
  { href: "/qa", label: "QA Center", icon: Gauge },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-full shrink-0 border-b border-[var(--border)] md:w-60 md:border-b-0 md:border-r">
      <nav className="flex gap-1 overflow-x-auto p-3 md:flex-col md:overflow-visible">
        {LINKS.map((l) => {
          const active = pathname === l.href;
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
              )}
            >
              <Icon className="h-4 w-4" />
              {l.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
