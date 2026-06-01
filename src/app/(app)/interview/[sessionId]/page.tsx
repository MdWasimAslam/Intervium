import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db, interviewSessions, sessionQuestions } from "@db";
import { requireAuth } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import {
  getQuestionsForSession,
  QuestionGenerationError,
} from "@/lib/question-engine";
import { Container } from "@/components/layout/Container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InterviewRunner } from "@/components/interview/InterviewRunner";

export const metadata: Metadata = { title: "Interview" };

// First visit may generate questions via Groq (one call); give it headroom
// within Vercel's Hobby function limit.
export const maxDuration = 60;

/**
 * Interview session page (Phase 7) — the real text answering flow.
 */
export default async function InterviewSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const user = await requireAuth();

  const [session] = await db
    .select({
      id: interviewSessions.id,
      userId: interviewSessions.userId,
      mode: interviewSessions.mode,
      jobRoleId: interviewSessions.jobRoleId,
      techStackId: interviewSessions.techStackId,
      skillLevel: interviewSessions.skillLevel,
      questionCount: interviewSessions.questionCount,
      timerEnabled: interviewSessions.timerEnabled,
      timerPresetId: interviewSessions.timerPresetId,
      customTimerSeconds: interviewSessions.customTimerSeconds,
      status: interviewSessions.status,
    })
    .from(interviewSessions)
    .where(
      and(
        eq(interviewSessions.id, sessionId),
        eq(interviewSessions.userId, user.id),
      ),
    );

  // Guard: owner-only.
  if (!session) notFound();

  // Guard: completed sessions go straight to results.
  if (session.status === "completed") {
    redirect(`/interview/${sessionId}/results`);
  }

  // Ensure questions exist (generates on first visit), then load them.
  let genError: string | null = null;
  try {
    await getQuestionsForSession(session);
  } catch (error) {
    genError =
      error instanceof QuestionGenerationError
        ? error.message
        : "Couldn't load questions. Please try again.";
  }

  if (genError) {
    return (
      <Container className="max-w-xl py-20 text-center">
        <Card>
          <CardHeader>
            <CardTitle>We hit a snag</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[var(--destructive)]">{genError}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {/* Retry: reloading this page re-runs question generation. */}
              <Link href={`/interview/${sessionId}`}>
                <Button>Try again</Button>
              </Link>
              <Link href="/interview/new">
                <Button variant="outline">Back to setup</Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="ghost">Dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </Container>
    );
  }

  const rows = await db
    .select({
      position: sessionQuestions.position,
      questionText: sessionQuestions.questionText,
      modality: sessionQuestions.modality,
      userAnswer: sessionQuestions.userAnswer,
      answeredAt: sessionQuestions.answeredAt,
    })
    .from(sessionQuestions)
    .where(eq(sessionQuestions.sessionId, sessionId))
    .orderBy(asc(sessionQuestions.position));

  // Resume at the first unanswered question.
  const startIndex = rows.findIndex((r) => r.answeredAt === null);

  // All answered but never finished → complete now and show results.
  if (startIndex === -1) {
    await db
      .update(interviewSessions)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(interviewSessions.id, sessionId));
    redirect(`/interview/${sessionId}/results`);
  }

  const initialAnswers: Record<number, string> = {};
  for (const r of rows) initialAnswers[r.position] = r.userAnswer ?? "";

  const settings = await getSettings();

  // Resolve the per-question timer. New sessions snapshot their resolved seconds
  // in customTimerSeconds (null = no timer); pre-preset sessions fall back to
  // the global default when they were timed.
  const resolvedTimerSeconds = session.timerPresetId
    ? session.customTimerSeconds
    : session.timerEnabled
      ? settings.defaultTimerSeconds
      : null;
  const timerEnabled = resolvedTimerSeconds != null && resolvedTimerSeconds > 0;

  return (
    <InterviewRunner
      sessionId={sessionId}
      questions={rows.map((r) => ({
        position: r.position,
        questionText: r.questionText,
        type: r.modality,
        language: r.modality === "coding" ? "javascript" : null,
      }))}
      initialAnswers={initialAnswers}
      timerEnabled={timerEnabled}
      timerSeconds={resolvedTimerSeconds ?? 0}
      startIndex={startIndex}
    />
  );
}
