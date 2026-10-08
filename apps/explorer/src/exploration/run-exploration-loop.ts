import type {
  BrowserSession,
} from '../browser/index.js';

import type {
  KnowledgeContext,
} from '../knowledge/knowledge-contracts.js';

import {
  linkNetworkEventsToOperations,
} from '../knowledge/api-operation-linker.js';

import {
  logger,
} from '../configuration/logger.js';

import type {
  ExplorationRepository,
} from '../database/index.js';

import {
  ApplicationStateModel,
  type TransitionAction,
} from '../state/index.js';

import {
  DeterministicExplorationPlanner,
} from './deterministic-exploration-planner.js';

import type {
  ExplorationBudget,
  ExplorationCheckpoint,
  ExplorationStopReason,
  ExplorationCandidate,
} from './exploration-contracts.js';

import {
  executeExplorationAction,
} from './execute-exploration-action.js';

type Observation =
  Awaited<
    ReturnType<
      BrowserSession['observe']
    >
  >;

type LoopRepository =
  Pick<
    ExplorationRepository,
    | 'saveState'
    | 'saveObservationEvidence'
    | 'saveDecision'
    | 'saveTransition'
    | 'saveRunCheckpoint'
  >;

export interface RunExplorationLoopInput {
  session:
  BrowserSession;

  stateModel:
  ApplicationStateModel;

  planner:
  DeterministicExplorationPlanner;

  repository:
  LoopRepository;

  applicationId:
  string;

  runId:
  string;

  priorityTerms:
  string[];

  targetOrigin?:
  string;

  knowledge?:
  KnowledgeContext;

  analyzeObservation?: (
    observation: Observation,
  ) => Promise<void>;

  budget:
    ExplorationBudget;

  checkpoint?:
    ExplorationCheckpoint | null;

  retryAttempts?:
    number;

  getModelCallCount?: () =>
    number;
}

export interface RunExplorationLoopResult {
  initialObservation:
  Observation;

  initialStateId:
  string;

  finalObservation:
  Observation;

  executedActions:
  number;

  stopReason:
  string | null;
}

function getContextualApiOperationIds(
  observation:
    Observation,

  knowledge:
    | KnowledgeContext
    | undefined,

  seenNetworkEventIds:
    Set<string>,
): string[] {
  const openApi =
    knowledge?.openApi;

  if (!openApi) {
    return [];
  }

  const freshNetworkEvents =
    observation.networkEvents.filter(
      (event) =>
        !seenNetworkEventIds.has(
          event.id,
        ),
    );

  for (
    const event of
    freshNetworkEvents
  ) {
    seenNetworkEventIds.add(
      event.id,
    );
  }

  const requestBodyOperationIds =
    new Set(
      openApi.operations
        .filter(
          (operation) =>
            operation.requestBody !==
            undefined,
        )
        .map(
          (operation) =>
            operation.operationId,
        ),
    );

  const links =
    linkNetworkEventsToOperations(
      freshNetworkEvents,
      openApi.operations,
    );

  return [
    ...new Set(
      links
        .map(
          (link) =>
            link.operationId,
        )
        .filter(
          (operationId) =>
            requestBodyOperationIds.has(
              operationId,
            ),
        ),
    ),
  ].sort();
}

function createTransitionAction(
  selected:
    ExplorationCandidate,
): TransitionAction {
  const target =
    selected.label;

  switch (
    selected.action.type
  ) {
    case 'input':
    case 'textarea':
    case 'contenteditable':
      if (
        selected.formExecution
          ?.kind ===
        'upload-file'
      ) {
        return {
          type:
            'set-input-files',

          target,

          value:
            selected
              .formExecution
              .file
              .name,
        };
      }

      if (
        selected.formExecution
          ?.kind ===
        'fill'
      ) {
        return {
          type:
            'fill',

          target,

          value:
            selected
              .formExecution
              .value,
        };
      }

      break;

    case 'select':
      if (
        selected.formExecution
          ?.kind ===
        'select'
      ) {
        return {
          type:
            'select',

          target,

          value:
            selected
              .formExecution
              .value,
        };
      }

      break;

    case 'combobox':
    case 'listbox':
      if (
        selected.formExecution
          ?.kind ===
        'fill'
      ) {
        return {
          type:
            'fill',

          target,

          value:
            selected
              .formExecution
              .value,
        };
      }

      if (
        selected.formExecution
          ?.kind ===
        'choose-option'
      ) {
        return {
          type:
            'select',

          target,

          value:
            selected
              .formExecution
              .value,
        };
      }

      break;
  }

  return {
    type:
      'click',

    target,
  };
}

