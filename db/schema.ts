import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const questionTypeEnum = pgEnum("question_type", [
  "text",
  "voice",
  "either",
  // Answered in the code editor and graded with a code-aware rubric.
  "coding",
]);
export const questionSourceEnum = pgEnum("question_source", ["ai", "admin"]);
export const sessionModeEnum = pgEnum("session_mode", ["text", "voice"]);
export const interviewTypeEnum = pgEnum("interview_type", [
  "technical",
  "behavioral",
  "mixed",
  // Coding interviews serve only coding questions (editor + code rubric).
  "coding",
]);
export const sessionStatusEnum = pgEnum("session_status", [
  "in_progress",
  "completed",
]);

/* -------------------------------------------------------------------------- */
/* users                                                                      */
/* -------------------------------------------------------------------------- */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("user"),
  // Deactivated users cannot log in.
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* -------------------------------------------------------------------------- */
/* access_codes                                                               */
/* -------------------------------------------------------------------------- */
export const accessCodes = pgTable(
  "access_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    isUsed: boolean("is_used").notNull().default(false),
    usedBy: uuid("used_by").references(() => users.id),
    createdBy: uuid("created_by").references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("access_codes_used_by_idx").on(table.usedBy)],
);

/* -------------------------------------------------------------------------- */
/* job_roles                                                                  */
/* -------------------------------------------------------------------------- */
export const jobRoles = pgTable("job_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

/* -------------------------------------------------------------------------- */
/* focus_areas                                                                */
/* -------------------------------------------------------------------------- */
export const focusAreas = pgTable(
  "focus_areas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobRoleId: uuid("job_role_id")
      .notNull()
      .references(() => jobRoles.id),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [
    index("focus_areas_job_role_id_idx").on(table.jobRoleId),
    // No two focus areas with the same name under one role.
    unique("focus_areas_job_role_id_name_key").on(table.jobRoleId, table.name),
  ],
);

/* -------------------------------------------------------------------------- */
/* tech_stacks                                                                */
/* -------------------------------------------------------------------------- */
export const techStacks = pgTable(
  "tech_stacks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobRoleId: uuid("job_role_id")
      .notNull()
      .references(() => jobRoles.id),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [
    index("tech_stacks_job_role_id_idx").on(table.jobRoleId),
    // No two tech stacks with the same name under one role.
    unique("tech_stacks_job_role_id_name_key").on(table.jobRoleId, table.name),
  ],
);

/* -------------------------------------------------------------------------- */
/* difficulty_bands                                                           */
/* -------------------------------------------------------------------------- */
export const difficultyBands = pgTable(
  "difficulty_bands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobRoleId: uuid("job_role_id")
      .notNull()
      .references(() => jobRoles.id),
    label: text("label").notNull(),
    minYears: integer("min_years"),
    maxYears: integer("max_years"),
  },
  (table) => [
    index("difficulty_bands_job_role_id_idx").on(table.jobRoleId),
    // A role can't have two bands sharing the same label (backs the app-level
    // overlap check with a race-proof DB constraint).
    unique("difficulty_bands_job_role_id_label_key").on(
      table.jobRoleId,
      table.label,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* profiles                                                                   */
/* -------------------------------------------------------------------------- */
export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  displayName: text("display_name"),
  primaryRole: uuid("primary_role").references(() => jobRoles.id),
  yearsExperience: integer("years_experience").notNull().default(0),
  skills: jsonb("skills")
    .notNull()
    .default(sql`'[]'::jsonb`),
  cvText: text("cv_text"),
  onboarding: jsonb("onboarding")
    .notNull()
    .default(sql`'{}'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* -------------------------------------------------------------------------- */
/* questions_cache                                                            */
/* -------------------------------------------------------------------------- */
export const questionsCache = pgTable(
  "questions_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobRoleId: uuid("job_role_id")
      .notNull()
      .references(() => jobRoles.id),
    techStackId: uuid("tech_stack_id")
      .notNull()
      .references(() => techStacks.id),
    focusAreaId: uuid("focus_area_id")
      .notNull()
      .references(() => focusAreas.id),
    difficulty: text("difficulty").notNull(),
    type: questionTypeEnum("type").notNull(),
    questionText: text("question_text").notNull(),
    idealAnswer: text("ideal_answer").notNull(),
    // Editor language for coding questions (e.g. "javascript", "typescript").
    // Null for non-coding questions.
    language: text("language"),
    // Deterministic hash of job_role + tech_stack + focus_area + difficulty + type.
    signature: text("signature").notNull(),
    source: questionSourceEnum("source").notNull().default("ai"),
    // Inactive questions are excluded from retrieval without being deleted.
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("questions_cache_signature_idx").on(table.signature),
    index("questions_cache_job_role_id_idx").on(table.jobRoleId),
    index("questions_cache_tech_stack_id_idx").on(table.techStackId),
    index("questions_cache_focus_area_id_idx").on(table.focusAreaId),
  ],
);

/* -------------------------------------------------------------------------- */
/* interview_sessions                                                         */
/* -------------------------------------------------------------------------- */
export const interviewSessions = pgTable(
  "interview_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    jobRoleId: uuid("job_role_id")
      .notNull()
      .references(() => jobRoles.id),
    techStackId: uuid("tech_stack_id")
      .notNull()
      .references(() => techStacks.id),
    focusAreaId: uuid("focus_area_id")
      .notNull()
      .references(() => focusAreas.id),
    interviewType: interviewTypeEnum("interview_type")
      .notNull()
      .default("technical"),
    difficulty: text("difficulty").notNull(),
    questionCount: integer("question_count").notNull(),
    mode: sessionModeEnum("mode").notNull(),
    timerEnabled: boolean("timer_enabled").notNull().default(false),
    status: sessionStatusEnum("status").notNull().default("in_progress"),
    totalScore: integer("total_score").notNull().default(0),
    maxScore: integer("max_score").notNull().default(0),
    // One-line AI summary of overall performance, set during scoring.
    summary: text("summary"),
    // Set when scoring finishes; null means "not scored yet".
    scoredAt: timestamp("scored_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    // Hottest lookup: a user's sessions (dashboard, history, ownership checks).
    index("interview_sessions_user_id_idx").on(table.userId),
    // Dashboard "recent scored" ordering: filter by user, sort by scored_at.
    index("interview_sessions_user_scored_idx").on(
      table.userId,
      table.scoredAt,
    ),
    // Admin taxonomy delete-guards count sessions by these foreign keys.
    index("interview_sessions_job_role_id_idx").on(table.jobRoleId),
    index("interview_sessions_tech_stack_id_idx").on(table.techStackId),
    index("interview_sessions_focus_area_id_idx").on(table.focusAreaId),
  ],
);

/* -------------------------------------------------------------------------- */
/* session_questions                                                          */
/* -------------------------------------------------------------------------- */
export const sessionQuestions = pgTable(
  "session_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => interviewSessions.id),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questionsCache.id),
    // 0-based order of the question within the session.
    position: integer("position").notNull().default(0),
    userAnswer: text("user_answer"),
    transcript: text("transcript"),
    score: integer("score").notNull().default(0),
    maxScore: integer("max_score").notNull().default(10),
    feedback: text("feedback"),
    // Structured feedback: { strengths: string[]; improvements: string[] }.
    feedbackDetail: jsonb("feedback_detail").$type<{
      strengths: string[];
      improvements: string[];
    }>(),
    timeTakenSeconds: integer("time_taken_seconds"),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
  },
  (table) => [
    // Every interview/scoring/results read filters rows by session, in order.
    index("session_questions_session_id_idx").on(
      table.sessionId,
      table.position,
    ),
    // "Has any session used this question?" guard before deleting a question.
    index("session_questions_question_id_idx").on(table.questionId),
    // A question appears at most once per session — lets inserts use
    // .onConflictDoNothing() to dedupe safely.
    unique("session_questions_session_id_question_id_key").on(
      table.sessionId,
      table.questionId,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* app_settings (single-row global config)                                    */
/* -------------------------------------------------------------------------- */
export const appSettings = pgTable("app_settings", {
  // Single row, id is always "global".
  id: text("id").primaryKey().default("global"),
  defaultTimerSeconds: integer("default_timer_seconds").notNull().default(120),
  questionCounts: jsonb("question_counts")
    .$type<number[]>()
    .notNull()
    .default(sql`'[3,5,10]'::jsonb`),
  transcriptionProvider: text("transcription_provider")
    .notNull()
    .default("webspeech"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* -------------------------------------------------------------------------- */
/* ai_usage (one row per UTC day — drives the daily AI-call budget guard)      */
/* -------------------------------------------------------------------------- */
export const aiUsage = pgTable("ai_usage", {
  // UTC calendar day, "YYYY-MM-DD". Survives serverless cold starts, so the
  // count is a real running total against Groq's per-day free-tier cap.
  day: text("day").primaryKey(),
  count: integer("count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
