import {
  access,
  readFile,
} from 'node:fs/promises';

import {
  dirname,
  isAbsolute,
  resolve,
} from 'node:path';

import {
  parse as parseYaml,
} from 'yaml';

import {
  z,
} from 'zod';

const positiveIntegerSchema =
  z.number()
    .int()
    .positive();

const publicConfigSchema =
  z.object({
    target:
      z.url()
        .optional(),

    requirements:
      z.string()
        .min(1)
        .optional(),

    openapi:
      z.string()
        .min(1)
        .optional(),

    output:
      z.string()
        .min(1)
        .optional(),

    summaryJson:
      z.string()
        .min(1)
        .optional(),

    headless:
      z.boolean()
        .optional(),

    resumeRunId:
      z.string()
        .min(1)
        .optional(),

    auth:
      z.object({
        storageState:
          z.string()
            .min(1)
            .optional(),
      })
        .strict()
        .optional(),

    safety:
      z.object({
        allowDestructiveActions:
          z.boolean()
            .optional(),
      })
        .strict()
        .optional(),

    model:
      z.object({
        provider:
          z.enum([
            'ollama',
          ])
            .optional(),

        reasoningEnabled:
          z.boolean()
            .optional(),

        retryAttempts:
          positiveIntegerSchema
            .optional(),

        ollamaBaseUrl:
          z.url()
            .optional(),

        cheapModel:
          z.string()
            .min(1)
            .optional(),

        complexModel:
          z.string()
            .min(1)
            .optional(),
      })
        .strict()
        .optional(),

    exploration:
      z.object({
        maxActions:
          positiveIntegerSchema
            .optional(),

        maxModelCalls:
          positiveIntegerSchema
            .optional(),
      })
        .strict()
        .optional(),

    timeouts:
      z.object({
        navigationMs:
          positiveIntegerSchema
            .optional(),

        actionMs:
          positiveIntegerSchema
            .optional(),

        modelCallMs:
          positiveIntegerSchema
            .optional(),

        testMs:
          positiveIntegerSchema
            .optional(),
      })
        .strict()
        .optional(),
  })
    .strict();

export type PublicGenerateConfig =
  z.infer<
    typeof publicConfigSchema
  >;

export type PublicCliCommand =
  | {
      kind:
        'help';
    }
  | {
      kind:
        'generate';

      config:
        PublicGenerateConfig;

      configPath:
        string | null;
    };

export class CliInputError
  extends Error {
  constructor(
    message:
      string,
  ) {
    super(
      message,
    );

    this.name =
      'CliInputError';
  }
}

interface ParsedArguments {
  help:
    boolean;

  configPath?:
    string;

  target?:
    string;

  requirements?:
    string;

  openapi?:
    string;

  output?:
    string;

  summaryJson?:
    string;

  headless?:
    boolean;

  resumeRunId?:
    string;

  storageState?:
    string;

  allowDestructiveActions?:
    boolean;

  modelProvider?:
    'ollama';

  modelReasoningEnabled?:
    boolean;

  modelRetryAttempts?:
    number;

  ollamaBaseUrl?:
    string;

  cheapModel?:
    string;

  complexModel?:
    string;

  maxActions?:
    number;

  maxModelCalls?:
    number;

  navigationTimeoutMs?:
    number;

  actionTimeoutMs?:
    number;

  modelTimeoutMs?:
    number;

  testTimeoutMs?:
    number;
}

const DEFAULT_CONFIG_FILES =
  [
    'toverni.yaml',
    'toverni.yml',
  ] as const;

function requireValue(
  args:
    string[],

  index:
    number,

  flag:
    string,
): string {
  const value =
    args[
      index + 1
    ];

  if (
    !value ||
    value.startsWith(
      '--',
    )
  ) {
    throw new CliInputError(
      `${flag} requires a value.`,
    );
  }

  return value;
}

function parsePositiveInteger(
  value:
    string,

  flag:
    string,
): number {
  const parsed =
    Number(
      value,
    );

  if (
    !Number.isInteger(
      parsed,
    ) ||
    parsed <=
      0
  ) {
    throw new CliInputError(
      `${flag} must be a positive integer.`,
    );
  }

  return parsed;
}

