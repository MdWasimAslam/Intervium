ALTER TABLE "interview_sessions" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD COLUMN "scored_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "session_questions" ADD COLUMN "feedback_detail" jsonb;