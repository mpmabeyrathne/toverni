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
      type: 'button' | 'input' | 'dialog' | 'link';
      tagName: string;
      role?: string;
      name?: string;
      text?: string;
      href?: string;
      testId?: string;
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
      'ignores semantic text composed from multiple visible control labels',
      () => {
        const result =
          buildEvidenceBackedAssertions({
            actionId:
              'action-next',

            actionEvidenceReference:
              'ACTION-NEXT',

            actionLabel:
              'Next Page',

            evidence: [
              {
                id:
                  'ACTION-NEXT',

                type:
                  'action',

                source:
                  'action-next',
              },
            ],

            transitions: [
              {
                id:
                  'transition-next',

                actionId:
                  'action-next',

                actionTarget:
                  'Next Page',

                explorationBlocked:
                  false,

                occurredAt:
                  '2026-10-01T00:00:00.000Z',

                beforeObservation:
                  observation({
                    semanticText: [
                      'Previous PagePage 1Next Page',
                    ],

                    actions: [
                      {
                        type:
                          'button',

                        tagName:
                          'button',

                        name:
                          'Previous Page',

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
                          'Next Page',

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
                      'Previous PagePage 2Next Page',
                    ],

                    actions: [
                      {
                        type:
                          'button',

                        tagName:
                          'button',

                        name:
                          'Previous Page',

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
                          'Next Page',

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
              assertion.kind ===
                'text' &&
              assertion.description
                .includes(
                  'Previous PagePage',
                ),
          ),
        ).toBe(false);

        expect(
          result.some(
            (assertion) =>
              assertion.kind ===
                'visibility' &&
              assertion.description
                .includes(
                  'Previous PagePage',
                ),
          ),
        ).toBe(false);
      },
    );


    it(
      'does not add volatile semantic text when stronger same-page assertions exist',
      () => {
        const result =
          buildEvidenceBackedAssertions({
            actionId:
              'action-search',

            actionEvidenceReference:
              'ACTION-SEARCH',

            actionLabel:
              'Search',

            evidence: [
              {
                id:
                  'ACTION-SEARCH',

                type:
                  'action',

                source:
                  'action-search',
              },
            ],

            transitions: [
              {
                id:
                  'transition-search',

                actionId:
                  'action-search',

                actionTarget:
                  'Search',

                explorationBlocked:
                  false,

                occurredAt:
                  '2026-10-08T00:00:00.000Z',

                beforeObservation:
                  observation({
                    semanticText: [
                      'Calorie Tracker Application',
                    ],

                    actions: [
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
                    semanticText: [
                      'Discover more',
                    ],

                    actions: [
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
                            'mock exam questions',
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
              assertion.description
                .includes(
                  'Discover more',
                ),
          ),
        ).toBe(false);

        expect(
          result.some(
            (assertion) =>
              assertion.matcher ===
                'value',
          ),
        ).toBe(true);
      },
    );


    it(
      'derives meaningful assertions from a same-page observed transition delta',
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
      'treats dialog text fallback as an unlabeled role target',
      () => {
        const result =
          buildEvidenceBackedAssertions({
            actionId:
              'action-review',

            actionEvidenceReference:
              'ACTION-REVIEW',

            actionLabel:
              'Review Order',

            evidence: [
              {
                id:
                  'ACTION-REVIEW',

                type:
                  'action',

                source:
                  'action-review',
              },
            ],

            transitions: [
              {
                id:
                  'transition-review',

                actionId:
                  'action-review',

                actionTarget:
                  'Review Order',

                explorationBlocked:
                  false,

                occurredAt:
                  '2026-10-04T00:00:00.000Z',

                beforeObservation:
                  observation({
                    actions: [
                      {
                        type:
                          'dialog',

                        tagName:
                          'dialog',

                        name:
                          'Confirm order total $25Confirm OrderCancel',

                        text:
                          'Confirm order total $25Confirm OrderCancel',

                        disabled:
                          false,

                        visible:
                          false,
                      },
                    ],
                  }),

                afterObservation:
                  observation({
                    actions: [
                      {
                        type:
                          'dialog',

                        tagName:
                          'dialog',

                        name:
                          'Confirm order total $25\n\nConfirm OrderCancel',

                        text:
                          'Confirm order total $25\n\nConfirm OrderCancel',

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
          result,
        ).toHaveLength(1);

        expect(
          result[0],
        ).toMatchObject({
          kind:
            'visibility',

          matcher:
            'visible',

          target: {
            kind:
              'locator',

            target: {
              by:
                'role',

              role:
                'dialog',
            },
          },
        });

        expect(
          result.some(
            (assertion) =>
              assertion.kind ===
              'count',
          ),
        ).toBe(false);
      },
    );


    it(
      'emits a zero-count assertion when an observed control is removed from the DOM',
      () => {
        const result =
          buildEvidenceBackedAssertions({
            actionId:
              'action-delete',

            actionEvidenceReference:
              'ACTION-DELETE',

            actionLabel:
              'Delete Todo',

            evidence: [
              {
                id:
                  'ACTION-DELETE',

                type:
                  'action',

                source:
                  'action-delete',
              },
            ],

            transitions: [
              {
                id:
                  'transition-delete',

                actionId:
                  'action-delete',

                actionTarget:
                  'Delete Todo',

                explorationBlocked:
                  false,

                occurredAt:
                  '2026-10-05T00:00:00.000Z',

                beforeObservation:
                  observation({
                    semanticText: [
                      'Learn Playwright Complete Todo Delete Todo',
                    ],

                    actions: [
                      {
                        type:
                          'button',

                        tagName:
                          'button',

                        name:
                          'Complete Todo',

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
                          'Delete Todo',

                        disabled:
                          false,

                        visible:
                          true,
                      },
                    ],
                  }),

                afterObservation:
                  observation({
                    semanticText: [],
                    actions: [],
                  }),
              },
            ],
          });

        expect(
          result,
        ).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              kind:
                'count',

              matcher:
                'count',

              expected:
                0,

              target: {
                kind:
                  'locator',

                target: {
                  by:
                    'role',

                  role:
                    'button',

                  name:
                    'Delete Todo',

                  exact:
                    true,
                },
              },
            }),
          ]),
        );
      },
    );


    it(
      'does not emit count assertions for hidden after-elements',
      () => {
        const result =
          buildEvidenceBackedAssertions({
            actionId:
              'action-confirm',

            actionEvidenceReference:
              'ACTION-CONFIRM',

            actionLabel:
              'Confirm Order',

            evidence: [
              {
                id:
                  'ACTION-CONFIRM',

                type:
                  'action',

                source:
                  'action-confirm',
              },
            ],

            transitions: [
              {
                id:
                  'transition-confirm',

                actionId:
                  'action-confirm',

                actionTarget:
                  'Confirm Order',

                explorationBlocked:
                  false,

                occurredAt:
                  '2026-10-04T00:00:00.000Z',

                beforeObservation:
                  observation({
                    actions: [
                      {
                        type:
                          'dialog',

                        tagName:
                          'dialog',

                        name:
                          'Confirm order total $25\n\nConfirm OrderCancel',

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
                      'Order complete',
                    ],

                    actions: [
                      {
                        type:
                          'dialog',

                        tagName:
                          'dialog',

                        name:
                          'Confirm order total $25Confirm OrderCancel',

                        disabled:
                          false,

                        visible:
                          false,
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
              'count',
          ),
        ).toBe(false);

        expect(
          result.some(
            (assertion) =>
              assertion.description ===
              'Observed text appeared: Order complete',
          ),
        ).toBe(true);
      },
    );


    it(
      'targets tab-separated table rows by ARIA row role',
      () => {
        const result =
          buildEvidenceBackedAssertions({
            actionId:
              'action-refresh',

            actionEvidenceReference:
              'ACTION-REFRESH',

            actionLabel:
              'Refresh',

            evidence: [
              {
                id:
                  'ACTION-REFRESH',

                type:
                  'action',

                source:
                  'action-refresh',
              },
            ],

            transitions: [
              {
                id:
                  'transition-refresh',

                actionId:
                  'action-refresh',

                actionTarget:
                  'Refresh',

                explorationBlocked:
                  false,

                occurredAt:
                  '2026-10-01T00:00:00.000Z',

                beforeObservation:
                  observation({
                    semanticText: [
                      'Alice\tPaid\t30',
                    ],
                  }),

                afterObservation:
                  observation({
                    semanticText: [
                      'Alice\tUpdated\t30',
                    ],
                  }),
              },
            ],
          });

        expect(
          result,
        ).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              kind:
                'text',

              target: {
                kind:
                  'locator',

                target: {
                  by:
                    'role',

                  role:
                    'row',

                  name:
                    'Alice Updated 30',

                  exact:
                    true,
                },
              },
            }),
          ]),
        );
      },
    );


    it(
      'uses only the URL assertion when navigation changes the page',
      () => {
        const result =
          buildEvidenceBackedAssertions({
            actionId:
              'action-pmp',

            actionEvidenceReference:
              'ACTION-PMP',

            actionLabel:
              'PMP Practice',

            evidence: [
              {
                id:
                  'ACTION-PMP',

                type:
                  'action',

                source:
                  'action-pmp',
              },
            ],

            transitions: [
              {
                id:
                  'transition-pmp',

                actionId:
                  'action-pmp',

                actionTarget:
                  'PMP Practice',

                explorationBlocked:
                  false,

                occurredAt:
                  '2026-10-08T00:00:00.000Z',

                beforeObservation:
                  observation({
                    url:
                      'https://practice.expandtesting.com/',

                    semanticText: [
                      'A demo with separate UI and API layers',
                    ],
                  }),

                afterObservation:
                  observation({
                    url:
                      'https://pmp.expandtesting.com/',

                    semanticText: [
                      'AC + BAC – EV — if BAC remains the same',
                    ],
                  }),
              },
            ],
          });

        expect(
          result,
        ).toHaveLength(
          1,
        );

        expect(
          result[0],
        ).toMatchObject({
          kind:
            'url',

          matcher:
            'url',

          expected:
            'https://pmp.expandtesting.com/',
        });
      },
    );

    it(
      'does not assert count or visibility for transient custom role links without href',
      () => {
        const result =
          buildEvidenceBackedAssertions({
            actionId:
              'action-search',

            actionEvidenceReference:
              'ACTION-SEARCH',

            actionLabel:
              'Search',

            evidence: [
              {
                id:
                  'ACTION-SEARCH',

                type:
                  'action',

                source:
                  'action-search',
              },
            ],

            transitions: [
              {
                id:
                  'transition-search',

                actionId:
                  'action-search',

                actionTarget:
                  'Search',

                explorationBlocked:
                  false,

                occurredAt:
                  '2026-10-08T00:00:00.000Z',

                beforeObservation:
                  observation({
                    actions: [
                      {
                        type:
                          'link',

                        tagName:
                          'div',

                        role:
                          'link',

                        name:
                          'API development resources',

                        text:
                          'API development resources',

                        disabled:
                          false,

                        visible:
                          true,
                      },
                    ],
                  }),

                afterObservation:
                  observation({
                    actions: [
                      {
                        type:
                          'link',

                        tagName:
                          'div',

                        role:
                          'link',

                        name:
                          'API development resources',

                        text:
                          'API development resources',

                        disabled:
                          false,

                        visible:
                          true,
                      },

                      {
                        type:
                          'link',

                        tagName:
                          'div',

                        role:
                          'link',

                        name:
                          'API development resources',

                        text:
                          'API development resources',

                        disabled:
                          false,

                        visible:
                          true,
                      },

                      {
                        type:
                          'link',

                        tagName:
                          'div',

                        role:
                          'link',

                        name:
                          'API development resources',

                        text:
                          'API development resources',

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
          result,
        ).toEqual(
          [],
        );
      },
    );

    it(
      'still permits assertions for native links with href',
      () => {
        const result =
          buildEvidenceBackedAssertions({
            actionId:
              'action-filter',

            actionEvidenceReference:
              'ACTION-FILTER',

            actionLabel:
              'Filter',

            evidence: [
              {
                id:
                  'ACTION-FILTER',

                type:
                  'action',

                source:
                  'action-filter',
              },
            ],

            transitions: [
              {
                id:
                  'transition-filter',

                actionId:
                  'action-filter',

                actionTarget:
                  'Filter',

                explorationBlocked:
                  false,

                occurredAt:
                  '2026-10-08T00:00:00.000Z',

                beforeObservation:
                  observation({
                    actions: [],
                  }),

                afterObservation:
                  observation({
                    actions: [
                      {
                        type:
                          'link',

                        tagName:
                          'a',

                        name:
                          'Results',

                        text:
                          'Results',

                        href:
                          'https://example.com/results',

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
              assertion.matcher ===
                'visible' &&
              assertion.target.kind ===
                'locator',
          ),
        ).toBe(
          true,
        );
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
