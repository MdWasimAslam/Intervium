CREATE TABLE "demo_requests" (
	"email" text PRIMARY KEY NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL,
	"first_requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_requested_at" timestamp with time zone DEFAULT now() NOT NULL
);
