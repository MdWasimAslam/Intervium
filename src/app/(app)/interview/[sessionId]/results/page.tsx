import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  interviewSessions,
  jobRoles,
  sessionQuestions,
  techStacks,
} from "@db";
import { requireAuth } from "@/lib/session";
import { Container } from "@/components/layout/Container";
import { Card, CardContent } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { ScoreRing } from "@/components/interview/ScoreRing";
import { ScoringScreen } from "@/components/interview/ScoringScreen";
import { RetakeButton } from "@/components/interview/RetakeButton";
import {
  QuestionResults,
  type QuestionResult,
} from "@/components/interview/QuestionResults";

export const metadata: Metadata = { title: "Results" };

// Scoring (the scoreSessionAction server action) runs in this route segment and
// makes Groq calls; give it headroom within Vercel's Hobby function limit.
export const maxDuration = 60;

const MODE_LABEL: Record<string, string> = {
  bank: "Question Bank",
  ai: "AI",
};

/**
 * Results page (Phase 8). Shows the overall score, an AI summary, and a
 * per-question breakdown. If the session isn't scored yet, kicks off scoring
 * and shows a loading state.
 */
export default async function ResultsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const user = await requireAuth();

  const [session] = await db
    .select({
      id: interviewSessions.id,
      status: interviewSessions.status,
      scoredAt: interviewSessions.scoredAt,
      totalScore: interviewSessions.totalScore,
      maxScore: interviewSessions.maxScore,
      summary: interviewSessions.summary,
      role: jobRoles.name,
      tech: techStacks.name,
      professionType: jobRoles.professionType,
      mode: interviewSessions.mode,
      skillLevel: interviewSessions.skillLevel,
    })
    .from(interviewSessions)
    .innerJoin(jobRoles, eq(jobRoles.id, interviewSessions.jobRoleId))
    .innerJoin(techStacks, eq(techStacks.id, interviewSessions.techStackId))
    .where(
      and(
        eq(interviewSessions.id, sessionId),
        eq(interviewSessions.userId, user.id),
      ),
    );

  if (!session) notFound();

  // Not finished yet → send back to the interview.
  if (session.status !== "completed") redirect(`/interview/${sessionId}`);

  // Finished but not scored → score it (loading state), then refresh.
  if (!session.scoredAt) return <ScoringScreen sessionId={sessionId} />;

  const rows = await db
    .select({
      position: sessionQuestions.position,
      questionText: sessionQuestions.questionText,
      idealAnswer: sessionQuestions.idealAnswer,
      modality: sessionQuestions.modality,
      userAnswer: sessionQuestions.userAnswer,
      score: sessionQuestions.score,
      maxScore: sessionQuestions.maxScore,
      feedback: sessionQuestions.feedback,
      feedbackDetail: sessionQuestions.feedbackDetail,
    })
    .from(sessionQuestions)
    .where(eq(sessionQuestions.sessionId, sessionId))
    .orderBy(asc(sessionQuestions.position));

  const results: QuestionResult[] = rows.map((r) => ({
    position: r.position,
    questionText: r.questionText,
    userAnswer: r.userAnswer ?? "",
    score: r.score,
    maxScore: r.maxScore,
    feedback: r.feedback ?? "",
    strengths: r.feedbackDetail?.strengths ?? [],
    improvements: r.feedbackDetail?.improvements ?? [],
    missingConcepts: r.feedbackDetail?.missingConcepts ?? [],
    betterApproach: r.feedbackDetail?.betterApproach ?? null,
    rubric: r.feedbackDetail?.rubric ?? null,
    codeRubric: r.feedbackDetail?.codeRubric ?? null,
    isCoding: r.modality === "coding",
    language: r.modality === "coding" ? "javascript" : null,
    // Expected/ideal answer: prose for text questions, a code block for coding.
    idealAnswer: r.modality === "coding" ? null : r.idealAnswer,
    idealSolution: r.modality === "coding" ? r.idealAnswer : null,
  }));

  return (
    <Container className="max-w-2xl py-12">
      {/* Overall */}
      <Card className="mb-6">
        <CardContent className="flex flex-col items-center gap-5 p-8 sm:flex-row sm:items-center sm:gap-8">
          <ScoreRing score={session.totalScore} max={session.maxScore} />
          <div className="text-center sm:text-left">
            <div className="mb-2 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Chip>{session.role}</Chip>
              <Chip>{session.tech}</Chip>
              <Chip>{MODE_LABEL[session.mode] ?? session.mode}</Chip>
              {session.skillLevel && (
                <Chip className="capitalize">{session.skillLevel}</Chip>
              )}
            </div>
            <h1 className="text-2xl font-bold">Interview complete</h1>
            {session.summary && (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {session.summary}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Per-question breakdown */}
      <QuestionResults
        results={results}
        isTechnical={session.professionType === "technical"}
      />

      {/* Actions */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/interview/new">
          <Button>New Interview</Button>
        </Link>
        <RetakeButton sessionId={sessionId} />
      </div>
    </Container>
  );
}
