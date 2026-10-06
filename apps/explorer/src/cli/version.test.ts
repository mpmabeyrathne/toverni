import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  getPackageVersion,
} from './version.js';

describe(
  'getPackageVersion',
  () => {
    it(
      'reads the package version from package.json',
      async () => {
        await expect(
          getPackageVersion(),
        ).resolves.toMatch(
          /^\d+\.\d+\.\d+/,
        );
      },
    );
  },
);
