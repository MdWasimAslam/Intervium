import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { ScoreRing } from "@/components/interview/ScoreRing";

export interface LatestSession {
  totalScore: number;
  maxScore: number;
  interviewType: string;
  techStack: string;
}

const TYPE_LABEL: Record<string, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
  mixed: "Mixed",
  coding: "Coding",
};

/**
 * The user's most recent completed session.
 *
 * - `compact` (default): the slim sidebar card used on the interview setup page.
 * - `highlight`: a richer dashboard card with a score ring, context chips and a
 *   link through to the full breakdown.
 */
export function LatestResult({
  latest,
  variant = "compact",
  href,
  role,
  date,
}: {
  latest: LatestSession | null;
  variant?: "compact" | "highlight";
  href?: string;
  role?: string;
  date?: string;
}) {
  if (variant === "highlight") {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-[var(--primary)]" />
            Latest result
          </CardTitle>
        </CardHeader>
        <CardContent>
          {latest ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <ScoreRing
                score={latest.totalScore}
                max={latest.maxScore}
                size={132}
              />
              <div className="space-y-2">
                <div className="flex flex-wrap justify-center gap-1.5">
                  {role && <Chip>{role}</Chip>}
                  <Chip>
                    {TYPE_LABEL[latest.interviewType] ?? latest.interviewType}
                  </Chip>
                  <Chip>{latest.techStack}</Chip>
                </div>
                {date && (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Scored {date}
                  </p>
                )}
              </div>
              {href && (
                <Link
                  href={href}
                  className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] transition-colors hover:opacity-80"
                >
                  View full breakdown
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">
              No interviews yet. Complete one to see your latest result here.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-[var(--primary)]" />
          Latest Result
        </CardTitle>
      </CardHeader>
      <CardContent>
        {latest ? (
          <div>
            <p className="text-3xl font-bold text-[var(--primary)]">
              {latest.totalScore}
              <span className="text-lg text-[var(--muted-foreground)]">
                /{latest.maxScore}
              </span>
            </p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {TYPE_LABEL[latest.interviewType] ?? latest.interviewType} ·{" "}
              {latest.techStack}
            </p>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">
            No interviews yet. Complete one to see your latest result here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
