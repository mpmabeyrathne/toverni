import type {
    ConsoleEvent,
    NetworkEvent,
  } from '../contracts/page-observation.js';
  
  import {
    applicationStates,
    consoleEvents,
    networkEvents,
    transitions,
  } from '../database/schema.js';
  
  import {
    applicationStateNodeSchema,
    applicationTransitionSchema,
    type ApplicationStateNode,
    type ApplicationTransition,
  } from './application-state.js';
  
  type PersistedState =
    typeof applicationStates.$inferSelect;
  
  type PersistedTransition =
    typeof transitions.$inferSelect;
  
  type PersistedNetworkEvent =
    typeof networkEvents.$inferSelect;
  
  type PersistedConsoleEvent =
    typeof consoleEvents.$inferSelect;
  
  export interface PersistedApplicationFlow {
    states:
      PersistedState[];
  
    transitions:
      PersistedTransition[];
  
    networkEvents:
      PersistedNetworkEvent[];
  
    consoleEvents:
      PersistedConsoleEvent[];
  }
  
  export interface PersistedApplicationGraph {
    states:
      ApplicationStateNode[];
  
    transitions:
      ApplicationTransition[];
  }
  
  export function mapPersistedApplicationGraph(
    flow:
      PersistedApplicationFlow,
  ): PersistedApplicationGraph {
    const states =
      flow.states.map(
        (state) =>
          applicationStateNodeSchema.parse({
            id:
              state.id,
  
            fingerprint:
              state.fingerprint,
  
            routePattern:
              state.routePattern,
  
            url:
              state.latestUrl,
  
            title:
              state.latestTitle,
  
            firstSeenAt:
              state.firstSeenAt
                .toISOString(),
  
            lastSeenAt:
              state.lastSeenAt
                .toISOString(),
  
            visits:
              state.visitCount,
  
            observation:
              state.observation,
          }),
      );
  
    const networkEventsByTransition =
      buildNetworkEventsByTransition(
        flow.networkEvents,
      );
  
    const consoleEventsByTransition =
      buildConsoleEventsByTransition(
        flow.consoleEvents,
      );
  
    const mappedTransitions =
      flow.transitions.map(
        (transition) =>
          applicationTransitionSchema.parse({
            id:
              transition.id,
  
            fromStateId:
              transition.fromStateId,
  
            toStateId:
              transition.toStateId,
  
            action: {
              type:
                transition.actionType,
  
              ...(transition.actionTarget
                ? {
                    target:
                      transition.actionTarget,
                  }
                : {}),
            },
  
            occurredAt:
              transition.occurredAt
                .toISOString(),
  
            equivalentState:
              transition.equivalentState,
  
            explorationBlocked:
              transition.explorationBlocked,
  
            beforeObservation:
              transition.beforeObservation,
  
            afterObservation:
              transition.afterObservation,
  
            evidence: {
              networkEvents:
                networkEventsByTransition.get(
                  transition.id,
                ) ?? [],
  
              consoleEvents:
                consoleEventsByTransition.get(
                  transition.id,
                ) ?? [],
            },
          }),
      );
  
    return {
      states,
  
      transitions:
        mappedTransitions,
    };
  }
  
  function buildNetworkEventsByTransition(
    events:
      PersistedNetworkEvent[],
  ): Map<
    string,
    NetworkEvent[]
  > {
    const result =
      new Map<
        string,
        NetworkEvent[]
      >();
  
    for (
      const event of events
    ) {
      if (
        !event.transitionId
      ) {
        continue;
      }
  
      const mappedEvent:
        NetworkEvent = {
          id:
            event.requestId,
  
          method:
            event.method,
  
          url:
            event.url,
  
          resourceType:
            event.resourceType,
  
          failed:
            event.failed,
  
          ...(event.status !== null
            ? {
                status:
                  event.status,
              }
            : {}),
  
          ...(event.ok !== null
            ? {
                ok:
                  event.ok,
              }
            : {}),
  
          ...(event.failureText !== null
            ? {
                failureText:
                  event.failureText,
              }
            : {}),
        };
  
      const existing =
        result.get(
          event.transitionId,
        ) ?? [];
  
      existing.push(
        mappedEvent,
      );
  
      result.set(
        event.transitionId,
        existing,
      );
    }
  
    return result;
  }
  
  function buildConsoleEventsByTransition(
    events:
      PersistedConsoleEvent[],
  ): Map<
    string,
    ConsoleEvent[]
  > {
    const result =
      new Map<
        string,
        ConsoleEvent[]
      >();
  
    for (
      const event of events
    ) {
      if (
        !event.transitionId
      ) {
        continue;
      }
  
      const mappedEvent:
        ConsoleEvent = {
          type:
            event.type as
            ConsoleEvent['type'],
  
          text:
            event.text,
  
          timestamp:
            event.occurredAt
              .toISOString(),
        };
  
      const existing =
        result.get(
          event.transitionId,
        ) ?? [];
  
      existing.push(
        mappedEvent,
      );
  
      result.set(
        event.transitionId,
        existing,
      );
    }
  
    return result;
  }