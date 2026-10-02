import {
  createHash,
} from 'node:crypto';

import type {
  ApplicationStateNode,
  ApplicationTransition,
} from '../state/application-state.js';

import type {
  ReconstructedBusinessFlow,
} from './business-flow.js';

import {
  businessBehaviorFlowSchema,
  type BusinessBehaviorFlow,
  type BusinessBoundaryEvidence,
} from './business-behavior.js';

const TRANSACTION_VERBS =
  new Set([
    'add',
    'approve',
    'assign',
    'book',
    'cancel',
    'checkout',
    'complete',
    'confirm',
    'create',
    'delete',
    'finish',
    'invite',
    'order',
    'pay',
    'publish',
    'purchase',
    'register',
    'remove',
    'reserve',
    'retry',
    'recover',
    'reset',
    'clear',
    'save',
    'send',
    'submit',
    'update',
    'upload',
  ]);

const MUTATING_HTTP_METHODS =
  new Set([
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
  ]);

export interface IdentifyBusinessBehaviorsInput {
  states:
  ApplicationStateNode[];

  transitions:
  ApplicationTransition[];

  flows:
  ReconstructedBusinessFlow[];
}

export function identifyBusinessBehaviors(
  input:
    IdentifyBusinessBehaviorsInput,
): BusinessBehaviorFlow[] {
  const stateById =
    new Map(
      input.states.map(
        (state) => [
          state.id,
          state,
        ],
      ),
    );

  const transitionById =
    new Map(
      input.transitions.map(
        (transition) => [
          transition.id,
          transition,
        ],
      ),
    );

  const behaviors =
    new Map<
      string,
      BusinessBehaviorFlow
    >();

  for (
    const flow of
    input.flows
  ) {
    let segmentStartIndex =
      0;

    for (
      let index = 0;
      index <
      flow.transitionIds.length;
      index += 1
    ) {
      const transitionId =
        flow.transitionIds[
        index
        ];

      if (!transitionId) {
        continue;
      }

      const transition =
        transitionById.get(
          transitionId,
        );

      if (!transition) {
        continue;
      }

      const boundaryEvidence =
        getBoundaryEvidence(
          transition,
        );

      if (
        boundaryEvidence.length ===
        0
      ) {
        continue;
      }

      const transitionIds =
        flow.transitionIds.slice(
          segmentStartIndex,
          index + 1,
        );

      const stateIds =
        flow.stateIds.slice(
          segmentStartIndex,
          index + 2,
        );

      const steps =
        flow.steps.slice(
          segmentStartIndex,
          index + 1,
        );

      const startStateId =
        stateIds[0];

      const endStateId =
        stateIds[
        stateIds.length - 1
        ];

      if (
        !startStateId ||
        !endStateId ||
        transitionIds.length === 0 ||
        steps.length === 0
      ) {
        segmentStartIndex =
          index + 1;

        continue;
      }

      const id =
        createBusinessBehaviorId(
          stateIds,
          transitionIds,
        );

      const name =
        getBehaviorName(
          transition,
        );

      const complete =
        stateById.has(
          endStateId,
        );

      const behavior =
        businessBehaviorFlowSchema.parse({
          id,

          sourceFlowIds: [
            flow.id,
          ],

          name,

          startStateId,

          endStateId,

          stateIds,

          transitionIds,

          preconditionTransitionIds:
            flow.transitionIds.slice(
              0,
              segmentStartIndex,
            ),

          steps,

          complete,

          boundaryEvidence,

          outcome:
            buildOutcome(
              transition,
            ),
        });

        const boundaryKey =
        createBusinessBoundaryKey(
          transition,
          name,
        );

      const existing =
        behaviors.get(
          boundaryKey,
        );

      if (existing) {
        const preferred =
          compareBusinessBehaviorCandidates(
            behavior,
            existing,
            transitionById,
          ) < 0
            ? behavior
            : existing;

        const merged =
          businessBehaviorFlowSchema.parse({
            ...preferred,

            sourceFlowIds: [
              ...new Set([
                ...existing
                  .sourceFlowIds,

                ...behavior
                  .sourceFlowIds,
              ]),
            ].sort(),
          });

        behaviors.set(
          boundaryKey,
          merged,
        );

        segmentStartIndex =
          index + 1;

        continue;
      }

      behaviors.set(
        boundaryKey,
        behavior,
      );

      segmentStartIndex =
        index + 1;
    }
  }

  return [
    ...behaviors.values(),
  ].sort(
    (
      first,
      second,
    ) =>
      first
        .preconditionTransitionIds
        .length -
      second
        .preconditionTransitionIds
        .length ||
      first.name.localeCompare(
        second.name,
      ) ||
      first.id.localeCompare(
        second.id,
      ),
  );
}

