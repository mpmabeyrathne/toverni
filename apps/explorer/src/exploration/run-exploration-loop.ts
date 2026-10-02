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

  // --------------------------------
  // Preserve raw observation evidence
  // --------------------------------

  if (
    !input.checkpoint
  ) {
    await input.repository
      .saveObservationEvidence(
        input.runId,
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
      },
    );

  let stopReason:
    string | null = null;

    const seenNetworkEventIds =
  new Set<string>();
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
      seenNetworkEventIds,
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

    const executionResult =
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
          failures +=
            1;
        },
      );

    if (
      executionResult.status !==
      'executed'
    ) {
      stopReason =
        executionResult.reason;

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

    await input.repository
      .saveObservationEvidence(
        input.runId,
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

    finalObservation:
      currentObservation,

    executedActions:
      input.planner
        .getTotalActionsTaken(),

    stopReason,
  };
}