import type {
    NetworkEvent,
  } from '../contracts/page-observation.js';
  
  import {
    linkNetworkEventsToOperations,
  } from '../knowledge/api-operation-linker.js';
  
  import type {
    KnowledgeContext,
  } from '../knowledge/knowledge-contracts.js';
  
  import type {
    ApplicationTransition,
  } from '../state/application-state.js';
  
  import type {
    BusinessBehaviorFlow,
  } from './business-behavior.js';
  
  import {
    groundedBusinessBehaviorSchema,
    type GroundedBusinessBehavior,
  } from './grounded-business-behavior.js';
  
  const TOKEN_ALIASES:
    Record<
      string,
      string
    > = {
      add:
        'create',
  
      added:
        'create',
  
      adding:
        'create',
  
      create:
        'create',
  
      created:
        'create',
  
      creates:
        'create',
  
      reserve:
        'book',
  
      reserved:
        'book',
  
      reservation:
        'book',
  
      reservations:
        'book',
  
      book:
        'book',
  
      booked:
        'book',
  
      booking:
        'book',
  
      bookings:
        'book',
  
      cancel:
        'cancel',
  
      cancelled:
        'cancel',
  
      canceled:
        'cancel',
  
      cancellation:
        'cancel',
  
      complete:
        'complete',
  
      completed:
        'complete',
  
      finish:
        'complete',
  
      finished:
        'complete',
  
      delete:
        'delete',
  
      deleted:
        'delete',
  
      remove:
        'delete',
  
      removed:
        'delete',
  
      update:
        'update',
  
      updated:
        'update',
  
      edit:
        'update',
  
      edited:
        'update',
  
      save:
        'update',
  
      saved:
        'update',
    };
  
  const TRANSACTION_TOKENS =
    new Set([
      'approve',
      'assign',
      'book',
      'cancel',
      'checkout',
      'complete',
      'confirm',
      'create',
      'delete',
      'invite',
      'order',
      'pay',
      'publish',
      'purchase',
      'register',
      'send',
      'submit',
      'update',
      'upload',
    ]);
  
  const STOP_WORDS =
    new Set([
      'a',
      'an',
      'and',
      'can',
      'customer',
      'existing',
      'for',
      'from',
      'in',
      'is',
      'of',
      'on',
      'the',
      'to',
      'user',
      'with',
    ]);
  
  export interface GroundBusinessBehaviorsInput {
    behaviors:
      BusinessBehaviorFlow[];
  
    transitions:
      ApplicationTransition[];
  
    knowledge:
      KnowledgeContext;
  }
  
  export function groundBusinessBehaviors(
    input:
      GroundBusinessBehaviorsInput,
  ): GroundedBusinessBehavior[] {
    const transitionById =
      new Map(
        input.transitions.map(
          (transition) => [
            transition.id,
            transition,
          ],
        ),
      );
  
    return input.behaviors.map(
      (behavior) => {
        const behaviorTransitions =
          behavior.transitionIds
            .map(
              (transitionId) =>
                transitionById.get(
                  transitionId,
                ),
            )
            .filter(
              (
                transition,
              ): transition is
                ApplicationTransition =>
                transition !==
                undefined,
            );
  
        const requirementEvidenceIds =
          getRequirementEvidenceIds(
            behavior,
            input.knowledge,
          );
  
        const freshNetworkEvents =
          deduplicateNetworkEvents(
            behaviorTransitions
              .flatMap(
                (transition) =>
                  getFreshNetworkEvents(
                    transition,
                  ),
              ),
          );
  
        const apiOperationLinks =
          input.knowledge.openApi
            ? linkNetworkEventsToOperations(
                freshNetworkEvents,
                input.knowledge
                  .openApi
                  .operations,
              )
            : [];
  
        const apiOperationIds =
          uniqueStrings(
            apiOperationLinks.map(
              (link) =>
                link.operationId,
            ),
          );
  
        return groundedBusinessBehaviorSchema.parse({
          ...behavior,
  
          requirementEvidenceIds,
  
          apiOperationIds,
  
          apiOperationLinks,
        });
      },
    );
  }
  
  function getRequirementEvidenceIds(
    behavior:
      BusinessBehaviorFlow,
  
    knowledge:
      KnowledgeContext,
  ): string[] {
    const requirements =
      knowledge.requirements;
  
    if (!requirements) {
      return [];
    }
  
    const behaviorTokens =
      getBehaviorTokens(
        behavior,
      );
  
    const matches:
      string[] = [];
  
    requirements
      .acceptanceCriteria
      .forEach(
        (
          criterion,
          index,
        ) => {
          if (
            requirementMatches(
              behaviorTokens,
              criterion,
            )
          ) {
            matches.push(
              `REQ-${index + 1}`,
            );
          }
        },
      );
  
    requirements
      .capabilities
      .forEach(
        (
          capability,
          index,
        ) => {
          if (
            requirementMatches(
              behaviorTokens,
              capability,
            )
          ) {
            matches.push(
              `CAP-${index + 1}`,
            );
          }
        },
      );
  
    return uniqueStrings(
      matches,
    );
  }
  
  function getBehaviorTokens(
    behavior:
      BusinessBehaviorFlow,
  ): Set<string> {
    const text = [
      behavior.name,
  
      ...behavior.steps.map(
        (step) =>
          step.action.target ??
          '',
      ),
  
      ...behavior
        .outcome
        .addedSemanticText,
  
      ...behavior
        .outcome
        .removedSemanticText,
    ].join(
      ' ',
    );
  
    return tokenize(
      text,
    );
  }
  
  function requirementMatches(
    behaviorTokens:
      Set<string>,
  
    requirement:
      string,
  ): boolean {
    const requirementTokens =
      tokenize(
        requirement,
      );
  
    const commonTokens =
      [
        ...behaviorTokens,
      ].filter(
        (token) =>
          requirementTokens.has(
            token,
          ),
      );
  
    if (
      commonTokens.length <
      2
    ) {
      return false;
    }
  
    return commonTokens.some(
      (token) =>
        TRANSACTION_TOKENS.has(
          token,
        ),
    );
  }
  
  function tokenize(
    value:
      string,
  ): Set<string> {
    const tokens =
      value
        .toLowerCase()
        .replace(
          /[^a-z0-9]+/g,
          ' ',
        )
        .trim()
        .split(
          /\s+/,
        )
        .filter(
          Boolean,
        )
        .map(
          canonicalizeToken,
        )
        .filter(
          (token) =>
            !STOP_WORDS.has(
              token,
            ),
        );
  
    return new Set(
      tokens,
    );
  }
  
  function canonicalizeToken(
    token:
      string,
  ): string {
    const alias =
      TOKEN_ALIASES[
        token
      ];
  
    if (alias) {
      return alias;
    }
  
    if (
      token.length > 3 &&
      token.endsWith(
        's',
      )
    ) {
      return token.slice(
        0,
        -1,
      );
    }
  
    return token;
  }
  
  function getFreshNetworkEvents(
    transition:
      ApplicationTransition,
  ): NetworkEvent[] {
    const beforeIds =
      new Set(
        transition
          .beforeObservation
          .networkEvents
          .map(
            (event) =>
              event.id,
          ),
      );
  
    return transition
      .afterObservation
      .networkEvents
      .filter(
        (event) =>
          !beforeIds.has(
            event.id,
          ),
      );
  }
  
  function deduplicateNetworkEvents(
    events:
      NetworkEvent[],
  ): NetworkEvent[] {
    const seen =
      new Set<string>();
  
    const result:
      NetworkEvent[] = [];
  
    for (
      const event of
      events
    ) {
      if (
        seen.has(
          event.id,
        )
      ) {
        continue;
      }
  
      seen.add(
        event.id,
      );
  
      result.push(
        event,
      );
    }
  
    return result;
  }
  
  function uniqueStrings(
    values:
      string[],
  ): string[] {
    return [
      ...new Set(
        values,
      ),
    ];
  }