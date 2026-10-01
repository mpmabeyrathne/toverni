import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  buildEvidenceBackedAssertions,
} from './assertion-planner.js';

function observation(
  input: {
    url?: string;
    semanticText?: string[];
    actions?: Array<{
      type: 'button' | 'input';
      tagName: string;
      name?: string;
      disabled: boolean;
      visible: boolean;
      formField?: {
        required: boolean;
        value?: string;
      };
    }>;
  } = {},
) {
  return {
    capturedAt:
      '2026-10-01T00:00:00.000Z',

    url:
      input.url ??
      'https://example.com',

    title:
      'Example',

    semanticText:
      input.semanticText ??
      [],

    ariaSnapshot:
      '',

    actions:
      input.actions ??
      [],

    consoleEvents:
      [],

    networkEvents:
      [],

    supportingArtifacts:
      [],
  };
}

describe(
  'buildEvidenceBackedAssertions',
  () => {
    it(
      'derives meaningful assertions from an observed transition delta',
      () => {
        const result =
          buildEvidenceBackedAssertions({
            actionId:
              'action-1',

            actionEvidenceReference:
              'ACTION-1',

            evidence: [
              {
                id:
                  'ACTION-1',

                type:
                  'action',

                source:
                  'action-1',
              },

              {
                id:
                  'FLOW-1',

                type:
                  'transition',

                source:
                  'transition-1',
              },
            ],

            transitions: [
              {
                id:
                  'transition-1',

                actionId:
                  'action-1',

                explorationBlocked:
                  false,

                occurredAt:
                  '2026-10-01T00:00:00.000Z',

                beforeObservation:
                  observation({
                    semanticText: [
                      'Cart is empty',
                    ],

                    actions: [
                      {
                        type:
                          'button',

                        tagName:
                          'button',

                        name:
                          'Remove from Cart',

                        disabled:
                          true,

                        visible:
                          true,
                      },

                      {
                        type:
                          'input',

                        tagName:
                          'input',

                        name:
                          'Search',

                        disabled:
                          false,

                        visible:
                          true,

                        formField: {
                          required:
                            false,

                          value:
                            '',
                        },
                      },
                    ],
                  }),

                afterObservation:
                  observation({
                    url:
                      'https://example.com/cart',

                    semanticText: [
                      'Mechanical Keyboard',
                    ],

                    actions: [
                      {
                        type:
                          'button',

                        tagName:
                          'button',

                        name:
                          'Remove from Cart',

                        disabled:
                          false,

                        visible:
                          true,
                      },

                      {
                        type:
                          'input',

                        tagName:
                          'input',

                        name:
                          'Search',

                        disabled:
                          false,

                        visible:
                          true,

                        formField: {
                          required:
                            false,

                          value:
                            'keyboard',
                        },
                      },
                    ],
                  }),
              },
            ],
          });

        expect(
          result.map(
            (assertion) =>
              assertion.kind,
          ),
        ).toEqual(
          expect.arrayContaining([
            'url',
            'enabled',
            'value',
            'text',
            'visibility',
          ]),
        );

        expect(
          result.every(
            (assertion) =>
              assertion
                .evidenceReferences
                .includes(
                  'ACTION-1',
                ) &&
              assertion
                .evidenceReferences
                .includes(
                  'FLOW-1',
                ),
          ),
        ).toBe(
          true,
        );
      },
    );

    it(
      'does not fabricate an assertion when no observed delta exists',
      () => {
        const state =
          observation({
            semanticText: [
              'Room Booking',
            ],
          });

        const result =
          buildEvidenceBackedAssertions({
            actionId:
              'action-1',

            actionEvidenceReference:
              'ACTION-1',

            evidence: [
              {
                id:
                  'ACTION-1',

                type:
                  'action',

                source:
                  'action-1',
              },
            ],

            transitions: [
              {
                id:
                  'transition-1',

                actionId:
                  'action-1',

                explorationBlocked:
                  false,

                occurredAt:
                  '2026-10-01T00:00:00.000Z',

                beforeObservation:
                  state,

                afterObservation:
                  state,
              },
            ],
          });

        expect(
          result,
        ).toEqual([]);
      },
    );
  },
);
