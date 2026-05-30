import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, interviewSessions } from "@db";
import { getCurrentUser } from "@/lib/session";
import {
  getQuestionsForSession,
  QuestionGenerationError,
} from "@/lib/question-engine";

// A single Gemini generation call can take several seconds; give it headroom
// while staying within Vercel's Hobby function limit.
export const maxDuration = 60;

/**
 * GET /api/interview/[sessionId]/questions
 *
 * Returns (and lazily generates) the questions for a session the caller owns.
 * The per-user generation rate limit lives inside the engine, so it applies
 * however this is invoked.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, message: "Not authenticated." },
      { status: 401 },
    );
  }

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
    })
    .from(interviewSessions)
    .where(
      and(
        eq(interviewSessions.id, sessionId),
        eq(interviewSessions.userId, user.id),
      ),
    );

  if (!session) {
    return NextResponse.json(
      { success: false, message: "Session not found." },
      { status: 404 },
    );
  }

  try {
    const questions = await getQuestionsForSession(session);
    return NextResponse.json({ success: true, data: questions });
  } catch (error) {
    if (error instanceof QuestionGenerationError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 503 },
      );
    }
    console.error("[api/questions]", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong." },
      { status: 500 },
    );
  }
}
