import { config } from "dotenv";
config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { eq, inArray, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import {
  DEMO_ACCESS_KEY_FALLBACK,
  DEMO_EMAIL_FALLBACK,
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
  normalizeDemoEmail,
  splitScore,
} from "./demo-data";

/**
 * DEMO data for previewing the app and for the public showcase account.
 *
 * Creates three namespaced users:
 *   - demo-new@intervium.app   → onboarded, zero sessions   (new-user states)
 *   - demo-power@intervium.app → onboarded, 6 scored + 1 in-progress session
 *   - john.doe@intervium.app   → the shared SHOWCASE account: onboarded, scored
 *       interviews across two stacks, study notes/folders/flashcards, and solved
 *       Dojo problems — so a stranger can explore every feature. AI + deletes are
 *       locked for this account at runtime (see src/lib/demo.ts; set
 *       DEMO_USER_EMAIL=john.doe@intervium.app). Its password is the access key.
 *
 * Idempotent: re-running wipes only these users' generated data and recreates
 * it. Remove everything with: npm run db:demo -- --clean
 *
 * Run with: npx tsx db/demo-seed.ts
 */

const DEMO_PASSWORD = "Demo@1234";
const NEW_USER = "demo-new@intervium.app";
const POWER_USER = "demo-power@intervium.app";

// The shared public showcase account. Share these two with anyone.
// The email is normalized (lowercased) so it always matches the runtime
// detection in src/lib/demo.ts (which lowercases DEMO_USER_EMAIL). The password
// is read from DEMO_ACCESS_KEY so it always matches the invite email
// (src/lib/email.ts reads the same env via the shared fallbacks).
const JOHN_USER = normalizeDemoEmail(
  process.env.DEMO_USER_EMAIL?.trim() || DEMO_EMAIL_FALLBACK,
);
const JOHN_ACCESS_KEY =
  process.env.DEMO_ACCESS_KEY?.trim() || DEMO_ACCESS_KEY_FALLBACK;

const DAY = 24 * 60 * 60 * 1000;

const DEMO_Q = DEMO_INTERVIEW_Q;
const DEMO_A = DEMO_INTERVIEW_A;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set.");
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: /@(localhost|127\.0\.0\.1)/.test(databaseUrl)
      ? false
      : { rejectUnauthorized: false },
  });
  const db = drizzle(pool, { schema });
  const clean = process.argv.includes("--clean");

  const [role] = await db
    .select()
    .from(schema.jobRoles)
    .where(eq(schema.jobRoles.slug, "software-developer"));
  if (!role)
    throw new Error("Run `npm run db:seed` first (no job role found).");

  const stacks = await db
    .select()
    .from(schema.techStacks)
    .where(eq(schema.techStacks.jobRoleId, role.id));
  const stack = stacks.find((s) => s.name === "React") ?? stacks[0];
  if (!stack)
    throw new Error("Run `npm run db:seed` first (no tech stack found).");

  // Upsert the demo users.
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const johnHash = await bcrypt.hash(JOHN_ACCESS_KEY, 10);
  for (const [email, hash] of [
    [NEW_USER, passwordHash],
    [POWER_USER, passwordHash],
    [JOHN_USER, johnHash],
  ] as const) {
    await db
      .insert(schema.users)
      .values({ email, passwordHash: hash, role: "user" })
      .onConflictDoNothing({ target: schema.users.email });
  }
  const users = await db
    .select()
    .from(schema.users)
    .where(inArray(schema.users.email, [NEW_USER, POWER_USER, JOHN_USER]));
  const idOf = (email: string) => users.find((u) => u.email === email)!.id;
  const newId = idOf(NEW_USER);
  const powerId = idOf(POWER_USER);
  const johnId = idOf(JOHN_USER);
  const allIds = [newId, powerId, johnId];

  // Wipe prior generated data (children first) so this is idempotent.
  const priorSessions = await db
    .select({ id: schema.interviewSessions.id })
    .from(schema.interviewSessions)
    .where(inArray(schema.interviewSessions.userId, allIds));
  if (priorSessions.length) {
    const ids = priorSessions.map((s) => s.id);
    await db
      .delete(schema.sessionQuestions)
      .where(inArray(schema.sessionQuestions.sessionId, ids));
    await db
      .delete(schema.interviewSessions)
      .where(inArray(schema.interviewSessions.id, ids));
  }
  // John's study + Dojo data (notes reference folders, so notes first).
  await db
    .delete(schema.studyNotes)
    .where(eq(schema.studyNotes.userId, johnId));
  await db
    .delete(schema.studyFolders)
    .where(eq(schema.studyFolders.userId, johnId));
  await db
    .delete(schema.dojoProgress)
    .where(eq(schema.dojoProgress.userId, johnId));

  if (clean) {
    await db
      .delete(schema.profiles)
      .where(inArray(schema.profiles.userId, allIds));
    await db.delete(schema.users).where(inArray(schema.users.id, allIds));
    console.log("🧹 Removed demo users and their data.");
    return;
  }

  // Profiles (onboarding completed so the dashboard renders).
  const profile = (
    displayName: string,
    years: number,
    skills: string[],
    cvText: string | null,
  ) => ({
    displayName,
    primaryRole: role.id,
    yearsExperience: years,
    skills,
    cvText,
    onboarding: { completed: true },
  });

  const upsertProfile = async (
    userId: string,
    displayName: string,
    years: number,
    skills: string[],
    cvText: string | null,
  ) => {
    const values = profile(displayName, years, skills, cvText);
    await db
      .insert(schema.profiles)
      .values({ userId, ...values })
      .onConflictDoUpdate({
        target: schema.profiles.userId,
        set: { ...values, updatedAt: new Date() },
      });
  };

  await upsertProfile(
    newId,
    "Maya Chen",
    1,
    ["JavaScript", "React", "CSS"],
    null,
  );

  const powerSkills = [
    "React",
    "TypeScript",
    "Node.js",
    "GraphQL",
    "PostgreSQL",
    "System Design",
  ];
  await upsertProfile(
    powerId,
    "Alex Rivera",
    6,
    powerSkills,
    "Senior software developer with 6 years building web platforms.",
  );

  await upsertProfile(
    johnId,
    JOHN_PROFILE.displayName,
    JOHN_PROFILE.yearsExperience,
    [...JOHN_PROFILE.skills],
    JOHN_PROFILE.cvText,
  );

  const Q = DEMO_QUESTIONS_PER_SESSION;

  /** Insert one completed + scored session with a self-contained transcript. */
  const addScoredSession = async (
    userId: string,
    techStackId: string,
    mode: "bank" | "ai",
    total: number,
    daysAgo: number,
  ) => {
    const when = new Date(Date.now() - daysAgo * DAY);
    const [session] = await db
      .insert(schema.interviewSessions)
      .values({
        userId,
        mode,
        jobRoleId: role.id,
        techStackId,
        skillLevel: mode === "ai" ? "advanced" : null,
        questionCount: Q,
        status: "completed",
        totalScore: total,
        maxScore: DEMO_SESSION_MAX,
        summary: DEMO_SESSION_SUMMARY,
        scoredAt: when,
        startedAt: when,
        completedAt: when,
      })
      .returning();

    const scores = splitScore(total);
    await db.insert(schema.sessionQuestions).values(
      scores.map((score, i) => ({
        sessionId: session.id,
        bankQuestionId: null,
        questionText: DEMO_Q,
        idealAnswer: DEMO_A,
        modality: "text" as const,
        position: i,
        userAnswer: DEMO_USER_ANSWER,
        score,
        maxScore: DEMO_PER_QUESTION_MAX,
        answeredAt: when,
      })),
    );
  };

  // Power user: 6 completed + scored (upward trend) + 1 in-progress.
  const powerRuns = [
    { total: 30, daysAgo: 35, mode: "bank" as const },
    { total: 34, daysAgo: 28, mode: "ai" as const },
    { total: 38, daysAgo: 21, mode: "bank" as const },
    { total: 40, daysAgo: 14, mode: "ai" as const },
    { total: 44, daysAgo: 7, mode: "bank" as const },
    { total: 46, daysAgo: 2, mode: "ai" as const },
  ];
  for (const r of powerRuns)
    await addScoredSession(powerId, stack.id, r.mode, r.total, r.daysAgo);
  await db.insert(schema.interviewSessions).values({
    userId: powerId,
    mode: "ai",
    jobRoleId: role.id,
    techStackId: stack.id,
    skillLevel: "advanced",
    questionCount: Q,
    status: "in_progress",
    totalScore: 0,
    maxScore: 0,
    startedAt: new Date(Date.now() - 1 * DAY),
  });

  // John Doe: interviews across up to two stacks (richer gap-analysis).
  const stackB = stacks.find((s) => s.id !== stack.id) ?? stack;
  for (const run of JOHN_INTERVIEWS)
    await addScoredSession(
      johnId,
      run.stack === "primary" ? stack.id : stackB.id,
      run.mode,
      run.total,
      run.daysAgo,
    );

  // John Doe: study folders + notes (incl. a flashcard and a cloze example).
  const folderId = new Map<string, string>();
  for (const f of JOHN_FOLDERS) {
    const [row] = await db
      .insert(schema.studyFolders)
      .values({
        userId: johnId,
        parentId: f.parent ? (folderId.get(f.parent) ?? null) : null,
        name: f.name,
        sortOrder: f.sortOrder,
      })
      .returning({ id: schema.studyFolders.id });
    folderId.set(f.key, row.id);
  }
  await db.insert(schema.studyNotes).values(
    JOHN_NOTES.map((n) => ({
      userId: johnId,
      folderId: folderId.get(n.folder) ?? null,
      title: n.title,
      content: n.content,
      isFlashcard: n.isFlashcard,
      tags: n.tags,
    })),
  );

  // John Doe: mark a few built-in Dojo problems solved (if any are seeded).
  const builtinProblems = await db
    .select({ id: schema.dojoQuestions.id })
    .from(schema.dojoQuestions)
    .where(isNull(schema.dojoQuestions.createdBy))
    .limit(JOHN_DOJO_SOLVED);
  if (builtinProblems.length) {
    const now = new Date();
    await db.insert(schema.dojoProgress).values(
      builtinProblems.map((p, i) => ({
        userId: johnId,
        questionId: p.id,
        solved: true,
        attempts: 2 + i,
        solvedAt: new Date(Date.now() - (i + 1) * DAY),
        lastAttemptedAt: now,
      })),
    );
  }

  console.log("\n✅ Demo data ready.");
  console.log("   New user:   demo-new@intervium.app   /  Demo@1234");
  console.log("   Power user: demo-power@intervium.app /  Demo@1234");
  console.log(
    `   Showcase:   ${JOHN_USER}      /  ${JOHN_ACCESS_KEY}  (set DEMO_USER_EMAIL=${JOHN_USER})`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Demo seed failed:", error);
    process.exit(1);
  });
