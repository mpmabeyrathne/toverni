import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import {
    fileURLToPath,
  } from 'node:url';
  
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
  
  describe(
    'startBenchmarkFixtureServer',
    () => {
      it(
        'serves a benchmark fixture',
        async () => {
          const server =
            await startBenchmarkFixtureServer({
              fixtureDirectory:
                `${projectRoot}fixtures/benchmark/booking`,
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
            ).toContain(
              'Room Booking',
            );
          } finally {
            await server.close();
          }
        },
      );
    },
  );