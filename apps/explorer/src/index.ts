#!/usr/bin/env node

import {
  ZodError,
} from 'zod';

import {
  BrowserControllerError,
} from './browser/index.js';

import {
  applyModelEnvironment,
  CliInputError,
  getPublicCliHelp,
  getPublicKnowledgeInput,
  parsePublicCli,
} from './cli/public-cli.js';

import {
  getPackageVersion,
} from './cli/version.js';

import {
  logger,
} from './configuration/logger.js';

import {
  runExplorer,
} from './explorer/run-explorer.js';

import {
  renderGenerationSummary,
  writeGenerationSummaryJson,
} from './explorer/generation-summary.js';

function formatZodError(
  error:
    ZodError,
): string {
  return error.issues
    .map(
      (issue) => {
        const path =
          issue.path.length >
          0
            ? issue.path.join(
                '.',
              )
            : 'configuration';

        return `${path}: ${issue.message}`;
      },
    )
    .join(
      '\n',
    );
}

async function main():
Promise<void> {
  try {
    const argumentsList =
      process.argv.slice(
        2,
      );

    if (
      argumentsList.includes(
        '--version',
      ) ||
      argumentsList.includes(
        '-v',
      ) ||
      argumentsList[0] ===
        'version'
    ) {
      console.log(
        await getPackageVersion(),
      );

      return;
    }

    const command =
      await parsePublicCli(
        argumentsList,
      );

    if (
      command.kind ===
      'help'
    ) {
      console.log(
        getPublicCliHelp(),
      );

      return;
    }

    const {
      config,
    } =
      command;

    applyModelEnvironment(
      config.model,
    );

    const result =
      await runExplorer({
      targetUrl:
        config.target!,

      knowledgeInput:
        getPublicKnowledgeInput(
          config,
        ),

      ...(config.headless !==
      undefined
        ? {
            headless:
              config.headless,
          }
        : {}),

      ...(config.output
        ? {
            outputDirectory:
              config.output,
          }
        : {}),

      ...(config.auth
        ?.storageState
        ? {
            auth: {
              storageStatePath:
                config.auth
                  .storageState,
            },
          }
        : {}),

      ...(config.resumeRunId
        ? {
            resumeRunId:
              config.resumeRunId,
          }
        : {}),

      ...(config.safety
        ?.allowDestructiveActions !==
      undefined
        ? {
            allowDestructiveActions:
              config.safety
                .allowDestructiveActions,
          }
        : {}),

      ...(config.exploration
        ?.maxScenarios !==
      undefined
        ? {
            maxScenarios:
              config.exploration
                .maxScenarios,
          }
        : {}),

      ...(config.exploration
        ? {
            explorationBudget: {
              ...(config.exploration
                .maxActions !==
              undefined
                ? {
                    maxActions:
                      config.exploration
                        .maxActions,
                  }
                : {}),

              ...(config.exploration
                .maxModelCalls !==
              undefined
                ? {
                    maxModelCalls:
                      config.exploration
                        .maxModelCalls,
                  }
                : {}),
            },
          }
        : {}),

      ...(config.timeouts
        ? {
            timeouts: {
              ...(config.timeouts
                .navigationMs !==
              undefined
                ? {
                    navigationMs:
                      config.timeouts
                        .navigationMs,
                  }
                : {}),

              ...(config.timeouts
                .actionMs !==
              undefined
                ? {
                    actionMs:
                      config.timeouts
                        .actionMs,
                  }
                : {}),

              ...(config.timeouts
                .modelCallMs !==
              undefined
                ? {
                    modelCallMs:
                      config.timeouts
                        .modelCallMs,
                  }
                : {}),

              ...(config.timeouts
                .testMs !==
              undefined
                ? {
                    testMs:
                      config.timeouts
                        .testMs,
                  }
                : {}),
            },
          }
        : {}),
    });

    console.log(
      renderGenerationSummary(
        result.summary,
      ),
    );

    if (
      config.summaryJson
    ) {
      await writeGenerationSummaryJson(
        result.summary,
        config.summaryJson,
      );

      console.log(
        `Summary JSON: ${config.summaryJson}`,
      );
    }
  } catch (
    error:
      unknown
  ) {
    if (
      error instanceof
      CliInputError
    ) {
      console.error(
        `Toverni: ${error.message}`,
      );

      process.exitCode =
        1;

      return;
    }

    if (
      error instanceof
      ZodError
    ) {
      console.error(
        `Toverni configuration is invalid:\n${formatZodError(error)}`,
      );

      process.exitCode =
        1;

      return;
    }

    if (
      error instanceof
      BrowserControllerError
    ) {
      logger.error(
        error.toJSON(),
        'Browser operation failed',
      );

      process.exitCode =
        1;

      return;
    }

    logger.error(
      {
        error:
          error instanceof Error
            ? {
                name:
                  error.name,

                message:
                  error.message,

                stack:
                  error.stack,

                cause:
                  error.cause,
              }
            : error,
      },
      'Unexpected explorer error',
    );

    process.exitCode =
      1;
  }
}

await main();
