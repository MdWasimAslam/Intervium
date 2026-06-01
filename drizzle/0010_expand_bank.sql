CREATE TYPE "public"."interview_mode" AS ENUM('bank', 'ai');--> statement-breakpoint
CREATE TYPE "public"."question_category" AS ENUM('technical', 'behavioral');--> statement-breakpoint
CREATE TYPE "public"."skill_level" AS ENUM('beginner', 'intermediate', 'advanced', 'expert');--> statement-breakpoint
CREATE TABLE "bank_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"tech_stack_id" uuid NOT NULL,
	"category" "question_category" NOT NULL,
	"modality" "question_type" NOT NULL,
	"question_text" text NOT NULL,
	"ideal_answer" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD COLUMN "mode" "interview_mode" DEFAULT 'ai' NOT NULL;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD COLUMN "skill_level" "skill_level";--> statement-breakpoint
ALTER TABLE "session_questions" ADD COLUMN "bank_question_id" uuid;--> statement-breakpoint
ALTER TABLE "session_questions" ADD COLUMN "question_text" text;--> statement-breakpoint
ALTER TABLE "session_questions" ADD COLUMN "ideal_answer" text;--> statement-breakpoint
ALTER TABLE "session_questions" ADD COLUMN "modality" "question_type";--> statement-breakpoint
ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_role_id_job_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."job_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_tech_stack_id_tech_stacks_id_fk" FOREIGN KEY ("tech_stack_id") REFERENCES "public"."tech_stacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_questions_role_tech_idx" ON "bank_questions" USING btree ("role_id","tech_stack_id","is_active");--> statement-breakpoint
CREATE INDEX "bank_questions_category_idx" ON "bank_questions" USING btree ("category");--> statement-breakpoint
ALTER TABLE "session_questions" ADD CONSTRAINT "session_questions_bank_question_id_bank_questions_id_fk" FOREIGN KEY ("bank_question_id") REFERENCES "public"."bank_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_questions_bank_question_id_idx" ON "session_questions" USING btree ("bank_question_id");--> statement-breakpoint
-- Backfill the new self-contained transcript columns from the question pool
-- that 0011 drops, so historical sessions stay scorable and replayable.
UPDATE "session_questions" sq
   SET "question_text" = qc."question_text",
       "ideal_answer"  = qc."ideal_answer",
       "modality"      = qc."type"
  FROM "questions_cache" qc
 WHERE sq."question_id" = qc."id";