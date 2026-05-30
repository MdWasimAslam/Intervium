CREATE TABLE "ai_usage" (
	"day" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "access_codes_used_by_idx" ON "access_codes" USING btree ("used_by");--> statement-breakpoint
CREATE INDEX "difficulty_bands_job_role_id_idx" ON "difficulty_bands" USING btree ("job_role_id");--> statement-breakpoint
CREATE INDEX "focus_areas_job_role_id_idx" ON "focus_areas" USING btree ("job_role_id");--> statement-breakpoint
CREATE INDEX "interview_sessions_user_id_idx" ON "interview_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "interview_sessions_user_scored_idx" ON "interview_sessions" USING btree ("user_id","scored_at");--> statement-breakpoint
CREATE INDEX "interview_sessions_job_role_id_idx" ON "interview_sessions" USING btree ("job_role_id");--> statement-breakpoint
CREATE INDEX "interview_sessions_tech_stack_id_idx" ON "interview_sessions" USING btree ("tech_stack_id");--> statement-breakpoint
CREATE INDEX "interview_sessions_focus_area_id_idx" ON "interview_sessions" USING btree ("focus_area_id");--> statement-breakpoint
CREATE INDEX "questions_cache_job_role_id_idx" ON "questions_cache" USING btree ("job_role_id");--> statement-breakpoint
CREATE INDEX "questions_cache_tech_stack_id_idx" ON "questions_cache" USING btree ("tech_stack_id");--> statement-breakpoint
CREATE INDEX "questions_cache_focus_area_id_idx" ON "questions_cache" USING btree ("focus_area_id");--> statement-breakpoint
CREATE INDEX "session_questions_session_id_idx" ON "session_questions" USING btree ("session_id","position");--> statement-breakpoint
CREATE INDEX "session_questions_question_id_idx" ON "session_questions" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "tech_stacks_job_role_id_idx" ON "tech_stacks" USING btree ("job_role_id");