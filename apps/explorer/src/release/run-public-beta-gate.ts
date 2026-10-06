import {
  mkdir,
  writeFile,
} from 'node:fs/promises';

import {
  join,
} from 'node:path';

import {
  fileURLToPath,
} from 'node:url';

import {
  aggregateBenchmarkMetrics,
  assessScenarioSupport,
  calculateBenchmarkMetrics,
  loadBenchmarkFixture,
  startBenchmarkFixtureServer,
  type BenchmarkMetrics,
  type BenchmarkScenario,
} from '../benchmark/index.js';

import {
  getModelConfiguration,
} from '../configuration/model.js';

import {
  runExplorer,
} from '../explorer/run-explorer.js';

import {
  createModelProviderRuntime,
} from '../models/index.js';

import {
  classifyReleaseFailure,
  evaluatePublicBetaReleaseGate,
  type ReleaseFailure,
  type ReleaseFixtureResult,
} from './release-validation.js';

const repositoryRoot =
  fileURLToPath(
    new URL(
      '../../../../',
      import.meta.url,
    ),
  );

const fixtureIds = [
  'booking',
  'todo',
  'commerce',
  'auth-rbac',
  'checkout-form',
  'data-grid',
  'upload-retry',
] as const;

function asStringArray(
  value:
    unknown,
): string[] {
  return Array.isArray(
    value,
  )
    ? value.filter(
        (
          item,
        ): item is string =>
          typeof item ===
            'string',
      )
    : [];
}

