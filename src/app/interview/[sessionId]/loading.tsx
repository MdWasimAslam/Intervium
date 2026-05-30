import { Loader2, Sparkles } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Shown while the session page prepares questions. On first visit this covers
 * the Gemini generation call (a few seconds); on later visits it's a brief
 * flash while cached questions load. Replaces a bare spinner with a meaningful,
 * progress-y message.
 */
export default function InterviewLoading() {
  return (
    <Container className="max-w-md py-24">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <span className="relative flex h-12 w-12 items-center justify-center">
            <Loader2 className="absolute h-12 w-12 animate-spin text-[var(--primary)]/30" />
            <Sparkles className="h-6 w-6 text-[var(--primary)]" />
          </span>
          <div>
            <p className="font-semibold">Generating your questions…</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Tailoring them to your role, stack, and experience.
            </p>
          </div>
          {/* Indeterminate progress shimmer — a sense of motion, not a number. */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--secondary)]">
            <div className="h-full w-1/3 animate-[loadingbar_1.4s_ease-in-out_infinite] rounded-full bg-[var(--primary)]" />
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}
