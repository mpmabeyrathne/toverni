import { ZodError } from 'zod';

import { parseTargetUrl } from './cli/parse-target.js';
import { environment } from './configuration/environment.js';
import { logger } from './configuration/logger.js';

function main(): void {
  try {
    const job = parseTargetUrl(process.argv.slice(2));

    logger.info(
      {
        targetUrl: job.targetUrl,
        environment: environment.NODE_ENV,
      },
      'Starting Toverni Application Explorer',
    );
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      logger.error(
        {
          issues: error.issues,
        },
        'Invalid exploration target',
      );

      process.exitCode = 1;
      return;
    }

    logger.error(
      {
        error,
      },
      'Unexpected explorer startup error',
    );

    process.exitCode = 1;
  }
}

main();