function parseArguments(
  input:
    string[],
): ParsedArguments {
  const args =
    [
      ...input,
    ];

  if (
    args[0] ===
    'generate'
  ) {
    args.shift();
  }

  if (
    args.length ===
      0 ||
    args.includes(
      '--help',
    ) ||
    args.includes(
      '-h',
    ) ||
    args[0] ===
      'help'
  ) {
    return {
      help:
        true,
    };
  }

  const parsed:
    ParsedArguments = {
      help:
        false,
    };

  for (
    let index = 0;
    index <
    args.length;
    index +=
    1
  ) {
    const argument =
      args[index];

    if (
      !argument
    ) {
      continue;
    }

    if (
      !argument.startsWith(
        '-',
      )
    ) {
      if (
        parsed.target
      ) {
        throw new CliInputError(
          'Only one target URL may be provided.',
        );
      }

      parsed.target =
        argument;

      continue;
    }

    switch (
      argument
    ) {
      case '--config':
      case '-c': {
        parsed.configPath =
          requireValue(
            args,
            index,
            argument,
          );

        index +=
          1;

        break;
      }

      case '--requirements': {
        parsed.requirements =
          requireValue(
            args,
            index,
            argument,
          );

        index +=
          1;

        break;
      }

      case '--openapi': {
        parsed.openapi =
          requireValue(
            args,
            index,
            argument,
          );

        index +=
          1;

        break;
      }

      case '--output':
      case '-o': {
        parsed.output =
          requireValue(
            args,
            index,
            argument,
          );

        index +=
          1;

        break;
      }

      case '--summary-json': {
        parsed.summaryJson =
          requireValue(
            args,
            index,
            argument,
          );

        index +=
          1;

        break;
      }

      case '--headless': {
        parsed.headless =
          true;

        break;
      }

      case '--headed': {
        parsed.headless =
          false;

        break;
      }

      case '--resume': {
        parsed.resumeRunId =
          requireValue(
            args,
            index,
            argument,
          );

        index +=
          1;

        break;
      }

      case '--storage-state': {
        parsed.storageState =
          requireValue(
            args,
            index,
            argument,
          );

        index +=
          1;

        break;
      }

      case '--allow-destructive-actions': {
        parsed.allowDestructiveActions =
          true;

        break;
      }

      case '--deny-destructive-actions': {
        parsed.allowDestructiveActions =
          false;

        break;
      }

      case '--model-provider': {
        const value =
          requireValue(
            args,
            index,
            argument,
          );

        if (
          value !==
          'ollama'
        ) {
          throw new CliInputError(
            '--model-provider currently supports only "ollama". Cloud/BYOK providers will use the same provider interface in production.',
          );
        }

        parsed.modelProvider =
          'ollama';

        index +=
          1;

        break;
      }

      case '--model-retry-attempts': {
        const value =
          requireValue(
            args,
            index,
            argument,
          );

        parsed.modelRetryAttempts =
          parsePositiveInteger(
            value,
            argument,
          );

        index +=
          1;

        break;
      }

      case '--model-reasoning': {
        parsed.modelReasoningEnabled =
          true;

        break;
      }

      case '--no-model-reasoning': {
        parsed.modelReasoningEnabled =
          false;

        break;
      }

      case '--ollama-base-url': {
        parsed.ollamaBaseUrl =
          requireValue(
            args,
            index,
            argument,
          );

        index +=
          1;

        break;
      }

      case '--cheap-model': {
        parsed.cheapModel =
          requireValue(
            args,
            index,
            argument,
          );

        index +=
          1;

        break;
      }

      case '--complex-model': {
        parsed.complexModel =
          requireValue(
            args,
            index,
            argument,
          );

        index +=
          1;

        break;
      }

      case '--max-actions': {
        const value =
          requireValue(
            args,
            index,
            argument,
          );

        parsed.maxActions =
          parsePositiveInteger(
            value,
            argument,
          );

        index +=
          1;

        break;
      }

      case '--max-model-calls': {
        const value =
          requireValue(
            args,
            index,
            argument,
          );

        parsed.maxModelCalls =
          parsePositiveInteger(
            value,
            argument,
          );

        index +=
          1;

        break;
      }

      case '--navigation-timeout-ms': {
        const value =
          requireValue(
            args,
            index,
            argument,
          );

        parsed.navigationTimeoutMs =
          parsePositiveInteger(
            value,
            argument,
          );

        index +=
          1;

        break;
      }

      case '--action-timeout-ms': {
        const value =
          requireValue(
            args,
            index,
            argument,
          );

        parsed.actionTimeoutMs =
          parsePositiveInteger(
            value,
            argument,
          );

        index +=
          1;

        break;
      }

      case '--model-timeout-ms': {
        const value =
          requireValue(
            args,
            index,
            argument,
          );

        parsed.modelTimeoutMs =
          parsePositiveInteger(
            value,
            argument,
          );

        index +=
          1;

        break;
      }

      case '--test-timeout-ms': {
        const value =
          requireValue(
            args,
            index,
            argument,
          );

        parsed.testTimeoutMs =
          parsePositiveInteger(
            value,
            argument,
          );

        index +=
          1;

        break;
      }

      default:
        throw new CliInputError(
          `Unknown option: ${argument}. Run with --help for usage.`,
        );
    }
  }

  return parsed;
}

