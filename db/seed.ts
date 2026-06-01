import { config } from "dotenv";
config({ path: ".env.local" });

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Baseline data for the two-mode interview model. Idempotent — existing rows
 * are left in place, so it is safe to re-run.
 * Run with: npm run db:seed
 */

const ADMIN_EMAIL = "wasimaslam2897@gmail.com";
const ACCESS_CODES = ["INTV-2K7Q4", "INTV-9F3X1", "INTV-5M8Z6"];

/** A few curated bank questions so a Question Bank interview works out of the box. */
const BANK_QUESTIONS: {
  techStack: string;
  category: "technical" | "behavioral";
  modality: "text" | "coding";
  questionText: string;
  idealAnswer: string;
}[] = [
  {
    techStack: "React",
    category: "technical",
    modality: "text",
    questionText:
      "Explain the difference between useMemo and useCallback, and when each is actually worth using.",
    idealAnswer:
      "- useMemo memoizes a computed value; useCallback memoizes a function reference.\n- Both take a dependency array and only recompute when deps change.\n- They matter when an expensive computation runs every render, or when a stable reference keeps memoized children / effect deps from re-firing.\n- They are NOT free — each adds bookkeeping — so reach for them only after profiling shows a real cost.",
  },
  {
    techStack: "Node.js",
    category: "behavioral",
    modality: "text",
    questionText:
      "Tell me about a time you had to make a backend change under significant time pressure. How did you balance speed and quality?",
    idealAnswer:
      "- Uses a concrete STAR situation: the deadline, the stakes, and the specific tradeoffs made.\n- Shows pragmatic prioritization (shipping behind a flag, deferring non-critical refactors, targeted tests on the risky path).\n- Communicates risk to stakeholders and has a rollback plan.\n- Reflects on the outcome and what they'd do differently.",
  },
  {
    techStack: "Node.js",
    category: "technical",
    modality: "coding",
    questionText:
      "Implement `firstNonRepeating(str)` that returns the first character that appears exactly once in the string, or null if there is none. Example: firstNonRepeating('aabbc') === 'c'.",
    idealAnswer:
      "function firstNonRepeating(str) {\n  const counts = new Map();\n  for (const ch of str) counts.set(ch, (counts.get(ch) ?? 0) + 1);\n  for (const ch of str) if (counts.get(ch) === 1) return ch;\n  return null;\n}\n// O(n) time, O(k) space. Two passes: count, then scan in order.",
  },
];

/**
 * Non-technical professions so the app demonstrates multi-profession support
 * (Feature 11) out of the box. Each gets a profession_type that switches the
 * interview generation/scoring to domain-appropriate (non-coding) framing.
 */
