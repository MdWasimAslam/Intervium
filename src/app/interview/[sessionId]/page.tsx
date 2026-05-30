import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db, interviewSessions, questionsCache, sessionQuestions } from "@db";
import { requireAuth } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import {
  getQuestionsForSession,
  QuestionGenerationError,
} from "@/lib/question-engine";
import { Container } from "@/components/layout/Container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InterviewRunner } from "@/components/interview/InterviewRunner";
import { VoiceRunner } from "@/components/interview/VoiceRunner";

export const metadata: Metadata = { title: "Interview" };

// First visit may generate questions via Gemini (one call); give it headroom
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
      jobRoleId: interviewSessions.jobRoleId,
      techStackId: interviewSessions.techStackId,
      focusAreaId: interviewSessions.focusAreaId,
      difficulty: interviewSessions.difficulty,
      interviewType: interviewSessions.interviewType,
      questionCount: interviewSessions.questionCount,
      mode: interviewSessions.mode,
      timerEnabled: interviewSessions.timerEnabled,
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
          <CardContent>
            <p className="text-sm text-[var(--destructive)]">{genError}</p>
          </CardContent>
        </Card>
      </Container>
    );
  }

  const rows = await db
    .select({
      position: sessionQuestions.position,
      questionText: questionsCache.questionText,
      type: questionsCache.type,
      language: questionsCache.language,
      userAnswer: sessionQuestions.userAnswer,
      answeredAt: sessionQuestions.answeredAt,
    })
    .from(sessionQuestions)
    .innerJoin(
      questionsCache,
      eq(questionsCache.id, sessionQuestions.questionId),
    )
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
  const runnerProps = {
    sessionId,
    questions: rows.map((r) => ({
      position: r.position,
      questionText: r.questionText,
      type: r.type,
      language: r.language,
    })),
    initialAnswers,
    timerEnabled: session.timerEnabled,
    timerSeconds: settings.defaultTimerSeconds,
    startIndex,
  };

  return session.mode === "voice" ? (
    <VoiceRunner
      {...runnerProps}
      transcriptionProvider={settings.transcriptionProvider}
    />
  ) : (
    <InterviewRunner {...runnerProps} />
  );
}