async function fileExists(
  path:
    string,
): Promise<boolean> {
  try {
    await access(
      path,
    );

    return true;
  } catch {
    return false;
  }
}

async function findConfigPath(
  cwd:
    string,

  explicitPath?:
    string,
): Promise<string | null> {
  if (
    explicitPath
  ) {
    const resolved =
      resolve(
        cwd,
        explicitPath,
      );

    if (
      !await fileExists(
        resolved,
      )
    ) {
      throw new CliInputError(
        `Config file not found: ${resolved}`,
      );
    }

    return resolved;
  }

  for (
    const fileName of
    DEFAULT_CONFIG_FILES
  ) {
    const candidate =
      resolve(
        cwd,
        fileName,
      );

    if (
      await fileExists(
        candidate,
      )
    ) {
      return candidate;
    }
  }

  return null;
}

function resolvePathValue(
  baseDirectory:
    string,

  value?:
    string,
): string | undefined {
  if (
    !value
  ) {
    return undefined;
  }

  return isAbsolute(
    value,
  )
    ? value
    : resolve(
        baseDirectory,
        value,
      );
}

function normalizeConfigPaths(
  config:
    PublicGenerateConfig,

  baseDirectory:
    string,
): PublicGenerateConfig {
  const requirements =
    resolvePathValue(
      baseDirectory,
      config.requirements,
    );

  const openapi =
    resolvePathValue(
      baseDirectory,
      config.openapi,
    );

  const output =
    resolvePathValue(
      baseDirectory,
      config.output,
    );

  const summaryJson =
    resolvePathValue(
      baseDirectory,
      config.summaryJson,
    );

  const storageState =
    resolvePathValue(
      baseDirectory,
      config.auth
        ?.storageState,
    );

  return {
    ...config,

    ...(requirements
      ? {
          requirements,
        }
      : {}),

    ...(openapi
      ? {
          openapi,
        }
      : {}),

    ...(output
      ? {
          output,
        }
      : {}),

    ...(summaryJson
      ? {
          summaryJson,
        }
      : {}),

    ...(config.auth
      ? {
          auth: {
            ...config.auth,

            ...(storageState
              ? {
                  storageState,
                }
              : {}),
          },
        }
      : {}),
  };
}

