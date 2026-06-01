import { Check, Code2, FileText, Sparkles } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/Logo";

/**
 * Split-screen shell for the auth pages (login / register).
 *
 * Left: a brand panel (brand-green gradient, logo, headline, feature
 * highlights) — shown only on large screens. Right: the form column. On
 * mobile the brand panel collapses away and a compact logo sits above the form.
 * Fills the viewport height beneath the public header (h-16 / 4rem).
 */

const FEATURES = [
  { icon: Sparkles, label: "AI-powered mock interviews with instant feedback" },
  { icon: FileText, label: "ATS CV review and optimization" },
  { icon: Code2, label: "Code Dojo practice with spaced repetition" },
];

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-[calc(100dvh-4rem)] lg:grid-cols-2">
      {/* Brand panel — large screens only */}
      <aside className="relative hidden overflow-hidden bg-[var(--primary)] p-12 text-[var(--primary-foreground)] lg:flex lg:flex-col lg:justify-between">
        {/* Decorative depth: soft radial highlights over the flat green. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-black/10 blur-3xl"
        />

        <div className="relative flex items-center gap-2.5">
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-tight tracking-tight">
            Ace your next interview.
          </h2>
          <p className="mt-3 text-[var(--primary-foreground)]/80">
            Practice with a realistic AI interviewer, get rubric-based feedback,
            and sharpen your CV — all in one place.
          </p>

          <ul className="mt-8 space-y-4">
            {FEATURES.map((f) => (
              <li key={f.label} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm text-[var(--primary-foreground)]/90">
                  {f.label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-[var(--primary-foreground)]/70">
          © {new Date().getFullYear()} Intervium
        </p>
      </aside>

      {/* Form column */}
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Compact logo for mobile (brand panel is hidden there). */}
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
              {title}
            </h1>
            <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
              {subtitle}
            </p>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
