import {
  and,
  eq,
  inArray,
} from 'drizzle-orm';

import type {
  PageObservation,
} from '../contracts/page-observation.js';

import type {
  GroundedScenario,
} from '../scenarios/index.js';

import type {
  ModelUsage,
} from '../models/index.js';

import type {
  ExplorationDecision,
} from '../exploration/exploration-contracts.js';

import type {
  ApplicationStateNode,
  ApplicationTransition,
} from '../state/application-state.js';

import type {
  Database,
} from './database.js';

import {
  applicationStates,
  applications,
  artifacts,
  consoleEvents,
  explorationActions,
  explorationDecisions,
  explorationRuns,
  networkEvents,
  transitions,
  modelUsageEvents,
  generatedScenarios,
} from './schema.js';

export class ExplorationRepository {
  constructor(
    private readonly db:
      Database,
  ) { }

  async ensureApplication(
    input: {
      name: string;

      baseUrl: string;
    },
  ) {
    const [application] =
      await this.db
        .insert(
          applications,
        )
        .values({
          name:
            input.name,

          baseUrl:
            input.baseUrl,

          updatedAt:
            new Date(),
        })
        .onConflictDoUpdate({
          target:
            applications.baseUrl,

          set: {
            name:
              input.name,

            updatedAt:
              new Date(),
          },
        })
        .returning();

    if (!application) {
      throw new Error(
        'Failed to create application',
      );
    }

    return application;
  }

  async startRun(
    input: {
      applicationId:
      string;

      entryUrl:
      string;

      context?:
      Record<
        string,
        unknown
      >;
    },
  ) {
    const [run] =
      await this.db
        .insert(
          explorationRuns,
        )
        .values({
          applicationId:
            input.applicationId,

          entryUrl:
            input.entryUrl,

          status:
            'running',

          ...(input.context !==
            undefined
            ? {
              context:
                input.context,
            }
            : {}),
        })
        .returning();

    if (!run) {
      throw new Error(
        'Failed to create exploration run',
      );
    }

    return run;
  }

  async completeRun(
    runId: string,
    status:
      | 'completed'
      | 'failed',
  ): Promise<void> {
    await this.db
      .update(
        explorationRuns,
      )
      .set({
        status,

        completedAt:
          new Date(),
      })
      .where(
        eq(
          explorationRuns.id,
          runId,
        ),
      );
  }

  async saveState(
    applicationId:
      string,

    state:
      ApplicationStateNode,
  ) {
    const [savedState] =
      await this.db
        .insert(
          applicationStates,
        )
        .values({
          applicationId,

          fingerprint:
            state.fingerprint,

          routePattern:
            state.routePattern,

          latestUrl:
            state.url,

          latestTitle:
            state.title,

          visitCount:
            state.visits,

          observation:
            state.observation,

          firstSeenAt:
            new Date(
              state.firstSeenAt,
            ),

          lastSeenAt:
            new Date(
              state.lastSeenAt,
            ),
        })
        .onConflictDoUpdate({
          target: [
            applicationStates
              .applicationId,

            applicationStates
              .fingerprint,
          ],

          set: {
            routePattern:
              state.routePattern,

            latestUrl:
              state.url,

            latestTitle:
              state.title,

            visitCount:
              state.visits,

            observation:
              state.observation,

            lastSeenAt:
              new Date(
                state.lastSeenAt,
              ),
          },
        })
        .returning();

    if (!savedState) {
      throw new Error(
        'Failed to save application state',
      );
    }

    return savedState;
  }

