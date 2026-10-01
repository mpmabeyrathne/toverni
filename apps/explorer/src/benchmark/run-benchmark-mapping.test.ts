import {
  readFile,
} from 'node:fs/promises';

import {
  fileURLToPath,
} from 'node:url';

import {
  describe,
  expect,
  it,
} from 'vitest';

describe(
  'benchmark scenario runtime mapping',
  () => {
    it(
      'preserves runtimeStatus in mapped benchmark scenarios',
      async () => {
        const sourcePath =
          fileURLToPath(
            new URL(
              './run-benchmark.ts',
              import.meta.url,
            ),
          );

        const source =
          await readFile(
            sourcePath,
            'utf8',
          );

        expect(
          source,
        ).toContain(
          'runtimeStatus,',
        );

        expect(
          source,
        ).toContain(
          "?.executionStatus ===\n          'passed'",
        );

        expect(
          source,
        ).toContain(
          "'runtime_error'",
        );
      },
    );
  },
);
