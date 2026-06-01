ALTER TABLE "difficulty_bands" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "focus_areas" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "questions_cache" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "difficulty_bands" CASCADE;--> statement-breakpoint
DROP TABLE "focus_areas" CASCADE;--> statement-breakpoint
DROP TABLE "questions_cache" CASCADE;--> statement-breakpoint
ALTER TABLE "session_questions" DROP CONSTRAINT "session_questions_session_id_question_id_key";--> statement-breakpoint
-- NOTE: the focus_area_id and question_id FK constraints are already removed by
-- the CASCADE table drops above, so they are intentionally NOT dropped again.
DROP INDEX "interview_sessions_focus_area_id_idx";--> statement-breakpoint
DROP INDEX "session_questions_session_id_idx";--> statement-breakpoint
DROP INDEX "session_questions_question_id_idx";--> statement-breakpoint
ALTER TABLE "session_questions" ALTER COLUMN "question_text" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "session_questions" ALTER COLUMN "ideal_answer" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "session_questions" ALTER COLUMN "modality" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "interview_sessions" DROP COLUMN "focus_area_id";--> statement-breakpoint
ALTER TABLE "interview_sessions" DROP COLUMN "interview_type";--> statement-breakpoint
ALTER TABLE "interview_sessions" DROP COLUMN "difficulty";--> statement-breakpoint
ALTER TABLE "session_questions" DROP COLUMN "question_id";--> statement-breakpoint
ALTER TABLE "session_questions" ADD CONSTRAINT "session_questions_session_id_position_key" UNIQUE("session_id","position");--> statement-breakpoint
DROP TYPE "public"."interview_type";--> statement-breakpoint
DROP TYPE "public"."question_source";