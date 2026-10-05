import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  extractGeneratedPlaywrightTests,
  normalizePlaywrightAgentsScenarios,
  parsePlaywrightJsonReport,
  parsePlaywrightPlannerMarkdown,
} from './playwright-agents-normalizer.js';

describe(
  'playwright-agents-normalizer',
  () => {
    const plannerMarkdown =
      [
        '# Plan',
        '',
        '#### 1.1. Book an available room',
        '',
        '**File:** `tests/booking/book.spec.ts`',
        '',
        '1. Click Book Ocean Room.',
        '  - expect: Ocean Room booked is visible.',
        '',
        '#### 1.2. Prevent duplicate booking',
        '',
        '**File:** `tests/booking/duplicate.spec.ts`',
        '',
        '1. Click Book Ocean Room.',
        '2. Click Book Ocean Room again.',
        '  - expect: A second active booking is not created.',
      ].join(
        '\n',
      );

    it(
      'parses planner scenarios without losing omitted generator scenarios',
      () => {
        const scenarios =
          parsePlaywrightPlannerMarkdown(
            plannerMarkdown,
          );

        expect(
          scenarios,
        ).toHaveLength(
          2,
        );

        expect(
          scenarios[0],
        ).toMatchObject({
          title:
            'Book an available room',

          filePath:
            'tests/booking/book.spec.ts',
        });

        expect(
          scenarios[1]
            ?.actions,
        ).toHaveLength(
          2,
        );
      },
    );

    it(
      'extracts generated Playwright test titles and assertion counts',
      () => {
        const tests =
          extractGeneratedPlaywrightTests(
            'book.spec.ts',
            [
              "import { test, expect } from '@playwright/test';",
              "test('Book an available room', async ({ page }) => {",
              "  await expect(page.getByText('Ocean Room booked')).toBeVisible();",
              "  await expect(page.getByRole('button', { name: 'Cancel Booking' })).toBeEnabled();",
              '});',
            ].join(
              '\n',
            ),
          );

        expect(
          tests,
        ).toEqual([
          {
            title:
              'Book an available room',

            filePath:
              'book.spec.ts',

            assertionCount:
              2,
          },
        ]);
      },
    );

    it(
      'maps Playwright JSON reporter statuses',
      () => {
        const statuses =
          parsePlaywrightJsonReport(
            JSON.stringify({
              suites: [
                {
                  specs: [
                    {
                      title:
                        'Book an available room',

                      tests: [
                        {
                          results: [
                            {
                              status:
                                'passed',
                            },
                          ],
                        },
                      ],
                    },

                    {
                      title:
                        'Broken test',

                      tests: [
                        {
                          results: [
                            {
                              status:
                                'failed',
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            }),
          );

        expect(
          [
            ...statuses.values(),
          ],
        ).toEqual([
          'passed',
          'failed',
        ]);
      },
    );

    it(
      'marks planner scenarios omitted by the generator as non executable',
      () => {
        const generatedTests =
          extractGeneratedPlaywrightTests(
            'book.spec.ts',
            [
              "import { test, expect } from '@playwright/test';",
              "test('Book an available room', async ({ page }) => {",
              "  await expect(page.getByText('Ocean Room booked')).toBeVisible();",
              '});',
            ].join(
              '\n',
            ),
          );

        const runtimeStatuses =
          parsePlaywrightJsonReport(
            JSON.stringify({
              suites: [
                {
                  specs: [
                    {
                      title:
                        'Book an available room',

                      tests: [
                        {
                          results: [
                            {
                              status:
                                'passed',
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            }),
          );

        const scenarios =
          normalizePlaywrightAgentsScenarios({
            plannerMarkdown,
            generatedTests,
            runtimeStatuses,
            requirements: {
              acceptanceCriteria: [
                'A customer can book an available room.',
              ],

              capabilities: [
                'Book an available room.',
              ],

              constraints: [
                'The same room cannot be booked twice for the same date.',
              ],
            },
          });

        expect(
          scenarios,
        ).toHaveLength(
          2,
        );

        expect(
          scenarios[0],
        ).toMatchObject({
          executable:
            true,

          runtimeStatus:
            'passed',

          humanEditsRequired:
            0,

          assertionCount:
            1,
        });

        expect(
          scenarios[0]
            ?.evidenceReferences,
        ).toContain(
          'REQ-1',
        );

        expect(
          scenarios[1],
        ).toMatchObject({
          executable:
            false,

          runtimeStatus:
            'not_run',

          humanEditsRequired:
            1,

          assertionCount:
            0,
        });

        expect(
          scenarios[1]
            ?.evidenceReferences,
        ).toContain(
          'CON-1',
        );
      },
    );
  },
);
