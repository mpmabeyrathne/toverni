import type {
    BrowserSession,
  } from '../browser/index.js';
  
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
    session: BrowserSession;
  
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
  
  export async function runExplorationLoop(
    input: RunExplorationLoopInput,
  ): Promise<RunExplorationLoopResult> {
    const initialObservation =
      await input.session.observe();
  
    let currentObservation =
      initialObservation;
  
    await input.analyzeObservation?.(
      currentObservation,
    );
  
    const initialStateResult =
      input.stateModel
        .registerObservation(
          currentObservation,
        );
  
    let currentState =
      initialStateResult.state;
  
    let currentPersistedState =
      await input.repository
        .saveState(
          input.applicationId,
          currentState,
        );
  
    await input.repository
      .saveObservationEvidence(
        input.runId,
        currentPersistedState.id,
        currentObservation,
      );
  
    let stopReason:
      string | null = null;
  
    while (true) {
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
        });
  
      const persistedDecision =
        await input.repository
          .saveDecision(
            input.runId,
            currentPersistedState.id,
            decision,
          );
  
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
  
      input.planner
        .recordActionExecution(
          selected,
        );
  
      const nextObservation =
        await input.session.observe();
  
      await input.analyzeObservation?.(
        nextObservation,
      );
  
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
  
      await input.repository
        .saveObservationEvidence(
          input.runId,
          persistedToState.id,
          nextObservation,
        );
  
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
  
      currentObservation =
        nextObservation;
  
      currentState =
        transitionResult.toState;
  
      currentPersistedState =
        persistedToState;
    }
  
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