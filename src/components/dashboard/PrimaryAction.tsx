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

      <CardContent className="relative flex h-full flex-col justify-between gap-6 p-7 sm:p-8">
        <div>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)]">
            <Sparkles className="h-4 w-4" />
            {isFirst ? "Let's get you started" : "Ready for another round?"}
          </span>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {isFirst ? "Start your first interview" : "Start a new interview"}
          </h2>
          <p className="mt-2 max-w-md text-sm text-[var(--muted-foreground)]">
            {isFirst
              ? "Pick a profession and specialization, then answer questions and get instant, scored feedback."
              : "Choose your profession and specialization — get questions and a scored breakdown in minutes."}
          </p>
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
