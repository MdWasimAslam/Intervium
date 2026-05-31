ALTER TABLE "difficulty_bands" ADD CONSTRAINT "difficulty_bands_job_role_id_label_key" UNIQUE("job_role_id","label");--> statement-breakpoint
ALTER TABLE "focus_areas" ADD CONSTRAINT "focus_areas_job_role_id_name_key" UNIQUE("job_role_id","name");--> statement-breakpoint
ALTER TABLE "session_questions" ADD CONSTRAINT "session_questions_session_id_question_id_key" UNIQUE("session_id","question_id");--> statement-breakpoint
ALTER TABLE "tech_stacks" ADD CONSTRAINT "tech_stacks_job_role_id_name_key" UNIQUE("job_role_id","name");