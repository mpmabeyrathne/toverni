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

import {
  loadBenchmarkFixture,
} from './benchmark-fixture-loader.js';

import {
  startBenchmarkFixtureServer,
} from './benchmark-fixture-server.js';

const projectRoot =
  fileURLToPath(
    new URL(
      '../../../../',
      import.meta.url,
    ),
  );

const fixtureIds = [
  'auth-rbac',
  'checkout-form',
  'data-grid',
  'upload-retry',
] as const;

describe(
  'expanded local benchmark fixtures',
  () => {
    for (
      const fixtureId of
        fixtureIds
    ) {
      it(
        `${fixtureId} is locally runnable and deterministic across fresh servers`,
        async () => {
          const fixture =
            await loadBenchmarkFixture(
              `${projectRoot}fixtures/benchmark/${fixtureId}/fixture.json`,
            );

          const expected =
            await readFile(
              fixture.entryFile,
              'utf8',
            );

          for (
            let attempt = 0;
            attempt < 2;
            attempt += 1
          ) {
            const server =
              await startBenchmarkFixtureServer({
                fixtureDirectory:
                  fixture.rootDirectory,
              });

            try {
              const response =
                await fetch(
                  server.baseUrl,
                );

              expect(
                response.status,
              ).toBe(200);

              expect(
                await response.text(),
              ).toBe(
                expected,
              );
            } finally {
              await server.close();
            }
          }
        },
      );
    }
  },
);
