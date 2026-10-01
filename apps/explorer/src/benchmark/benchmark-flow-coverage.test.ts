import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  buildBenchmarkFlowCoverageReport,
} from './benchmark-flow-coverage.js';

describe(
  'buildBenchmarkFlowCoverageReport',
  () => {
    it(
      'assigns an explicit status to every benchmark reference flow',
      () => {
        const report =
          buildBenchmarkFlowCoverageReport(
            [
              {
                id:
                  'BOOK-1',

                title:
                  'Book available room',

                important:
                  true,

                keywords: [
                  'book',
                  'room',
                ],
              },
              {
                id:
                  'BOOK-2',

                title:
                  'Cancel booking',

                important:
                  true,

                keywords: [
                  'cancel',
                  'booking',
                ],
              },
            ],
            [
              {
                title:
                  'Book an available room',

                actions: [
                  'Book room',
                ],

                expectedOutcomes: [
                  'Room is booked',
                ],

                executable:
                  true,

                evidenceReferences: [],

                unsupportedSteps: [],

                humanEditsRequired:
                  0,
              },
            ],
          );

        expect(
          report.entries,
        ).toHaveLength(
          2,
        );

        expect(
          report.entries[0]
            ?.status,
        ).toBe(
          'covered',
        );

        expect(
          report.entries[1]
            ?.status,
        ).toBe(
          'uncovered',
        );
      },
    );

    it(
      'marks matching unsupported benchmark scenarios as blocked',
      () => {
        const report =
          buildBenchmarkFlowCoverageReport(
            [
              {
                id:
                  'SHOP-1',

                title:
                  'Add product to cart',

                important:
                  true,

                keywords: [
                  'add',
                  'cart',
                ],
              },
            ],
            [
              {
                title:
                  'Add product to cart',

                actions: [
                  'Add to cart',
                ],

                expectedOutcomes: [
                  'Product appears in cart',
                ],

                executable:
                  false,

                evidenceReferences: [],

                unsupportedSteps: [
                  'Unsupported selector',
                ],

                humanEditsRequired:
                  1,
              },
            ],
          );

        expect(
          report.entries[0]
            ?.status,
        ).toBe(
          'blocked',
        );
      },
    );
  },
);
