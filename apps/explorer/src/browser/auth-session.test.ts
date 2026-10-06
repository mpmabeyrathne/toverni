import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  assertAuthenticatedLanding,
} from './auth-session.js';

describe(
  'assertAuthenticatedLanding',
  () => {
    it(
      'allows authenticated application pages',
      () => {
        expect(
          () =>
            assertAuthenticatedLanding({
              requestedUrl:
                'https://example.com/dashboard',

              actualUrl:
                'https://example.com/dashboard',

              title:
                'Dashboard',
            }),
        ).not.toThrow();
      },
    );

    it(
      'reports expired auth when navigation lands on login',
      () => {
        expect(
          () =>
            assertAuthenticatedLanding({
              requestedUrl:
                'https://example.com/dashboard',

              actualUrl:
                'https://example.com/login?next=%2Fdashboard',

              title:
                'Log in',
            }),
        ).toThrow(
          'Saved authentication state appears invalid or expired.',
        );
      },
    );
  },
);