function getBoundaryEvidence(
  transition:
    ApplicationTransition,
): BusinessBoundaryEvidence[] {
  const evidence:
    BusinessBoundaryEvidence[] = [];

  if (
    transition.action.type ===
    'submit' ||
    hasTransactionVerb(
      transition.action.target,
    )
  ) {
    evidence.push({
      source:
        'action',

      transitionId:
        transition.id,

      detail:
        transition.action.target
          ? `Observed transactional action "${transition.action.target}"`
          : `Observed transactional action type "${transition.action.type}"`,

      networkEventIds: [],
    });
  }

  const freshNetworkEvents =
    getFreshNetworkEvents(
      transition,
    );

  const mutationEvents =
    freshNetworkEvents.filter(
      (event) =>
        MUTATING_HTTP_METHODS.has(
          event.method.toUpperCase(),
        ),
    );

  if (
    mutationEvents.length >
    0
  ) {
    evidence.push({
      source:
        'network',

      transitionId:
        transition.id,

      detail:
        `Observed fresh mutating network request(s): ${mutationEvents
          .map(
            (event) =>
              `${event.method.toUpperCase()} ${event.url}`,
          )
          .join(', ')}`,

      networkEventIds:
        mutationEvents.map(
          (event) =>
            event.id,
        ),
    });
  }

  return evidence;
}

function getFreshNetworkEvents(
  transition:
    ApplicationTransition,
) {
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

function hasTransactionVerb(
  value:
    string | undefined,
): boolean {
  if (!value) {
    return false;
  }

  const tokens =
    normalize(
      value,
    )
      .split(' ')
      .filter(
        Boolean,
      );

  return tokens.some(
    (token) =>
      TRANSACTION_VERBS.has(
        token,
      ),
  );
}

function getBehaviorName(
  transition:
    ApplicationTransition,
): string {
  const target =
    transition.action.target
      ?.trim();

  if (target) {
    return target;
  }

  return `${transition.action.type} ${transition.toStateId}`;
}

function buildOutcome(
  transition:
    ApplicationTransition,
) {
  const beforeText =
    new Set(
      transition
        .beforeObservation
        .semanticText,
    );

  const afterText =
    new Set(
      transition
        .afterObservation
        .semanticText,
    );

  return {
    stateId:
      transition.toStateId,

    urlChanged:
      transition
        .beforeObservation
        .url !==
      transition
        .afterObservation
        .url,

    titleChanged:
      transition
        .beforeObservation
        .title !==
      transition
        .afterObservation
        .title,

    addedSemanticText:
      [
        ...afterText,
      ].filter(
        (value) =>
          !beforeText.has(
            value,
          ),
      ),

    removedSemanticText:
      [
        ...beforeText,
      ].filter(
        (value) =>
          !afterText.has(
            value,
          ),
      ),
  };
}

function createBusinessBehaviorId(
  stateIds:
    string[],

  transitionIds:
    string[],
): string {
  const hash =
    createHash(
      'sha256',
    )
      .update(
        JSON.stringify({
          stateIds,
          transitionIds,
        }),
      )
      .digest(
        'hex',
      )
      .slice(
        0,
        24,
      );

  return `behavior-${hash}`;
}

function createBusinessBoundaryKey(
  transition:
    ApplicationTransition,

  name:
    string,
): string {
  const mutationSignatures =
    getFreshNetworkEvents(
      transition,
    )
      .filter(
        (event) =>
          MUTATING_HTTP_METHODS.has(
            event.method
              .toUpperCase(),
          ),
      )
      .map(
        (event) => {
          let pathname =
            event.url;

          try {
            pathname =
              new URL(
                event.url,
              ).pathname;
          } catch {
            // Keep the original URL
            // when it is not parseable.
          }

          return [
            event.method
              .toUpperCase(),

            pathname,
          ].join(':');
        },
      )
      .sort();

  return [
    transition.action.type,

    normalize(
      name,
    ),

    mutationSignatures.join(
      '|',
    ),
  ].join(
    '::',
  );
}

const REPLAY_SETUP_ACTION_TYPES =
  new Set([
    'fill',
    'select',
    'set-input-files',
  ]);

function countReplaySetupPreconditions(
  behavior:
    BusinessBehaviorFlow,

  transitionById:
    Map<
      string,
      ApplicationTransition
    >,
): number {
  return behavior
    .preconditionTransitionIds
    .filter(
      (transitionId) => {
        const transition =
          transitionById.get(
            transitionId,
          );

        return (
          transition !==
            undefined &&
          REPLAY_SETUP_ACTION_TYPES.has(
            transition.action.type,
          )
        );
      },
    )
    .length;
}

function compareBusinessBehaviorCandidates(
  first:
    BusinessBehaviorFlow,

  second:
    BusinessBehaviorFlow,

  transitionById:
    Map<
      string,
      ApplicationTransition
    >,
): number {
  const firstSetupCount =
    countReplaySetupPreconditions(
      first,
      transitionById,
    );

  const secondSetupCount =
    countReplaySetupPreconditions(
      second,
      transitionById,
    );

  return (
    secondSetupCount -
      firstSetupCount ||

    first
      .preconditionTransitionIds
      .length -
      second
        .preconditionTransitionIds
        .length ||

    first
      .transitionIds
      .length -
      second
        .transitionIds
        .length ||

    first.id.localeCompare(
      second.id,
    )
  );
}

function normalize(
  value:
    string,
): string {
  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      ' ',
    )
    .trim();
}