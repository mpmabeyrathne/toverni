import {
  join,
} from 'node:path';

import {
  fileURLToPath,
} from 'node:url';

import {
  getModelConfiguration,
} from '../configuration/model.js';

import {
  runExplorer,
  type RunExplorerResult,
} from '../explorer/run-explorer.js';

import {
  createBenchmarkReport,
  evaluateBenchmarkApplication,
  GenericBaselineGenerator,
  loadBenchmarkFixture,
  startBenchmarkFixtureServer,
  writeBenchmarkReport,
} from './index.js';

import {
  assessScenarioSupport,
} from './benchmark-support-assessor.js';

import type {
  BenchmarkApplicationEvaluation,
} from './benchmark-evaluator.js';

import type {
  BenchmarkScenario,
} from './benchmark-contracts.js';

const repositoryRoot =
  fileURLToPath(
    new URL(
      '../../../../',
      import.meta.url,
    ),
  );

function asStringArray(
  value:
    unknown,
): string[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  return value.filter(
    (
      item,
    ): item is string =>
      typeof item ===
      'string',
  );
}

function mapToverniScenarios(
  result:
    RunExplorerResult,
): BenchmarkScenario[] {
  const generatedTests =
    result.flow
      .generatedTests
      .filter(
        (test) =>
          test.runId ===
          result.runId,
      );

  const generatedTestByScenario =
    new Map(
      generatedTests.map(
        (test) => [
          test.scenarioId,
          test,
        ],
      ),
    );

  return result.flow
    .generatedScenarios
    .filter(
      (scenario) =>
        scenario.runId ===
        result.runId,
    )
    .map(
      (
        scenario,
      ): BenchmarkScenario => {
        const generatedTest =
          generatedTestByScenario.get(
            scenario.id,
          );

        const executable =
          generatedTest
            ?.generationStatus ===
          'ready';

        const runtimeStatus =
          generatedTest
            ?.executionStatus ===
          'passed'
            ? 'passed'
            : generatedTest
                ?.executionStatus ===
              'failed'
              ? 'failed'
              : generatedTest
                  ?.executionStatus ===
                'runtime_error'
                ? 'runtime_error'
                : 'not_run';

        return {
          title:
            scenario.title,

          actions:
            asStringArray(
              scenario.actions,
            ),

          expectedOutcomes:
            asStringArray(
              scenario
                .expectedOutcomes,
            ),

          executable,

          runtimeStatus,

          evidenceReferences:
            asStringArray(
              scenario
                .evidenceReferences,
            ),

          unsupportedSteps:
            [],

          humanEditsRequired:
            0,

          assertionCount:
            generatedTest
              ?.assertions
              .length ??
            0,
        };
      },
    );
}

const allFixtureIds = [
  'booking',
  'todo',
  'commerce',
  'auth-rbac',
  'checkout-form',
  'data-grid',
  'upload-retry',
] as const;

type BenchmarkFixtureId =
  typeof allFixtureIds[
    number
  ];

function resolveFixtureIds():
  BenchmarkFixtureId[] {
  const requested =
    process.env
      .BENCHMARK_FIXTURE
      ?.trim();

  if (!requested) {
    return [
      ...allFixtureIds,
    ];
  }

  if (
    !allFixtureIds.includes(
      requested as
        BenchmarkFixtureId,
    )
  ) {
    throw new Error(
      `Unknown BENCHMARK_FIXTURE "${requested}". Expected one of: ${allFixtureIds.join(', ')}`,
    );
  }

  return [
    requested as
      BenchmarkFixtureId,
  ];
}

