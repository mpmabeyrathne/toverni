import {
  mkdtemp,
  writeFile,
} from 'node:fs/promises';

import {
  tmpdir,
} from 'node:os';

import {
  join,
} from 'node:path';

import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  applyModelEnvironment,
  CliInputError,
  parsePublicCli,
} from './public-cli.js';

const originalEnvironment = {
  MODEL_PROVIDER:
    process.env
      .MODEL_PROVIDER,

  MODEL_RETRY_ATTEMPTS:
    process.env
      .MODEL_RETRY_ATTEMPTS,

  MODEL_REASONING_ENABLED:
    process.env
      .MODEL_REASONING_ENABLED,

  OLLAMA_BASE_URL:
    process.env
      .OLLAMA_BASE_URL,

  OLLAMA_CHEAP_MODEL:
    process.env
      .OLLAMA_CHEAP_MODEL,

  OLLAMA_COMPLEX_MODEL:
    process.env
      .OLLAMA_COMPLEX_MODEL,
};

afterEach(
  () => {
    for (
      const [
        key,
        value,
      ] of
      Object.entries(
        originalEnvironment,
      )
    ) {
      if (
        value ===
        undefined
      ) {
        delete process.env[
          key
        ];
      } else {
        process.env[
          key
        ] =
          value;
      }
    }
  },
);

