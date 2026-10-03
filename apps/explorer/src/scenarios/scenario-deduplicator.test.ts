import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  deduplicateScenarios,
  deduplicateScenariosWithReasons,
} from './scenario-deduplicator.js';

describe(
  'deduplicateScenarios',
  () => {
    it(
      'collapses equivalent product instances when behavior is the same',
      () => {
        const result =
          deduplicateScenariosWithReasons([
            {
              title:
                'Add Mechanical Keyboard to Cart',

              type:
                'positive',

              preconditions: [],

              actions: [
                'Add Mechanical Keyboard to Cart',
              ],

              expectedOutcomes: [
                'Mechanical Keyboard added to cart',
              ],

              evidenceReferences: [
                'REQ-1',
              ],
            },

            {
              title:
                'Add Gaming Mouse to Cart',

              type:
                'positive',

              preconditions: [],

              actions: [
                'Add Gaming Mouse to Cart',
              ],

              expectedOutcomes: [
                'Gaming Mouse added to cart',
              ],

              evidenceReferences: [
                'ACTION-2',
              ],
            },
          ]);

        expect(
          result,
        ).toHaveLength(1);

        expect(
          result[0]
            ?.scenario
            .evidenceReferences,
        ).toEqual([
          'ACTION-2',
          'REQ-1',
        ]);

        expect(
          result[0]
            ?.deduplicationReasons
            .some(
              (reason) =>
                reason.includes(
                  'collapsed 2 semantically equivalent scenarios',
                ),
            ),
        ).toBe(true);
      },
    );

    it(
      'retains meaningful availability variants',
      () => {
        const result =
          deduplicateScenarios([
            {
              title:
                'Book available room',

              type:
                'positive',

              preconditions: [],

              actions: [
                'Book an available room',
              ],

              expectedOutcomes: [
                'Available room booking succeeds',
              ],

              evidenceReferences: [
                'REQ-1',
              ],
            },

            {
              title:
                'Book unavailable room',

              type:
                'positive',

              preconditions: [],

              actions: [
                'Book an unavailable room',
              ],

              expectedOutcomes: [
                'Unavailable room booking is rejected',
              ],

              evidenceReferences: [
                'CON-1',
              ],
            },
          ]);

        expect(
          result,
        ).toHaveLength(2);
      },
    );

    it(
      'does not collapse distinct discovered navigation action instances',
      () => {
        const result =
          deduplicateScenarios([
            {
              title:
                'Navigation: Book Ocean Room',

              type:
                'navigation',

              preconditions: [],

              actions: [
                'Use the discovered button "Book Ocean Room"',
              ],

              expectedOutcomes: [
                'The discovered button "Book Ocean Room" can be executed from the observed application state.',
              ],

              evidenceReferences: [
                'ACTION-1',
              ],
            },

            {
              title:
                'Navigation: Book Garden Room',

              type:
                'navigation',

              preconditions: [],

              actions: [
                'Use the discovered button "Book Garden Room"',
              ],

              expectedOutcomes: [
                'The discovered button "Book Garden Room" can be executed from the observed application state.',
              ],

              evidenceReferences: [
                'ACTION-2',
              ],
            },
          ]);

        expect(
          result,
        ).toHaveLength(2);
      },
    );

    it(
      'retains success and error scenario types even when wording overlaps',
      () => {
        const result =
          deduplicateScenarios([
            {
              title:
                'Submit booking',

              type:
                'positive',

              preconditions: [],

              actions: [
                'Submit booking',
              ],

              expectedOutcomes: [
                'Booking succeeds',
              ],

              evidenceReferences: [
                'REQ-1',
              ],
            },

            {
              title:
                'Submit booking error',

              type:
                'negative',

              preconditions: [],

              actions: [
                'Submit booking',
              ],

              expectedOutcomes: [
                'Booking error is shown',
              ],

              evidenceReferences: [
                'CON-1',
              ],
            },
          ]);

        expect(
          result,
        ).toHaveLength(2);
      },
    );

      it(
        'preserves an explicit negative requirement representative during semantic deduplication',
        () => {
          const result =
            deduplicateScenariosWithReasons([
              {
                title:
                  'Unsupported file validation',

                type:
                  'negative',

                preconditions:
                  [],

                actions: [
                  'Exercise unsupported file type',
                ],

                expectedOutcomes: [
                  'Show validation error',
                ],

                evidenceReferences: [
                  'REQ-2',
                  'CON-1',
                ],
              },

              {
                title:
                  'Negative requirement: Unsupported file types show a validation error.',

                type:
                  'negative',

                preconditions:
                  [],

                actions: [
                  'Exercise the invalid or unsupported case described by: Unsupported file types show a validation error.',
                ],

                expectedOutcomes: [
                  'Unsupported file types show a validation error.',
                ],

                evidenceReferences: [
                  'REQ-2',
                ],
              },
            ]);

          expect(
            result,
          ).toHaveLength(
            1,
          );

          expect(
            result[0]
              ?.scenario
              .title,
          ).toBe(
            'Negative requirement: Unsupported file types show a validation error.',
          );

          expect(
            result[0]
              ?.scenario
              .evidenceReferences,
          ).toEqual([
            'CON-1',
            'REQ-2',
          ]);
        },
      );

  },
);
