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
} from '../state/index.js';

import {
  DeterministicExplorationPlanner,
} from './deterministic-exploration-planner.js';

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

export async function runExplorationLoop(
  input:
    RunExplorationLoopInput,
): Promise<RunExplorationLoopResult> {
  // --------------------------------
  // Initial observation
  // --------------------------------

  const initialObservation =
    await input.session.observe();

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

  await input.repository
    .saveObservationEvidence(
      input.runId,
      currentPersistedState.id,
      currentObservation,
    );

  let stopReason:
    string | null = null;

    const seenNetworkEventIds =
  new Set<string>();
  // --------------------------------
  // Multi-step exploration loop
  // --------------------------------

  while (true) {
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
    await executeExplorationAction(
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
      await input.session.observe();

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

          action: {
            type:
              'click',

            target:
              selected.label,
          },
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