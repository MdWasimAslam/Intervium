import Link from "next/link";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * The dashboard hero: a brand-green band whose single job is to launch a new
 * interview. A "Resume" action appears only when the user has a session still
 * in progress (existing `in_progress` status).
 */
export function PrimaryAction({
  isFirst,
  resumeId,
}: {
  isFirst: boolean;
  resumeId: string | null;
}) {
  return (
    <Card className="relative h-full overflow-hidden border border-[var(--primary)]/30 bg-[var(--primary)]/[0.06] text-[var(--foreground)]">
      {/* Decorative glow — purely cosmetic. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-[var(--primary)]/10 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-[var(--primary)]/10 blur-2xl"
      />

      {/* Decorative abstract geometric pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 hidden lg:block"
      >
        <svg width="200" height="160" viewBox="0 0 200 160" fill="none" className="opacity-15">
          {/* Large overlapping circles */}
          <circle cx="100" cy="80" r="70" stroke="var(--primary)" strokeWidth="1" opacity="0.4" />
          <circle cx="130" cy="60" r="50" stroke="var(--primary)" strokeWidth="0.8" opacity="0.3" />
          <circle cx="70" cy="100" r="40" stroke="var(--primary)" strokeWidth="0.6" opacity="0.25" />
          {/* Intersecting lines */}
          <line x1="30" y1="30" x2="170" y2="130" stroke="var(--primary)" strokeWidth="0.5" opacity="0.2" />
          <line x1="170" y1="30" x2="30" y2="130" stroke="var(--primary)" strokeWidth="0.5" opacity="0.2" />
          <line x1="100" y1="10" x2="100" y2="150" stroke="var(--primary)" strokeWidth="0.5" opacity="0.15" />
          <line x1="20" y1="80" x2="180" y2="80" stroke="var(--primary)" strokeWidth="0.5" opacity="0.15" />
          {/* Dots at intersections */}
          <circle cx="100" cy="80" r="3" fill="var(--primary)" opacity="0.4" />
          <circle cx="130" cy="60" r="2" fill="var(--primary)" opacity="0.3" />
          <circle cx="70" cy="100" r="2" fill="var(--primary)" opacity="0.3" />
          <circle cx="50" cy="50" r="1.5" fill="var(--primary)" opacity="0.2" />
          <circle cx="150" cy="110" r="1.5" fill="var(--primary)" opacity="0.2" />
          <circle cx="60" cy="30" r="1.5" fill="var(--primary)" opacity="0.2" />
          <circle cx="140" cy="130" r="1.5" fill="var(--primary)" opacity="0.2" />
          {/* Small accent dots */}
          <circle cx="30" cy="60" r="1" fill="var(--primary)" opacity="0.15" />
          <circle cx="170" cy="100" r="1" fill="var(--primary)" opacity="0.15" />
          <circle cx="80" cy="20" r="1" fill="var(--primary)" opacity="0.15" />
          <circle cx="120" cy="140" r="1" fill="var(--primary)" opacity="0.15" />
        </svg>
      </div>

      <CardContent className="relative flex h-full flex-col justify-between gap-6 p-7 sm:p-8">
        <div>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)]">
            <Sparkles className="h-4 w-4" />
            {isFirst ? "Let's get you started" : "Ready for another round?"}
          </span>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {isFirst ? "Start your first interview" : "Start a new interview"}
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--muted-foreground)]">
            {isFirst
              ? "Pick a profession and specialization, then answer questions and get instant, scored feedback."
              : "Choose your profession and specialization to get a tailored set of questions. Each answer is scored in real time with detailed breakdowns — so you know exactly where you stand and what to improve."}
          </p>

          {/* Feature highlights */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-4">
            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)]/15">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5 L4 7 L8 3" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              Real-time scoring
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)]/15">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5 L4 7 L8 3" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              Tailored questions
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)]/15">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5 L4 7 L8 3" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              Breakdown analysis
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/interview/new">
            <Button size="lg">
              {isFirst ? "Start interview" : "New interview"}
              <ArrowRight />
            </Button>
          </Link>

          {resumeId && (
            <Link href={`/interview/${resumeId}`}>
              <Button size="lg" variant="outline">
                <Play />
                Resume in progress
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}