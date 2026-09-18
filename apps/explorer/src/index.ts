import { ZodError } from 'zod';

import {
  BrowserControllerError,
  PlaywrightBrowserController,
} from './browser/index.js';

import {
  parseTargetUrl,
} from './cli/parse-target.js';

import {
  getDatabaseUrl,
} from './configuration/database.js';

import {
  environment,
} from './configuration/environment.js';

import {
  logger,
} from './configuration/logger.js';

import {
  createDatabase,
  ExplorationRepository,
} from './database/index.js';

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

  let databaseConnection:
    | ReturnType<
        typeof createDatabase
      >
    | null = null;

  let repository:
    | ExplorationRepository
    | null = null;

  let currentRunId:
    | string
    | null = null;

  let runCompleted = false;

  try {
    const job =
      parseTargetUrl(
        process.argv.slice(2),
      );

    // --------------------------------
    // Database
    // --------------------------------

    const databaseUrl =
      getDatabaseUrl();

    databaseConnection =
      createDatabase(
        databaseUrl,
      );

    repository =
      new ExplorationRepository(
        databaseConnection.db,
      );

    // --------------------------------
    // Application
    // --------------------------------

    const targetUrl =
      new URL(
        job.targetUrl,
      );

    const application =
      await repository
        .ensureApplication({
          name:
            targetUrl.hostname,

          baseUrl:
            targetUrl.origin,
        });

    // --------------------------------
    // Exploration run
    // --------------------------------

    const run =
      await repository.startRun({
        applicationId:
          application.id,

        entryUrl:
          job.targetUrl,

        context: {
          environment:
            environment.NODE_ENV,
        },
      });

    currentRunId =
      run.id;

    logger.info(
      {
        targetUrl:
          job.targetUrl,

        applicationId:
          application.id,

        runId:
          run.id,

        environment:
          environment.NODE_ENV,
      },
      'Starting Toverni Application Explorer',
    );

    // --------------------------------
    // Browser
    // --------------------------------

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

    // --------------------------------
    // Observation
    // --------------------------------

    const observation =
      await session.observe();

    logger.info(
      {
        observation,
      },
      'Page observation captured',
    );

    // --------------------------------
    // State identification
    // --------------------------------

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

    // --------------------------------
    // Persist state
    // --------------------------------

    const persistedState =
      await repository.saveState(
        application.id,
        stateResult.state,
      );

    // --------------------------------
    // Persist evidence
    // --------------------------------

    await repository
      .saveObservationEvidence(
        run.id,
        persistedState.id,
        observation,
      );

    // --------------------------------
    // Exploration planning
    // --------------------------------

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

    // --------------------------------
    // Persist planner decision/actions
    // --------------------------------

    await repository.saveDecision(
      run.id,
      persistedState.id,
      explorationDecision,
    );

    // --------------------------------
    // Complete exploration run
    // --------------------------------

    await repository.completeRun(
      run.id,
      'completed',
    );

    runCompleted = true;

    // --------------------------------
    // Query complete application graph
    // --------------------------------

    const flow =
      await repository
        .getApplicationFlow(
          application.id,
        );

    logger.info(
      {
        applicationId:
          application.id,

        runId:
          run.id,

        runs:
          flow?.runs.length ??
          0,

        states:
          flow?.states.length ??
          0,

        actions:
          flow?.actions.length ??
          0,

        transitions:
          flow?.transitions
            .length ??
          0,

        decisions:
          flow?.decisions
            .length ??
          0,

        networkEvents:
          flow?.networkEvents
            .length ??
          0,

        consoleEvents:
          flow?.consoleEvents
            .length ??
          0,

        artifacts:
          flow?.artifacts
            .length ??
          0,
      },
      'Application graph persisted',
    );

    await session.close();

    logger.info(
      'Browser session closed',
    );
  } catch (error: unknown) {
    // If the run started but something failed,
    // persist the failed state of the run.
    if (
      repository &&
      currentRunId &&
      !runCompleted
    ) {
      try {
        await repository.completeRun(
          currentRunId,
          'failed',
        );
      } catch (
        persistenceError:
          unknown
      ) {
        logger.error(
          {
            error:
              persistenceError,

            runId:
              currentRunId,
          },
          'Failed to mark exploration run as failed',
        );
      }
    }

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
    try {
      await browser.close();
    } finally {
      if (
        databaseConnection
      ) {
        await databaseConnection
          .close();
      }
    }
  }
}

await main();