CREATE TYPE "public"."study_note_rating" AS ENUM('again', 'hard', 'good', 'easy');--> statement-breakpoint
CREATE TABLE "study_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"folder_id" uuid,
	"title" text NOT NULL,
	"content" text,
	"front" text,
	"is_flashcard" boolean DEFAULT false NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"ease" integer DEFAULT 250 NOT NULL,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone,
	"last_rating" "study_note_rating",
	"last_reviewed_at" timestamp with time zone,
	"review_count" integer DEFAULT 0 NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"last_viewed_at" timestamp with time zone,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "study_folders" ADD CONSTRAINT "study_folders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_folders" ADD CONSTRAINT "study_folders_parent_id_study_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."study_folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_notes" ADD CONSTRAINT "study_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_notes" ADD CONSTRAINT "study_notes_folder_id_study_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."study_folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "study_folders_user_parent_idx" ON "study_folders" USING btree ("user_id","parent_id");--> statement-breakpoint
CREATE INDEX "study_notes_user_folder_idx" ON "study_notes" USING btree ("user_id","folder_id");--> statement-breakpoint
CREATE INDEX "study_notes_user_due_idx" ON "study_notes" USING btree ("user_id","due_at");--> statement-breakpoint
CREATE INDEX "study_notes_user_viewed_idx" ON "study_notes" USING btree ("user_id","last_viewed_at");--> statement-breakpoint
CREATE INDEX "study_notes_tags_idx" ON "study_notes" USING gin ("tags");