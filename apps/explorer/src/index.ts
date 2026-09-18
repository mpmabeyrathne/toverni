import { ZodError } from 'zod';

import {
  BrowserControllerError,
  PlaywrightBrowserController,
} from './browser/index.js';

import { parseTargetUrl } from './cli/parse-target.js';
import { environment } from './configuration/environment.js';
import { logger } from './configuration/logger.js';

async function main(): Promise<void> {
  const browser = new PlaywrightBrowserController({
    headless: false,
    timeoutMs: 15_000,
  });

  try {
    const job = parseTargetUrl(
      process.argv.slice(2),
    );

    logger.info(
      {
        targetUrl: job.targetUrl,
        environment: environment.NODE_ENV,
      },
      'Starting Toverni Application Explorer',
    );

    await browser.start();

    logger.info('Chromium launched');

    const session = await browser.createSession();

    await session.navigate(job.targetUrl);

    logger.info(
      {
        url: session.getUrl(),
        title: await session.getTitle(),
      },
      'Target application loaded',
    );

    await session.close();

    logger.info('Browser session closed');
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

    if (error instanceof BrowserControllerError) {
      logger.error(
        error.toJSON(),
        'Browser operation failed',
      );

      process.exitCode = 1;
      return;
    }

    logger.error(
      {
        error,
      },
      'Unexpected explorer error',
    );

    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

await main();