const NON_TECHNICAL_PROFESSIONS: {
  name: string;
  slug: string;
  description: string;
  professionType: "hr" | "sales" | "marketing";
  sortOrder: number;
  specializations: string[];
  questions: {
    specialization: string;
    category: "technical" | "behavioral";
    questionText: string;
    idealAnswer: string;
  }[];
}[] = [
  {
    name: "HR",
    slug: "hr",
    description: "Human resources, people operations, and talent.",
    professionType: "hr",
    sortOrder: 10,
    specializations: [
      "Recruitment",
      "Employee Relations",
      "Talent Acquisition",
    ],
    questions: [
      {
        specialization: "Recruitment",
        category: "technical",
        questionText:
          "Walk me through how you'd design a structured interview process to reduce bias for a high-volume role.",
        idealAnswer:
          "- Start from a job analysis: define the competencies the role actually needs.\n- Use the same structured questions and a defined scorecard for every candidate.\n- Train interviewers and run calibration sessions to align on what 'good' looks like.\n- Use diverse interview panels and blind early-stage screening where feasible.\n- Track funnel metrics (pass-through, adverse impact) and iterate.\n- Document decisions to keep the process consistent, fair, and defensible.",
      },
      {
        specialization: "Employee Relations",
        category: "behavioral",
        questionText:
          "Tell me about a time you handled a sensitive conflict between two employees. How did you approach it?",
        idealAnswer:
          "- Concrete STAR situation with the tension and stakes.\n- Listened to both sides separately, stayed neutral, focused on behaviour not personality.\n- Referenced policy fairly and kept appropriate confidentiality.\n- Drove to a concrete, documented resolution and a follow-up check-in.\n- Reflects on the outcome and prevention going forward.",
      },
    ],
  },
  {
    name: "Sales",
    slug: "sales",
    description: "Revenue, pipeline, and customer acquisition.",
    professionType: "sales",
    sortOrder: 11,
    specializations: ["B2B Sales", "SaaS Sales", "Enterprise Sales"],
    questions: [
      {
        specialization: "B2B Sales",
        category: "technical",
        questionText:
          "How do you qualify a B2B lead? Walk through the framework you use and why.",
        idealAnswer:
          "- Names a framework (e.g. BANT or MEDDIC) and applies it, not just recites it.\n- Runs real discovery: the prospect's pain, impact, and desired outcome.\n- Confirms budget, decision process, and timeline; identifies the economic buyer and a champion.\n- Disqualifies fast when there's no fit, to protect pipeline quality.\n- Ties qualification to next steps and a mutual action plan.",
      },
      {
        specialization: "SaaS Sales",
        category: "behavioral",
        questionText:
          "Describe a deal you lost. What happened, and what did you change afterward?",
        idealAnswer:
          "- Honest STAR account of a real loss, without blaming the prospect.\n- Diagnoses the actual cause (late champion, wrong stakeholders, weak value case).\n- Shows a concrete change to process or messaging afterward.\n- Demonstrates resilience and a data-informed view of the pipeline.",
      },
    ],
  },
  {
    name: "Marketing",
    slug: "marketing",
    description: "Growth, brand, content, and demand generation.",
    professionType: "marketing",
    sortOrder: 12,
    specializations: ["SEO", "Content Marketing", "Performance Marketing"],
    questions: [
      {
        specialization: "SEO",
        category: "technical",
        questionText:
          "Organic traffic for a site has plateaued. How would you approach diagnosing and growing it?",
        idealAnswer:
          "- Audit the basics first: indexation, crawlability, site architecture, Core Web Vitals.\n- Analyse keyword intent and content gaps vs. competitors; prune or consolidate thin pages.\n- Strengthen internal linking and earn authoritative backlinks.\n- Match content to search intent and refresh decaying top pages.\n- Define measurement (rankings, impressions, conversions) and prioritise by impact/effort.",
      },
      {
        specialization: "Performance Marketing",
        category: "behavioral",
        questionText:
          "Tell me about a campaign that underperformed. How did you respond?",
        idealAnswer:
          "- STAR account with the target, the gap, and the spend at risk.\n- Investigated funnel stage by stage (impressions → CTR → conversion) to localise the problem.\n- Ran disciplined tests (creative, audience, landing page) rather than guessing.\n- Reallocated budget to what worked and communicated honestly to stakeholders.\n- Captured the learning for future campaigns.",
      },
    ],
  },
];

