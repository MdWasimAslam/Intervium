CREATE TYPE "public"."dojo_attempt_status" AS ENUM('passed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."dojo_confidence" AS ENUM('again', 'hard', 'good', 'easy');--> statement-breakpoint
CREATE TYPE "public"."dojo_difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TABLE "dojo_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"code" text NOT NULL,
	"status" "dojo_attempt_status" NOT NULL,
	"tests_passed" integer DEFAULT 0 NOT NULL,
	"tests_total" integer DEFAULT 0 NOT NULL,
	"runtime_ms" integer,
	"hints_used" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dojo_progress" (
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"solved" boolean DEFAULT false NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempted_at" timestamp with time zone,
	"solved_at" timestamp with time zone,
	"ease" integer DEFAULT 250 NOT NULL,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone,
	"last_confidence" "dojo_confidence",
	CONSTRAINT "dojo_progress_user_id_question_id_pk" PRIMARY KEY("user_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "dojo_question_topics" (
	"question_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	CONSTRAINT "dojo_question_topics_question_id_topic_id_pk" PRIMARY KEY("question_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "dojo_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"difficulty" "dojo_difficulty" NOT NULL,
	"starter_code" text NOT NULL,
	"fn_name" text NOT NULL,
	"test_cases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dojo_questions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "dojo_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "dojo_topics_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "dojo_attempts" ADD CONSTRAINT "dojo_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dojo_attempts" ADD CONSTRAINT "dojo_attempts_question_id_dojo_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."dojo_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dojo_progress" ADD CONSTRAINT "dojo_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dojo_progress" ADD CONSTRAINT "dojo_progress_question_id_dojo_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."dojo_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dojo_question_topics" ADD CONSTRAINT "dojo_question_topics_question_id_dojo_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."dojo_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dojo_question_topics" ADD CONSTRAINT "dojo_question_topics_topic_id_dojo_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."dojo_topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dojo_questions" ADD CONSTRAINT "dojo_questions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dojo_attempts_user_question_idx" ON "dojo_attempts" USING btree ("user_id","question_id","created_at");--> statement-breakpoint
CREATE INDEX "dojo_progress_user_due_idx" ON "dojo_progress" USING btree ("user_id","due_at");--> statement-breakpoint
CREATE INDEX "dojo_question_topics_topic_idx" ON "dojo_question_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "dojo_questions_difficulty_idx" ON "dojo_questions" USING btree ("difficulty");