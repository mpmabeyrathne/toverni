CREATE TABLE "application_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"route_pattern" text NOT NULL,
	"latest_url" text NOT NULL,
	"latest_title" text NOT NULL,
	"visit_count" integer DEFAULT 1 NOT NULL,
	"observation" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"state_id" uuid,
	"transition_id" uuid,
	"type" varchar(32) NOT NULL,
	"path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "console_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"state_id" uuid,
	"transition_id" uuid,
	"type" varchar(16) NOT NULL,
	"text" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exploration_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"state_id" uuid NOT NULL,
	"signature" text NOT NULL,
	"label" text NOT NULL,
	"type" varchar(32) NOT NULL,
	"target" jsonb,
	"score" integer NOT NULL,
	"reasons" jsonb NOT NULL,
	"blocked" boolean NOT NULL,
	"block_reasons" jsonb NOT NULL,
	"previously_visited" boolean NOT NULL,
	"graph_visit_count" integer NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exploration_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"state_id" uuid NOT NULL,
	"selected_action_id" uuid,
	"should_stop" boolean NOT NULL,
	"stop_reason" varchar(64),
	"selected_score" integer,
	"reasons" jsonb NOT NULL,
	"ranked_candidates" jsonb NOT NULL,
	"decided_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exploration_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"entry_url" text NOT NULL,
	"status" varchar(32) DEFAULT 'running' NOT NULL,
	"context" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "network_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"state_id" uuid,
	"transition_id" uuid,
	"request_id" text NOT NULL,
	"method" varchar(16) NOT NULL,
	"url" text NOT NULL,
	"resource_type" varchar(64) NOT NULL,
	"status" integer,
	"ok" boolean,
	"failed" boolean NOT NULL,
	"failure_text" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"from_state_id" uuid NOT NULL,
	"to_state_id" uuid NOT NULL,
	"action_id" uuid,
	"action_type" varchar(32) NOT NULL,
	"action_target" text,
	"equivalent_state" boolean NOT NULL,
	"exploration_blocked" boolean NOT NULL,
	"before_observation" jsonb NOT NULL,
	"after_observation" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application_states" ADD CONSTRAINT "application_states_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_run_id_exploration_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."exploration_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_state_id_application_states_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."application_states"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_transition_id_transitions_id_fk" FOREIGN KEY ("transition_id") REFERENCES "public"."transitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_events" ADD CONSTRAINT "console_events_run_id_exploration_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."exploration_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_events" ADD CONSTRAINT "console_events_state_id_application_states_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."application_states"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_events" ADD CONSTRAINT "console_events_transition_id_transitions_id_fk" FOREIGN KEY ("transition_id") REFERENCES "public"."transitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exploration_actions" ADD CONSTRAINT "exploration_actions_run_id_exploration_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."exploration_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exploration_actions" ADD CONSTRAINT "exploration_actions_state_id_application_states_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."application_states"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exploration_decisions" ADD CONSTRAINT "exploration_decisions_run_id_exploration_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."exploration_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exploration_decisions" ADD CONSTRAINT "exploration_decisions_state_id_application_states_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."application_states"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exploration_decisions" ADD CONSTRAINT "exploration_decisions_selected_action_id_exploration_actions_id_fk" FOREIGN KEY ("selected_action_id") REFERENCES "public"."exploration_actions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exploration_runs" ADD CONSTRAINT "exploration_runs_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_events" ADD CONSTRAINT "network_events_run_id_exploration_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."exploration_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_events" ADD CONSTRAINT "network_events_state_id_application_states_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."application_states"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_events" ADD CONSTRAINT "network_events_transition_id_transitions_id_fk" FOREIGN KEY ("transition_id") REFERENCES "public"."transitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transitions" ADD CONSTRAINT "transitions_run_id_exploration_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."exploration_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transitions" ADD CONSTRAINT "transitions_from_state_id_application_states_id_fk" FOREIGN KEY ("from_state_id") REFERENCES "public"."application_states"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transitions" ADD CONSTRAINT "transitions_to_state_id_application_states_id_fk" FOREIGN KEY ("to_state_id") REFERENCES "public"."application_states"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transitions" ADD CONSTRAINT "transitions_action_id_exploration_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."exploration_actions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "application_states_app_fingerprint_uidx" ON "application_states" USING btree ("application_id","fingerprint");--> statement-breakpoint
CREATE INDEX "application_states_application_idx" ON "application_states" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_base_url_uidx" ON "applications" USING btree ("base_url");--> statement-breakpoint
CREATE UNIQUE INDEX "exploration_actions_run_state_signature_uidx" ON "exploration_actions" USING btree ("run_id","state_id","signature");--> statement-breakpoint
CREATE INDEX "exploration_actions_state_idx" ON "exploration_actions" USING btree ("state_id");--> statement-breakpoint
CREATE INDEX "exploration_runs_application_idx" ON "exploration_runs" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "network_events_run_idx" ON "network_events" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "transitions_run_idx" ON "transitions" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "transitions_from_state_idx" ON "transitions" USING btree ("from_state_id");