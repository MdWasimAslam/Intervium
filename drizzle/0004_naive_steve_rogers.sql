CREATE TABLE "app_settings" (
	"id" text PRIMARY KEY DEFAULT 'global' NOT NULL,
	"default_timer_seconds" integer DEFAULT 120 NOT NULL,
	"question_counts" jsonb DEFAULT '[3,5,10]'::jsonb NOT NULL,
	"transcription_provider" text DEFAULT 'webspeech' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions_cache" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;