import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  PageObservation,
} from '../contracts/page-observation.js';

import {
  ApplicationStateModel,
} from '../state/application-state-model.js';

import {
  DeterministicExplorationPlanner,
} from './deterministic-exploration-planner.js';

function createObservation(
  labels:
    string[],
): PageObservation {
  return {
    capturedAt:
      '2026-10-07T00:00:00.000Z',

    url:
      'https://example.com/admin',

    title:
      'Safety Test',

    semanticText:
      labels,

    ariaSnapshot:
      labels
        .map(
          (label) =>
            `- button "${label}"`,
        )
        .join(
          '\n',
        ),

    actions:
      labels.map(
        (label) => ({
          type:
            'button' as const,

          tagName:
            'button',

          name:
            label,

          text:
            label,

          disabled:
            false,

          visible:
            true,
        }),
      ),

    consoleEvents: [],

    networkEvents: [],

    supportingArtifacts: [],
  };
}

function plan(
  labels:
    string[],

  allowDestructiveActions =
    false,
) {
  const stateModel =
    new ApplicationStateModel();

  const observation =
    createObservation(
      labels,
    );

  const state =
    stateModel
      .registerObservation(
        observation,
      )
      .state;

  const planner =
    new DeterministicExplorationPlanner(
      stateModel,
      {},
      allowDestructiveActions,
    );

  return planner.plan({
    state,
    observation,
  });
}

describe(
  'public destructive-action safety',
  () => {
    it.each([
      [
        'Delete Project',
        'destructive',
      ],
      [
        'Pay Now',
        'financial',
      ],
      [
        'Place Order',
        'financial',
      ],
      [
        'Invite User',
        'communication',
      ],
      [
        'Send Email',
        'communication',
      ],
      [
        'Cancel Subscription',
        'subscription',
      ],
      [
        'Transfer Funds',
        'transfer',
      ],
      [
        'Transfer Ownership',
        'transfer',
      ],
      [
        'Deactivate Account',
        'admin',
      ],
      [
        'Revoke Access',
        'admin',
      ],
      [
        'Reset Workspace',
        'admin',
      ],
    ])(
      'blocks %s by default with explainable %s classification',
      (
        label,
        category,
      ) => {
        const decision =
          plan([
            label,
            'View Details',
          ]);

        const candidate =
          decision
            .rankedCandidates
            .find(
              (item) =>
                item.label ===
                label,
            );

        expect(
          candidate?.blocked,
        ).toBe(
          true,
        );

        expect(
          candidate
            ?.blockReasons
            .join(
              ' ',
            ),
        ).toContain(
          category,
        );

        expect(
          decision.selected
            ?.label,
        ).toBe(
          'View Details',
        );
      },
    );

    it.each([
      'Remove Filter',
      'Remove from Cart',
      'Cancel Search',
      'Send to Details',
      'Transfer Settings',
      'Payment Methods',
      'Invite Settings',
    ])(
      'does not block ambiguous safe label %s',
      (
        label,
      ) => {
        const decision =
          plan([
            label,
          ]);

        const candidate =
          decision
            .rankedCandidates[0];

        expect(
          candidate?.blocked,
        ).toBe(
          false,
        );
      },
    );

    it(
      'requires explicit override before a high-impact action becomes eligible',
      () => {
        const blocked =
          plan([
            'Transfer Funds',
          ]);

        expect(
          blocked
            .rankedCandidates[0]
            ?.blocked,
        ).toBe(
          true,
        );

        const allowed =
          plan(
            [
              'Transfer Funds',
            ],
            true,
          );

        expect(
          allowed
            .rankedCandidates[0]
            ?.blocked,
        ).toBe(
          false,
        );

        expect(
          allowed
            .rankedCandidates[0]
            ?.reasons
            .join(
              ' ',
            ),
        ).toContain(
          'explicitly allowed',
        );
      },
    );
  },
);
