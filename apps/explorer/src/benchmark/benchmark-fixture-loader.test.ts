import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import {
    fileURLToPath,
  } from 'node:url';
  
  import {
    loadBenchmarkFixture,
  } from './benchmark-fixture-loader.js';
  
  const projectRoot =
    fileURLToPath(
      new URL(
        '../../../../',
        import.meta.url,
      ),
    );
  
  describe(
    'benchmark fixtures',
    () => {
      for (
        const fixtureId of [
          'booking',
          'todo',
          'commerce',
          'auth-rbac',
          'checkout-form',
          'data-grid',
          'upload-retry',
        ]
      ) {
        it(
          `loads ${fixtureId} fixture`,
          async () => {
            const fixture =
              await loadBenchmarkFixture(
                `${projectRoot}fixtures/benchmark/${fixtureId}/fixture.json`,
              );
  
            expect(
              fixture.manifest.id,
            ).toBe(
              fixtureId,
            );
  
            expect(
              fixture.requirements
                .length,
            ).toBeGreaterThan(
              0,
            );
  
            expect(
              fixture.openApi.length,
            ).toBeGreaterThan(
              0,
            );
  
            expect(
              fixture.humanReference
                .flows.length,
            ).toBeGreaterThan(
              0,
            );

            expect(
              fixture.humanReference
                .flows.every(
                  (flow) =>
                    flow.important,
                ),
            ).toBe(true);

            expect(
              fixture.humanReference
                .scenarios.length,
            ).toBeGreaterThan(
              0,
            );

            expect(
              fixture.humanReference
                .scenarios.some(
                  (scenario) =>
                    scenario
                      .assertionCount >
                    0,
                ),
            ).toBe(true);
          },
        );
      }
    },
  );