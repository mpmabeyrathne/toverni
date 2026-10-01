import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  ModelProvider,
} from './model-provider.js';

import {
  BoundedModelProvider,
} from './bounded-model-provider.js';

function createProvider(
  analyzeState:
    ModelProvider['analyzeState'],
): ModelProvider {
  return {
    name:
      'fake',

    analyzeState,

    rankActions:
      vi.fn(),

    generateScenarios:
      vi.fn(),
  };
}

describe(
  'BoundedModelProvider',
  () => {
    it(
      'retries a transient model failure within one logical call',
      async () => {
        const analyzeState =
          vi.fn()
            .mockRejectedValueOnce(
              new Error(
                'temporary',
              ),
            )
            .mockResolvedValueOnce(
              {
                data: {
                  summary:
                    'ok',
                },

                usage: {},
              },
            );

        const provider =
          new BoundedModelProvider(
            createProvider(
              analyzeState as
                ModelProvider[
                  'analyzeState'
                ],
            ),
            {
              maxCalls:
                2,

              retryAttempts:
                2,

              timeoutMs:
                1_000,
            },
          );

        await provider
          .analyzeState(
            {} as never,
          );

        expect(
          analyzeState,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          provider
            .getCallCount(),
        ).toBe(1);
      },
    );

    it(
      'rejects calls after the model-call budget is exhausted',
      async () => {
        const analyzeState =
          vi.fn(
            async () =>
              ({
                data: {
                  summary:
                    'ok',
                },

                usage: {},
              }) as never,
          );

        const provider =
          new BoundedModelProvider(
            createProvider(
              analyzeState,
            ),
            {
              maxCalls:
                1,

              retryAttempts:
                1,

              timeoutMs:
                1_000,
            },
          );

        await provider
          .analyzeState(
            {} as never,
          );

        await expect(
          provider
            .analyzeState(
              {} as never,
            ),
        ).rejects.toThrow(
          'Model call budget exhausted.',
        );
      },
    );

    it(
      'fails a model call that exceeds its per-call timeout',
      async () => {
        const provider =
          new BoundedModelProvider(
            createProvider(
              async () =>
                new Promise(
                  () => {
                    // Never resolves.
                  },
                ),
            ),
            {
              maxCalls:
                1,

              retryAttempts:
                1,

              timeoutMs:
                5,
            },
          );

        await expect(
          provider
            .analyzeState(
              {} as never,
            ),
        ).rejects.toThrow(
          'Model call timed out.',
        );
      },
    );
  },
);
