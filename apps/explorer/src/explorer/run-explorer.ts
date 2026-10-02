import {
    PlaywrightBrowserController,
} from '../browser/index.js';

import {
    createExecutableTestPlan,
    runPlaywrightTest,
    writePlaywrightTest,
} from '../test-generation/index.js';

import {
    buildCoverageReport,
    buildCoverageTargets,
    resolveCoverageTestStatus,
    type CoverageReport,
} from '../coverage/index.js';

import {
    mapPersistedApplicationGraph,
} from '../state/persisted-application-graph.js';

import {
    join,
} from 'node:path';

import {
    buildEvidenceCatalog,
    GroundedScenarioGenerator,
} from '../scenarios/index.js';

import {
    getDatabaseUrl,
} from '../configuration/database.js';

import {
    environment,
} from '../configuration/environment.js';

import {
    getKnowledgeConfiguration,
} from '../configuration/knowledge.js';

import {
    logger,
} from '../configuration/logger.js';

import {
    getModelConfiguration,
} from '../configuration/model.js';

import {
    createDatabase,
    ExplorationRepository,
} from '../database/index.js';

import {
    DeterministicExplorationPlanner,
    runExplorationLoop,
    type ExplorationBudget,
} from '../exploration/index.js';

import {
    groundBusinessBehaviors,
    identifyBusinessBehaviors,
    reconstructBusinessFlows,
} from '../flows/index.js';

import {
    linkNetworkEventsToOperations,
    loadKnowledge,
} from '../knowledge/index.js';

import {
    BoundedModelProvider,
    OllamaProvider,
    RecordingModelProvider,
} from '../models/index.js';

import {
    ApplicationStateModel,
} from '../state/index.js';

export interface RunExplorerInput {
    targetUrl: string;

    knowledgeInput?: {
        requirementsPath?: string;
        openApiPath?: string;
    };

    headless?: boolean;

    artifactsDirectory?: string;

    resumeRunId?: string;

    explorationBudget?:
        Partial<ExplorationBudget>;

    timeouts?: {
        navigationMs?: number;
        actionMs?: number;
        modelCallMs?: number;
        testMs?: number;
    };
}

type ApplicationFlow =
    NonNullable<
        Awaited<
            ReturnType<
                ExplorationRepository[
                'getApplicationFlow'
                ]
            >
        >
    >;

export interface RunExplorerResult {
    applicationId:
    string;

    runId:
    string;

    targetUrl:
    string;

    initialPageContext:
    string;

    flow:
    ApplicationFlow;

    coverage:
    CoverageReport;
}

export async function runExplorer(
    input:
        RunExplorerInput,
): Promise<
    RunExplorerResult
