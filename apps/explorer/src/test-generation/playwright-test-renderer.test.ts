import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import {
    renderPlaywrightTest,
  } from './playwright-test-renderer.js';
  
  describe(
    'renderPlaywrightTest',
    () => {
      it(
        'renders a runnable Playwright test from a ready plan',
        () => {
          const source =
            renderPlaywrightTest({
              targetUrl:
                'https://example.com',
  
              plan: {
                scenarioId:
                  'scenario-1',
  
                title:
                  'Navigate to learn more',
  
                status:
                  'ready',
  
                reason:
                  null,
  
                evidenceReferences: [
                  'ACTION-1',
                ],
  
                steps: [
                  {
                    actionId:
                      'action-1',
  
                    description:
                      'Learn more',
  
                    evidenceReference:
                      'ACTION-1',
  
                    playwright:
                      'page.getByRole("link", { name: "Learn more", exact: true }).click();',
                  },
                ],
              },
            });
  
          expect(
            source,
          ).toContain(
            `import { test } from '@playwright/test';`,
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
            'ACTION-1',
          );
        },
      );
  
      it(
        'refuses to render manual-required plans',
        () => {
          expect(
            () =>
              renderPlaywrightTest({
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