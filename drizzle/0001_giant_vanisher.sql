CREATE TABLE "model_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"task" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"reasoning_tier" text NOT NULL,
	"prompt_tokens" integer NOT NULL,
	"completion_tokens" integer NOT NULL,
	"total_tokens" integer NOT NULL,
	"estimated_cost_usd" real NOT NULL,
	"duration_ms" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "model_usage_events" ADD CONSTRAINT "model_usage_events_run_id_exploration_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."exploration_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_usage_run_idx" ON "model_usage_events" USING btree ("run_id");