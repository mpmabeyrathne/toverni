import { ZodError } from 'zod';

import {
  BrowserControllerError,
  PlaywrightBrowserController,
} from './browser/index.js';

import {
  parseTargetUrl,
} from './cli/parse-target.js';

import {
  environment,
} from './configuration/environment.js';

import {
  logger,
} from './configuration/logger.js';

import {
  DeterministicExplorationPlanner,
} from './exploration/index.js';

import {
  ApplicationStateModel,
} from './state/index.js';

async function main(): Promise<void> {
  const browser =
    new PlaywrightBrowserController({
      headless: false,
      timeoutMs: 15_000,
      artifactsDirectory:
        'artifacts',
    });

  const stateModel =
    new ApplicationStateModel();

  const planner =
    new DeterministicExplorationPlanner(
      stateModel,
      {
        maxActions: 50,
        maxActionsPerState: 10,
        maxStates: 100,
      },
    );

  try {
    const job =
      parseTargetUrl(
        process.argv.slice(2),
      );

    logger.info(
      {
        targetUrl:
          job.targetUrl,

        environment:
          environment.NODE_ENV,
      },
      'Starting Toverni Application Explorer',
    );

    await browser.start();

    logger.info(
      'Chromium launched',
    );

    const session =
      await browser.createSession();

    await session.navigate(
      job.targetUrl,
    );

    logger.info(
      {
        url:
          session.getUrl(),

        title:
          await session.getTitle(),
      },
      'Target application loaded',
    );

    const observation =
      await session.observe();

    logger.info(
      {
        observation,
      },
      'Page observation captured',
    );

    const stateResult =
      stateModel.registerObservation(
        observation,
      );

    logger.info(
      {
        stateId:
          stateResult.state.id,

        routePattern:
          stateResult.state
            .routePattern,

        isNew:
          stateResult.isNew,

        visits:
          stateResult.state.visits,
      },
      'Application state identified',
    );

    const explorationDecision =
      planner.plan({
        state:
          stateResult.state,

        observation,
      });

    logger.info(
      {
        selectedAction:
          explorationDecision.selected
            ? {
                label:
                  explorationDecision
                    .selected
                    .label,

                score:
                  explorationDecision
                    .selected
                    .score,

                target:
                  explorationDecision
                    .selected
                    .target,

                reasons:
                  explorationDecision
                    .selected
                    .reasons,
              }
            : null,

        shouldStop:
          explorationDecision
            .shouldStop,

        stopReason:
          explorationDecision
            .stopReason,

        candidateCount:
          explorationDecision
            .rankedCandidates
            .length,
      },
      'Next exploration action planned',
    );

    await session.close();

    logger.info(
      'Browser session closed',
    );
  } catch (error: unknown) {
    if (
      error instanceof ZodError
    ) {
      logger.error(
        {
          issues:
            error.issues,
        },
        'Invalid exploration target',
      );

      process.exitCode = 1;
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