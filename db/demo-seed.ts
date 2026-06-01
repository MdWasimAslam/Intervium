import { config } from "dotenv";
config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * DEMO data for previewing the dashboard. NOT part of the real seed.
 *
 * Creates two namespaced users:
 *   - demo-new@intervium.app   → onboarded, zero sessions   (new-user states)
 *   - demo-power@intervium.app → onboarded, 6 scored + 1 in-progress session
 *
 * Idempotent: re-running wipes only these two users' sessions and recreates
 * them. Remove everything with: npm run db:demo -- --clean
 *
 * Run with: npx tsx db/demo-seed.ts
 */

const DEMO_PASSWORD = "Demo@1234";
const NEW_USER = "demo-new@intervium.app";
const POWER_USER = "demo-power@intervium.app";
const DAY = 24 * 60 * 60 * 1000;

const DEMO_Q = "Explain how you would design a rate limiter.";
const DEMO_A = "Token bucket / sliding window, with tradeoffs.";

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

  // Upsert the two demo users.
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const email of [NEW_USER, POWER_USER]) {
    await db
      .insert(schema.users)
      .values({ email, passwordHash, role: "user" })
      .onConflictDoNothing({ target: schema.users.email });
  }
  const users = await db
    .select()
    .from(schema.users)
    .where(inArray(schema.users.email, [NEW_USER, POWER_USER]));
  const idOf = (email: string) => users.find((u) => u.email === email)!.id;
  const newId = idOf(NEW_USER);
  const powerId = idOf(POWER_USER);

  // Wipe any prior demo sessions (children first) so this is idempotent.
  const priorSessions = await db
    .select({ id: schema.interviewSessions.id })
    .from(schema.interviewSessions)
    .where(inArray(schema.interviewSessions.userId, [newId, powerId]));
  if (priorSessions.length) {
    const ids = priorSessions.map((s) => s.id);
    await db
      .delete(schema.sessionQuestions)
      .where(inArray(schema.sessionQuestions.sessionId, ids));
    await db
      .delete(schema.interviewSessions)
      .where(inArray(schema.interviewSessions.id, ids));
  }

  if (clean) {
    await db
      .delete(schema.profiles)
      .where(inArray(schema.profiles.userId, [newId, powerId]));
    await db
      .delete(schema.users)
      .where(inArray(schema.users.id, [newId, powerId]));
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

  await db
    .insert(schema.profiles)
    .values({
      userId: newId,
      ...profile("Maya Chen", 1, ["JavaScript", "React", "CSS"], null),
    })
    .onConflictDoUpdate({
      target: schema.profiles.userId,
      set: {
        ...profile("Maya Chen", 1, ["JavaScript", "React", "CSS"], null),
        updatedAt: new Date(),
      },
    });

  const powerSkills = [
    "React",
    "TypeScript",
    "Node.js",
    "GraphQL",
    "PostgreSQL",
    "System Design",
  ];
  const powerCv =
    "Senior software developer with 6 years building web platforms.";
  await db
    .insert(schema.profiles)
    .values({
      userId: powerId,
      ...profile("Alex Rivera", 6, powerSkills, powerCv),
    })
    .onConflictDoUpdate({
      target: schema.profiles.userId,
      set: {
        ...profile("Alex Rivera", 6, powerSkills, powerCv),
        updatedAt: new Date(),
      },
    });

  // Power user: 6 completed + scored sessions (upward trend) + 1 in-progress.
  const completed = [
    { total: 30, daysAgo: 35, mode: "bank" as const },
    { total: 34, daysAgo: 28, mode: "ai" as const },
    { total: 38, daysAgo: 21, mode: "bank" as const },
    { total: 40, daysAgo: 14, mode: "ai" as const },
    { total: 44, daysAgo: 7, mode: "bank" as const },
    { total: 46, daysAgo: 2, mode: "ai" as const },
  ];
  const MAX = 50;
  const Q = 5;

  for (const c of completed) {
    const when = new Date(Date.now() - c.daysAgo * DAY);
    const [session] = await db
      .insert(schema.interviewSessions)
      .values({
        userId: powerId,
        mode: c.mode,
        jobRoleId: role.id,
        techStackId: stack.id,
        skillLevel: c.mode === "ai" ? "advanced" : null,
        questionCount: Q,
        status: "completed",
        totalScore: c.total,
        maxScore: MAX,
        summary: "Solid answers with room to deepen system-design detail.",
        scoredAt: when,
        startedAt: when,
        completedAt: when,
      })
      .returning();

    // Spread the total across Q answered, self-contained transcript rows.
    const base = Math.floor(c.total / Q);
    const rem = c.total - base * Q;
    await db.insert(schema.sessionQuestions).values(
      Array.from({ length: Q }).map((_, i) => ({
        sessionId: session.id,
        bankQuestionId: null,
        questionText: DEMO_Q,
        idealAnswer: DEMO_A,
        modality: "text" as const,
        position: i,
        userAnswer: "Demo answer.",
        score: base + (i < rem ? 1 : 0),
        maxScore: 10,
        answeredAt: when,
      })),
    );
  }

  // One in-progress session → drives the "Resume" button.
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

  console.log("\n✅ Demo data ready.");
  console.log("   New user:   demo-new@intervium.app   /  Demo@1234");
  console.log("   Power user: demo-power@intervium.app /  Demo@1234");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Demo seed failed:", error);
    process.exit(1);
  });
