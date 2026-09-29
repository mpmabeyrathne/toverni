import {
  randomUUID,
} from 'node:crypto';

import type {
  PageObservation,
} from '../contracts/page-observation.js';

import {
  applicationStateNodeSchema,
  applicationTransitionSchema,
  type ApplicationStateNode,
  type ApplicationTransition,
  type TransitionAction,
} from './application-state.js';

import {
  createStateFingerprint,
} from './state-fingerprint.js';

export interface StateDeduplicationDecision {
  matchedExistingState:
  boolean;

  canonicalStateId:
  string;

  fingerprint:
  string;

  routePattern:
  string;

  observedUrl:
  string;

  reason:
  | 'new-structural-state'
  | 'structural-fingerprint-match';
}

export interface RegisterObservationResult {
  state:
  ApplicationStateNode;

  isNew:
  boolean;

  deduplication:
  StateDeduplicationDecision;
}

export interface RecordTransitionInput {
  before: PageObservation;

  after: PageObservation;

  action: TransitionAction;
}

export interface RecordTransitionResult {
  transition:
  ApplicationTransition;

  fromState:
  ApplicationStateNode;

  toState:
  ApplicationStateNode;

  fromStateIsNew:
  boolean;

  toStateIsNew:
  boolean;
  fromStateDeduplication:
  StateDeduplicationDecision;

  toStateDeduplication:
  StateDeduplicationDecision;
}

export class ApplicationStateModel {
  private readonly states =
    new Map<
      string,
      ApplicationStateNode
    >();

  private readonly transitions:
    ApplicationTransition[] = [];

  private readonly transitionKeys =
    new Set<string>();

  registerObservation(
    observation: PageObservation,
  ): RegisterObservationResult {
    const result =
      createStateFingerprint(
        observation,
      );

    const existing =
      this.states.get(
        result.fingerprint,
      );

    const now =
      new Date().toISOString();

    if (existing) {
      const updated =
        applicationStateNodeSchema.parse({
          ...existing,

          // Keep the first concrete
          // observation as the stable
          // representative of this
          // canonical structural state.
          lastSeenAt:
            now,

          visits:
            existing.visits + 1,
        });

      this.states.set(
        result.fingerprint,
        updated,
      );

      return {
        state:
          updated,

        isNew:
          false,

        deduplication: {
          matchedExistingState:
            true,

          canonicalStateId:
            updated.id,

          fingerprint:
            result.fingerprint,

          routePattern:
            result.routePattern,

          observedUrl:
            observation.url,

          reason:
            'structural-fingerprint-match',
        },
      };
    }
    const state =
      applicationStateNodeSchema.parse({
        id:
          result.fingerprint,

        fingerprint:
          result.fingerprint,

        routePattern:
          result.routePattern,

        url:
          observation.url,

        title:
          observation.title,

        firstSeenAt:
          now,

        lastSeenAt:
          now,

        visits: 1,

        observation,
      });

    this.states.set(
      result.fingerprint,
      state,
    );

    return {
      state,

      isNew:
        true,

      deduplication: {
        matchedExistingState:
          false,

        canonicalStateId:
          state.id,

        fingerprint:
          result.fingerprint,

        routePattern:
          result.routePattern,

        observedUrl:
          observation.url,

        reason:
          'new-structural-state',
      },
    };
  }

  recordTransition(
    input: RecordTransitionInput,
  ): RecordTransitionResult {
    const beforeResult =
      this.registerObservation(
        input.before,
      );

    const afterResult =
      this.registerObservation(
        input.after,
      );

    const equivalentState =
      beforeResult.state.id ===
      afterResult.state.id;

    const actionSignature =
      JSON.stringify(
        input.action,
      );

    const transitionKey = [
      beforeResult.state.id,

      actionSignature,

      afterResult.state.id,
    ].join('::');

    const duplicate =
      this.transitionKeys.has(
        transitionKey,
      );

    const transition =
      applicationTransitionSchema.parse({
        id:
          randomUUID(),

        fromStateId:
          beforeResult.state.id,

        toStateId:
          afterResult.state.id,

        action:
          input.action,

        occurredAt:
          new Date().toISOString(),

        equivalentState,

        explorationBlocked:
          equivalentState ||
          duplicate,

        beforeObservation:
          input.before,

        afterObservation:
          input.after,

        evidence: {
          networkEvents: [
            ...input.after
              .networkEvents,
          ],

          consoleEvents: [
            ...input.after
              .consoleEvents,
          ],
        },
      });

    if (!duplicate) {
      this.transitions.push(
        transition,
      );

      this.transitionKeys.add(
        transitionKey,
      );
    }

    return {
      transition,
    
      fromState:
        beforeResult.state,
    
      toState:
        afterResult.state,
    
      fromStateIsNew:
        beforeResult.isNew,
    
      toStateIsNew:
        afterResult.isNew,
    
      fromStateDeduplication:
        beforeResult
          .deduplication,
    
      toStateDeduplication:
        afterResult
          .deduplication,
    };
  }

  hasSeenObservation(
    observation: PageObservation,
  ): boolean {
    const result =
      createStateFingerprint(
        observation,
      );

    return this.states.has(
      result.fingerprint,
    );
  }

  shouldExploreObservation(
    observation: PageObservation,
  ): boolean {
    return !this.hasSeenObservation(
      observation,
    );
  }

  getState(
    id: string,
  ):
    | ApplicationStateNode
    | undefined {
    return this.states.get(id);
  }

  getStates():
    ApplicationStateNode[] {
    return [
      ...this.states.values(),
    ];
  }

  getTransitions():
    ApplicationTransition[] {
    return [
      ...this.transitions,
    ];
  }

  getStateCount(): number {
    return this.states.size;
  }

  getTransitionCount():
    number {
    return this.transitions.length;
  }
}