> {
    const browser =
        new PlaywrightBrowserController({
            headless:
                input.headless ??
                false,

            timeoutMs:
                input.timeouts
                    ?.actionMs ??
                15_000,

            artifactsDirectory:
                input.artifactsDirectory ??
                'artifacts',
        });

    const stateModel =
        new ApplicationStateModel();

    const explorationBudget:
        ExplorationBudget = {
        maxActions: 50,
        maxActionsPerState: 10,
        maxStates: 100,
        maxDepth: 100,
        maxVisitsPerState: 20,
        maxFailures: 5,
        maxModelCalls: 20,
        maxDurationMs:
            60 * 60 * 1000,
        ...input.explorationBudget,
    };

    const planner =
        new DeterministicExplorationPlanner(
            stateModel,
            explorationBudget,
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
        // Product knowledge
        // --------------------------------

        const knowledgeConfiguration =
            input.knowledgeInput ??
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
                input.targetUrl,
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

        const existingRun =
            input.resumeRunId
                ? await activeRepository
                    .getRun(
                        input.resumeRunId,
                    )
                : null;

        if (
            input.resumeRunId &&
            !existingRun
        ) {
            throw new Error(
                'Requested exploration run was not found for resume.',
            );
        }

        if (
            existingRun &&
            existingRun.applicationId !==
                application.id
        ) {
            throw new Error(
                'Requested exploration run belongs to a different application.',
            );
        }

        const run =
            existingRun
                ? await activeRepository
                    .resumeRun(
                        existingRun.id,
                    )
                : await activeRepository
                    .startRun({
                        applicationId:
                            application.id,

                        entryUrl:
                            input.targetUrl,

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

                            explorationBudget,
                        },
                    });

        const checkpoint =
            existingRun
                ? await activeRepository
                    .getRunCheckpoint(
                        run.id,
                    )
                : null;

        currentRunId =
            run.id;

        logger.info(
            {
                targetUrl:
                    input.targetUrl,

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

        const boundedModelProvider =
            new BoundedModelProvider(
                rawModelProvider,
                {
                    maxCalls:
                        explorationBudget
                            .maxModelCalls,

                    retryAttempts:
                        2,

                    timeoutMs:
                        input.timeouts
                            ?.modelCallMs ??
                        600_000,
                },
            );

        const modelProvider =
            new RecordingModelProvider(
                boundedModelProvider,

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

        {
            const navigationTarget =
                checkpoint
                    ?.currentUrl ??
                input.targetUrl;

            let lastNavigationError:
                unknown;

            for (
                let attempt = 1;
                attempt <= 2;
                attempt += 1
            ) {
                try {
                    let timeoutHandle:
                        ReturnType<
                            typeof setTimeout
                        > |
                        undefined;

                    try {
                        await Promise.race([
                            session.navigate(
                                navigationTarget,
                            ),

                            new Promise<never>(
                                (
                                    _resolve,
                                    reject,
                                ) => {
                                    timeoutHandle =
                                        setTimeout(
                                            () => {
                                                reject(
                                                    new Error(
                                                        'Navigation timed out.',
                                                    ),
                                                );
                                            },
                                            input.timeouts
                                                ?.navigationMs ??
                                            30_000,
                                        );
                                },
                            ),
                        ]);
                    } finally {
                        if (
                            timeoutHandle !==
                            undefined
                        ) {
                            clearTimeout(
                                timeoutHandle,
                            );
                        }
                    }

                    lastNavigationError =
                        undefined;

                    break;
                } catch (
                    error:
                        unknown
                ) {
                    lastNavigationError =
                        error;
                }
            }

            if (
                lastNavigationError !==
                undefined
            ) {
                throw lastNavigationError;
            }
        }

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
        // Observation analysis helper
        // --------------------------------

        type Observation =
            Awaited<
                ReturnType<
                    typeof session.observe
                >
            >;

        const analyzeObservation =
            async (
                observation:
                    Observation,
            ): Promise<void> => {
                logger.info(
                    {
                        observation,
                    },
                    'Page observation captured',
                );

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
                                .networkEvents
                                .length,

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
            };

        // --------------------------------
        // Multi-step exploration
        // --------------------------------

        const explorationResult =
            await runExplorationLoop({
                session,

                stateModel,

                planner,

                repository:
                    activeRepository,

                applicationId:
                    application.id,

                runId:
                    run.id,

                priorityTerms: [
                    ...(knowledge.requirements
                        ?.capabilities ??
                        []),

                    ...(knowledge.requirements
                        ?.domainTerms ??
                        []),
                ],

                knowledge,

                analyzeObservation,

                budget:
                    explorationBudget,

                checkpoint,

                getModelCallCount:
                    () =>
                        boundedModelProvider
                            .getCallCount(),
            });

        const initialObservation =
            explorationResult
                .initialObservation;

        logger.info(
            {
                executedActions:
                    explorationResult
                        .executedActions,

                stopReason:
                    explorationResult
                        .stopReason,
            },
            'Multi-step exploration completed',
        );

        // --------------------------------
        // Persisted business-flow reconstruction
        // --------------------------------

        const currentFlow =
            await activeRepository
                .getApplicationFlow(
                    application.id,
                );

        if (!currentFlow) {
            throw new Error(
                'Application flow was not available after exploration.',
            );
        }

        const {
            states:
            graphStates,

            transitions:
            graphTransitions,
        } =
            mapPersistedApplicationGraph(
                currentFlow,
            );

        const reconstructedFlows =
            reconstructBusinessFlows({
                states:
                    graphStates,

                transitions:
                    graphTransitions,
            });

        const businessBehaviors =
            identifyBusinessBehaviors({
                states:
                    graphStates,

                transitions:
                    graphTransitions,

                flows:
                    reconstructedFlows,
            });

        const groundedBusinessBehaviors =
            groundBusinessBehaviors({
                behaviors:
                    businessBehaviors,

                transitions:
                    graphTransitions,

                knowledge,
            });

        logger.info(
            {
                applicationId:
                    application.id,

                runId:
                    run.id,

                graphSource:
                    'persisted',

                graphStates:
                    graphStates.length,

                graphTransitions:
                    graphTransitions.length,

                reconstructedFlows:
                    reconstructedFlows.length,

                businessBehaviors:
                    businessBehaviors.length,

                groundedBusinessBehaviors:
                    groundedBusinessBehaviors.length,
            },
            'Business flows reconstructed and grounded',
        );

        const evidence =
            buildEvidenceCatalog(
                knowledge,
                currentFlow,
                groundedBusinessBehaviors,
            );

        const coverageTargets =
            buildCoverageTargets(
                evidence,
                groundedBusinessBehaviors,
            );

        const preGenerationCoverage =
            buildCoverageReport({
                targets:
                    coverageTargets,

                scenarios:
                    currentFlow
                        .generatedScenarios
                        .map(
                            (scenario) => ({
                                id:
                                    scenario.id,

                                evidenceReferences:
                                    scenario
                                        .evidenceReferences,

                                accepted:
                                    true,
                            }),
                        ),

                tests:
                    currentFlow
                        .generatedTests
                        .map(
                            (test) => ({
                                id:
                                    test.id,

                                scenarioId:
                                    test.scenarioId,

                                status:
                                    resolveCoverageTestStatus(
                                        test.generationStatus,
                                        test.executionStatus,
                                    ),
                            }),
                        ),
            });

        const scenarioCoverageGaps =
            preGenerationCoverage
                .gaps
                .filter(
                    (entry) =>
                        entry.status ===
                            'uncovered' ||
                        entry.status ===
                            'partially_covered',
                )
                .map(
                    (entry) => ({
                        targetId:
                            entry.target.id,

                        kind:
                            entry.target.kind,

                        status:
                            entry.status as
                                | 'uncovered'
                                | 'partially_covered',

                        evidenceReferences:
                            entry.target
                                .evidenceReferences,
                    }),
                );

        // --------------------------------
        // Grounded scenario generation
        // --------------------------------

        if (
            modelConfiguration
                .MODEL_REASONING_ENABLED
        ) {
  
    const scenarioGenerator =
      new GroundedScenarioGenerator(
        modelProvider,
      );
  
    const generatedScenarios =
      await scenarioGenerator
        .generate({
          evidence,
          coverageGaps:
            scenarioCoverageGaps,

          businessBehaviors:
            groundedBusinessBehaviors,
        });
  
    const scenarios =
      generatedScenarios.slice(
        0,
        8,
      );
  
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

        coverageGapCount:
          scenarioCoverageGaps.length,

        coverageGaps:
          scenarioCoverageGaps.map(
            (gap) => ({
              targetId:
                gap.targetId,

              kind:
                gap.kind,

              status:
                gap.status,
            }),
          ),
  
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

              rankingReasons:
                scenario
                  .rankingReasons,
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
  
                blocked:
                  action.blocked,
  
                blockReasons:
                  action.blockReasons,
              }),
            ),

          transitions:
            currentFlow
              .transitions
              .map(
                (transition) => ({
                  id:
                    transition.id,

                  actionId:
                    transition.actionId,

                  actionTarget:
                    transition
                      .actionTarget,

                  actionType:
                    transition
                      .actionType,

                  explorationBlocked:
                    transition
                      .explorationBlocked,

                  occurredAt:
                    transition
                      .occurredAt,

                  beforeObservation:
                    transition
                      .beforeObservation,

                  afterObservation:
                    transition
                      .afterObservation,
                }),
              ),

          businessBehaviors:
            groundedBusinessBehaviors
              .map(
                (behavior) => ({
                  id:
                    behavior.id,

                  preconditionTransitionIds:
                    behavior
                      .preconditionTransitionIds,

                  transitionIds:
                    behavior
                      .transitionIds,
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

            assertions:
              [],
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
                input.targetUrl,
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

              assertions:
                plan.assertions,
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

              timeoutMs:
                input.timeouts
                  ?.testMs ??
                60_000,
            });
  
          await activeRepository
            .saveGeneratedTestExecution(
              storedTest.id,
              executionResult,
            );
  
          const executionLog = {
            scenarioId:
              storedScenario.id,

            title:
              storedScenario.title,

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

            ...(
              executionResult.status ===
                'failed'
                ? {
                  error:
                    executionResult.error,

                  stderr:
                    executionResult.stderr,

                  stdout:
                    executionResult.stdout,
                }
                : {}
            ),
          };

          if (
            executionResult.status ===
            'failed'
          ) {
            logger.error(
              executionLog,
              'Generated Playwright test failed',
            );
          } else {
            logger.info(
              executionLog,
              'Generated Playwright test executed',
            );
          }
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

            assertions:
              [],
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

        if (
            !flow
        ) {
            throw new Error(
                'Application flow was not available after exploration.',
            );
        }

        const coverage =
            buildCoverageReport({
                targets:
                    coverageTargets,

                scenarios:
                    flow.generatedScenarios
                        .filter(
                            (scenario) =>
                                scenario.runId ===
                                run.id,
                        )
                        .map(
                            (scenario) => ({
                                id:
                                    scenario.id,

                                evidenceReferences:
                                    scenario
                                        .evidenceReferences,

                                accepted:
                                    true,
                            }),
                        ),

                tests:
                    flow.generatedTests
                        .filter(
                            (test) =>
                                test.runId ===
                                run.id,
                        )
                        .map(
                            (test) => ({
                                id:
                                    test.id,

                                scenarioId:
                                    test.scenarioId,

                                status:
                                    resolveCoverageTestStatus(
                                        test.generationStatus,
                                        test.executionStatus,
                                    ),
                            }),
                        ),
            });

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

                coverage:
                    coverage.totals,

                coverageGaps:
                    coverage.gaps.map(
                        (entry) => ({
                            targetId:
                                entry.target.id,

                            kind:
                                entry.target.kind,

                            status:
                                entry.status,
                        }),
                    ),
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

        return {
            applicationId:
                application.id,

            runId:
                run.id,

            targetUrl:
                input.targetUrl,

            initialPageContext:
                [
                    initialObservation.title,
                    initialObservation.url,
                    ...initialObservation
                        .semanticText,
                ].join('\n'),

            flow,

            coverage,
        };
    } catch (
    error:
        unknown
    ) {
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

        throw error;
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