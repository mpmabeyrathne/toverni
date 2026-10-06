import {
  describe,
  expect,
  it,
} from 'vitest';

const releaseFixtureCapabilities = {
  booking: [
    'search',
    'async-loading-api-state',
  ],

  todo: [
    'crud',
    'validation',
  ],

  commerce: [
    'crud',
    'async-loading-api-state',
  ],

  'auth-rbac': [
    'auth-session',
    'rbac',
    'spa-routing',
  ],

  'checkout-form': [
    'multi-step-forms',
    'validation',
    'dialogs-modals',
  ],

  'data-grid': [
    'search-filter-sort',
    'pagination',
    'async-loading-api-state',
  ],

  'upload-retry': [
    'file-upload',
    'recovery-error-states',
  ],
} as const;

describe(
  'public beta release pattern matrix',
  () => {
    it(
      'covers every TOV-124 representative application pattern',
      () => {
        const represented =
          new Set<string>(
            Object.values(
              releaseFixtureCapabilities,
            ).flat(),
          );

        for (
          const required of [
            'crud',
            'auth-session',
            'rbac',
            'search-filter-sort',
            'multi-step-forms',
            'validation',
            'file-upload',
            'dialogs-modals',
            'pagination',
            'spa-routing',
            'async-loading-api-state',
            'recovery-error-states',
          ]
        ) {
          expect(
            represented.has(
              required,
            ),
          ).toBe(
            true,
          );
        }
      },
    );

    it(
      'uses more than one fixture for API-driven/application-state behavior',
      () => {
        const apiDrivenFixtures =
          Object.entries(
            releaseFixtureCapabilities,
          )
            .filter(
              (
                [
                  ,
                  capabilities,
                ],
              ) =>
                (
                  capabilities as
                    readonly string[]
                ).includes(
                  'async-loading-api-state',
                ),
            );

        expect(
          apiDrivenFixtures.length,
        ).toBeGreaterThanOrEqual(
          2,
        );
      },
    );
  },
);
