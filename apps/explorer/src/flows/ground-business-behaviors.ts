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

      upload:
        'upload',

      uploaded:
        'upload',

      uploading:
        'upload',

      retry:
        'retry',

      retried:
        'retry',

      retrying:
        'retry',

      recover:
        'retry',

      recovered:
        'retry',

      recovery:
        'retry',

      clear:
        'clear',

      cleared:
        'clear',

      clearing:
        'clear',

      reset:
        'reset',

      resets:
        'reset',

      resetting:
        'reset',

      failed:
        'fail',

      fails:
        'fail',

      failure:
        'fail',

      succeeds:
        'success',

      succeeded:
        'success',

      successful:
        'success',

      sign:
        'auth',

      signed:
        'auth',

      signing:
        'auth',

      login:
        'login',

      logged:
        'login',

      logout:
        'logout',

      authenticate:
        'login',

      authenticated:
        'login',

      authentication:
        'login',
    };
  
  const TRANSACTION_TOKENS =
    new Set([
      'approve',
      'assign',
      'auth',
      'login',
      'logout',
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
      'retry',
      'clear',
      'reset',
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
              behavior,
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
              behavior,
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

  function getBehaviorTransactionTokens(
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
    ].join(
      ' ',
    );

    return new Set(
      [
        ...tokenize(
          text,
        ),
      ].filter(
        (token) =>
          TRANSACTION_TOKENS.has(
            token,
          ),
      ),
    );
  }

  function hasNegativeOutcome(
    behavior:
      BusinessBehaviorFlow,
  ): boolean {
    return behavior
      .outcome
      .addedSemanticText
      .some(
        (value) =>
          /\b(?:invalid|error|failed|failure|forbidden|denied|rejected|unauthorized)\b/i
            .test(
              value,
            ),
      );
  }

  function isNegativeRequirement(
    requirement:
      string,
  ): boolean {
    return /\b(?:invalid|error|failed|failure|forbidden|denied|rejected|unauthorized|must not|cannot|can't|prevented)\b/i
      .test(
        requirement,
      );
  }

  function requirementMatches(
    behavior:
      BusinessBehaviorFlow,

    requirement:
      string,
  ): boolean {
    const behaviorTokens =
      getBehaviorTokens(
        behavior,
      );

    const behaviorTransactionTokens =
      getBehaviorTransactionTokens(
        behavior,
      );

    const requirementTokens =
      tokenize(
        requirement,
      );

    const requirementTransactionTokens =
      new Set(
        [
          ...requirementTokens,
        ].filter(
          (token) =>
            TRANSACTION_TOKENS.has(
              token,
            ),
        ),
      );

    const sharedTransaction =
      [
        ...behaviorTransactionTokens,
      ].some(
        (token) =>
          requirementTransactionTokens
            .has(
              token,
            ),
      );

    if (!sharedTransaction) {
      return false;
    }

    const requirementIsNegative =
      isNegativeRequirement(
        requirement,
      );

    const behaviorIsNegative =
      hasNegativeOutcome(
        behavior,
      );

    if (
      requirementIsNegative !==
      behaviorIsNegative
    ) {
      return false;
    }

    const commonTokens =
      [
        ...behaviorTokens,
      ].filter(
        (token) =>
          requirementTokens.has(
            token,
          ),
      );

    return (
      commonTokens.length >=
      2
    );
  }
  
  function tokenize(
    value:
      string,
  ): Set<string> {
    const directionalValue =
      value
        .toLowerCase()
        .replace(
          /\b(?:sign|signed|signing)\s+out\b/g,
          'logout',
        )
        .replace(
          /\b(?:sign|signed|signing)\s+in\b/g,
          'login',
        );

    const tokens =
      directionalValue
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