async function main():
  Promise<void> {
  const fixtureIds =
    resolveFixtureIds();

  if (
    process.env
      .BENCHMARK_FIXTURE
  ) {
    console.log(
      `Benchmark fixture filter: ${fixtureIds.join(', ')}`,
    );
  }

  const modelConfiguration =
    getModelConfiguration();

  const baselineGenerator =
    new GenericBaselineGenerator({
      baseUrl:
        modelConfiguration
          .OLLAMA_BASE_URL,

      model:
        modelConfiguration
          .OLLAMA_COMPLEX_MODEL,
    });

  const evaluations:
    BenchmarkApplicationEvaluation[] =
    [];

  for (
    const fixtureId of
    fixtureIds
  ) {
    console.log(
      `\n=== Benchmark: ${fixtureId} ===`,
    );

    const fixture =
      await loadBenchmarkFixture(
        join(
          repositoryRoot,
          'fixtures',
          'benchmark',
          fixtureId,
          'fixture.json',
        ),
      );

    const fixtureServer =
      await startBenchmarkFixtureServer({
        fixtureDirectory:
          fixture.rootDirectory,
      });

    try {
      const targetUrl =
        fixtureServer.baseUrl;

      console.log(
        `Fixture running at ${targetUrl}`,
      );

      // --------------------------------
      // Toverni
      // --------------------------------

      const explorerResult =
        await runExplorer({
          targetUrl,

          headless:
            true,

          artifactsDirectory:
            join(
              process.cwd(),
              'artifacts',
              'benchmark-runs',
              fixtureId,
            ),

          knowledgeInput: {
            requirementsPath:
              join(
                fixture.rootDirectory,
                fixture
                  .manifest
                  .requirementsPath,
              ),

            openApiPath:
              join(
                fixture.rootDirectory,
                fixture
                  .manifest
                  .openApiPath,
              ),
          },
        });

      const rawToverniScenarios =
        mapToverniScenarios(
          explorerResult,
        );

      // --------------------------------
      // Generic LLM baseline
      // --------------------------------

      const skipGenericBaseline =
        process.env
          .BENCHMARK_SKIP_GENERIC_BASELINE ===
        'true';

      const rawBaselineScenarios =
        skipGenericBaseline
          ? []
          : await baselineGenerator.generate({
            targetUrl,

            requirements:
              fixture.requirements,

            openApi:
              fixture.openApi,

            initialPageContext:
              explorerResult
                .initialPageContext,
          });
      if (skipGenericBaseline) {
        console.log(
          'Generic LLM baseline skipped.',
        );
      }

      // --------------------------------
      // Shared support corpus
      // --------------------------------

      const observedSupportCorpus =
        [
          ...explorerResult
            .flow
            .actions
            .flatMap(
              (action) => [
                action.label ??
                  '',
                action.type,
              ],
            ),

          ...explorerResult
            .flow
            .transitions
            .flatMap(
              (transition) => [
                transition
                  .actionTarget ??
                  '',
                ...transition
                  .beforeObservation
                  .semanticText,
                ...transition
                  .afterObservation
                  .semanticText,
              ],
            ),
        ]
          .filter(
            (value) =>
              value.length >
              0,
          )
          .join(
            '\n',
          );

      const supportCorpus =
        [
          fixture.requirements,
          fixture.openApi,
          explorerResult
            .initialPageContext,
          observedSupportCorpus,
        ].join(
          '\n',
        );

      const toverniScenarios =
        assessScenarioSupport(
          rawToverniScenarios,
          supportCorpus,
        );

      const baselineScenarios =
        assessScenarioSupport(
          rawBaselineScenarios,
          supportCorpus,
        );

      // --------------------------------
      // Evaluation
      // --------------------------------

      const evaluation =
        evaluateBenchmarkApplication({
          fixtureId:
            fixture.manifest.id,

          title:
            fixture.manifest.title,

          referenceFlows:
            fixture
              .humanReference
              .flows,

          toverniScenarios,

          baselineScenarios,
        });

      evaluations.push(
        evaluation,
      );

      console.log(
        JSON.stringify(
          {
            fixture:
              fixtureId,

            toverni:
              evaluation.toverni,

            baseline:
              evaluation.baseline,

            decision:
              evaluation.decision,
          },
          null,
          2,
        ),
      );
    } finally {
      await fixtureServer.close();
    }
  }

  // --------------------------------
  // Final report
  // --------------------------------

  const report =
    createBenchmarkReport(
      evaluations,
    );

  const outputDirectory =
    join(
      process.cwd(),
      'artifacts',
      'benchmark',
    );

  const writtenReport =
    await writeBenchmarkReport(
      report,
      outputDirectory,
    );

  console.log(
    '\n=== Toverni P0 Benchmark Complete ===',
  );

  console.log(
    JSON.stringify(
      {
        overallDecision:
          report.overallDecision,

        jsonReport:
          writtenReport.jsonPath,

        markdownReport:
          writtenReport
            .markdownPath,

        reasons:
          report.reasons,
      },
      null,
      2,
    ),
  );
}

await main();