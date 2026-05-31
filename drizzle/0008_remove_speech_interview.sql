ALTER TABLE "questions_cache" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
-- Speech interview removed: collapse the old voice modalities onto text before
-- the enum is narrowed, so existing rows can cast into the new ('text','coding') enum.
UPDATE "questions_cache" SET "type" = 'text' WHERE "type" IN ('voice', 'either');--> statement-breakpoint
DROP TYPE "public"."question_type";--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('text', 'coding');--> statement-breakpoint
ALTER TABLE "questions_cache" ALTER COLUMN "type" SET DATA TYPE "public"."question_type" USING "type"::"public"."question_type";--> statement-breakpoint
ALTER TABLE "app_settings" DROP COLUMN "transcription_provider";--> statement-breakpoint
ALTER TABLE "interview_sessions" DROP COLUMN "mode";--> statement-breakpoint
ALTER TABLE "session_questions" DROP COLUMN "transcript";--> statement-breakpoint
DROP TYPE "public"."session_mode";