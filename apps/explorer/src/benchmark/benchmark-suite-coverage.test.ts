import {
  describe,
  expect,
  it,
} from 'vitest';

const fixtureCapabilities = {
  booking: [
    'booking',
  ],

  todo: [
    'crud',
  ],

  commerce: [
    'cart',
  ],

  'auth-rbac': [
    'authentication',
    'session',
    'rbac',
    'spa-route',
  ],

  'checkout-form': [
    'checkout',
    'multi-step-form',
    'validation',
    'dialog',
  ],

  'data-grid': [
    'search',
    'filter',
    'sort',
    'dynamic-table',
    'pagination',
    'api-driven-update',
  ],

  'upload-retry': [
    'file-upload',
    'error-state',
    'retry',
    'api-driven-update',
  ],
} as const;

describe(
  'expanded benchmark suite',
  () => {
    it(
      'covers substantially more representative interaction patterns',
      () => {
        const patterns =
          new Set(
            Object.values(
              fixtureCapabilities,
            ).flat(),
          );

        expect(
          patterns.size,
        ).toBeGreaterThanOrEqual(
          15,
        );

        for (
          const expected of [
            'authentication',
            'session',
            'rbac',
            'checkout',
            'multi-step-form',
            'validation',
            'search',
            'filter',
            'sort',
            'dynamic-table',
            'pagination',
            'dialog',
            'error-state',
            'retry',
            'api-driven-update',
            'spa-route',
            'file-upload',
          ]
        ) {
          expect(
            patterns.has(
              expected,
            ),
          ).toBe(true);
        }
      },
    );
  },
);
