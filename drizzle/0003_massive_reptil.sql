CREATE TABLE "generated_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"scenario_id" uuid NOT NULL,
	"generation_status" text NOT NULL,
	"reason" text,
	"source_file_path" text,
	"source_code" text,
	"execution_status" text DEFAULT 'not_run' NOT NULL,
	"exit_code" integer,
	"duration_ms" real,
	"stdout" text,
	"stderr" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generated_tests" ADD CONSTRAINT "generated_tests_run_id_exploration_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."exploration_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_tests" ADD CONSTRAINT "generated_tests_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_tests" ADD CONSTRAINT "generated_tests_scenario_id_generated_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."generated_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generated_tests_run_idx" ON "generated_tests" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "generated_tests_scenario_idx" ON "generated_tests" USING btree ("scenario_id");