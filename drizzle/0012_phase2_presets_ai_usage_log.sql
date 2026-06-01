CREATE TABLE "ai_usage_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"feature" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"status" text DEFAULT 'success' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "timer_presets" jsonb DEFAULT '[{"id":"no-timer","label":"No Timer","seconds":null},{"id":"1min","label":"1 min","seconds":60},{"id":"2min","label":"2 min","seconds":120},{"id":"3min","label":"3 min","seconds":180},{"id":"5min","label":"5 min","seconds":300},{"id":"10min","label":"10 min","seconds":600}]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "default_timer_preset_id" text DEFAULT 'no-timer' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "length_presets" jsonb DEFAULT '[{"id":"quick","label":"Quick","questionCount":5},{"id":"standard","label":"Standard","questionCount":10},{"id":"full","label":"Full","questionCount":20}]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "default_length_preset_id" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD COLUMN "timer_preset_id" text;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD COLUMN "custom_timer_seconds" integer;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD COLUMN "length_preset_id" text;--> statement-breakpoint
ALTER TABLE "ai_usage_log" ADD CONSTRAINT "ai_usage_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_log_created_idx" ON "ai_usage_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_log_feature_created_idx" ON "ai_usage_log" USING btree ("feature","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_log_user_idx" ON "ai_usage_log" USING btree ("user_id");