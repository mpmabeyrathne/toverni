import type { ApprovedFormFixture } from '../forms/approved-form-fixtures.js';
import {
    assertAuthenticatedLanding,
    PlaywrightBrowserController,
} from '../browser/index.js';

import {
    createExecutableTestPlan,
    resolvePlaywrightProjectOutput,
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
    buildGenerationSummary,
    type GenerationSummary,
} from './generation-summary.js';

import {
    buildEvidenceCatalog,
    GroundedScenarioGenerator,
} from '../scenarios/index.js';

import {
    getDatabaseConfiguration,
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
    createModelProviderRuntime,
    RecordingModelProvider,
} from '../models/index.js';

import {
    ApplicationStateModel,
} from '../state/index.js';

export interface RunExplorerInput {
    approvedFixture?: ApprovedFormFixture;
    targetUrl: string;

    knowledgeInput?: {
        requirementsPath?: string;
        openApiPath?: string;
    };

    headless?: boolean;

    artifactsDirectory?: string;

    outputDirectory?: string;

    auth?: {
        storageStatePath?: string;
    };

    resumeRunId?: string;

    explorationBudget?:
        Partial<ExplorationBudget>;

    allowDestructiveActions?:
        boolean;

    maxScenarios?:
        number;

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

    summary:
    GenerationSummary;
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

            ...(
                input.auth
                    ?.storageStatePath
                    ? input.artifactsDirectory
                        ? {
                            artifactsDirectory:
                                input.artifactsDirectory,
                          }
                        : {}
                    : {
                        artifactsDirectory:
                            input.artifactsDirectory ??
                            'artifacts',
                      }
            ),

