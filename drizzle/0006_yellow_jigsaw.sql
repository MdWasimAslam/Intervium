ALTER TYPE "public"."interview_type" ADD VALUE 'coding';--> statement-breakpoint
ALTER TYPE "public"."question_type" ADD VALUE 'coding';--> statement-breakpoint
ALTER TABLE "questions_cache" ADD COLUMN "language" text;