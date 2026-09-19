CREATE TABLE "generated_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"title" text NOT NULL,
	"scenario_type" text NOT NULL,
	"preconditions" jsonb NOT NULL,
	"actions" jsonb NOT NULL,
	"expected_outcomes" jsonb NOT NULL,
	"evidence_references" jsonb NOT NULL,
	"relevance" integer NOT NULL,
	"risk" integer NOT NULL,
	"confidence" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generated_scenarios" ADD CONSTRAINT "generated_scenarios_run_id_exploration_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."exploration_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_scenarios" ADD CONSTRAINT "generated_scenarios_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generated_scenarios_run_idx" ON "generated_scenarios" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "generated_scenarios_application_idx" ON "generated_scenarios" USING btree ("application_id");