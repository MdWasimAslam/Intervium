import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Container } from "@/components/layout/Container";

/**
 * Auth pages (login / register). A contained two-column layout that follows the
 * app's container width: a value headline + a custom interview illustration on
 * large screens, and the form card on the right (the only column on mobile).
 * No logo here — the public header already shows it.
 */
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
    <div className="relative overflow-hidden">
      {/* Ambient depth — a faint grid and a soft brand glow behind the content. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="landing-grid absolute inset-0" />
        <div className="landing-glow absolute top-[-120px] left-[6%] h-[420px] w-[620px] rounded-full" />
      </div>

      <Container className="relative flex min-h-[calc(100dvh-4rem)] items-center justify-center py-12">
        <div className="grid w-full max-w-5xl items-center gap-12 lg:grid-cols-2">
          {/* Value + illustration — large screens only */}
          <div className="hidden lg:block">
            <Chip>
              <Sparkles className="h-3 w-3" /> AI-powered interview prep
            </Chip>
            <h2 className="mt-5 text-4xl font-bold leading-[1.08] tracking-tight">
              Practice the interview.{" "}
              <span className="text-[var(--primary)]">Ace the real one.</span>
            </h2>
            <p className="mt-3 max-w-md text-[var(--muted-foreground)]">
              Realistic mock interviews, instant AI feedback, and a clear path
              to fixing your weak spots — long before it counts.
            </p>
            <AuthIllustration className="mt-8 h-auto w-full max-w-md" />
          </div>

          {/* Form card */}
          <div className="mx-auto w-full max-w-md">
            <Card className="p-6 elev-2 sm:p-8">
              <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
                  {title}
                </h1>
                <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
                  {subtitle}
                </p>
              </div>

              {children}
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}

/**
 * A hand-built illustration of an AI mock interview — a chat window with a
 * prompt bubble (interviewer + avatar) and a reply bubble (candidate, with a
 * tick), plus a couple of AI sparkles. Drawn with the design tokens so it
 * adapts to light/dark, and distinct from the landing's score-card preview.
 */
function AuthIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 440 360"
      role="img"
      aria-label="Illustration of an AI-powered mock interview"
      className={className}
      fill="none"
    >
      {/* soft decorative blobs */}
      <circle cx="92" cy="68" r="66" fill="var(--primary)" opacity="0.10" />
      <circle cx="372" cy="300" r="84" fill="var(--chart-2)" opacity="0.10" />

      {/* window card */}
      <rect
        x="56"
        y="58"
        width="300"
        height="240"
        rx="24"
        fill="var(--card)"
        stroke="var(--border)"
        strokeWidth="1.5"
      />
      {/* window chrome dots */}
      <circle cx="84" cy="84" r="4" fill="var(--border)" />
      <circle cx="100" cy="84" r="4" fill="var(--border)" />
      <circle cx="116" cy="84" r="4" fill="var(--border)" />

      {/* interviewer avatar */}
      <circle cx="92" cy="146" r="18" fill="var(--accent)" />
      <circle cx="92" cy="141" r="6" fill="var(--primary)" />
      <rect
        x="83"
        y="149"
        width="18"
        height="11"
        rx="5.5"
        fill="var(--primary)"
      />

      {/* prompt bubble (interviewer) */}
      <rect
        x="120"
        y="124"
        width="166"
        height="46"
        rx="14"
        fill="var(--accent)"
      />
      <rect
        x="134"
        y="139"
        width="118"
        height="6"
        rx="3"
        fill="var(--accent-foreground)"
        opacity="0.5"
      />
      <rect
        x="134"
        y="151"
        width="78"
        height="6"
        rx="3"
        fill="var(--accent-foreground)"
        opacity="0.32"
      />

      {/* reply bubble (candidate) */}
      <rect
        x="150"
        y="194"
        width="180"
        height="66"
        rx="16"
        fill="var(--primary)"
      />
      <rect
        x="166"
        y="210"
        width="132"
        height="6"
        rx="3"
        fill="#ffffff"
        opacity="0.9"
      />
      <rect
        x="166"
        y="222"
        width="104"
        height="6"
        rx="3"
        fill="#ffffff"
        opacity="0.6"
      />
      <circle cx="178" cy="244" r="8" fill="#ffffff" opacity="0.22" />
      <path
        d="M174 244 l3 3 l6 -7"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* AI sparkles */}
      <path
        d="M322 98 l3.2 8.4 l8.4 3.2 l-8.4 3.2 l-3.2 8.4 l-3.2 -8.4 l-8.4 -3.2 l8.4 -3.2 z"
        fill="var(--primary)"
      />
      <path
        d="M302 156 l2 5.2 l5.2 2 l-5.2 2 l-2 5.2 l-2 -5.2 l-5.2 -2 l5.2 -2 z"
        fill="var(--chart-2)"
        opacity="0.85"
      />
    </svg>
  );
}
