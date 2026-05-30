CREATE TYPE "public"."question_source" AS ENUM('ai', 'admin');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('text', 'voice', 'either');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."session_mode" AS ENUM('text', 'voice');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('in_progress', 'completed');--> statement-breakpoint
CREATE TABLE "access_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"is_used" boolean DEFAULT false NOT NULL,
	"used_by" uuid,
	"created_by" uuid,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "difficulty_bands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_role_id" uuid NOT NULL,
	"label" text NOT NULL,
	"min_years" integer,
	"max_years" integer
);
--> statement-breakpoint
CREATE TABLE "focus_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_role_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_role_id" uuid NOT NULL,
	"tech_stack_id" uuid NOT NULL,
	"focus_area_id" uuid NOT NULL,
	"difficulty" text NOT NULL,
	"question_count" integer NOT NULL,
	"mode" "session_mode" NOT NULL,
	"timer_enabled" boolean DEFAULT false NOT NULL,
	"status" "session_status" DEFAULT 'in_progress' NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL,
	"max_score" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "job_roles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"primary_role" uuid,
	"years_experience" integer DEFAULT 0 NOT NULL,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cv_text" text,
	"onboarding" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_role_id" uuid NOT NULL,
	"tech_stack_id" uuid NOT NULL,
	"focus_area_id" uuid NOT NULL,
	"difficulty" text NOT NULL,
	"type" "question_type" NOT NULL,
	"question_text" text NOT NULL,
	"ideal_answer" text NOT NULL,
	"signature" text NOT NULL,
	"source" "question_source" DEFAULT 'ai' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"user_answer" text,
	"transcript" text,
	"score" integer DEFAULT 0 NOT NULL,
	"max_score" integer DEFAULT 10 NOT NULL,
	"feedback" text,
	"time_taken_seconds" integer,
	"answered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tech_stacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_role_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "access_codes" ADD CONSTRAINT "access_codes_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_codes" ADD CONSTRAINT "access_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "difficulty_bands" ADD CONSTRAINT "difficulty_bands_job_role_id_job_roles_id_fk" FOREIGN KEY ("job_role_id") REFERENCES "public"."job_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_areas" ADD CONSTRAINT "focus_areas_job_role_id_job_roles_id_fk" FOREIGN KEY ("job_role_id") REFERENCES "public"."job_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_job_role_id_job_roles_id_fk" FOREIGN KEY ("job_role_id") REFERENCES "public"."job_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_tech_stack_id_tech_stacks_id_fk" FOREIGN KEY ("tech_stack_id") REFERENCES "public"."tech_stacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_focus_area_id_focus_areas_id_fk" FOREIGN KEY ("focus_area_id") REFERENCES "public"."focus_areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_primary_role_job_roles_id_fk" FOREIGN KEY ("primary_role") REFERENCES "public"."job_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions_cache" ADD CONSTRAINT "questions_cache_job_role_id_job_roles_id_fk" FOREIGN KEY ("job_role_id") REFERENCES "public"."job_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions_cache" ADD CONSTRAINT "questions_cache_tech_stack_id_tech_stacks_id_fk" FOREIGN KEY ("tech_stack_id") REFERENCES "public"."tech_stacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions_cache" ADD CONSTRAINT "questions_cache_focus_area_id_focus_areas_id_fk" FOREIGN KEY ("focus_area_id") REFERENCES "public"."focus_areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_questions" ADD CONSTRAINT "session_questions_session_id_interview_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."interview_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_questions" ADD CONSTRAINT "session_questions_question_id_questions_cache_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions_cache"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tech_stacks" ADD CONSTRAINT "tech_stacks_job_role_id_job_roles_id_fk" FOREIGN KEY ("job_role_id") REFERENCES "public"."job_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "questions_cache_signature_idx" ON "questions_cache" USING btree ("signature");