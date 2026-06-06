import "server-only";
import { eq, inArray, isNull } from "drizzle-orm";
import {
  db,
  dojoProgress,
  dojoQuestions,
  interviewSessions,
  jobRoles,
  profiles,
  sessionQuestions,
  studyFolders,
  studyNotes,
  techStacks,
  users,
} from "@db";
import { withTransaction } from "@db/tx";
import { DEMO_USER_EMAIL } from "@/lib/demo";
import {
  DEMO_INTERVIEW_A,
  DEMO_INTERVIEW_Q,
  DEMO_PER_QUESTION_MAX,
  DEMO_QUESTIONS_PER_SESSION,
  DEMO_SESSION_MAX,
  DEMO_SESSION_SUMMARY,
  DEMO_USER_ANSWER,
  JOHN_DOJO_SOLVED,
  JOHN_FOLDERS,
  JOHN_INTERVIEWS,
  JOHN_NOTES,
  JOHN_PROFILE,
  splitScore,
} from "../../db/demo-data";

/**
 * Reset the shared demo account to its pristine seeded state: wipe everything
 * the (shared) account may have edited, then re-create the curated profile,
 * interviews, study notes/folders, and Dojo progress. Uses the same content as
 * `db/demo-seed.ts` (both read `db/demo-data.ts`), runs app-side, and atomically.
 *
 * The account itself (and its password) is untouched — only generated data.
 */
const DAY = 24 * 60 * 60 * 1000;
const Q = DEMO_QUESTIONS_PER_SESSION;

export async function resetDemoAccount(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  // No configured demo account → nothing to reset. (Refusing here also means the
  // admin action can never target an unrecognized, unlocked account.)
  if (!DEMO_USER_EMAIL) {
    return {
      ok: false,
      error: "Demo account isn't configured (set DEMO_USER_EMAIL).",
    };
  }
  const email = DEMO_USER_EMAIL;

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  if (!user) {
    return {
      ok: false,
      error: `Demo account (${email}) not found. Run \`npm run db:demo\` first.`,
    };
  }
  const johnId = user.id;

  const [role] = await db
    .select()
    .from(jobRoles)
    .where(eq(jobRoles.slug, "software-developer"));
  if (!role) return { ok: false, error: "Seed data missing (no job role)." };

  const stacks = await db
    .select()
    .from(techStacks)
    .where(eq(techStacks.jobRoleId, role.id));
  const stack = stacks.find((s) => s.name === "React") ?? stacks[0];
  if (!stack) return { ok: false, error: "Seed data missing (no tech stack)." };
  const stackB = stacks.find((s) => s.id !== stack.id) ?? stack;
  const stackIdFor = (which: "primary" | "secondary") =>
    which === "primary" ? stack.id : stackB.id;

  const builtin = await db
    .select({ id: dojoQuestions.id })
    .from(dojoQuestions)
    .where(isNull(dojoQuestions.createdBy))
    .limit(JOHN_DOJO_SOLVED);

  try {
    await withTransaction(async (tx) => {
      // --- wipe (children first) ---
      const prior = await tx
        .select({ id: interviewSessions.id })
        .from(interviewSessions)
        .where(eq(interviewSessions.userId, johnId));
      if (prior.length) {
        const ids = prior.map((s) => s.id);
        await tx
          .delete(sessionQuestions)
          .where(inArray(sessionQuestions.sessionId, ids));
        await tx
          .delete(interviewSessions)
          .where(inArray(interviewSessions.id, ids));
      }
      await tx.delete(studyNotes).where(eq(studyNotes.userId, johnId));
      await tx.delete(studyFolders).where(eq(studyFolders.userId, johnId));
      await tx.delete(dojoProgress).where(eq(dojoProgress.userId, johnId));

      // --- profile ---
      const profileValues = {
        displayName: JOHN_PROFILE.displayName,
        primaryRole: role.id,
        yearsExperience: JOHN_PROFILE.yearsExperience,
        skills: [...JOHN_PROFILE.skills],
        cvText: JOHN_PROFILE.cvText,
        onboarding: { completed: true },
      };
      await tx
        .insert(profiles)
        .values({ userId: johnId, ...profileValues })
        .onConflictDoUpdate({
          target: profiles.userId,
          set: { ...profileValues, updatedAt: new Date() },
        });

      // --- interviews (scored, across two stacks) ---
      for (const run of JOHN_INTERVIEWS) {
        const when = new Date(Date.now() - run.daysAgo * DAY);
        const [session] = await tx
          .insert(interviewSessions)
          .values({
            userId: johnId,
            mode: run.mode,
            jobRoleId: role.id,
            techStackId: stackIdFor(run.stack),
            skillLevel: run.mode === "ai" ? "advanced" : null,
            questionCount: Q,
            status: "completed",
            totalScore: run.total,
            maxScore: DEMO_SESSION_MAX,
            summary: DEMO_SESSION_SUMMARY,
            scoredAt: when,
            startedAt: when,
            completedAt: when,
          })
          .returning({ id: interviewSessions.id });

        const scores = splitScore(run.total);
        await tx.insert(sessionQuestions).values(
          scores.map((score, i) => ({
            sessionId: session.id,
            bankQuestionId: null,
            questionText: DEMO_INTERVIEW_Q,
            idealAnswer: DEMO_INTERVIEW_A,
            modality: "text" as const,
            position: i,
            userAnswer: DEMO_USER_ANSWER,
            score,
            maxScore: DEMO_PER_QUESTION_MAX,
            answeredAt: when,
          })),
        );
      }

      // --- study folders + notes ---
      const folderId = new Map<string, string>();
      for (const f of JOHN_FOLDERS) {
        const [row] = await tx
          .insert(studyFolders)
          .values({
            userId: johnId,
            parentId: f.parent ? (folderId.get(f.parent) ?? null) : null,
            name: f.name,
            sortOrder: f.sortOrder,
          })
          .returning({ id: studyFolders.id });
        folderId.set(f.key, row.id);
      }
      await tx.insert(studyNotes).values(
        JOHN_NOTES.map((n) => ({
          userId: johnId,
          folderId: folderId.get(n.folder) ?? null,
          title: n.title,
          content: n.content,
          isFlashcard: n.isFlashcard,
          tags: n.tags,
        })),
      );

      // --- Dojo progress (mark a few built-ins solved) ---
      if (builtin.length) {
        const now = new Date();
        await tx.insert(dojoProgress).values(
          builtin.map((p, i) => ({
            userId: johnId,
            questionId: p.id,
            solved: true,
            attempts: 2 + i,
            solvedAt: new Date(Date.now() - (i + 1) * DAY),
            lastAttemptedAt: now,
          })),
        );
      }
    });
    return { ok: true };
  } catch (error) {
    console.error("[resetDemoAccount]", error);
    return { ok: false, error: "Could not reset the demo account." };
  }
}