async function withRetry<T>(
  operation:
    () => Promise<T>,

  attempts:
    number,

  onFailure:
    () => void,
): Promise<T> {
  let lastError:
    unknown;

  for (
    let attempt = 1;
    attempt <= attempts;
    attempt += 1
  ) {
    try {
      return await operation();
    } catch (
      error:
        unknown
    ) {
      lastError =
        error;

      onFailure();

      if (
        attempt ===
        attempts
      ) {
        break;
      }
    }
  }

  throw lastError;
}

function runtimeBudgetStop(
  budget:
    ExplorationBudget,

  input: {
    depth:
      number;

    failures:
      number;

    modelCalls:
      number;

    startedAt:
      string;

    stateVisits:
      number;
  },
):
  | ExplorationStopReason
  | null {
  if (
    Date.now() -
      new Date(
        input.startedAt,
      ).getTime() >=
    budget.maxDurationMs
  ) {
    return 'max-duration-reached';
  }

  if (
    input.depth >=
    budget.maxDepth
  ) {
    return 'max-depth-reached';
  }

  if (
    input.stateVisits >=
    budget.maxVisitsPerState
  ) {
    return 'max-visits-per-state-reached';
  }

  if (
    input.failures >=
    budget.maxFailures
  ) {
    return 'max-failures-reached';
  }

  if (
    input.modelCalls >=
    budget.maxModelCalls
  ) {
    return 'max-model-calls-reached';
  }

  return null;
}

