ALTER TABLE "profiles" ADD COLUMN "ats_score" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "ats_review" jsonb;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "ats_cv_hash" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "ats_checked_at" timestamp with time zone;