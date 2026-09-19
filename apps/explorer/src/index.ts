import {
  ZodError,
} from 'zod';

import {
  BrowserControllerError,
} from './browser/index.js';

import {
  parseTargetUrl,
} from './cli/parse-target.js';

import {
  logger,
} from './configuration/logger.js';

import {
  runExplorer,
} from './explorer/run-explorer.js';

async function main():
Promise<void> {
  try {
    const job =
      parseTargetUrl(
        process.argv.slice(2),
      );

    await runExplorer({
      targetUrl:
        job.targetUrl,
    });
  } catch (
    error:
      unknown
  ) {
    if (
      error instanceof
      ZodError
    ) {
      logger.error(
        {
          issues:
            error.issues,
        },
        'Invalid exploration configuration',
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