async function loadConfigFile(
  path:
    string,
): Promise<PublicGenerateConfig> {
  let source:
    string;

  try {
    source =
      await readFile(
        path,
        'utf8',
      );
  } catch (
    error:
      unknown
  ) {
    throw new CliInputError(
      `Unable to read config file ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  let parsed:
    unknown;

  try {
    parsed =
      parseYaml(
        source,
      );
  } catch (
    error:
      unknown
  ) {
    throw new CliInputError(
      `Invalid YAML in ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const config =
    publicConfigSchema.parse(
      parsed ??
        {},
    );

  return normalizeConfigPaths(
    config,
    dirname(
      path,
    ),
  );
}

function buildCliOverrides(
  parsed:
    ParsedArguments,

  cwd:
    string,
): PublicGenerateConfig {
  const requirements =
    resolvePathValue(
      cwd,
      parsed.requirements,
    );

  const openapi =
    resolvePathValue(
      cwd,
      parsed.openapi,
    );

  const output =
    resolvePathValue(
      cwd,
      parsed.output,
    );

  const summaryJson =
    resolvePathValue(
      cwd,
      parsed.summaryJson,
    );

  const storageState =
    resolvePathValue(
      cwd,
      parsed.storageState,
    );

  const model =
    (
      parsed
        .modelProvider !==
        undefined ||
      parsed
        .modelReasoningEnabled !==
        undefined ||
      parsed
        .modelRetryAttempts !==
        undefined ||
      parsed
        .ollamaBaseUrl !==
        undefined ||
      parsed
        .cheapModel !==
        undefined ||
      parsed
        .complexModel !==
        undefined
    )
      ? {
          ...(parsed
            .modelProvider
            ? {
                provider:
                  parsed
                    .modelProvider,
              }
            : {}),

          ...(parsed
            .modelReasoningEnabled !==
            undefined
            ? {
                reasoningEnabled:
                  parsed
                    .modelReasoningEnabled,
              }
            : {}),

          ...(parsed
            .modelRetryAttempts !==
            undefined
            ? {
                retryAttempts:
                  parsed
                    .modelRetryAttempts,
              }
            : {}),

          ...(parsed
            .ollamaBaseUrl
            ? {
                ollamaBaseUrl:
                  parsed
                    .ollamaBaseUrl,
              }
            : {}),

          ...(parsed
            .cheapModel
            ? {
                cheapModel:
                  parsed
                    .cheapModel,
              }
            : {}),

          ...(parsed
            .complexModel
            ? {
                complexModel:
                  parsed
                    .complexModel,
              }
            : {}),
        }
      : undefined;

  const exploration =
    (
      parsed.maxActions !==
        undefined ||
      parsed.maxModelCalls !==
        undefined
    )
      ? {
          ...(parsed.maxActions !==
            undefined
            ? {
                maxActions:
                  parsed.maxActions,
              }
            : {}),

          ...(parsed
            .maxModelCalls !==
            undefined
            ? {
                maxModelCalls:
                  parsed
                    .maxModelCalls,
              }
            : {}),
        }
      : undefined;

  const timeouts =
    (
      parsed
        .navigationTimeoutMs !==
        undefined ||
      parsed
        .actionTimeoutMs !==
        undefined ||
      parsed
        .modelTimeoutMs !==
        undefined ||
      parsed
        .testTimeoutMs !==
        undefined
    )
      ? {
          ...(parsed
            .navigationTimeoutMs !==
            undefined
            ? {
                navigationMs:
                  parsed
                    .navigationTimeoutMs,
              }
            : {}),

          ...(parsed
            .actionTimeoutMs !==
            undefined
            ? {
                actionMs:
                  parsed
                    .actionTimeoutMs,
              }
            : {}),

          ...(parsed
            .modelTimeoutMs !==
            undefined
            ? {
                modelCallMs:
                  parsed
                    .modelTimeoutMs,
              }
            : {}),

          ...(parsed
            .testTimeoutMs !==
            undefined
            ? {
                testMs:
                  parsed
                    .testTimeoutMs,
              }
            : {}),
        }
      : undefined;

  return publicConfigSchema.parse({
    ...(parsed.target
      ? {
          target:
            parsed.target,
        }
      : {}),

    ...(requirements
      ? {
          requirements,
        }
      : {}),

    ...(openapi
      ? {
          openapi,
        }
      : {}),

    ...(output
      ? {
          output,
        }
      : {}),

    ...(summaryJson
      ? {
          summaryJson,
        }
      : {}),

    ...(parsed.headless !==
      undefined
      ? {
          headless:
            parsed.headless,
        }
      : {}),

    ...(parsed.resumeRunId
      ? {
          resumeRunId:
            parsed.resumeRunId,
        }
      : {}),

    ...(storageState
      ? {
          auth: {
            storageState,
          },
        }
      : {}),

    ...(parsed
      .allowDestructiveActions !==
      undefined
      ? {
          safety: {
            allowDestructiveActions:
              parsed
                .allowDestructiveActions,
          },
        }
      : {}),

    ...(model
      ? {
          model,
        }
      : {}),

    ...(exploration
      ? {
          exploration,
        }
      : {}),

    ...(timeouts
      ? {
          timeouts,
        }
      : {}),
  });
}

function mergeConfig(
  base:
    PublicGenerateConfig,

  overrides:
    PublicGenerateConfig,
): PublicGenerateConfig {
  return publicConfigSchema.parse({
    ...base,
    ...overrides,

    ...(
      base.auth ||
      overrides.auth
        ? {
            auth: {
              ...base.auth,
              ...overrides.auth,
            },
          }
        : {}
    ),

    ...(
      base.safety ||
      overrides.safety
        ? {
            safety: {
              ...base.safety,
              ...overrides.safety,
            },
          }
        : {}
    ),

    ...(
      base.model ||
      overrides.model
        ? {
            model: {
              ...base.model,
              ...overrides.model,
            },
          }
        : {}
    ),

    ...(
      base.exploration ||
      overrides.exploration
        ? {
            exploration: {
              ...base.exploration,
              ...overrides.exploration,
            },
          }
        : {}
    ),

    ...(
      base.timeouts ||
      overrides.timeouts
        ? {
            timeouts: {
              ...base.timeouts,
              ...overrides.timeouts,
            },
          }
        : {}
    ),
  });
}

export async function parsePublicCli(
  args:
    string[],

  cwd:
    string =
      process.cwd(),
): Promise<PublicCliCommand> {
  const parsed =
    parseArguments(
      args,
    );

  if (
    parsed.help
  ) {
    return {
      kind:
        'help',
    };
  }

  const configPath =
    await findConfigPath(
      cwd,
      parsed.configPath,
    );

  const fileConfig =
    configPath
      ? await loadConfigFile(
          configPath,
        )
      : {};

  const cliOverrides =
    buildCliOverrides(
      parsed,
      cwd,
    );

  const config =
    mergeConfig(
      fileConfig,
      cliOverrides,
    );

  if (
    !config.target
  ) {
    throw new CliInputError(
      'A target URL is required. Use "toverni generate <url>" or set "target" in toverni.yaml.',
    );
  }

  return {
    kind:
      'generate',

    config,

    configPath,
  };
}

export function applyModelEnvironment(
  config:
    PublicGenerateConfig['model'],
): void {
  if (
    !config
  ) {
    return;
  }

  if (
    config.provider
  ) {
    process.env
      .MODEL_PROVIDER =
      config.provider;
  }

  if (
    config.reasoningEnabled !==
    undefined
  ) {
    process.env
      .MODEL_REASONING_ENABLED =
      config.reasoningEnabled
        ? 'true'
        : 'false';
  }

  if (
    config.retryAttempts !==
    undefined
  ) {
    process.env
      .MODEL_RETRY_ATTEMPTS =
      String(
        config.retryAttempts,
      );
  }

  if (
    config.ollamaBaseUrl
  ) {
    process.env
      .OLLAMA_BASE_URL =
      config.ollamaBaseUrl;
  }

  if (
    config.cheapModel
  ) {
    process.env
      .OLLAMA_CHEAP_MODEL =
      config.cheapModel;
  }

  if (
    config.complexModel
  ) {
    process.env
      .OLLAMA_COMPLEX_MODEL =
      config.complexModel;
  }
}

export function getPublicCliHelp():
string {
  return `Toverni — grounded Playwright test generation

Usage:
  toverni generate <url> [options]
  toverni generate --config ./toverni.yaml
  toverni <url> [options]

Core options:
  -c, --config <path>              YAML config file (default: ./toverni.yaml or ./toverni.yml)
      --requirements <path>        Requirements/document input
      --openapi <path>             OpenAPI YAML/JSON input
  -o, --output <path>              Generated Playwright test output directory
      --headless                   Run Chromium headless
      --headed                     Show Chromium
      --resume <run-id>            Resume a prior exploration run

Safety:
      --allow-destructive-actions  Explicitly permit destructive exploration actions
      --deny-destructive-actions   Keep destructive actions blocked (default)

Model:
      --model-reasoning            Enable grounded model reasoning/scenario generation
      --no-model-reasoning         Disable model reasoning
      --ollama-base-url <url>      Ollama endpoint
      --cheap-model <name>         Cheap/fast model name
      --complex-model <name>       Complex model name

Budgets/timeouts:
      --max-actions <n>
      --max-model-calls <n>
      --navigation-timeout-ms <n>
      --action-timeout-ms <n>
      --model-timeout-ms <n>
      --test-timeout-ms <n>

Authentication contract:
      --storage-state <path>       Accepted by the CLI contract; authenticated exploration is implemented in TOV-118

Config precedence:
  CLI flags > explicit/default YAML config > engine defaults

Minimal:
  toverni generate http://localhost:3000

Grounded:
  toverni generate http://localhost:3000 --requirements ./requirements.md --openapi ./openapi.yaml

Config example:
  target: http://localhost:3000
  requirements: ./requirements.md
  openapi: ./openapi.yaml
  output: ./tests/toverni
  headless: true
  safety:
    allowDestructiveActions: false
  model:
    reasoningEnabled: true
    ollamaBaseUrl: http://127.0.0.1:11434
    cheapModel: llama3.2:3b
    complexModel: llama3.2:3b
`;
}
