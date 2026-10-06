import {
  createServer,
} from 'node:http';

import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  createModelProviderRuntime,
} from './model-provider-runtime.js';

const servers:
  Array<
    ReturnType<
      typeof createServer
    >
  > = [];

async function startOllamaFixture(
  models:
    string[],
): Promise<string> {
  const server =
    createServer(
      (
        request,
        response,
      ) => {
        if (
          request.url ===
          '/api/version'
        ) {
          response.writeHead(
            200,
            {
              'content-type':
                'application/json',
            },
          );

          response.end(
            JSON.stringify({
              version:
                'test',
            }),
          );

          return;
        }

        if (
          request.url ===
          '/api/tags'
        ) {
          response.writeHead(
            200,
            {
              'content-type':
                'application/json',
            },
          );

          response.end(
            JSON.stringify({
              models:
                models.map(
                  (name) => ({
                    name,
                    model:
                      name,
                  }),
                ),
            }),
          );

          return;
        }

        response.writeHead(
          404,
        );

        response.end();
      },
    );

  servers.push(
    server,
  );

  await new Promise<void>(
    (resolve) => {
      server.listen(
        0,
        '127.0.0.1',
        resolve,
      );
    },
  );

  const address =
    server.address();

  if (
    !address ||
    typeof address ===
      'string'
  ) {
    throw new Error(
      'Unable to resolve model fixture server.',
    );
  }

  return `http://127.0.0.1:${address.port}`;
}

afterEach(
  async () => {
    await Promise.all(
      servers
        .splice(
          0,
        )
        .map(
          (server) =>
            new Promise<void>(
              (
                resolve,
                reject,
              ) => {
                server.close(
                  (error) => {
                    if (
                      error
                    ) {
                      reject(
                        error,
                      );

                      return;
                    }

                    resolve();
                  },
                );
              },
            ),
        ),
    );
  },
);

describe(
  'createModelProviderRuntime',
  () => {
    it(
      'preflights a local Ollama provider and installed models',
      async () => {
        const baseUrl =
          await startOllamaFixture([
            'llama3.2:3b',
            'qwen3:4b',
          ]);

        const runtime =
          createModelProviderRuntime({
            provider:
              'ollama',

            baseUrl,

            cheapModel:
              'llama3.2:3b',

            complexModel:
              'qwen3:4b',
          });

        expect(
          runtime.kind,
        ).toBe(
          'ollama',
        );

        expect(
          runtime.local,
        ).toBe(
          true,
        );

        expect(
          runtime
            .requiresUserCredentials,
        ).toBe(
          false,
        );

        await expect(
          runtime.preflight(),
        ).resolves.toMatchObject({
          provider:
            'ollama',

          local:
            true,
        });
      },
    );

    it(
      'returns a friendly diagnostic when a requested Ollama model is missing',
      async () => {
        const baseUrl =
          await startOllamaFixture([
            'llama3.2:3b',
          ]);

        const runtime =
          createModelProviderRuntime({
            provider:
              'ollama',

            baseUrl,

            cheapModel:
              'llama3.2:3b',

            complexModel:
              'qwen3:4b',
          });

        await expect(
          runtime.preflight(),
        ).rejects.toThrow(
          'ollama pull qwen3:4b',
        );
      },
    );

    it(
      'returns a friendly diagnostic when Ollama is unreachable',
      async () => {
        const runtime =
          createModelProviderRuntime({
            provider:
              'ollama',

            baseUrl:
              'http://127.0.0.1:1',

            cheapModel:
              'llama3.2:3b',

            complexModel:
              'llama3.2:3b',
          });

        await expect(
          runtime.preflight(),
        ).rejects.toThrow(
          'Ollama is not reachable.',
        );
      },
    );
  },
);