function mapScenarios(
  result:
    Awaited<
      ReturnType<
        typeof runExplorer
      >
    >,
): BenchmarkScenario[] {
  const testsByScenario =
    new Map(
      result.flow
        .generatedTests
        .filter(
          (test) =>
            test.runId ===
            result.runId,
        )
        .map(
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
      (scenario) => {
        const test =
          testsByScenario.get(
            scenario.id,
          );

        return {
          title:
            scenario.title,

          actions:
            asStringArray(
              scenario.actions,
            ),

          expectedOutcomes:
            asStringArray(
              scenario.expectedOutcomes,
            ),

          executable:
            test?.generationStatus ===
            'ready',

          runtimeStatus:
            test?.executionStatus ===
              'passed'
              ? 'passed'
              : test?.executionStatus ===
                  'failed'
                ? 'failed'
                : test?.executionStatus ===
                    'runtime_error'
                  ? 'runtime_error'
                  : 'not_run',

          evidenceReferences:
            asStringArray(
              scenario
                .evidenceReferences,
            ),

          unsupportedSteps:
            test?.generationStatus ===
              'manual_required'
              ? [
                  test.reason ??
                  'Manual completion required',
                ]
              : [],

          humanEditsRequired:
            test?.generationStatus ===
              'manual_required'
              ? 1
              : 0,

          assertionCount:
            test?.assertions
              .length ??
            0,
        };
      },
    );
}

function collectFailures(
  fixtureId:
    string,

  result:
    Awaited<
      ReturnType<
        typeof runExplorer
      >
    >,
): ReleaseFailure[] {
  const failures:
    ReleaseFailure[] = [];

  for (
    const test of
      result.flow
        .generatedTests
        .filter(
          (item) =>
            item.runId ===
            result.runId,
        )
  ) {
    const messages =
      [
        test.reason,
        test.error,
        test.stderr,
      ]
        .filter(
          (
            value,
          ): value is string =>
            typeof value ===
              'string' &&
            value.trim()
              .length >
              0,
        );

    if (
      test.generationStatus ===
        'manual_required' &&
      messages.length ===
        0
    ) {
      messages.push(
        'Unsupported control requires manual completion.',
      );
    }

    if (
      test.executionStatus ===
        'failed' ||
      test.executionStatus ===
        'runtime_error' ||
      test.generationStatus ===
        'manual_required' ||
      test.generationStatus ===
        'generation_error'
    ) {
      const message =
        messages.join(
          '\n',
        ) ||
        [
          test.generationStatus,
          test.executionStatus,
        ].join(
          ' / ',
        );

      failures.push({
        fixtureId,

        source:
          'generated-test',

        category:
          classifyReleaseFailure(
            message,
          ),

        message,
      });
    }
  }

  return failures;
}

function safetyResult(
  result:
    Awaited<
      ReturnType<
        typeof runExplorer
      >
    >,
): {
  blockedHighImpactActions:
    number;

  executedHighImpactActions:
    number;
} {
  const highImpactActions =
    result.flow.actions
      .filter(
        (action) =>
          action.blockReasons
            .some(
              (reason) =>
                reason.includes(
                  'unsafe for autonomous exploration',
                ),
            ),
      );

  const selectedActionIds =
    new Set(
      result.flow
        .decisions
        .map(
          (decision) =>
            decision
              .selectedActionId,
        )
        .filter(
          (
            value,
          ): value is string =>
            typeof value ===
              'string',
        ),
    );

  return {
    blockedHighImpactActions:
      highImpactActions
        .filter(
          (action) =>
            action.blocked,
        )
        .length,

    executedHighImpactActions:
      highImpactActions
        .filter(
          (action) =>
            selectedActionIds
              .has(
                action.id,
              ),
        )
        .length,
  };
}

function renderReport(
  input: {
    generatedAt:
      string;

    gate:
      ReturnType<
        typeof evaluatePublicBetaReleaseGate
      >;

    fixtures:
      ReleaseFixtureResult[];
  },
): string {
  const lines = [
    '# Toverni Free v1 Public Beta Release Gate',
    '',
    `Generated: ${input.generatedAt}`,
    '',
    `Overall gate: **${input.gate.passed ? 'PASSED' : 'FAILED'}**`,
    `Quality thresholds: **${input.gate.qualityPassed ? 'PASSED' : 'FAILED'}**`,
    `Generated-test runtime: **${input.gate.runtimePassed ? 'PASSED' : 'FAILED'}**`,
    `Safety defaults: **${input.gate.safetyPassed ? 'PASSED' : 'FAILED'}**`,
    `Local Ollama path: **${input.gate.modelPathPassed ? 'PASSED' : 'FAILED'}**`,
    '',
    '## Aggregate metrics',
    '',
    `- Important-flow coverage: ${(input.gate.aggregate.importantFlowCoverage * 100).toFixed(1)}%`,
    `- Executability: ${(input.gate.aggregate.executabilityRate * 100).toFixed(1)}%`,
    `- Runtime pass rate: ${(input.gate.aggregate.runtimePassRate * 100).toFixed(1)}%`,
    `- Requirement grounding: ${(input.gate.aggregate.requirementGroundingRate * 100).toFixed(1)}%`,
    `- Meaningful assertion coverage: ${(input.gate.aggregate.meaningfulAssertionCoverage * 100).toFixed(1)}%`,
    `- Unsupported action rate: ${(input.gate.aggregate.unsupportedActionRate * 100).toFixed(1)}%`,
    `- Duplicate rate: ${(input.gate.aggregate.duplicateRate * 100).toFixed(1)}%`,
    '',
    '## Failure taxonomy',
    '',
    ...Object.entries(
      input.gate.failureCounts,
    ).map(
      ([category,count]) =>
        `- ${category}: ${count}`,
    ),
    '',
    '## Fixture results',
    '',
    ...input.fixtures.flatMap(
      (fixture) => [
        `### ${fixture.fixtureId} — ${fixture.title}`,
        '',
        `- Executability: ${(fixture.metrics.executabilityRate * 100).toFixed(1)}%`,
        `- Runtime pass: ${(fixture.metrics.runtimePassRate * 100).toFixed(1)}%`,
        `- Important-flow coverage: ${(fixture.metrics.importantFlowCoverage * 100).toFixed(1)}%`,
        `- High-impact blocked: ${fixture.safety.blockedHighImpactActions}`,
        `- High-impact executed: ${fixture.safety.executedHighImpactActions}`,
        `- Classified failures: ${fixture.failures.length}`,
        '',
      ],
    ),
  ];

  if (
    input.gate.failedChecks
      .length >
    0
  ) {
    lines.push(
      '## Failed checks',
      '',
      ...input.gate
        .failedChecks
        .map(
          (reason) =>
            `- ${reason}`,
        ),
      '',
    );
  }

  lines.push(
    '## Release constraints',
    '',
    '- This gate does not publish to npm or create a GitHub release.',
    '- Free v1 requires no Toverni-hosted verification/SaaS service.',
    '- Ollama remains the local model provider for the public beta candidate.',
    '- Cloud BYOK adapters remain deferred to TOV-125.',
    '',
  );

  return lines.join(
    '\n',
  );
}

async function main():
Promise<void> {
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

  let modelPathPassed =
    false;

  try {
    await modelRuntime
      .preflight();

    modelPathPassed =
      true;
  } catch (
    error:
      unknown
  ) {
    console.error(
      error instanceof Error
        ? error.message
        : String(
            error,
          ),
    );
  }

  const fixtures:
    ReleaseFixtureResult[] = [];

  for (
    const fixtureId of
      fixtureIds
  ) {
    console.log(
      `\n=== Public beta gate: ${fixtureId} ===`,
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

    const server =
      await startBenchmarkFixtureServer({
        fixtureDirectory:
          fixture.rootDirectory,
      });

    try {
      process.env
        .MODEL_REASONING_ENABLED =
        'true';

      const result =
        await runExplorer({
          targetUrl:
            server.baseUrl,

          headless:
            true,

          allowDestructiveActions:
            false,

          artifactsDirectory:
            join(
              process.cwd(),
              'artifacts',
              'release-gate',
              fixtureId,
            ),

          knowledgeInput: {
            requirementsPath:
              join(
                fixture.rootDirectory,
                fixture.manifest
                  .requirementsPath,
              ),

            openApiPath:
              join(
                fixture.rootDirectory,
                fixture.manifest
                  .openApiPath,
              ),
          },
        });

      const rawScenarios =
        mapScenarios(
          result,
        );

      const supportCorpus =
        [
          fixture.requirements,
          fixture.openApi,
          result.initialPageContext,
          ...result.flow.actions
            .map(
              (action) =>
                action.label,
            ),
        ].join(
          '\n',
        );

      const scenarios =
        assessScenarioSupport(
          rawScenarios,
          supportCorpus,
        );

      const metrics =
        calculateBenchmarkMetrics(
          scenarios,
          fixture.humanReference
            .flows,
        );

      const fixtureResult:
        ReleaseFixtureResult = {
          fixtureId,

          title:
            fixture.manifest
              .title,

          metrics,

          safety:
            safetyResult(
              result,
            ),

          failures:
            collectFailures(
              fixtureId,
              result,
            ),
        };

      fixtures.push(
        fixtureResult,
      );

      console.log(
        JSON.stringify(
          fixtureResult,
          null,
          2,
        ),
      );
    } finally {
      await server.close();
    }
  }

  const aggregate =
    aggregateBenchmarkMetrics(
      fixtures.map(
        (fixture) =>
          fixture.metrics,
      ),
    );

  const gate =
    evaluatePublicBetaReleaseGate({
      aggregate,
      fixtures,
      modelPathPassed,
    });

  const generatedAt =
    new Date()
      .toISOString();

  const outputDirectory =
    join(
      process.cwd(),
      'artifacts',
      'release-gate',
    );

  await mkdir(
    outputDirectory,
    {
      recursive:
        true,
    },
  );

  await Promise.all([
    writeFile(
      join(
        outputDirectory,
        'public-beta-release-gate.json',
      ),
      `${JSON.stringify(
        {
          generatedAt,
          gate,
          fixtures,
        },
        null,
        2,
      )}\n`,
      'utf8',
    ),

    writeFile(
      join(
        outputDirectory,
        'public-beta-release-gate.md',
      ),
      renderReport({
        generatedAt,
        gate,
        fixtures,
      }),
      'utf8',
    ),
  ]);

  console.log(
    '\n=== Public beta release gate complete ===',
  );

  console.log(
    JSON.stringify(
      {
        passed:
          gate.passed,

        failedChecks:
          gate.failedChecks,

        report:
          join(
            outputDirectory,
            'public-beta-release-gate.md',
          ),
      },
      null,
      2,
    ),
  );

  if (
    !gate.passed
  ) {
    process.exitCode =
      1;
  }
}

await main();