            ...(input.auth
                ?.storageStatePath
                ? {
                    storageStatePath:
                        input.auth
                            .storageStatePath,
                  }
                : {}),
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
            input.allowDestructiveActions ??
                false,
        );

    let databaseConnection:
        | Awaited<
            ReturnType<
                typeof createDatabase
            >
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

        const databaseConfiguration =
            getDatabaseConfiguration();

        databaseConnection =
            await createDatabase(
                databaseConfiguration,
            );

        logger.info(
            {
                storageMode:
                    databaseConnection.kind,

                ...(databaseConnection.kind ===
                    'local'
                    ? {
                        dataDirectory:
                            databaseConfiguration.kind ===
                                'local'
                                ? databaseConfiguration
                                    .dataDirectory
                                : null,
                    }
                    : {}),
            },
            'Persistence ready',
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

        const modelRuntime =
            createModelProviderRuntime({
                provider:
                    modelConfiguration
                        .MODEL_PROVIDER,

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

        if (
            modelConfiguration
                .MODEL_REASONING_ENABLED
        ) {
            const preflight =
                await modelRuntime
                    .preflight();

            logger.info(
                {
                    provider:
                        preflight.provider,

                    local:
                        preflight.local,

                    cheapModel:
                        modelConfiguration
                            .OLLAMA_CHEAP_MODEL,

                    complexModel:
                        modelConfiguration
                            .OLLAMA_COMPLEX_MODEL,

                    requiresUserCredentials:
                        modelRuntime
                            .requiresUserCredentials,
                },
                'Model provider preflight passed',
            );
        }

        const rawModelProvider =
            modelRuntime
                .provider;

        const boundedModelProvider =
            new BoundedModelProvider(
                rawModelProvider,
                {
                    maxCalls:
                        explorationBudget
                            .maxModelCalls,

                    retryAttempts:
                        modelConfiguration
                            .MODEL_RETRY_ATTEMPTS,

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

        const loadedTitle =
            await session.getTitle();

        if (
            input.auth
                ?.storageStatePath
        ) {
            assertAuthenticatedLanding({
                requestedUrl:
                    input.targetUrl,

                actualUrl:
                    session.getUrl(),

                title:
                    loadedTitle,
            });
        }

        logger.info(
            {
                url:
                    session.getUrl(),

                title:
                    loadedTitle,

                authenticatedSession:
                    Boolean(
                        input.auth
                            ?.storageStatePath,
                    ),
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
                    input.auth
                        ?.storageStatePath
                        ? {
                            url:
                                observation.url,

                            title:
                                observation.title,

                            actionCount:
                                observation.actions
                                    .length,

                            networkEventCount:
                                observation
                                    .networkEvents
                                    .length,

                            consoleEventCount:
                                observation
                                    .consoleEvents
                                    .length,

                            authenticatedSession:
                                true,
                          }
                        : {
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
                ...(input.approvedFixture ? { approvedFixture: input.approvedFixture } : {}),
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

                targetOrigin:
                    new URL(
                        input.targetUrl,
                    ).origin,

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
                    run.id,
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

                initialStateId:
                    explorationResult
                        .initialStateId,
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
        // Resolve generated Playwright output
        // --------------------------------

        const playwrightProjectOutput =
            await resolvePlaywrightProjectOutput({
                workingDirectory:
                    process.cwd(),

                ...(input.outputDirectory
                    ? {
                        explicitOutputDirectory:
                            input.outputDirectory,
                      }
                    : {}),
            });

        const generatedTestsDirectory =
            playwrightProjectOutput
                .outputDirectory;

        // Isolated verified-workflow pipeline. It runs only when the
        // operator supplies explicit expected outcomes and approved fixtures.
        // No scenario or credential is inferred from a successful click.
        if (input.approvedFixture && process.env.TOVERNI_WORKFLOW_DATASETS) {
            const { runVerifiedWorkflowPipeline } =
                await import('../exploration/verified-workflow-pipeline.js');
            const workflowResult = await runVerifiedWorkflowPipeline({
                initialObservation: explorationResult.initialObservation,
                fixture: input.approvedFixture,
                openSession: () => browser.createSession(),
                outputDirectory: generatedTestsDirectory,
                datasetsJson: process.env.TOVERNI_WORKFLOW_DATASETS,
                fieldEnvJson: process.env.TOVERNI_APPROVED_FIXTURE_FIELDS ?? '{}',
            });
            logger.info({
                discoveredBranches: workflowResult.discoveredBranches,
                completed: workflowResult.completed,
                blocked: workflowResult.blocked,
                failed: workflowResult.failed,
                generatedSpecs: workflowResult.generatedSpecs,
            }, 'Verified workflow pipeline completed');
        }



        logger.info(
            {
                outputDirectory:
                    generatedTestsDirectory,

                projectDetected:
                    playwrightProjectOutput
                        .projectDetected,

                configPath:
                    playwrightProjectOutput
                        .configPath,
            },
            'Resolved generated Playwright suite output',
        );

        if (
            playwrightProjectOutput
                .bootstrapCommand
        ) {
            logger.warn(
                {
                    outputDirectory:
                        generatedTestsDirectory,

                    bootstrapCommand:
                        playwrightProjectOutput
                            .bootstrapCommand,
                },
                'Playwright project was not detected; generated specs are ready, but bootstrap Playwright before running them',
            );
        }

        // --------------------------------
        // Grounded scenario generation
        // --------------------------------

        {
  
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
        }, {
          skipModel:
            !modelConfiguration.MODEL_REASONING_ENABLED,
        });
  
    const hasAcceptanceCriteria =
      (
        knowledge.requirements
          ?.acceptanceCriteria
          .length ??
        0
      ) >
      0;

    const browserSuiteCandidates =
      hasAcceptanceCriteria
        ? generatedScenarios.filter(
            (scenario) =>
              scenario
                .evidenceReferences
                .some(
                  (reference) =>
                    reference
                      .toUpperCase()
                      .startsWith(
                        'REQ-',
                      ),
                ),
          )
        : generatedScenarios;

    const scenarioCandidates =
      browserSuiteCandidates.length >
        0
        ? browserSuiteCandidates
        : generatedScenarios;

    const createPlanForScenario =
      (
        scenario: {
          id?: string;
          title: string;
          evidenceReferences:
            string[];
        },

        provisionalId:
          string,
      ) =>
        createExecutableTestPlan({
          scenario: {
            id:
              scenario.id ??
              provisionalId,

            title:
              scenario.title,

            evidenceReferences:
              scenario
                .evidenceReferences,
          },

          initialStateId:
            explorationResult
              .initialStateId,

          evidence:
            evidence.map(
              (item) => ({
                id:
                  item.id,

                type:
                  item.type,

                source:
                  item.source,

                description:
                  item.description,
              }),
            ),

          actions:
            currentFlow.actions.map(
              (action) => {
                const sourceState =
                  currentFlow.states.find(
                    (state) =>
                      state.id ===
                      action.stateId,
                  );

                const observedAction =
                  sourceState
                    ?.observation
                    .actions
                    .find(
                      (candidate) =>
                        (
                          candidate.name ??
                          candidate.text ??
                          candidate.testId ??
                          `${candidate.type}:${candidate.tagName}`
                        ) ===
                        action.label,
                    );

                return {
                  id:
                    action.id,

                  label:
                    action.label,

                  type:
                    action.type,

                  target:
                    action.target,

                  ...(observedAction
                    ?.href
                    ? {
                        href:
                          observedAction.href,
                      }
                    : {}),

                  ...(sourceState
                    ?.observation
                    .url
                    ? {
                        sourceUrl:
                          sourceState
                            .observation
                            .url,
                      }
                    : {}),

                  blocked:
                    action.blocked,

                  blockReasons:
                    action.blockReasons,
                };
              },
            ),

          transitions:
            currentFlow
              .transitions
              .map(
                (transition) => ({
                  id:
                    transition.id,

                  fromStateId:
                    transition
                      .fromStateId,

                  toStateId:
                    transition
                      .toStateId,

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

    const plannedCandidates =
      scenarioCandidates.map(
        (
          scenario,
          index,
        ) => ({
          scenario,

          plan:
            createPlanForScenario(
              scenario,
              `candidate-${index + 1}`,
            ),
        }),
      );

    const maxScenarios =
      input.maxScenarios ??
      20;

    const runnableCandidates =
      plannedCandidates.filter(
        (candidate) =>
          candidate.plan.status ===
          'ready',
      );

    const manualCandidates =
      plannedCandidates.filter(
        (candidate) =>
          candidate.plan.status ===
          'manual_required',
      );

    const selectedCandidates = [
      ...runnableCandidates,
      ...manualCandidates,
    ].slice(
      0,
      maxScenarios,
    );

    const scenarios =
      selectedCandidates.map(
        (candidate) =>
          candidate.scenario,
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

        scenarioCandidateCount:
          scenarioCandidates.length,

        runnableCandidateCount:
          runnableCandidates.length,

        manualCandidateCount:
          manualCandidates.length,
  
        scenarioCount:
          scenarios.length,

        maxScenarios,

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
  

    for (
      const storedScenario of
      storedScenarios
    ) {
      const plan =
        createPlanForScenario(
          storedScenario,
          storedScenario.id,
        );
  
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
                playwrightProjectOutput
                  .workingDirectory,

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
                    run.id,
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

        const targetOrigin =
            new URL(
                input.targetUrl,
            ).origin;

        const executedActionIds =
            new Set(
                flow.transitions
                    .map(
                        (transition) =>
                            transition.actionId,
                    )
                    .filter(
                        (
                            actionId,
                        ): actionId is string =>
                            typeof actionId ===
                                'string',
                    ),
            );

        const routeCandidates =
            flow.actions
                .map(
                    (action) => {
                        const state =
                            flow.states.find(
                                (candidate) =>
                                    candidate.id ===
                                    action.stateId,
                            );

                        const observedAction =
                            state
                                ?.observation
                                .actions
                                .find(
                                    (candidate) =>
                                        (
                                            candidate.name ??
                                            candidate.text ??
                                            candidate.testId ??
                                            `${candidate.type}:${candidate.tagName}`
                                        ) ===
                                        action.label,
                                );

                        if (
                            !state ||
                            !observedAction
                                ?.href
                        ) {
                            return null;
                        }

                        try {
                            const sourceUrl =
                                new URL(
                                    state
                                        .observation
                                        .url,
                                );

                            const destinationUrl =
                                new URL(
                                    observedAction
                                        .href,
                                    sourceUrl,
                                );

                            const sameOrigin =
                                destinationUrl.origin ===
                                targetOrigin;

                            const changesRoute =
                                destinationUrl.pathname !==
                                    sourceUrl.pathname ||
                                destinationUrl.search !==
                                    sourceUrl.search;

                            if (
                                !changesRoute
                            ) {
                                return null;
                            }

                            return {
                                actionId:
                                    action.id,

                                label:
                                    action.label,

                                href:
                                    destinationUrl.href,

                                sameOrigin,

                                blocked:
                                    action.blocked,

                                blockReasons:
                                    action.blockReasons,
                            };
                        } catch {
                            return null;
                        }
                    },
                )
                .filter(
                    (
                        candidate,
                    ): candidate is NonNullable<
                        typeof candidate
                    > =>
                        candidate !==
                        null,
                );

        // Only label a flow covered when the coverage evaluator says so.
        // Grounded behaviors alone do not guarantee executable test coverage.
        const coveredFlowNames =
            [
                ...new Set(
                    coverage.entries
                        .filter(
                            (entry) =>
                                entry.target.kind === 'flow' &&
                                entry.status === 'covered',
                        )
                        .map((entry) => entry.target.label),
                ),
            ].sort();

        // Audit successful destinations rather than only the exact action ID:
        // the same route may be reached through another navigation action.
        const reachedRouteUrls =
            new Set(
                flow.transitions
                    .map((transition) =>
                        flow.states.find(
                            (state) => state.id === transition.toStateId,
                        )?.latestUrl,
                    )
                    .filter((url): url is string => typeof url === 'string')
                    .map((url) => {
                        const parsed = new URL(url);
                        parsed.hash = '';
                        return parsed.href;
                    }),
            );

        const wasRouteReached = (href: string): boolean => {
            const parsed = new URL(href);
            parsed.hash = '';
            return reachedRouteUrls.has(parsed.href);
        };

        const missedRouteFlows =
            [
                ...new Set(
                    routeCandidates
                        .filter(
                            (candidate) =>
                                candidate.sameOrigin &&
                                !candidate.blocked &&
                                !executedActionIds.has(candidate.actionId) &&
                                !wasRouteReached(candidate.href),
                        )
                        .map(
                            (candidate) =>
                                `${candidate.label} → ${candidate.href}`,
                        ),
                ),
            ].sort();

        const blockedRouteFlows =
            [
                ...new Set(
                    routeCandidates
                        .filter(
                            (candidate) =>
                                !candidate.sameOrigin ||
                                candidate.blocked,
                        )
                        .map(
                            (candidate) =>
                                `${candidate.label} → ${candidate.href}`,
                        ),
                ),
            ].sort();

        const summary =
            buildGenerationSummary({
                runId:
                    run.id,

                targetUrl:
                    input.targetUrl,

                flow,

                coverage,

                discoveredFlows:
                    reconstructedFlows
                        .length,

                flowAudit: {
                    covered:
                        coveredFlowNames,

                    missed:
                        missedRouteFlows,

                    blocked:
                        blockedRouteFlows,
                },

                outputDirectory:
                    generatedTestsDirectory,

                stopReason:
                    explorationResult
                        .stopReason,
            });

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

            summary,
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