import { config } from "dotenv";
config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { and, eq, inArray } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
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

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set.");
  const db = drizzle(neon(databaseUrl), { schema });
  const clean = process.argv.includes("--clean");

  // Reference data created by the baseline seed.
  const [role] = await db
    .select()
    .from(schema.jobRoles)
    .where(eq(schema.jobRoles.slug, "software-developer"));
  if (!role) throw new Error("Run `npm run db:seed` first (no job role found).");

  const stacks = await db
    .select()
    .from(schema.techStacks)
    .where(eq(schema.techStacks.jobRoleId, role.id));
  const focuses = await db
    .select()
    .from(schema.focusAreas)
    .where(eq(schema.focusAreas.jobRoleId, role.id));
  const stack = stacks.find((s) => s.name === "React") ?? stacks[0];
  const focus = focuses.find((f) => f.name === "General") ?? focuses[0];
  if (!stack || !focus) throw new Error("Seed tech stacks / focus areas first.");

  // Ensure a question exists for the session_questions FK.
  let [question] = await db
    .select()
    .from(schema.questionsCache)
    .where(eq(schema.questionsCache.signature, "demo-signature"));
  if (!question) {
    [question] = await db
      .insert(schema.questionsCache)
      .values({
        jobRoleId: role.id,
        techStackId: stack.id,
        focusAreaId: focus.id,
        difficulty: "Senior",
        type: "text",
        questionText: "Explain how you would design a rate limiter.",
        idealAnswer: "Token bucket / sliding window, with tradeoffs.",
        signature: "demo-signature",
        source: "admin",
      })
      .returning();
  }

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
  await db
    .insert(schema.profiles)
    .values({
      userId: newId,
      displayName: "Maya Chen",
      primaryRole: role.id,
      yearsExperience: 1,
      skills: ["JavaScript", "React", "CSS"],
      cvText: null,
      onboarding: { completed: true },
    })
    .onConflictDoUpdate({
      target: schema.profiles.userId,
      set: {
        displayName: "Maya Chen",
        primaryRole: role.id,
        yearsExperience: 1,
        skills: ["JavaScript", "React", "CSS"],
        cvText: null,
        onboarding: { completed: true },
        updatedAt: new Date(),
      },
    });

  await db
    .insert(schema.profiles)
    .values({
      userId: powerId,
      displayName: "Alex Rivera",
      primaryRole: role.id,
      yearsExperience: 6,
      skills: [
        "React",
        "TypeScript",
        "Node.js",
        "GraphQL",
        "PostgreSQL",
        "System Design",
        "Jest",
        "Docker",
        "AWS",
        "Redis",
      ],
      cvText: "Senior software developer with 6 years building web platforms.",
      onboarding: { completed: true },
    })
    .onConflictDoUpdate({
      target: schema.profiles.userId,
      set: {
        displayName: "Alex Rivera",
        primaryRole: role.id,
        yearsExperience: 6,
        skills: [
          "React",
          "TypeScript",
          "Node.js",
          "GraphQL",
          "PostgreSQL",
          "System Design",
          "Jest",
          "Docker",
          "AWS",
          "Redis",
        ],
        cvText:
          "Senior software developer with 6 years building web platforms.",
        onboarding: { completed: true },
        updatedAt: new Date(),
      },
    });

  // Power user: 6 completed + scored sessions (upward trend) + 1 in-progress.
  const completed = [
    { total: 30, daysAgo: 35, type: "technical" as const },
    { total: 34, daysAgo: 28, type: "behavioral" as const },
    { total: 38, daysAgo: 21, type: "mixed" as const },
    { total: 40, daysAgo: 14, type: "technical" as const },
    { total: 44, daysAgo: 7, type: "technical" as const },
    { total: 46, daysAgo: 2, type: "mixed" as const },
  ];
  const MAX = 50;
  const Q = 5;

  for (const c of completed) {
    const when = new Date(Date.now() - c.daysAgo * DAY);
    const [session] = await db
      .insert(schema.interviewSessions)
      .values({
        userId: powerId,
        jobRoleId: role.id,
        techStackId: stack.id,
        focusAreaId: focus.id,
        interviewType: c.type,
        difficulty: "Senior",
        questionCount: Q,
        mode: "text",
        status: "completed",
        totalScore: c.total,
        maxScore: MAX,
        summary: "Solid answers with room to deepen system-design detail.",
        scoredAt: when,
        startedAt: when,
        completedAt: when,
      })
      .returning();

    // Spread the total across Q answered questions.
    const base = Math.floor(c.total / Q);
    const rem = c.total - base * Q;
    await db.insert(schema.sessionQuestions).values(
      Array.from({ length: Q }).map((_, i) => ({
        sessionId: session.id,
        questionId: question.id,
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
    jobRoleId: role.id,
    techStackId: stack.id,
    focusAreaId: focus.id,
    interviewType: "technical",
    difficulty: "Senior",
    questionCount: Q,
    mode: "text",
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
