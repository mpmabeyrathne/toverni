import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  compilePlaywrightTest,
} from './playwright-test-renderer.js';

const readyPlan = {
  scenarioId:
    'scenario-1',

  title:
    'Navigate to learn more',

  status:
    'ready' as const,

  reason:
    null,

  evidenceReferences: [
    'ACTION-1',
  ],

  metadata: {
    irVersion:
      '1' as const,

    generator:
      'toverni' as const,
  },

  assertions: [
    {
      afterActionId:
        'action-1',

      kind:
        'url' as const,

      description:
        'URL changed',

      target: {
        kind:
          'page' as const,
      },

      matcher:
        'url' as const,

      expected:
        'https://example.com/learn',

      evidenceReferences: [
        'ACTION-1',
        'FLOW-1',
      ],
    },
  ],

  steps: [
    {
      actionId:
        'action-1',

      description:
        'Learn more',

      evidenceReference:
        'ACTION-1',

      operation: {
        kind:
          'click' as const,

        target: {
          by:
            'role' as const,

          role:
            'link',

          name:
            'Learn more',

          exact:
            true,
        },
      },
    },
  ],
};

describe(
  'compilePlaywrightTest',
  () => {
    it(
      'compiles validated IR into runnable Playwright source',
      () => {
        const source =
          compilePlaywrightTest({
            targetUrl:
              'https://example.com',

            plan:
              readyPlan,
          });

        expect(
          source,
        ).toContain(
          `import { expect, test } from '@playwright/test';`,
        );

        expect(
          source,
        ).toContain(
          'await page.goto("https://example.com");',
        );

        expect(
          source,
        ).toContain(
          'await page.getByRole("link", { name: "Learn more", exact: true }).click();',
        );

        expect(
          source,
        ).toContain(
          'await expect(page).toHaveURL("https://example.com/learn");',
        );

        expect(
          source,
        ).toContain(
          'Assertion evidence: ACTION-1, FLOW-1',
        );

        expect(
          source,
        ).toContain(
          'irVersion: "1"',
        );
      },
    );

    it(
      'produces deterministic source for the same validated IR',
      () => {
        const first =
          compilePlaywrightTest({
            targetUrl:
              'https://example.com',

            plan:
              readyPlan,
          });

        const second =
          compilePlaywrightTest({
            targetUrl:
              'https://example.com',

            plan:
              structuredClone(
                readyPlan,
              ),
          });

        expect(
          first,
        ).toBe(
          second,
        );
      },
    );

    it(
      'rejects unsupported IR before code generation',
      () => {
        expect(
          () =>
            compilePlaywrightTest({
              targetUrl:
                'https://example.com',

              plan: {
                ...readyPlan,

                steps: [
                  {
                    ...readyPlan
                      .steps[0],

                    operation: {
                      kind:
                        'invented-operation',
                    },
                  },
                ],
              } as never,
            }),
        ).toThrow();
      },
    );

    it(
      'refuses to render manual-required plans',
      () => {
        expect(
          () =>
            compilePlaywrightTest({
              targetUrl:
                'https://example.com',

              plan: {
                scenarioId:
                  'scenario-2',

                title:
                  'Book room',

                status:
                  'manual_required',

                reason:
                  'No executable discovered browser actions support this scenario.',

                evidenceReferences: [
                  'REQ-1',
                ],

                metadata: {
                  irVersion:
                    '1',

                  generator:
                    'toverni',
                },

                assertions: [],

                steps: [],
              },
            }),
        ).toThrow(
          'Cannot render a manual-required test plan.',
        );
      },
    );
  },
);