describe(
  'parsePublicCli',
  () => {
    it(
      'resolves summary JSON output relative to the working directory',
      async () => {
        const directory =
          await mkdtemp(
            join(
              tmpdir(),
              'toverni-summary-cli-',
            ),
          );

        const command =
          await parsePublicCli(
            [
              'generate',
              'http://localhost:3000',
              '--summary-json',
              './artifacts/summary.json',
            ],
            directory,
          );

        expect(
          command,
        ).toMatchObject({
          kind:
            'generate',

          config: {
            summaryJson:
              join(
                directory,
                'artifacts',
                'summary.json',
              ),
          },
        });
      },
    );

    it(
      'parses provider-neutral model settings while keeping Ollama as the current runtime provider',
      async () => {
        const command =
          await parsePublicCli(
            [
              'generate',
              'http://localhost:3000',
              '--model-provider',
              'ollama',
              '--model-retry-attempts',
              '3',
              '--model-reasoning',
              '--cheap-model',
              'llama3.2:3b',
              '--complex-model',
              'qwen3:4b',
            ],
            process.cwd(),
          );

        expect(
          command,
        ).toMatchObject({
          kind:
            'generate',

          config: {
            model: {
              provider:
                'ollama',

              retryAttempts:
                3,

              reasoningEnabled:
                true,

              cheapModel:
                'llama3.2:3b',

              complexModel:
                'qwen3:4b',
            },
          },
        });
      },
    );

    it(
      'rejects unsupported cloud providers until BYOK adapters are intentionally enabled',
      async () => {
        await expect(
          parsePublicCli(
            [
              'generate',
              'http://localhost:3000',
              '--model-provider',
              'openai',
            ],
            process.cwd(),
          ),
        ).rejects.toThrow(
          'currently supports only "ollama"',
        );
      },
    );

    it(
      'applies provider and retry model settings without requiring credentials',
      () => {
        applyModelEnvironment({
          provider:
            'ollama',

          retryAttempts:
            4,

          reasoningEnabled:
            true,
        });

        expect(
          process.env
            .MODEL_PROVIDER,
        ).toBe(
          'ollama',
        );

        expect(
          process.env
            .MODEL_RETRY_ATTEMPTS,
        ).toBe(
          '4',
        );

        expect(
          process.env
            .MODEL_REASONING_ENABLED,
        ).toBe(
          'true',
        );
      },
    );

    it(
      'supports a browser-only generate command',
      async () => {
        const command =
          await parsePublicCli(
            [
              'generate',
              'http://localhost:3000',
            ],
            process.cwd(),
          );

        expect(
          command,
        ).toMatchObject({
          kind:
            'generate',

          config: {
            target:
              'http://localhost:3000',
          },
        });
      },
    );

    it(
      'loads YAML config and resolves file paths relative to the config file',
      async () => {
        const directory =
          await mkdtemp(
            join(
              tmpdir(),
              'toverni-cli-',
            ),
          );

        const configPath =
          join(
            directory,
            'toverni.yaml',
          );

        await writeFile(
          configPath,
          [
            'target: http://localhost:4173',
            'requirements: ./docs/requirements.md',
            'openapi: ./docs/openapi.yaml',
            'output: ./tests/toverni',
            'headless: true',
            'safety:',
            '  allowDestructiveActions: false',
          ].join(
            '\n',
          ),
          'utf8',
        );

        const command =
          await parsePublicCli(
            [
              'generate',
              '--config',
              configPath,
            ],
            process.cwd(),
          );

        expect(
          command.kind,
        ).toBe(
          'generate',
        );

        if (
          command.kind !==
          'generate'
        ) {
          return;
        }

        expect(
          command.config,
        ).toMatchObject({
          target:
            'http://localhost:4173',

          requirements:
            join(
              directory,
              'docs',
              'requirements.md',
            ),

          openapi:
            join(
              directory,
              'docs',
              'openapi.yaml',
            ),

          output:
            join(
              directory,
              'tests',
              'toverni',
            ),

          headless:
            true,

          safety: {
            allowDestructiveActions:
              false,
          },
        });
      },
    );

    it(
      'lets CLI flags override config values while preserving nested config',
      async () => {
        const directory =
          await mkdtemp(
            join(
              tmpdir(),
              'toverni-cli-',
            ),
          );

        await writeFile(
          join(
            directory,
            'toverni.yaml',
          ),
          [
            'target: http://localhost:3000',
            'headless: false',
            'model:',
            '  reasoningEnabled: false',
            '  cheapModel: base-model',
            '  complexModel: complex-model',
            'exploration:',
            '  maxActions: 20',
            '  maxModelCalls: 5',
          ].join(
            '\n',
          ),
          'utf8',
        );

        const command =
          await parsePublicCli(
            [
              'generate',
              'http://localhost:4000',
              '--headless',
              '--model-reasoning',
              '--cheap-model',
              'override-model',
              '--max-actions',
              '12',
            ],
            directory,
          );

        expect(
          command,
        ).toMatchObject({
          kind:
            'generate',

          config: {
            target:
              'http://localhost:4000',

            headless:
              true,

            model: {
              reasoningEnabled:
                true,

              cheapModel:
                'override-model',

              complexModel:
                'complex-model',
            },

            exploration: {
              maxActions:
                12,

              maxModelCalls:
                5,
            },
          },
        });
      },
    );

    it(
      'accepts the future auth/session contract without silently converting it',
      async () => {
        const directory =
          await mkdtemp(
            join(
              tmpdir(),
              'toverni-cli-',
            ),
          );

        const command =
          await parsePublicCli(
            [
              'generate',
              'http://localhost:3000',
              '--storage-state',
              './auth/user.json',
            ],
            directory,
          );

        expect(
          command,
        ).toMatchObject({
          kind:
            'generate',

          config: {
            auth: {
              storageState:
                join(
                  directory,
                  'auth',
                  'user.json',
                ),
            },
          },
        });
      },
    );

    it(
      'rejects missing targets with an actionable error',
      async () => {
        await expect(
          parsePublicCli(
            [
              'generate',
              '--headless',
            ],
            process.cwd(),
          ),
        ).rejects.toThrow(
          'A target URL is required',
        );
      },
    );

    it(
      'rejects unknown options',
      async () => {
        await expect(
          parsePublicCli(
            [
              'generate',
              'http://localhost:3000',
              '--wat',
            ],
            process.cwd(),
          ),
        ).rejects.toBeInstanceOf(
          CliInputError,
        );
      },
    );

    it(
      'applies model overrides to the existing model environment contract',
      () => {
        applyModelEnvironment({
          reasoningEnabled:
            true,

          ollamaBaseUrl:
            'http://127.0.0.1:11434',

          cheapModel:
            'cheap',

          complexModel:
            'complex',
        });

        expect(
          process.env
            .MODEL_REASONING_ENABLED,
        ).toBe(
          'true',
        );

        expect(
          process.env
            .OLLAMA_BASE_URL,
        ).toBe(
          'http://127.0.0.1:11434',
        );

        expect(
          process.env
            .OLLAMA_CHEAP_MODEL,
        ).toBe(
          'cheap',
        );

        expect(
          process.env
            .OLLAMA_COMPLEX_MODEL,
        ).toBe(
          'complex',
        );
      },
    );
  },
);