  async saveDecision(
    runId:
      string,

    stateId:
      string,

    decision:
      ExplorationDecision,
  ) {
    const actionIds =
      new Map<
        string,
        string
      >();

    for (
      const candidate of
      decision.rankedCandidates
    ) {
      const [action] =
        await this.db
          .insert(
            explorationActions,
          )
          .values({
            runId,

            stateId,

            signature:
              candidate.signature,

            label:
              candidate.label,

            type:
              candidate.action.type,

            target:
              candidate.target,

            score:
              candidate.score,

            reasons:
              candidate.reasons,

            blocked:
              candidate.blocked,

            blockReasons:
              candidate.blockReasons,

            previouslyVisited:
              candidate.previouslyVisited,

            graphVisitCount:
              candidate.graphVisitCount,
          })
          .onConflictDoUpdate({
            target: [
              explorationActions
                .runId,

              explorationActions
                .stateId,

              explorationActions
                .signature,
            ],

            set: {
              score:
                candidate.score,

              reasons:
                candidate.reasons,

              blocked:
                candidate.blocked,

              blockReasons:
                candidate.blockReasons,

              previouslyVisited:
                candidate.previouslyVisited,

              graphVisitCount:
                candidate.graphVisitCount,
            },
          })
          .returning();

      if (action) {
        actionIds.set(
          candidate.signature,
          action.id,
        );
      }
    }

    const selectedActionId =
      decision.selected
        ? (
          actionIds.get(
            decision
              .selected
              .signature,
          ) ?? null
        )
        : null;

    const [storedDecision] =
      await this.db
        .insert(
          explorationDecisions,
        )
        .values({
          runId,

          stateId,

          selectedActionId,

          shouldStop:
            decision.shouldStop,

          stopReason:
            decision.stopReason,

          selectedScore:
            decision.selected
              ?.score ??
            null,

          reasons:
            decision.selected
              ?.reasons ??
            [],

          rankedCandidates:
            decision
              .rankedCandidates,

          decidedAt:
            new Date(
              decision.decidedAt,
            ),
        })
        .returning();

    if (!storedDecision) {
      throw new Error(
        'Failed to save exploration decision',
      );
    }

    return {
      decision:
        storedDecision,

      selectedActionId,
    };
  }

  async saveObservationEvidence(
    runId:
      string,

    stateId:
      string,

    observation:
      PageObservation,
  ): Promise<void> {
    if (
      observation
        .networkEvents
        .length > 0
    ) {
      await this.db
        .insert(
          networkEvents,
        )
        .values(
          observation
            .networkEvents
            .map(
              (event) => ({
                runId,

                stateId,

                requestId:
                  event.id,

                method:
                  event.method,

                url:
                  event.url,

                resourceType:
                  event
                    .resourceType,

                status:
                  event.status ??
                  null,

                ok:
                  event.ok ??
                  null,

                failed:
                  event.failed,

                failureText:
                  event.failureText ??
                  null,
              }),
            ),
        );
    }

    if (
      observation
        .consoleEvents
        .length > 0
    ) {
      await this.db
        .insert(
          consoleEvents,
        )
        .values(
          observation
            .consoleEvents
            .map(
              (event) => ({
                runId,

                stateId,

                type:
                  event.type,

                text:
                  event.text,

                occurredAt:
                  new Date(
                    event.timestamp,
                  ),
              }),
            ),
        );
    }

    if (
      observation
        .supportingArtifacts
        .length > 0
    ) {
      await this.db
        .insert(
          artifacts,
        )
        .values(
          observation
            .supportingArtifacts
            .map(
              (artifact) => ({
                runId,

                stateId,

                type:
                  artifact.type,

                path:
                  artifact.path,
              }),
            ),
        );
    }
  }

  async saveTransition(
    input: {
      runId: string;

      fromStateId:
      string;

      toStateId:
      string;

      actionId?:
      string | null;

      transition:
      ApplicationTransition;
    },
  ) {
    const [storedTransition] =
      await this.db
        .insert(
          transitions,
        )
        .values({
          runId:
            input.runId,

          fromStateId:
            input.fromStateId,

          toStateId:
            input.toStateId,

          actionId:
            input.actionId ??
            null,

          actionType:
            input.transition
              .action.type,

          actionTarget:
            input.transition
              .action.target ??
            null,

          equivalentState:
            input.transition
              .equivalentState,

          explorationBlocked:
            input.transition
              .explorationBlocked,

          beforeObservation:
            input.transition
              .beforeObservation,

          afterObservation:
            input.transition
              .afterObservation,

          occurredAt:
            new Date(
              input.transition
                .occurredAt,
            ),
        })
        .returning();

    if (!storedTransition) {
      throw new Error(
        'Failed to save transition',
      );
    }

    return storedTransition;
  }

