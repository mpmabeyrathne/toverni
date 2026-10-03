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
        inputType?: string;
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

            actionLabel:
              'Add Todo',

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

                actionTarget:
                  'Add Todo',

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
      'matches an observed transition by action label when persisted action ids differ',
      () => {
        const result =
          buildEvidenceBackedAssertions({
            actionId:
              'scenario-action-id',

            actionEvidenceReference:
              'ACTION-1',

            actionLabel:
              'Add Todo',

            evidence: [
              {
                id:
                  'ACTION-1',

                type:
                  'action',

                source:
                  'scenario-action-id',
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
                  'different-persisted-action-id',

                actionTarget:
                  'Add Todo',

                explorationBlocked:
                  false,

                occurredAt:
                  '2026-10-01T00:00:00.000Z',

                beforeObservation:
                  observation({
                    semanticText: [
                      'Todo List',
                    ],
                  }),

                afterObservation:
                  observation({
                    semanticText: [
                      'Todo List',
                      'test-value',
                    ],
                  }),
              },
            ],
          });

        expect(
          result,
        ).toHaveLength(1);

        expect(
          result[0],
        ).toMatchObject({
          kind:
            'text',

          matcher:
            'visible',

          target: {
            kind:
              'locator',

            target: {
              by:
                'text',

              text:
                'test-value',

              exact:
                true,
            },
          },
        });
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

            actionLabel:
              'Add Todo',

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

                actionTarget:
                  'Add Todo',

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
    it(
      'uses equivalent-state transitions as assertion evidence',
      () => {
        const result =
          buildEvidenceBackedAssertions({
            actionId:
              'action-page',

            actionEvidenceReference:
              'ACTION-PAGE',

            actionLabel:
              'Next Page',

            evidence: [
              {
                id:
                  'ACTION-PAGE',

                type:
                  'action',

                source:
                  'action-page',
              },
            ],

            transitions: [
              {
                id:
                  'transition-page',

                actionId:
                  'action-page',

                actionTarget:
                  'Next Page',

                explorationBlocked:
                  true,

                occurredAt:
                  '2026-10-01T00:00:00.000Z',

                beforeObservation:
                  observation({
                    semanticText: [
                      'Page 1',
                    ],
                  }),

                afterObservation:
                  observation({
                    semanticText: [
                      'Page 2',
                    ],
                  }),
              },
            ],
          });

        expect(
          result.some(
            (item) =>
              item.description ===
              'Observed text appeared: Page 2',
          ),
        ).toBe(
          true,
        );
      },
    );


    it(
      'does not emit a brittle value assertion for file inputs',
      () => {
        const result =
          buildEvidenceBackedAssertions({
            actionId:
              'action-upload',

            actionEvidenceReference:
              'ACTION-UPLOAD',

            actionLabel:
              'Upload',

            evidence: [
              {
                id:
                  'ACTION-UPLOAD',

                type:
                  'action',

                source:
                  'action-upload',
              },
            ],

            transitions: [
              {
                id:
                  'transition-upload',

                actionId:
                  'action-upload',

                actionTarget:
                  'Upload',

                explorationBlocked:
                  false,

                occurredAt:
                  '2026-10-02T00:00:00.000Z',

                beforeObservation:
                  observation({
                    semanticText: [
                      'No file selected',
                    ],

                    actions: [
                      {
                        type:
                          'input',

                        tagName:
                          'input',

                        name:
                          'Upload file',

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
                    semanticText: [
                      'toverni-test.txt ready',
                    ],

                    actions: [
                      {
                        type:
                          'input',

                        tagName:
                          'input',

                        name:
                          'Upload file',

                        disabled:
                          false,

                        visible:
                          true,

                        formField: {
                          required:
                            false,

                          inputType:
                            'file',

                          value:
                            'C:\\fakepath\\toverni-test.txt',
                        },
                      },
                    ],
                  }),
              },
            ],
          });

        expect(
          result.some(
            (assertion) =>
              assertion.kind ===
              'value',
          ),
        ).toBe(false);

        expect(
          result.some(
            (assertion) =>
              assertion.kind ===
                'text' &&
              assertion.description.includes(
                'toverni-test.txt ready',
              ),
          ),
        ).toBe(true);
      },
    );


    it(
      'ignores semantic text composed only of visible action labels',
      () => {
        const result =
          buildEvidenceBackedAssertions({
            actionId:
              'action-retry',

            actionEvidenceReference:
              'ACTION-RETRY',

            actionLabel:
              'Retry',

            evidence: [
              {
                id:
                  'ACTION-RETRY',

                type:
                  'action',

                source:
                  'action-retry',
              },
            ],

            transitions: [
              {
                id:
                  'transition-retry',

                actionId:
                  'action-retry',

                actionTarget:
                  'Retry',

                explorationBlocked:
                  false,

                occurredAt:
                  '2026-10-03T00:00:00.000Z',

                beforeObservation:
                  observation({
                    semanticText: [
                      'Upload failed',
                    ],

                    actions: [
                      {
                        type:
                          'button',

                        tagName:
                          'button',

                        name:
                          'Upload',

                        disabled:
                          false,

                        visible:
                          true,
                      },

                      {
                        type:
                          'button',

                        tagName:
                          'button',

                        name:
                          'Retry',

                        disabled:
                          false,

                        visible:
                          true,
                      },

                      {
                        type:
                          'button',

                        tagName:
                          'button',

                        name:
                          'Clear',

                        disabled:
                          false,

                        visible:
                          true,
                      },
                    ],
                  }),

                afterObservation:
                  observation({
                    semanticText: [
                      'UploadClear',
                      'Uploaded',
                    ],

                    actions: [
                      {
                        type:
                          'button',

                        tagName:
                          'button',

                        name:
                          'Upload',

                        disabled:
                          false,

                        visible:
                          true,
                      },

                      {
                        type:
                          'button',

                        tagName:
                          'button',

                        name:
                          'Retry',

                        disabled:
                          false,

                        visible:
                          false,
                      },

                      {
                        type:
                          'button',

                        tagName:
                          'button',

                        name:
                          'Clear',

                        disabled:
                          false,

                        visible:
                          true,
                      },
                    ],
                  }),
              },
            ],
          });

        expect(
          result.some(
            (assertion) =>
              assertion.description ===
              'Observed text appeared: UploadClear',
          ),
        ).toBe(false);

        expect(
          result.some(
            (assertion) =>
              assertion.description ===
              'Observed text appeared: Uploaded',
          ),
        ).toBe(true);
      },
    );

  },
);