function resolveAdminPassword(): { password: string; generated: boolean } {
  const fromEnv = process.env.ADMIN_PASSWORD;
  if (fromEnv && fromEnv.length > 0)
    return { password: fromEnv, generated: false };
  return { password: randomBytes(24).toString("base64url"), generated: true };
}

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

  // 1) Admin user (idempotent; existing admin keeps its password).
  const { password: adminPassword, generated } = resolveAdminPassword();
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await db
    .insert(schema.users)
    .values({ email: ADMIN_EMAIL, passwordHash, role: "admin" })
    .onConflictDoNothing({ target: schema.users.email });
  const [admin] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, ADMIN_EMAIL));

  console.log("\n👤 Admin user:");
  console.log(`   email: ${admin.email}`);
  console.log(
    generated
      ? "   notice: no ADMIN_PASSWORD set — a random password was generated. Reset it via the admin panel."
      : "   notice: rotate the admin password after first login if it's a shared default.",
  );

  // 2) Job role.
  await db
    .insert(schema.jobRoles)
    .values({
      name: "Software Developer",
      slug: "software-developer",
      description: "Builds and maintains software applications.",
      sortOrder: 1,
    })
    .onConflictDoNothing({ target: schema.jobRoles.slug });
  const [jobRole] = await db
    .select()
    .from(schema.jobRoles)
    .where(eq(schema.jobRoles.slug, "software-developer"));

  // 3) Tech stacks.
  const existingStacks = await db
    .select()
    .from(schema.techStacks)
    .where(eq(schema.techStacks.jobRoleId, jobRole.id));
  if (existingStacks.length === 0) {
    await db.insert(schema.techStacks).values(
      ["React", "React Native", "Node.js", "MongoDB"].map((name) => ({
        jobRoleId: jobRole.id,
        name,
      })),
    );
  }

  // 4) Curated bank questions (idempotent by role+tech+text).
  let inserted = 0;
  for (const q of BANK_QUESTIONS) {
    const [stack] = await db
      .select()
      .from(schema.techStacks)
      .where(
        and(
          eq(schema.techStacks.jobRoleId, jobRole.id),
          eq(schema.techStacks.name, q.techStack),
        ),
      );
    if (!stack) continue;

    const [exists] = await db
      .select({ id: schema.bankQuestions.id })
      .from(schema.bankQuestions)
      .where(
        and(
          eq(schema.bankQuestions.roleId, jobRole.id),
          eq(schema.bankQuestions.techStackId, stack.id),
          eq(schema.bankQuestions.questionText, q.questionText),
        ),
      );
    if (exists) continue;

    await db.insert(schema.bankQuestions).values({
      roleId: jobRole.id,
      techStackId: stack.id,
      category: q.category,
      modality: q.modality,
      questionText: q.questionText,
      idealAnswer: q.idealAnswer,
      isActive: true,
    });
    inserted++;
  }
  if (inserted > 0) console.log(`\n📚 Seeded ${inserted} bank question(s).`);

  // 4b) Non-technical professions (Feature 11), idempotent like the above.
  let profInserted = 0;
  for (const prof of NON_TECHNICAL_PROFESSIONS) {
    await db
      .insert(schema.jobRoles)
      .values({
        name: prof.name,
        slug: prof.slug,
        description: prof.description,
        professionType: prof.professionType,
        sortOrder: prof.sortOrder,
      })
      .onConflictDoNothing({ target: schema.jobRoles.slug });
    const [role] = await db
      .select()
      .from(schema.jobRoles)
      .where(eq(schema.jobRoles.slug, prof.slug));
    if (!role) continue;

    const existing = await db
      .select()
      .from(schema.techStacks)
      .where(eq(schema.techStacks.jobRoleId, role.id));
    const have = new Set(existing.map((s) => s.name));
    const toAdd = prof.specializations.filter((name) => !have.has(name));
    if (toAdd.length > 0) {
      await db
        .insert(schema.techStacks)
        .values(toAdd.map((name) => ({ jobRoleId: role.id, name })));
    }

    for (const q of prof.questions) {
      const [stack] = await db
        .select()
        .from(schema.techStacks)
        .where(
          and(
            eq(schema.techStacks.jobRoleId, role.id),
            eq(schema.techStacks.name, q.specialization),
          ),
        );
      if (!stack) continue;
      const [exists] = await db
        .select({ id: schema.bankQuestions.id })
        .from(schema.bankQuestions)
        .where(
          and(
            eq(schema.bankQuestions.roleId, role.id),
            eq(schema.bankQuestions.techStackId, stack.id),
            eq(schema.bankQuestions.questionText, q.questionText),
          ),
        );
      if (exists) continue;
      await db.insert(schema.bankQuestions).values({
        roleId: role.id,
        techStackId: stack.id,
        category: q.category,
        modality: "text",
        questionText: q.questionText,
        idealAnswer: q.idealAnswer,
        isActive: true,
      });
      profInserted++;
    }
  }
  if (profInserted > 0)
    console.log(`🧑‍💼 Seeded ${profInserted} non-technical bank question(s).`);

  // 5) Access codes.
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db
    .insert(schema.accessCodes)
    .values(
      ACCESS_CODES.map((code) => ({ code, createdBy: admin.id, expiresAt })),
    )
    .onConflictDoNothing({ target: schema.accessCodes.code });

  // 6) Report.
  const [roleRows, stackRows, qRows, codeRows] = await Promise.all([
    db.select().from(schema.jobRoles),
    db.select().from(schema.techStacks),
    db.select().from(schema.bankQuestions),
    db.select().from(schema.accessCodes),
  ]);
  console.log("\n💼 job_roles:", roleRows.map((r) => r.name).join(", "));
  console.log("🧰 tech_stacks:", stackRows.map((r) => r.name).join(", "));
  console.log(`📚 bank_questions: ${qRows.length}`);
  console.log("🔑 access_codes:", codeRows.map((r) => r.code).join(", "));
  console.log("\n✅ Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  });