  async getApplicationFlow(
    applicationId:
      string,
  ) {
    const [
      application,
    ] =
      await this.db
        .select()
        .from(
          applications,
        )
        .where(
          eq(
            applications.id,
            applicationId,
          ),
        )
        .limit(1);

    if (!application) {
      return null;
    }

    const runs =
      await this.db
        .select()
        .from(
          explorationRuns,
        )
        .where(
          eq(
            explorationRuns
              .applicationId,

            applicationId,
          ),
        );

    const states =
      await this.db
        .select()
        .from(
          applicationStates,
        )
        .where(
          eq(
            applicationStates
              .applicationId,

            applicationId,
          ),
        );

    if (
      runs.length === 0
    ) {
      return {
        application,

        runs,

        states,

        actions: [],

        transitions: [],

        decisions: [],

        networkEvents: [],

        consoleEvents: [],

        artifacts: [],

        modelUsage: [],

        generatedScenarios: [],
      };
    }

    const runIds =
      runs.map(
        (run) =>
          run.id,
      );

    const [
      actions,
      storedTransitions,
      decisions,
      storedNetworkEvents,
      storedConsoleEvents,
      storedArtifacts,
      storedModelUsage,
      storedGeneratedScenarios,
    ] =
      await Promise.all([
        this.db
          .select()
          .from(
            explorationActions,
          )
          .where(
            inArray(
              explorationActions
                .runId,

              runIds,
            ),
          ),

        this.db
          .select()
          .from(
            transitions,
          )
          .where(
            inArray(
              transitions.runId,

              runIds,
            ),
          ),

        this.db
          .select()
          .from(
            explorationDecisions,
          )
          .where(
            inArray(
              explorationDecisions
                .runId,

              runIds,
            ),
          ),

        this.db
          .select()
          .from(
            networkEvents,
          )
          .where(
            inArray(
              networkEvents.runId,

              runIds,
            ),
          ),

        this.db
          .select()
          .from(
            consoleEvents,
          )
          .where(
            inArray(
              consoleEvents.runId,

              runIds,
            ),
          ),

        this.db
          .select()
          .from(
            artifacts,
          )
          .where(
            inArray(
              artifacts.runId,

              runIds,
            ),
          ),

        this.db
          .select()
          .from(
            modelUsageEvents,
          )
          .where(
            inArray(
              modelUsageEvents
                .runId,

              runIds,
            ),
          ),

        this.db
          .select()
          .from(
            generatedScenarios,
          )
          .where(
            inArray(
              generatedScenarios
                .runId,
              runIds,
            ),
          ),
      ]);

    return {
      application,

      runs,

      states,

      actions,

      transitions:
        storedTransitions,

      decisions,

      networkEvents:
        storedNetworkEvents,

      consoleEvents:
        storedConsoleEvents,

      artifacts:
        storedArtifacts,

      modelUsage:
        storedModelUsage,

      generatedScenarios:
        storedGeneratedScenarios,
    };
  }

  async saveModelUsage(
    runId: string,

    task: string,

    usage: ModelUsage,
  ): Promise<void> {
    await this.db
      .insert(
        modelUsageEvents,
      )
      .values({
        runId,

        task,

        provider:
          usage.provider,

        model:
          usage.model,

        reasoningTier:
          usage.reasoningTier,

        promptTokens:
          usage.promptTokens,

        completionTokens:
          usage.completionTokens,

        totalTokens:
          usage.totalTokens,

        estimatedCostUsd:
          usage.estimatedCostUsd,

        durationMs:
          usage.durationMs,
      });
  }
  async saveGeneratedScenarios(
    runId: string,
    applicationId: string,
    scenarios:
      GroundedScenario[],
  ) {
    if (
      scenarios.length === 0
    ) {
      return [];
    }

    return this.db
      .insert(
        generatedScenarios,
      )
      .values(
        scenarios.map(
          (scenario) => ({
            runId,

            applicationId,

            title:
              scenario.title,

            scenarioType:
              scenario.type,

            preconditions:
              scenario.preconditions,

            actions:
              scenario.actions,

            expectedOutcomes:
              scenario
                .expectedOutcomes,

            evidenceReferences:
              scenario
                .evidenceReferences,

            relevance:
              scenario.relevance,

            risk:
              scenario.risk,

            confidence:
              scenario.confidence,
          }),
        ),
      )
      .returning();
  }
}