export async function runExplorationLoop(
  input:
    RunExplorationLoopInput,
): Promise<RunExplorationLoopResult> {
  // --------------------------------
  // Initial observation
  // --------------------------------

  const retryAttempts =
    input.retryAttempts ??
    2;

  const startedAt =
    input.checkpoint
      ?.startedAt ??
    new Date()
      .toISOString();

  let failures =
    input.checkpoint
      ?.failures ??
    0;

  let depth =
    input.checkpoint
      ?.depth ??
    0;

  let modelCalls =
    input.getModelCallCount?.() ??
    input.checkpoint
      ?.modelCalls ??
    0;

  const completedExecutions =
    [
      ...(
        input.checkpoint
          ?.completedExecutions ??
        []
      ),
    ];

  const frontier =
    [
      ...(
        input.checkpoint
          ?.frontier ??
        []
      ),
    ];

  const persistedNetworkEventIds =
    new Set<string>();

  const persistedConsoleEventKeys =
    new Set<string>();

  const persistedArtifactKeys =
    new Set<string>();

  input.planner
    .restoreExecutionHistory(
      completedExecutions,
    );

  const initialObservation =
    await withRetry(
      () =>
        input.session
          .observe(),
      retryAttempts,
      () => {
        failures +=
          1;
      },
    );

  let currentObservation =
    initialObservation;

  await input.analyzeObservation?.(
    currentObservation,
  );

  // --------------------------------
  // Register initial state
  // --------------------------------

  const initialStateResult =
    input.stateModel
      .registerObservation(
        currentObservation,
      );

  // --------------------------------
  // Inspectable deduplication
  // --------------------------------

  logger.info(
    {
      observedUrl:
        initialStateResult
          .deduplication
          .observedUrl,

      routePattern:
        initialStateResult
          .deduplication
          .routePattern,

      fingerprint:
        initialStateResult
          .deduplication
          .fingerprint,

      canonicalStateId:
        initialStateResult
          .deduplication
          .canonicalStateId,

      matchedExistingState:
        initialStateResult
          .deduplication
          .matchedExistingState,

      reason:
        initialStateResult
          .deduplication
          .reason,
    },
    'Application state deduplication evaluated',
  );

  let currentState =
    initialStateResult.state;

  // --------------------------------
  // Persist initial state
  // --------------------------------

  let currentPersistedState =
    await input.repository
      .saveState(
        input.applicationId,
        currentState,
      );

  const initialStateId =
    currentPersistedState.id;

  const persistFreshObservationEvidence =
    async (
      stateId:
        string,

      observation:
        Observation,
    ): Promise<void> => {
      const freshNetworkEvents =
        observation
          .networkEvents
          .filter(
            (event) =>
              !persistedNetworkEventIds
                .has(
                  event.id,
                ),
          );

      const freshConsoleEvents =
        observation
          .consoleEvents
          .filter(
            (event) => {
              const key =
                [
                  event.timestamp,
                  event.type,
                  event.text,
                ].join(
                  '\u0000',
                );

              return !persistedConsoleEventKeys
                .has(
                  key,
                );
            },
          );

      const freshArtifacts =
        observation
          .supportingArtifacts
          .filter(
            (artifact) => {
              const key =
                [
                  artifact.type,
                  artifact.path,
                ].join(
                  '\u0000',
                );

              return !persistedArtifactKeys
                .has(
                  key,
                );
            },
          );

      if (
        freshNetworkEvents.length ===
          0 &&
        freshConsoleEvents.length ===
          0 &&
        freshArtifacts.length ===
          0
      ) {
        return;
      }

      await input.repository
        .saveObservationEvidence(
          input.runId,
          stateId,
          {
            ...observation,

            networkEvents:
              freshNetworkEvents,

            consoleEvents:
              freshConsoleEvents,

            supportingArtifacts:
              freshArtifacts,
          },
        );

      for (
        const event of
        freshNetworkEvents
      ) {
        persistedNetworkEventIds
          .add(
            event.id,
          );
      }

      for (
        const event of
        freshConsoleEvents
      ) {
        persistedConsoleEventKeys
          .add(
            [
              event.timestamp,
              event.type,
              event.text,
            ].join(
              '\u0000',
            ),
          );
      }

      for (
        const artifact of
        freshArtifacts
      ) {
        persistedArtifactKeys
          .add(
            [
              artifact.type,
              artifact.path,
            ].join(
              '\u0000',
            ),
          );
      }
    };

  // --------------------------------
  // Preserve raw observation evidence
  // --------------------------------

  if (
    !input.checkpoint
  ) {
    await persistFreshObservationEvidence(
      currentPersistedState.id,
      currentObservation,
    );
  }

  await input.repository
    .saveRunCheckpoint(
      input.runId,
      {
        version:
          1,

        currentUrl:
          currentObservation.url,

        depth,

        failures,

        modelCalls,

        startedAt,

        updatedAt:
          new Date()
            .toISOString(),

        completedExecutions,

        frontier,
      },
    );

  let stopReason:
    string | null = null;

  const targetOrigin =
    input.targetOrigin ??
    new URL(
      initialObservation.url,
    ).origin;

  const seenApiNetworkEventIds =
    new Set<string>();

  const restoreFromFrontier =
    async (): Promise<boolean> => {
      while (
        frontier.length >
        0
      ) {
        const next =
          frontier.pop();

        if (!next) {
          return false;
        }

        try {
          await input.session
            .navigate(
              next.url,
            );

          const restoredObservation =
            await withRetry(
              () =>
                input.session
                  .observe(),
              retryAttempts,
              () => {
                failures +=
                  1;
              },
            );

          await input
            .analyzeObservation?.(
              restoredObservation,
            );

          const restoredStateResult =
            input.stateModel
              .registerObservation(
                restoredObservation,
              );

          const restoredPersistedState =
            await input.repository
              .saveState(
                input.applicationId,
                restoredStateResult
                  .state,
              );

          await persistFreshObservationEvidence(
            restoredPersistedState.id,
            restoredObservation,
          );

          currentObservation =
            restoredObservation;

          currentState =
            restoredStateResult
              .state;

          currentPersistedState =
            restoredPersistedState;

          logger.info(
            {
              restoredUrl:
                restoredObservation.url,

              requestedStateId:
                next.stateId,

              restoredStateId:
                restoredStateResult
                  .state.id,

              remainingFrontierStates:
                frontier.length,
            },
            'Restored exploration frontier state',
          );

          return true;
        } catch (
          error:
            unknown
        ) {
          failures +=
            1;

          logger.warn(
            {
              frontierStateId:
                next.stateId,

              frontierUrl:
                next.url,

              error:
                error instanceof
                  Error
                  ? error.message
                  : String(
                      error,
                    ),
            },
            'Failed to restore exploration frontier state; trying next frontier entry',
          );
        }
      }

      return false;
    };

  // --------------------------------
  // Multi-step exploration loop
  // --------------------------------

  while (true) {
    modelCalls =
      input.getModelCallCount?.() ??
      modelCalls;

    const runtimeStop =
      runtimeBudgetStop(
        input.budget,
        {
          depth,
          failures,
          modelCalls,
          startedAt,
          stateVisits:
            currentState.visits,
        },
      );

    if (
      runtimeStop
    ) {
      const stateLocalStop =
        runtimeStop ===
          'max-visits-per-state-reached';

      if (
        stateLocalStop &&
        await restoreFromFrontier()
      ) {
        continue;
      }

      stopReason =
        runtimeStop;

      break;
    }

    // ------------------------------
    // Plan next action
    // ------------------------------
    const apiOperationIds =
    getContextualApiOperationIds(
      currentObservation,
      input.knowledge,
      seenApiNetworkEventIds,
    );

const decision =
  input.planner.plan({
    state:
      currentState,

    observation:
      currentObservation,

    productContext: {
      priorityTerms:
        input.priorityTerms,

      targetOrigin,
    },

    ...(input.knowledge
      ? {
          knowledge:
            input.knowledge,
        }
      : {}),

    ...(apiOperationIds.length >
    0
      ? {
          apiOperationIds,
        }
      : {}),
  });

    const safetySkippedActions =
      decision
        .rankedCandidates
        .filter(
          (candidate) =>
            candidate
              .blockReasons
              .some(
                (reason) =>
                  reason.includes(
                    'unsafe for autonomous exploration',
                  ),
              ),
        )
        .map(
          (candidate) => ({
            label:
              candidate.label,

            reasons:
              candidate
                .blockReasons,
          }),
        );

    if (
      safetySkippedActions.length >
      0
    ) {
      logger.info(
        {
          stateId:
            currentState.id,

          skippedActionCount:
            safetySkippedActions
              .length,

          skippedActions:
            safetySkippedActions,
        },
        'High-impact actions skipped by exploration safety policy',
      );
    }

    // ------------------------------
    // Persist decision
    // ------------------------------

    const persistedDecision =
      await input.repository
        .saveDecision(
          input.runId,
          currentPersistedState.id,
          decision,
        );

    // ------------------------------
    // Stop if no eligible action
    // ------------------------------

    if (
      decision.shouldStop ||
      !decision.selected
    ) {
      const resumableStop =
        decision.stopReason ===
          'no-eligible-actions' ||
        decision.stopReason ===
          'max-actions-per-state-reached';

      if (
        resumableStop &&
        await restoreFromFrontier()
      ) {
        continue;
      }

      stopReason =
        decision.stopReason ??
        'no-selected-action';

      break;
    }

    const selected =
      decision.selected;

    // ------------------------------
    // Execute selected action
    // ------------------------------

    let executionResult:
      Awaited<
        ReturnType<
          typeof executeExplorationAction
        >
      > |
      null = null;

    let executionError:
      unknown;

    try {
      executionResult =
        await withRetry(
          () =>
            executeExplorationAction(
              input.session,
              {
                type:
                  selected.action.type,

                label:
                  selected.label,

                target:
                  selected.target,

                formExecution:
                  selected.formExecution,
              },
            ),
          retryAttempts,
          () => {
            // Retry attempts are not separate
            // exploration failures. The
            // candidate is counted once if
            // all retries are exhausted.
          },
        );
    } catch (
      error:
        unknown
    ) {
      executionError =
        error;

      failures +=
        1;
    }

    if (
      executionError !==
      undefined
    ) {
      input.planner
        .recordActionExecution(
          selected,
        );

      completedExecutions.push({
        stateId:
          selected.stateId,

        signature:
          selected.signature,

        actionType:
          selected.action.type,

        label:
          selected.label,
      });

      logger.warn(
        {
          stateId:
            selected.stateId,

          action:
            selected.label,

          target:
            selected.target,

          failures,

          error:
            executionError instanceof
              Error
              ? {
                  name:
                    executionError
                      .name,

                  message:
                    executionError
                      .message,
                }
              : String(
                  executionError,
                ),
        },
        'Browser action failed after retries; skipping candidate and continuing exploration',
      );

      await input.repository
        .saveRunCheckpoint(
          input.runId,
          {
            version:
              1,

            currentUrl:
              currentObservation.url,

            depth,

            failures,

            modelCalls,

            startedAt,

            updatedAt:
              new Date()
                .toISOString(),

            completedExecutions,

            frontier,
          },
        );

      continue;
    }

    if (
      executionResult?.status !==
      'executed'
    ) {
      stopReason =
        executionResult?.reason ??
        'no-selected-action';

      break;
    }

    // ------------------------------
    // Record executed action
    // ------------------------------

    input.planner
      .recordActionExecution(
        selected,
      );

    // ------------------------------
    // Observe destination
    // ------------------------------

    const nextObservation =
      await withRetry(
        () =>
          input.session
            .observe(),
        retryAttempts,
        () => {
          failures +=
            1;
        },
      );

    await input.analyzeObservation?.(
      nextObservation,
    );

    // ------------------------------
    // Register transition
    // ------------------------------

    const transitionResult =
      input.stateModel
        .recordTransition({
          before:
            currentObservation,

          after:
            nextObservation,

          action:
            createTransitionAction(
              selected,
            ),
        });

    // ------------------------------
    // Inspectable state deduplication
    // ------------------------------

    logger.info(
      {
        observedUrl:
          transitionResult
            .toStateDeduplication
            .observedUrl,

        routePattern:
          transitionResult
            .toStateDeduplication
            .routePattern,

        fingerprint:
          transitionResult
            .toStateDeduplication
            .fingerprint,

        canonicalStateId:
          transitionResult
            .toStateDeduplication
            .canonicalStateId,

        matchedExistingState:
          transitionResult
            .toStateDeduplication
            .matchedExistingState,

        reason:
          transitionResult
            .toStateDeduplication
            .reason,

        fromStateId:
          transitionResult
            .fromState.id,

        toStateId:
          transitionResult
            .toState.id,

        equivalentState:
          transitionResult
            .transition
            .equivalentState,

        explorationBlocked:
          transitionResult
            .transition
            .explorationBlocked,
      },
      'Application state deduplication evaluated',
    );

    // ------------------------------
    // Persist transition states
    // ------------------------------

    const persistedFromState =
      await input.repository
        .saveState(
          input.applicationId,
          transitionResult
            .fromState,
        );

    const persistedToState =
      await input.repository
        .saveState(
          input.applicationId,
          transitionResult
            .toState,
        );

    // ------------------------------
    // Preserve raw destination
    // observation evidence
    // ------------------------------

    await persistFreshObservationEvidence(
      persistedToState.id,
      nextObservation,
    );

    // ------------------------------
    // Persist transition
    // ------------------------------

    await input.repository
      .saveTransition({
        runId:
          input.runId,

        fromStateId:
          persistedFromState.id,

        toStateId:
          persistedToState.id,

        actionId:
          persistedDecision
            .selectedActionId,

        transition:
          transitionResult
            .transition,
      });

    depth +=
      1;

    modelCalls =
      input.getModelCallCount?.() ??
      modelCalls;

    completedExecutions.push({
      stateId:
        selected.stateId,

      signature:
        selected.signature,

      actionType:
        selected.action.type,

      label:
        selected.label,
    });

    if (
      currentObservation.url !==
        nextObservation.url
    ) {
      const hasRemainingSourceActions =
        decision
          .rankedCandidates
          .some(
            (candidate) =>
              !candidate.blocked &&
              candidate.signature !==
                selected.signature,
          );

      const alreadyQueued =
        frontier.some(
          (item) =>
            item.stateId ===
              currentState.id,
        );

      if (
        hasRemainingSourceActions &&
        !alreadyQueued
      ) {
        frontier.push({
          stateId:
            currentState.id,

          url:
            currentObservation.url,
        });
      }
    }

    await input.repository
      .saveRunCheckpoint(
        input.runId,
        {
          version:
            1,

          currentUrl:
            nextObservation.url,

          depth,

          failures,

          modelCalls,

          startedAt,

          updatedAt:
            new Date()
              .toISOString(),

          completedExecutions,

          frontier,
        },
      );

    // ------------------------------
    // Continue from destination
    // ------------------------------

    currentObservation =
      nextObservation;

    currentState =
      transitionResult.toState;

    currentPersistedState =
      persistedToState;
  }

  modelCalls =
    input.getModelCallCount?.() ??
    modelCalls;

  await input.repository
    .saveRunCheckpoint(
      input.runId,
      {
        version:
          1,

        currentUrl:
          currentObservation.url,

        depth,

        failures,

        modelCalls,

        startedAt,

        updatedAt:
          new Date()
            .toISOString(),

        completedExecutions,

        frontier,

        stopReason:
          (
            stopReason as
              ExplorationStopReason |
              null
          ),
      },
    );

  // --------------------------------
  // Result
  // --------------------------------

  return {
    initialObservation,

    initialStateId,

    finalObservation:
      currentObservation,

    executedActions:
      input.planner
        .getTotalActionsTaken(),

    stopReason,
  };
}