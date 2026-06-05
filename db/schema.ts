import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { StoredAtsReview } from "../src/lib/cv/types";

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */
export const roleEnum = pgEnum("role", ["user", "admin"]);
// Answer modality: text vs. answered in the code editor (code-aware rubric).
export const questionTypeEnum = pgEnum("question_type", ["text", "coding"]);
export const sessionStatusEnum = pgEnum("session_status", [
  "in_progress",
  "completed",
]);
// The two interview modes. Bank = curated questions; AI = generated live.
export const interviewModeEnum = pgEnum("interview_mode", ["bank", "ai"]);
// Curated question category (content type). Coding lives under `modality`.
export const questionCategoryEnum = pgEnum("question_category", [
  "technical",
  "behavioral",
]);
// AI interview calibration target (replaces the old difficulty bands).
export const skillLevelEnum = pgEnum("skill_level", [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
]);
// Profession category for a job_roles row. Gates the generation/scoring prompts
// so non-technical professions (HR, Sales, …) get domain-appropriate interviews
// instead of software-engineering framing. Existing rows default to "technical".
export const professionTypeEnum = pgEnum("profession_type", [
  "technical",
  "hr",
  "sales",
  "marketing",
  "other",
]);
// Cover-letter generation style (Feature 9).
export const coverLetterTypeEnum = pgEnum("cover_letter_type", [
  "generic",
  "job_specific",
  "company_specific",
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
  // Drives whether interviews for this profession use the technical (coding /
  // tech-stack) prompts or domain-appropriate non-technical ones.
  professionType: professionTypeEnum("profession_type")
    .notNull()
    .default("technical"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

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
  // User-chosen avatar customization: { bg?: string; icon?: string } (ids from
  // avatar-options). Empty object → the generated initials avatar.
  avatar: jsonb("avatar")
    .notNull()
    .default(sql`'{}'::jsonb`),
  onboarding: jsonb("onboarding")
    .notNull()
    .default(sql`'{}'::jsonb`),
  // Latest AI ATS review of the user's CV (the /cv "AI ATS review" panel).
  // Null until the user runs a check; refreshed on every re-check.
  atsScore: integer("ats_score"),
  atsReview: jsonb("ats_review").$type<StoredAtsReview>(),
  // cvFingerprint() of the CV when the review was generated — drives the
  // "your CV changed, re-check" staleness hint.
  atsCvHash: text("ats_cv_hash"),
  atsCheckedAt: timestamp("ats_checked_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* -------------------------------------------------------------------------- */
/* ai_cv_cache — content-addressed cache of CV AI results                     */
/*                                                                            */
/* Makes the CV AI features deterministic from the user's point of view: an   */
/* identical input (CV + JD + feature + model) hashes to the same cacheKey,   */
/* so a repeat returns the stored result with no AI call. Also saves Groq     */
/* quota. Content-addressed, so it never goes "stale" for the same input;     */
/* the model name is folded into the key, so a model upgrade auto-invalidates.*/
/* -------------------------------------------------------------------------- */
export const aiCvCache = pgTable(
  "ai_cv_cache",
  {
    // `${feature}:${model}:${fnv1a(stableStringify(canonicalInput))}`
    cacheKey: text("cache_key").primaryKey(),
    feature: text("feature").notNull(),
    result: jsonb("result").notNull(),
    hitCount: integer("hit_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ai_cv_cache_feature_created_idx").on(table.feature, table.createdAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* bank_questions — the ONLY curated question store                           */
/* -------------------------------------------------------------------------- */
export const bankQuestions = pgTable(
  "bank_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => jobRoles.id),
    techStackId: uuid("tech_stack_id")
      .notNull()
      .references(() => techStacks.id),
    // Content type. Coding is expressed via `modality` below, not here.
    category: questionCategoryEnum("category").notNull(),
    // How the candidate answers. Coding questions default to JavaScript.
    modality: questionTypeEnum("modality").notNull(),
    questionText: text("question_text").notNull(),
    idealAnswer: text("ideal_answer").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Bank-mode selection: random active questions for a (role, tech).
    index("bank_questions_role_tech_idx").on(
      table.roleId,
      table.techStackId,
      table.isActive,
    ),
    index("bank_questions_category_idx").on(table.category),
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
    // Which engine path produced this session's questions.
    mode: interviewModeEnum("mode").notNull().default("ai"),
    jobRoleId: uuid("job_role_id")
      .notNull()
      .references(() => jobRoles.id),
    techStackId: uuid("tech_stack_id")
      .notNull()
      .references(() => techStacks.id),
    // AI-mode calibration target. Null for bank-mode sessions.
    skillLevel: skillLevelEnum("skill_level"),
    questionCount: integer("question_count").notNull(),
    timerEnabled: boolean("timer_enabled").notNull().default(false),
    // Per-session timer/length choices (preset-driven). Null on legacy sessions,
    // which fall back to the global default timer + their stored questionCount.
    timerPresetId: text("timer_preset_id"),
    // Snapshot of the resolved per-question seconds at creation time (null = no
    // timer). Snapshotting means a later admin edit to the presets can't change
    // a session that's already running.
    customTimerSeconds: integer("custom_timer_seconds"),
    lengthPresetId: text("length_preset_id"),
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
    index("interview_sessions_user_id_idx").on(table.userId),
    index("interview_sessions_user_scored_idx").on(
      table.userId,
      table.scoredAt,
    ),
    index("interview_sessions_job_role_id_idx").on(table.jobRoleId),
    index("interview_sessions_tech_stack_id_idx").on(table.techStackId),
  ],
);

/* -------------------------------------------------------------------------- */
/* session_questions — self-contained transcript rows                         */
/* -------------------------------------------------------------------------- */
export const sessionQuestions = pgTable(
  "session_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => interviewSessions.id),
    // The bank question this came from (bank mode only); null for AI questions,
    // which are ephemeral and live only on this transcript.
    bankQuestionId: uuid("bank_question_id").references(() => bankQuestions.id),
    // Question content is stored inline so a session can always be scored and
    // replayed without depending on the (mutable, or absent) source question.
    questionText: text("question_text").notNull(),
    idealAnswer: text("ideal_answer").notNull(),
    modality: questionTypeEnum("modality").notNull(),
    // 0-based order of the question within the session.
    position: integer("position").notNull().default(0),
    userAnswer: text("user_answer"),
    score: integer("score").notNull().default(0),
    maxScore: integer("max_score").notNull().default(10),
    feedback: text("feedback"),
    // Structured feedback: strengths/improvements plus the interviewer rubric
    // breakdown (one of `rubric`/`codeRubric` depending on modality).
    feedbackDetail: jsonb("feedback_detail").$type<{
      strengths: string[];
      improvements: string[];
      // Concepts from the ideal answer the candidate missed (score transparency).
      missingConcepts?: string[];
      // Coding only: a stronger alternative solution, when the model suggests one.
      betterApproach?: string;
      rubric?: {
        technicalAccuracy: number;
        completeness: number;
        communicationClarity: number;
        interviewReadiness: number;
      };
      codeRubric?: {
        correctness: number;
        approach: number;
        edgeCases: number;
        readability: number;
      };
    }>(),
    timeTakenSeconds: integer("time_taken_seconds"),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
  },
  (table) => [
    // Bank-mode "already seen" lookup joins through here by bank_question_id.
    index("session_questions_bank_question_id_idx").on(table.bankQuestionId),
    // Every interview/scoring/results read filters by session, in order — and a
    // question occupies each position at most once (idempotent inserts).
    unique("session_questions_session_id_position_key").on(
      table.sessionId,
      table.position,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* app_settings (single-row global config)                                    */
/* -------------------------------------------------------------------------- */

/** Admin-configurable timer option. `seconds: null` means "No Timer". */
export interface TimerPreset {
  id: string;
  label: string;
  seconds: number | null;
}

/** Admin-configurable interview-length option (Quick / Standard / Full / …). */
export interface LengthPreset {
  id: string;
  label: string;
  questionCount: number;
}

export const appSettings = pgTable("app_settings", {
  // Single row, id is always "global".
  id: text("id").primaryKey().default("global"),
  // Legacy fallback timer (kept so old sessions without a preset still resolve).
  defaultTimerSeconds: integer("default_timer_seconds").notNull().default(120),
  // Legacy raw counts — derived from lengthPresets now, kept for back-compat.
  questionCounts: jsonb("question_counts")
    .$type<number[]>()
    .notNull()
    .default(sql`'[3,5,10]'::jsonb`),
  // Configurable timer presets shown in interview setup (No Timer / 1m / …).
  timerPresets: jsonb("timer_presets")
    .$type<TimerPreset[]>()
    .notNull()
    .default(
      sql`'[{"id":"no-timer","label":"No Timer","seconds":null},{"id":"1min","label":"1 min","seconds":60},{"id":"2min","label":"2 min","seconds":120},{"id":"3min","label":"3 min","seconds":180},{"id":"5min","label":"5 min","seconds":300},{"id":"10min","label":"10 min","seconds":600}]'::jsonb`,
    ),
  defaultTimerPresetId: text("default_timer_preset_id")
    .notNull()
    .default("no-timer"),
  // Configurable interview-length presets (mapped to question counts).
  lengthPresets: jsonb("length_presets")
    .$type<LengthPreset[]>()
    .notNull()
    .default(
      sql`'[{"id":"quick","label":"Quick","questionCount":5},{"id":"standard","label":"Standard","questionCount":10},{"id":"full","label":"Full","questionCount":20}]'::jsonb`,
    ),
  defaultLengthPresetId: text("default_length_preset_id")
    .notNull()
    .default("standard"),
  // Which AI backend powers every smart-tier feature — interview grading,
  // result summaries, and all CV / Code Dojo AI ("groq" | "deepseek"). The
  // column name predates the setting governing all AI (not just scoring). A
  // plain text column (not an enum) so a future provider needs no migration.
  scoringProvider: text("scoring_provider").notNull().default("groq"),
  // Per-feature model overrides: { [featureKey]: { provider, model } }. Empty
  // map = every feature uses the global provider + its tier default (the
  // historical behaviour). Lets an admin route each AI feature to a specific
  // model. JSONB so adding/removing features needs no migration.
  featureModels: jsonb("feature_models")
    .$type<Record<string, { provider: "groq" | "deepseek"; model: string }>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
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

/* -------------------------------------------------------------------------- */
/* ai_usage_log — one row per Groq call (powers the Admin AI Usage dashboard)  */
/* -------------------------------------------------------------------------- */
export const aiUsageLog = pgTable(
  "ai_usage_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable so a logging failure (e.g. a system call with no user) never
    // blocks the AI work it's recording.
    userId: uuid("user_id").references(() => users.id),
    // Which feature triggered the call (question_gen, scoring_text, …).
    feature: text("feature").notNull(),
    // Resolved Groq model name (e.g. "llama-3.1-8b-instant").
    model: text("model").notNull(),
    // Token counts from Groq's `usage` block — null when the API omits them.
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    status: text("status").notNull().default("success"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ai_usage_log_created_idx").on(table.createdAt),
    index("ai_usage_log_feature_created_idx").on(
      table.feature,
      table.createdAt,
    ),
    index("ai_usage_log_user_idx").on(table.userId),
  ],
);

/* -------------------------------------------------------------------------- */
/* cv_versions — snapshots so an optimization never overwrites the original    */
/* (Feature 8). The live/working CV stays in profiles.cv_text; each accepted   */
/* optimization (and the pre-optimization "Original") is snapshotted here.     */
/* -------------------------------------------------------------------------- */
export const cvVersions = pgTable(
  "cv_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    // Human label, e.g. "Original" or "Optimized · 2026-06-01".
    label: text("label").notNull(),
    // Full structured CvData snapshot (see src/lib/cv/types.ts).
    cvData: jsonb("cv_data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cv_versions_user_created_idx").on(table.userId, table.createdAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* cover_letters — saved generated cover letters (Feature 9)                   */
/* -------------------------------------------------------------------------- */
export const coverLetters = pgTable(
  "cover_letters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    letterType: coverLetterTypeEnum("letter_type").notNull(),
    jobTitle: text("job_title").notNull().default(""),
    companyName: text("company_name").notNull().default(""),
    jobDescription: text("job_description").notNull().default(""),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cover_letters_user_created_idx").on(table.userId, table.createdAt),
  ],
);

/* ========================================================================== */
/* Code Dojo — personal coding practice ground (separate from interviews)     */
/* ========================================================================== */

export const dojoDifficultyEnum = pgEnum("dojo_difficulty", [
  "easy",
  "medium",
  "hard",
]);
// A run either passes every test case or it doesn't.
export const dojoAttemptStatusEnum = pgEnum("dojo_attempt_status", [
  "passed",
  "failed",
]);
// Anki-style self-rating that drives the spaced-repetition schedule.
export const dojoConfidenceEnum = pgEnum("dojo_confidence", [
  "again",
  "hard",
  "good",
  "easy",
]);

/** A single function-call test case: call fn(...input) and deep-equal vs expected. */
type DojoTestCase = {
  input: unknown[];
  expected: unknown;
  hidden?: boolean;
};

/* -------------------------------------------------------------------------- */
/* dojo_questions                                                             */
/* -------------------------------------------------------------------------- */
export const dojoQuestions = pgTable(
  "dojo_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    // Problem statement in Markdown.
    prompt: text("prompt").notNull(),
    difficulty: dojoDifficultyEnum("difficulty").notNull(),
    // Code the editor opens with (a function stub the user fills in).
    starterCode: text("starter_code").notNull(),
    // The function the runner calls with each test case's input.
    fnName: text("fn_name").notNull(),
    testCases: jsonb("test_cases")
      .$type<DojoTestCase[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    // NULL = built-in/seeded; otherwise the user who authored it.
    createdBy: uuid("created_by").references(() => users.id),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("dojo_questions_difficulty_idx").on(table.difficulty)],
);

/* -------------------------------------------------------------------------- */
/* dojo_topics                                                                */
/* -------------------------------------------------------------------------- */
export const dojoTopics = pgTable("dojo_topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

/* -------------------------------------------------------------------------- */
/* dojo_question_topics — M:N tags (arrays, strings, hashmaps, DP, …)         */
/* -------------------------------------------------------------------------- */
export const dojoQuestionTopics = pgTable(
  "dojo_question_topics",
  {
    questionId: uuid("question_id")
      .notNull()
      .references(() => dojoQuestions.id),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => dojoTopics.id),
  },
  (table) => [
    primaryKey({ columns: [table.questionId, table.topicId] }),
    index("dojo_question_topics_topic_idx").on(table.topicId),
  ],
);

/* -------------------------------------------------------------------------- */
/* dojo_attempts — full history of every run a user saves                     */
/* -------------------------------------------------------------------------- */
export const dojoAttempts = pgTable(
  "dojo_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    questionId: uuid("question_id")
      .notNull()
      .references(() => dojoQuestions.id),
    code: text("code").notNull(),
    status: dojoAttemptStatusEnum("status").notNull(),
    testsPassed: integer("tests_passed").notNull().default(0),
    testsTotal: integer("tests_total").notNull().default(0),
    runtimeMs: integer("runtime_ms"),
    hintsUsed: integer("hints_used").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("dojo_attempts_user_question_idx").on(
      table.userId,
      table.questionId,
      table.createdAt,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* dojo_progress — per-(user, question) rollup that powers revision           */
/* -------------------------------------------------------------------------- */
export const dojoProgress = pgTable(
  "dojo_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    questionId: uuid("question_id")
      .notNull()
      .references(() => dojoQuestions.id),
    solved: boolean("solved").notNull().default(false),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptedAt: timestamp("last_attempted_at", { withTimezone: true }),
    solvedAt: timestamp("solved_at", { withTimezone: true }),
    // SM-2 lite state (Phase 2). `ease` is the factor ×100 (250 = 2.5).
    ease: integer("ease").notNull().default(250),
    intervalDays: integer("interval_days").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }),
    lastConfidence: dojoConfidenceEnum("last_confidence"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.questionId] }),
    index("dojo_progress_user_due_idx").on(table.userId, table.dueAt),
  ],
);

/* ========================================================================== */
/* STUDY NOTES                                                                */
/* A standalone personal knowledge base: Markdown notes + front/back          */
/* flashcards, organized in a user-built nested folder tree, with free-form   */
/* tags and SM-2 spaced-repetition review. All rows are scoped to one user.   */
/* ========================================================================== */

// Anki-style self-rating that drives the study-note spaced-repetition schedule.
export const studyNoteRatingEnum = pgEnum("study_note_rating", [
  "again",
  "hard",
  "good",
  "easy",
]);

/* -------------------------------------------------------------------------- */
/* study_folders — self-referencing tree (JavaScript > Basics > Closures …)   */
/* -------------------------------------------------------------------------- */
export const studyFolders = pgTable(
  "study_folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    // NULL = a top-level folder. Self-reference makes the tree arbitrary-depth.
    parentId: uuid("parent_id").references((): AnyPgColumn => studyFolders.id),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("study_folders_user_parent_idx").on(table.userId, table.parentId),
  ],
);

/* -------------------------------------------------------------------------- */
/* study_notes — notes & flashcards; SR state lives inline (rows are per-user)*/
/* -------------------------------------------------------------------------- */
export const studyNotes = pgTable(
  "study_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    // NULL = unfiled (lives at the root, outside any folder).
    folderId: uuid("folder_id").references(() => studyFolders.id),
    // The note heading; for a flashcard this doubles as the prompt ("front").
    title: text("title").notNull(),
    // Markdown body for a note; the flashcard "back" / answer for a flashcard.
    content: text("content"),
    // When true, the note enters the spaced-repetition review queue.
    isFlashcard: boolean("is_flashcard").notNull().default(false),
    // Free-form tags, lowercased + deduped on save. Cross-cutting filtering.
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    // SM-2 lite state (only meaningful for flashcards). `ease` is ×100 (250 = 2.5).
    ease: integer("ease").notNull().default(250),
    intervalDays: integer("interval_days").notNull().default(0),
    // Null = brand-new card, due immediately.
    dueAt: timestamp("due_at", { withTimezone: true }),
    lastRating: studyNoteRatingEnum("last_rating"),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    reviewCount: integer("review_count").notNull().default(0),
    // Pinned notes sort to the top of any list.
    isPinned: boolean("is_pinned").notNull().default(false),
    // Powers the "recently viewed" strip and resume affordance.
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("study_notes_user_folder_idx").on(table.userId, table.folderId),
    index("study_notes_user_due_idx").on(table.userId, table.dueAt),
    index("study_notes_user_viewed_idx").on(table.userId, table.lastViewedAt),
    // GIN index over the tags array for fast "contains tag" filtering.
    index("study_notes_tags_idx").using("gin", table.tags),
  ],
);
