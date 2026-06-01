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
    <Card className="relative h-full overflow-hidden border-0 bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_8px_30px_-12px_rgba(0,183,117,0.55)]">
      {/* Decorative glow — purely cosmetic. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-[var(--primary-foreground)]/10 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-[var(--primary-foreground)]/10 blur-2xl"
      />

      <CardContent className="relative flex h-full flex-col justify-between gap-6 p-7 sm:p-8">
        <div>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium opacity-90">
            <Sparkles className="h-4 w-4" />
            {isFirst ? "Let's get you started" : "Ready for another round?"}
          </span>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {isFirst ? "Start your first interview" : "Start a new interview"}
          </h2>
          <p className="mt-2 max-w-md text-sm opacity-90">
            {isFirst
              ? "Pick a profession and specialization, then answer questions and get instant, scored feedback."
              : "Choose your profession and specialization — get questions and a scored breakdown in minutes."}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/interview/new">
            <Button
              size="lg"
              variant="secondary"
              className="bg-[var(--primary-foreground)] text-[var(--primary)] hover:opacity-90"
            >
              {isFirst ? "Start interview" : "New interview"}
              <ArrowRight />
            </Button>
          </Link>

          {resumeId && (
            <Link href={`/interview/${resumeId}`}>
              <Button
                size="lg"
                variant="secondary"
                className="border border-[var(--primary-foreground)]/25 bg-[var(--primary-foreground)]/10 text-[var(--primary-foreground)] hover:bg-[var(--primary-foreground)]/20"
              >
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
