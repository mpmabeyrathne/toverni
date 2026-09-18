import {
    boolean,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
  } from 'drizzle-orm/pg-core';
  
  import type {
    BrowserTarget,
  } from '../browser/browser-target.js';
  
  import type {
    PageObservation,
  } from '../contracts/page-observation.js';
  
  import type {
    ExplorationCandidate,
  } from '../exploration/exploration-contracts.js';
  
  export const applications =
    pgTable(
      'applications',
  
      {
        id:
          uuid('id')
            .defaultRandom()
            .primaryKey(),
  
        name:
          text('name')
            .notNull(),
  
        baseUrl:
          text('base_url')
            .notNull(),
  
        createdAt:
          timestamp(
            'created_at',
            {
              withTimezone: true,
            },
          )
            .defaultNow()
            .notNull(),
  
        updatedAt:
          timestamp(
            'updated_at',
            {
              withTimezone: true,
            },
          )
            .defaultNow()
            .notNull(),
      },
  
      (table) => [
        uniqueIndex(
          'applications_base_url_uidx',
        ).on(
          table.baseUrl,
        ),
      ],
    );
  
  export const explorationRuns =
    pgTable(
      'exploration_runs',
  
      {
        id:
          uuid('id')
            .defaultRandom()
            .primaryKey(),
  
        applicationId:
          uuid(
            'application_id',
          )
            .notNull()
            .references(
              () =>
                applications.id,
              {
                onDelete:
                  'cascade',
              },
            ),
  
        entryUrl:
          text('entry_url')
            .notNull(),
  
        status:
          varchar(
            'status',
            {
              length: 32,
            },
          )
            .default(
              'running',
            )
            .notNull(),
  
        context:
          jsonb('context')
            .$type<
              Record<
                string,
                unknown
              >
            >(),
  
        startedAt:
          timestamp(
            'started_at',
            {
              withTimezone: true,
            },
          )
            .defaultNow()
            .notNull(),
  
        completedAt:
          timestamp(
            'completed_at',
            {
              withTimezone: true,
            },
          ),
      },
  
      (table) => [
        index(
          'exploration_runs_application_idx',
        ).on(
          table.applicationId,
        ),
      ],
    );
  
  export const applicationStates =
    pgTable(
      'application_states',
  
      {
        id:
          uuid('id')
            .defaultRandom()
            .primaryKey(),
  
        applicationId:
          uuid(
            'application_id',
          )
            .notNull()
            .references(
              () =>
                applications.id,
              {
                onDelete:
                  'cascade',
              },
            ),
  
        fingerprint:
          text(
            'fingerprint',
          )
            .notNull(),
  
        routePattern:
          text(
            'route_pattern',
          )
            .notNull(),
  
        latestUrl:
          text(
            'latest_url',
          )
            .notNull(),
  
        latestTitle:
          text(
            'latest_title',
          )
            .notNull(),
  
        visitCount:
          integer(
            'visit_count',
          )
            .default(1)
            .notNull(),
  
        observation:
          jsonb(
            'observation',
          )
            .$type<
              PageObservation
            >()
            .notNull(),
  
        firstSeenAt:
          timestamp(
            'first_seen_at',
            {
              withTimezone: true,
            },
          )
            .notNull(),
  
        lastSeenAt:
          timestamp(
            'last_seen_at',
            {
              withTimezone: true,
            },
          )
            .notNull(),
      },
  
      (table) => [
        uniqueIndex(
          'application_states_app_fingerprint_uidx',
        ).on(
          table.applicationId,
          table.fingerprint,
        ),
  
        index(
          'application_states_application_idx',
        ).on(
          table.applicationId,
        ),
      ],
    );
  
  export const explorationActions =
    pgTable(
      'exploration_actions',
  
      {
        id:
          uuid('id')
            .defaultRandom()
            .primaryKey(),
  
        runId:
          uuid(
            'run_id',
          )
            .notNull()
            .references(
              () =>
                explorationRuns.id,
              {
                onDelete:
                  'cascade',
              },
            ),
  
        stateId:
          uuid(
            'state_id',
          )
            .notNull()
            .references(
              () =>
                applicationStates.id,
              {
                onDelete:
                  'cascade',
              },
            ),
  
        signature:
          text(
            'signature',
          )
            .notNull(),
  
        label:
          text('label')
            .notNull(),
  
        type:
          varchar(
            'type',
            {
              length: 32,
            },
          )
            .notNull(),
  
        target:
          jsonb('target')
            .$type<
              BrowserTarget | null
            >(),
  
        score:
          integer('score')
            .notNull(),
  
        reasons:
          jsonb('reasons')
            .$type<
              string[]
            >()
            .notNull(),
  
        blocked:
          boolean('blocked')
            .notNull(),
  
        blockReasons:
          jsonb(
            'block_reasons',
          )
            .$type<
              string[]
            >()
            .notNull(),
  
        previouslyVisited:
          boolean(
            'previously_visited',
          )
            .notNull(),
  
        graphVisitCount:
          integer(
            'graph_visit_count',
          )
            .notNull(),
  
        discoveredAt:
          timestamp(
            'discovered_at',
            {
              withTimezone: true,
            },
          )
            .defaultNow()
            .notNull(),
      },
  
      (table) => [
        uniqueIndex(
          'exploration_actions_run_state_signature_uidx',
        ).on(
          table.runId,
          table.stateId,
          table.signature,
        ),
  
        index(
          'exploration_actions_state_idx',
        ).on(
          table.stateId,
        ),
      ],
    );
  
  export const transitions =
    pgTable(
      'transitions',
  
      {
        id:
          uuid('id')
            .defaultRandom()
            .primaryKey(),
  
        runId:
          uuid(
            'run_id',
          )
            .notNull()
            .references(
              () =>
                explorationRuns.id,
              {
                onDelete:
                  'cascade',
              },
            ),
  
        fromStateId:
          uuid(
            'from_state_id',
          )
            .notNull()
            .references(
              () =>
                applicationStates.id,
            ),
  
        toStateId:
          uuid(
            'to_state_id',
          )
            .notNull()
            .references(
              () =>
                applicationStates.id,
            ),
  
        actionId:
          uuid(
            'action_id',
          )
            .references(
              () =>
                explorationActions.id,
              {
                onDelete:
                  'set null',
              },
            ),
  
        actionType:
          varchar(
            'action_type',
            {
              length: 32,
            },
          )
            .notNull(),
  
        actionTarget:
          text(
            'action_target',
          ),
  
        equivalentState:
          boolean(
            'equivalent_state',
          )
            .notNull(),
  
        explorationBlocked:
          boolean(
            'exploration_blocked',
          )
            .notNull(),
  
        beforeObservation:
          jsonb(
            'before_observation',
          )
            .$type<
              PageObservation
            >()
            .notNull(),
  
        afterObservation:
          jsonb(
            'after_observation',
          )
            .$type<
              PageObservation
            >()
            .notNull(),
  
        occurredAt:
          timestamp(
            'occurred_at',
            {
              withTimezone: true,
            },
          )
            .notNull(),
      },
  
      (table) => [
        index(
          'transitions_run_idx',
        ).on(
          table.runId,
        ),
  
        index(
          'transitions_from_state_idx',
        ).on(
          table.fromStateId,
        ),
      ],
    );
  
  export const networkEvents =
    pgTable(
      'network_events',
  
      {
        id:
          uuid('id')
            .defaultRandom()
            .primaryKey(),
  
        runId:
          uuid(
            'run_id',
          )
            .notNull()
            .references(
              () =>
                explorationRuns.id,
              {
                onDelete:
                  'cascade',
              },
            ),
  
        stateId:
          uuid(
            'state_id',
          )
            .references(
              () =>
                applicationStates.id,
            ),
  
        transitionId:
          uuid(
            'transition_id',
          )
            .references(
              () =>
                transitions.id,
              {
                onDelete:
                  'cascade',
              },
            ),
  
        requestId:
          text(
            'request_id',
          )
            .notNull(),
  
        method:
          varchar(
            'method',
            {
              length: 16,
            },
          )
            .notNull(),
  
        url:
          text('url')
            .notNull(),
  
        resourceType:
          varchar(
            'resource_type',
            {
              length: 64,
            },
          )
            .notNull(),
  
        status:
          integer(
            'status',
          ),
  
        ok:
          boolean('ok'),
  
        failed:
          boolean(
            'failed',
          )
            .notNull(),
  
        failureText:
          text(
            'failure_text',
          ),
  
        capturedAt:
          timestamp(
            'captured_at',
            {
              withTimezone: true,
            },
          )
            .defaultNow()
            .notNull(),
      },
  
      (table) => [
        index(
          'network_events_run_idx',
        ).on(
          table.runId,
        ),
      ],
    );
  
  export const consoleEvents =
    pgTable(
      'console_events',
  
      {
        id:
          uuid('id')
            .defaultRandom()
            .primaryKey(),
  
        runId:
          uuid(
            'run_id',
          )
            .notNull()
            .references(
              () =>
                explorationRuns.id,
              {
                onDelete:
                  'cascade',
              },
            ),
  
        stateId:
          uuid(
            'state_id',
          )
            .references(
              () =>
                applicationStates.id,
            ),
  
        transitionId:
          uuid(
            'transition_id',
          )
            .references(
              () =>
                transitions.id,
              {
                onDelete:
                  'cascade',
              },
            ),
  
        type:
          varchar(
            'type',
            {
              length: 16,
            },
          )
            .notNull(),
  
        text:
          text('text')
            .notNull(),
  
        occurredAt:
          timestamp(
            'occurred_at',
            {
              withTimezone: true,
            },
          )
            .notNull(),
      },
    );
  
  export const artifacts =
    pgTable(
      'artifacts',
  
      {
        id:
          uuid('id')
            .defaultRandom()
            .primaryKey(),
  
        runId:
          uuid(
            'run_id',
          )
            .notNull()
            .references(
              () =>
                explorationRuns.id,
              {
                onDelete:
                  'cascade',
              },
            ),
  
        stateId:
          uuid(
            'state_id',
          )
            .references(
              () =>
                applicationStates.id,
            ),
  
        transitionId:
          uuid(
            'transition_id',
          )
            .references(
              () =>
                transitions.id,
              {
                onDelete:
                  'cascade',
              },
            ),
  
        type:
          varchar(
            'type',
            {
              length: 32,
            },
          )
            .notNull(),
  
        path:
          text('path')
            .notNull(),
  
        createdAt:
          timestamp(
            'created_at',
            {
              withTimezone: true,
            },
          )
            .defaultNow()
            .notNull(),
      },
    );
  
  export const explorationDecisions =
    pgTable(
      'exploration_decisions',
  
      {
        id:
          uuid('id')
            .defaultRandom()
            .primaryKey(),
  
        runId:
          uuid(
            'run_id',
          )
            .notNull()
            .references(
              () =>
                explorationRuns.id,
              {
                onDelete:
                  'cascade',
              },
            ),
  
        stateId:
          uuid(
            'state_id',
          )
            .notNull()
            .references(
              () =>
                applicationStates.id,
            ),
  
        selectedActionId:
          uuid(
            'selected_action_id',
          )
            .references(
              () =>
                explorationActions.id,
              {
                onDelete:
                  'set null',
              },
            ),
  
        shouldStop:
          boolean(
            'should_stop',
          )
            .notNull(),
  
        stopReason:
          varchar(
            'stop_reason',
            {
              length: 64,
            },
          ),
  
        selectedScore:
          integer(
            'selected_score',
          ),
  
        reasons:
          jsonb('reasons')
            .$type<
              string[]
            >()
            .notNull(),
  
        rankedCandidates:
          jsonb(
            'ranked_candidates',
          )
            .$type<
              ExplorationCandidate[]
            >()
            .notNull(),
  
        decidedAt:
          timestamp(
            'decided_at',
            {
              withTimezone: true,
            },
          )
            .notNull(),
      },
    );