CREATE TABLE "ai_cv_cache" (
	"cache_key" text PRIMARY KEY NOT NULL,
	"feature" text NOT NULL,
	"result" jsonb NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_cv_cache_feature_created_idx" ON "ai_cv_cache" USING btree ("feature","created_at");