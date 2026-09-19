import { ZodError } from 'zod';

import {
  BrowserControllerError,
  PlaywrightBrowserController,
} from './browser/index.js';

import {
  createExecutableTestPlan,
  runPlaywrightTest,
  writePlaywrightTest,
} from './test-generation/index.js';

import {
  join,
} from 'node:path';

import {
  parseTargetUrl,
} from './cli/parse-target.js';

import {
  buildEvidenceCatalog,
  GroundedScenarioGenerator,
} from './scenarios/index.js';

import {
  getDatabaseUrl,
} from './configuration/database.js';

import {
  environment,
} from './configuration/environment.js';

import {
  getKnowledgeConfiguration,
} from './configuration/knowledge.js';

import {
  logger,
} from './configuration/logger.js';

import {
  getModelConfiguration,
} from './configuration/model.js';

import {
  createDatabase,
  ExplorationRepository,
} from './database/index.js';

import {
  DeterministicExplorationPlanner,
} from './exploration/index.js';

import {
  linkNetworkEventsToOperations,
  loadKnowledge,
} from './knowledge/index.js';

import {
  OllamaProvider,
  RecordingModelProvider,
} from './models/index.js';

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
    // --------------------------------
    // Exploration target
    // --------------------------------

    const job =
      parseTargetUrl(
        process.argv.slice(2),
      );

    // --------------------------------
    // Product knowledge
    // --------------------------------

    const knowledgeConfiguration =
      getKnowledgeConfiguration();

    const knowledge =
      await loadKnowledge(
        knowledgeConfiguration,
      );

    logger.info(
      {
        requirementsLoaded:
          knowledge.requirements !==
          null,

        requirementsSource:
          knowledge.requirements
            ?.sourcePath ??
          null,

        acceptanceCriteria:
          knowledge.requirements
            ?.acceptanceCriteria
            .length ??
          0,

        userRoles:
          knowledge.requirements
            ?.userRoles.length ??
          0,

        capabilities:
          knowledge.requirements
            ?.capabilities.length ??
          0,

        constraints:
          knowledge.requirements
            ?.constraints.length ??
          0,

        domainTerms:
          knowledge.requirements
            ?.domainTerms.length ??
          0,

        openApiLoaded:
          knowledge.openApi !==
          null,

        openApiSource:
          knowledge.openApi
            ?.sourcePath ??
          null,

        apiOperations:
          knowledge.openApi
            ?.operations.length ??
          0,

        apiSchemas:
          knowledge.openApi
            ? Object.keys(
              knowledge.openApi
                .schemas,
            ).length
            : 0,
      },
      'Product knowledge loaded',
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

    const activeRepository =
      new ExplorationRepository(
        databaseConnection.db,
      );

    repository =
      activeRepository;

    // --------------------------------
    // Application
    // --------------------------------

    const targetUrl =
      new URL(
        job.targetUrl,
      );

    const application =
      await activeRepository
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
      await activeRepository
        .startRun({
          applicationId:
            application.id,

          entryUrl:
            job.targetUrl,

          context: {
            environment:
              environment.NODE_ENV,

            requirementsLoaded:
              knowledge.requirements !==
              null,

            openApiLoaded:
              knowledge.openApi !==
              null,

            apiOperationCount:
              knowledge.openApi
                ?.operations.length ??
              0,
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
    // Model provider
    // --------------------------------

    const modelConfiguration =
      getModelConfiguration();

    const rawModelProvider =
      new OllamaProvider({
        baseUrl:
          modelConfiguration
            .OLLAMA_BASE_URL,

        cheapModel:
          modelConfiguration
            .OLLAMA_CHEAP_MODEL,

        complexModel:
          modelConfiguration
            .OLLAMA_COMPLEX_MODEL,
      });

    const modelProvider =
      new RecordingModelProvider(
        rawModelProvider,

        async (
          task,
          usage,
        ) => {
          await activeRepository
            .saveModelUsage(
              run.id,
              task,
              usage,
            );
        },
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
    // Optional semantic state analysis
    // --------------------------------

    if (
      modelConfiguration
        .MODEL_REASONING_ENABLED
    ) {
      const stateAnalysis =
        await modelProvider
          .analyzeState({
            url:
              observation.url,

            title:
              observation.title,

            semanticText:
              observation
                .semanticText,

            actions:
              observation.actions
                .map(
                  (action) => ({
                    type:
                      action.type,

                    ...(action.name !==
                      undefined
                      ? {
                        name:
                          action.name,
                      }
                      : {}),

                    ...(action.text !==
                      undefined
                      ? {
                        text:
                          action.text,
                      }
                      : {}),
                  }),
                ),
          });

      logger.info(
        {
          analysis:
            stateAnalysis.data,

          usage:
            stateAnalysis.usage,
        },
        'Application state semantically analyzed',
      );
    }

    // --------------------------------
    // Runtime network → OpenAPI
    // --------------------------------

    const apiLinks =
      knowledge.openApi
        ? linkNetworkEventsToOperations(
          observation
            .networkEvents,

          knowledge.openApi
            .operations,
        )
        : [];

    logger.info(
      {
        networkEventCount:
          observation
            .networkEvents.length,

        linkedOperationCount:
          apiLinks.length,

        linkedApiOperations:
          apiLinks.map(
            (link) => ({
              networkEventId:
                link.networkEventId,

              method:
                link.method,

              url:
                link.url,

              operationId:
                link.operationId,

              operationPath:
                link.operationPath,

              confidence:
                link.confidence,

              reason:
                link.reason,
            }),
          ),
      },
      'Runtime network evidence linked to API context',
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
      await activeRepository
        .saveState(
          application.id,
          stateResult.state,
        );

    // --------------------------------
    // Persist observation evidence
    // --------------------------------

    await activeRepository
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

        productContext: {
          priorityTerms: [
            ...(knowledge.requirements
              ?.capabilities ??
              []),

            ...(knowledge.requirements
              ?.domainTerms ??
              []),
          ],
        },
      });

    logger.info(
      {
        selectedAction:
          explorationDecision
            .selected
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

    await activeRepository
      .saveDecision(
        run.id,
        persistedState.id,
        explorationDecision,
      );

    // --------------------------------
    // Grounded scenario generation
    // --------------------------------

    if (
      modelConfiguration
        .MODEL_REASONING_ENABLED
    ) {
      const currentFlow =
        await activeRepository
          .getApplicationFlow(
            application.id,
          );

      if (currentFlow) {
        const evidence =
          buildEvidenceCatalog(
            knowledge,
            currentFlow,
          );

        const scenarioGenerator =
          new GroundedScenarioGenerator(
            modelProvider,
          );

          const generatedScenarios =
          await scenarioGenerator
            .generate({
              evidence,
            });
        
        const actionBackedScenarios =
          generatedScenarios.filter(
            (scenario) =>
              scenario
                .evidenceReferences
                .some(
                  (reference) =>
                    reference.startsWith(
                      'ACTION-',
                    ),
                ),
          );
        
        const otherScenarios =
          generatedScenarios.filter(
            (scenario) =>
              !scenario
                .evidenceReferences
                .some(
                  (reference) =>
                    reference.startsWith(
                      'ACTION-',
                    ),
                ),
          );
        
        const scenarios = [
          ...actionBackedScenarios
            .slice(0, 2),
        
          ...otherScenarios
            .slice(
              0,
              Math.max(
                0,
                8 -
                  actionBackedScenarios
                    .slice(0, 2)
                    .length,
              ),
            ),
        ];

        const storedScenarios =
          await activeRepository
            .saveGeneratedScenarios(
              run.id,
              application.id,
              scenarios,
            );

        logger.info(
          {
            evidenceCount:
              evidence.length,

            scenarioCount:
              scenarios.length,

            scenarios:
              scenarios.map(
                (scenario) => ({
                  title:
                    scenario.title,

                  type:
                    scenario.type,

                  relevance:
                    scenario.relevance,

                  risk:
                    scenario.risk,

                  confidence:
                    scenario.confidence,

                  evidenceReferences:
                    scenario
                      .evidenceReferences,
                }),
              ),
          },
          'Grounded test scenarios generated',
        );

        // --------------------------------
        // Executable Playwright generation
        // --------------------------------

        const generatedTestsDirectory =
          join(
            process.cwd(),
            'artifacts',
            'generated-tests',
            run.id,
          );

        for (
          const storedScenario of
          storedScenarios
        ) {
          const plan =
            createExecutableTestPlan({
              scenario: {
                id:
                  storedScenario.id,

                title:
                  storedScenario.title,

                evidenceReferences:
                  storedScenario
                    .evidenceReferences,
              },

              evidence:
                evidence.map(
                  (item) => ({
                    id:
                      item.id,

                    type:
                      item.type,

                    source:
                      item.source,
                  }),
                ),

              actions:
                currentFlow.actions.map(
                  (action) => ({
                    id:
                      action.id,

                    label:
                      action.label,

                    type:
                      action.type,

                    target:
                      action.target,
                  }),
                ),
            });

          // ------------------------------
          // Manual-required scenario
          // ------------------------------

          if (
            plan.status ===
            'manual_required'
          ) {
            await activeRepository
              .saveGeneratedTest({
                runId:
                  run.id,

                applicationId:
                  application.id,

                scenarioId:
                  storedScenario.id,

                generationStatus:
                  'manual_required',

                reason:
                  plan.reason,

                sourceFilePath:
                  null,

                sourceCode:
                  null,
              });

            logger.info(
              {
                scenarioId:
                  storedScenario.id,

                title:
                  storedScenario.title,

                reason:
                  plan.reason,
              },
              'Generated test requires manual completion',
            );

            continue;
          }

          // ------------------------------
          // Generate Playwright file
          // ------------------------------

          try {
            const writtenTest =
              await writePlaywrightTest(
                {
                  plan,

                  targetUrl:
                    job.targetUrl,
                },

                generatedTestsDirectory,
              );

            const storedTest =
              await activeRepository
                .saveGeneratedTest({
                  runId:
                    run.id,

                  applicationId:
                    application.id,

                  scenarioId:
                    storedScenario.id,

                  generationStatus:
                    'ready',

                  reason:
                    null,

                  sourceFilePath:
                    writtenTest.filePath,

                  sourceCode:
                    writtenTest.source,
                });

            // ----------------------------
            // Execute generated test
            // ----------------------------

            try {
              const executionResult =
                await runPlaywrightTest({
                  filePath:
                    writtenTest.filePath,

                  workingDirectory:
                    process.cwd(),
                });

              await activeRepository
                .saveGeneratedTestExecution(
                  storedTest.id,
                  executionResult,
                );

              logger.info(
                {
                  scenarioId:
                    storedScenario.id,

                  generatedTestId:
                    storedTest.id,

                  filePath:
                    writtenTest.filePath,

                  status:
                    executionResult.status,

                  exitCode:
                    executionResult.exitCode,

                  durationMs:
                    executionResult.durationMs,
                },
                'Generated Playwright test executed',
              );
            } catch (
            executionError:
              unknown
            ) {
              await activeRepository
                .saveGeneratedTestError(
                  storedTest.id,
                  executionError,
                );

              logger.error(
                {
                  scenarioId:
                    storedScenario.id,

                  generatedTestId:
                    storedTest.id,

                  error:
                    executionError,
                },
                'Generated Playwright test execution failed',
              );
            }
          } catch (
          generationError:
            unknown
          ) {
            const message =
              generationError instanceof
                Error
                ? generationError.message
                : String(
                  generationError,
                );

            await activeRepository
              .saveGeneratedTest({
                runId:
                  run.id,

                applicationId:
                  application.id,

                scenarioId:
                  storedScenario.id,

                generationStatus:
                  'generation_error',

                reason:
                  message,

                sourceFilePath:
                  null,

                sourceCode:
                  null,
              });

            logger.error(
              {
                scenarioId:
                  storedScenario.id,

                error:
                  generationError,
              },
              'Playwright test generation failed',
            );
          }
        }
      }
    }

    // --------------------------------
    // Complete exploration run
    // --------------------------------

    await activeRepository
      .completeRun(
        run.id,
        'completed',
      );

    runCompleted = true;

    // --------------------------------
    // Query complete application graph
    // --------------------------------

    const flow =
      await activeRepository
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

        modelUsageEvents:
          flow?.modelUsage
            .length ??
          0,

        generatedScenarios:
          flow?.generatedScenarios
            .length ?? 0,

        modelTokens:
          flow?.modelUsage
            .reduce(
              (
                total,
                usage,
              ) =>
                total +
                usage.totalTokens,
              0,
            ) ??
          0,

        modelCostUsd:
          flow?.modelUsage
            .reduce(
              (
                total,
                usage,
              ) =>
                total +
                usage
                  .estimatedCostUsd,
              0,
            ) ??
          0,

        generatedTests:
          flow?.generatedTests
            .length ??
          0,

        passedGeneratedTests:
          flow?.generatedTests
            .filter(
              (test) =>
                test.executionStatus ===
                'passed',
            )
            .length ??
          0,

        failedGeneratedTests:
          flow?.generatedTests
            .filter(
              (test) =>
                test.executionStatus ===
                'failed' ||
                test.executionStatus ===
                'runtime_error',
            )
            .length ??
          0,

        manualRequiredTests:
          flow?.generatedTests
            .filter(
              (test) =>
                test.generationStatus ===
                'manual_required',
            )
            .length ??
          0,
      },
      'Application graph persisted',
    );

    // --------------------------------
    // Close session
    // --------------------------------

    await session.close();

    logger.info(
      'Browser session closed',
    );
  } catch (error: unknown) {
    // --------------------------------
    // Mark failed run
    // --------------------------------

    if (
      repository &&
      currentRunId &&
      !runCompleted
    ) {
      try {
        await repository
          .completeRun(
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

    // --------------------------------
    // Zod error
    // --------------------------------

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

    // --------------------------------
    // Browser error
    // --------------------------------

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

    // --------------------------------
    // Unknown error
    // --------------------------------

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