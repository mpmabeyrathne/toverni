import {
  mkdir,
  writeFile,
} from 'node:fs/promises';

import {
  dirname,
} from 'node:path';

import type {
  CoverageReport,
} from '../coverage/index.js';

export interface GenerationSummary {
  status:
    'completed'
    | 'partial';

  runId:
    string;

  targetUrl:
    string;

  discovery: {
    states:
      number;

    flows:
      number;

    transitions:
      number;

    scenarios:
      number;
  };

  tests: {
    generated:
      number;

    runnable:
      number;

    passed:
      number;

    failed:
      number;

    manualRequired:
      number;

    generationErrors:
      number;
  };

  safety: {
    blockedActions:
      number;

    highImpactSkipped:
      Array<{
        label:
          string;

        reasons:
          string[];
      }>;
  };

  coverage: {
    total:
      number;

    covered:
      number;

    partiallyCovered:
      number;

    blocked:
      number;

    unsupported:
      number;

    uncovered:
      number;

    requirementCovered:
      number;

    requirementTotal:
      number;

    flowCovered:
      number;

    flowTotal:
      number;
  };

  output: {
    directory:
      string;

    files:
      string[];
  };

  model: {
    calls:
      number;

    provider:
      string | null;

    models:
      string[];

    totalTokens:
      number;

    estimatedCostUsd:
      number;

    durationMs:
      number;
  };

  warnings:
    string[];

  nextSteps:
    string[];
}

export interface BuildGenerationSummaryInput {
  runId:
    string;

  targetUrl:
    string;

  flow: {
    states:
      unknown[];

    transitions:
      unknown[];

    actions:
      Array<{
        label:
          string;

        blocked:
          boolean;

        blockReasons:
          string[];
      }>;

    generatedScenarios:
      unknown[];

    generatedTests:
      Array<{
        generationStatus:
          string;

        executionStatus:
          string;

        reason?:
          string | null;

        sourceFilePath?:
          string | null;
      }>;

    modelUsage:
      Array<{
        provider:
          string;

        model:
          string;

        totalTokens:
          number;

        estimatedCostUsd:
          number;

        durationMs:
          number;
      }>;
  };

  coverage:
    CoverageReport;

  discoveredFlows:
    number;

  outputDirectory:
    string;

  stopReason?:
    string | null;
}

function coverageByKind(
  coverage:
    CoverageReport,

  kind:
    'requirement'
    | 'flow',
): {
  covered:
    number;

  total:
    number;
} {
  const entries =
    coverage.entries.filter(
      (entry) =>
        entry.target.kind ===
        kind,
    );

  return {
    total:
      entries.length,

    covered:
      entries.filter(
        (entry) =>
          entry.status ===
          'covered',
      ).length,
  };
}

export function buildGenerationSummary(
  input:
    BuildGenerationSummaryInput,
): GenerationSummary {
  const generatedTests =
    input.flow.generatedTests;

  const failed =
    generatedTests.filter(
      (test) =>
        test.executionStatus ===
          'failed' ||
        test.executionStatus ===
          'runtime_error',
    );

  const manualRequired =
    generatedTests.filter(
      (test) =>
        test.generationStatus ===
          'manual_required',
    );

  const generationErrors =
    generatedTests.filter(
      (test) =>
        test.generationStatus ===
          'generation_error',
    );

  const runnable =
    generatedTests.filter(
      (test) =>
        test.generationStatus ===
          'ready',
    );

  const highImpactSkipped =
    input.flow.actions
      .filter(
        (action) =>
          action.blocked &&
          action.blockReasons
            .some(
              (reason) =>
                reason.includes(
                  'unsafe for autonomous exploration',
                ),
            ),
      )
      .map(
        (action) => ({
          label:
            action.label,

          reasons: [
            ...action
              .blockReasons,
          ],
        }),
      );

  const outputFiles =
    [
      ...new Set(
        generatedTests
          .map(
            (test) =>
              test.sourceFilePath,
          )
          .filter(
            (
              value,
            ): value is string =>
              typeof value ===
                'string' &&
              value.length >
                0,
          ),
      ),
    ].sort();

  const modelProviders =
    [
      ...new Set(
        input.flow.modelUsage
          .map(
            (usage) =>
              usage.provider,
          ),
      ),
    ];

  const modelNames =
    [
      ...new Set(
        input.flow.modelUsage
          .map(
            (usage) =>
              usage.model,
          ),
      ),
    ].sort();

  const warnings:
    string[] = [];

  const nextSteps:
    string[] = [];

  if (
    failed.length >
    0
  ) {
    warnings.push(
      `${failed.length} generated test(s) failed during execution.`,
    );

    nextSteps.push(
      'Review failed generated test output and application state, then rerun the affected specs.',
    );
  }

  if (
    manualRequired.length >
    0
  ) {
    warnings.push(
      `${manualRequired.length} scenario(s) require manual completion.`,
    );

    nextSteps.push(
      'Review manual-required scenarios and supply missing evidence or application-specific test logic.',
    );
  }

  if (
    generationErrors.length >
    0
  ) {
    warnings.push(
      `${generationErrors.length} test(s) could not be generated.`,
    );

    nextSteps.push(
      'Review generation-error reasons and add missing executable evidence or supported actions.',
    );
  }

  if (
    input.coverage.gaps
      .length >
    0
  ) {
    warnings.push(
      `${input.coverage.gaps.length} coverage target(s) remain incomplete.`,
    );

    nextSteps.push(
      'Review uncovered/blocked coverage targets and provide requirements, API evidence, or reachable UI flows.',
    );
  }

  if (
    highImpactSkipped.length >
    0
  ) {
    warnings.push(
      `${highImpactSkipped.length} high-impact action(s) were skipped by the safety policy.`,
    );

    nextSteps.push(
      'Use --allow-destructive-actions only in an isolated environment if those actions must be explored.',
    );
  }

  if (
    input.stopReason &&
    input.stopReason !==
      'no-eligible-actions'
  ) {
    warnings.push(
      `Exploration stopped because: ${input.stopReason}.`,
    );
  }

  const requirementCoverage =
    coverageByKind(
      input.coverage,
      'requirement',
    );

  const flowCoverage =
    coverageByKind(
      input.coverage,
      'flow',
    );

  const partial =
    warnings.length >
      0 ||
    failed.length >
      0 ||
    manualRequired.length >
      0 ||
    generationErrors.length >
      0;

  return {
    status:
      partial
        ? 'partial'
        : 'completed',

    runId:
      input.runId,

    targetUrl:
      input.targetUrl,

    discovery: {
      states:
        input.flow.states
          .length,

      flows:
        input.discoveredFlows,

      transitions:
        input.flow.transitions
          .length,

      scenarios:
        input.flow
          .generatedScenarios
          .length,
    },

    tests: {
      generated:
        generatedTests.length,

      runnable:
        runnable.length,

      passed:
        generatedTests.filter(
          (test) =>
            test.executionStatus ===
            'passed',
        ).length,

      failed:
        failed.length,

      manualRequired:
        manualRequired.length,

      generationErrors:
        generationErrors.length,
    },

    safety: {
      blockedActions:
        input.flow.actions
          .filter(
            (action) =>
              action.blocked,
          )
          .length,

      highImpactSkipped,
    },

    coverage: {
      ...input.coverage
        .totals,

      requirementCovered:
        requirementCoverage
          .covered,

      requirementTotal:
        requirementCoverage
          .total,

      flowCovered:
        flowCoverage.covered,

      flowTotal:
        flowCoverage.total,
    },

    output: {
      directory:
        input.outputDirectory,

      files:
        outputFiles,
    },

    model: {
      calls:
        input.flow.modelUsage
          .length,

      provider:
        modelProviders.length ===
          1
          ? modelProviders[0] ??
            null
          : modelProviders.length >
              1
            ? 'multiple'
            : null,

      models:
        modelNames,

      totalTokens:
        input.flow.modelUsage
          .reduce(
            (
              total,
              usage,
            ) =>
              total +
              usage.totalTokens,
            0,
          ),

      estimatedCostUsd:
        input.flow.modelUsage
          .reduce(
            (
              total,
              usage,
            ) =>
              total +
              usage
                .estimatedCostUsd,
            0,
          ),

      durationMs:
        input.flow.modelUsage
          .reduce(
            (
              total,
              usage,
            ) =>
              total +
              usage.durationMs,
            0,
          ),
    },

    warnings,

    nextSteps: [
      ...new Set(
        nextSteps,
      ),
    ],
  };
}

export function renderGenerationSummary(
  summary:
    GenerationSummary,
): string {
  const lines = [
    '',
    'Toverni generation summary',
    '--------------------------',
    `Status: ${summary.status}`,
    `Run: ${summary.runId}`,
    `Target: ${summary.targetUrl}`,
    '',
    `Discovered: ${summary.discovery.states} states, ${summary.discovery.flows} flows, ${summary.discovery.transitions} transitions`,
    `Scenarios: ${summary.discovery.scenarios}`,
    `Tests: ${summary.tests.generated} generated, ${summary.tests.runnable} runnable, ${summary.tests.passed} passed, ${summary.tests.failed} failed, ${summary.tests.manualRequired} manual-required`,
    `Coverage: ${summary.coverage.covered}/${summary.coverage.total} covered, ${summary.coverage.partiallyCovered} partial, ${summary.coverage.blocked} blocked, ${summary.coverage.uncovered} uncovered`,
    `Requirements: ${summary.coverage.requirementCovered}/${summary.coverage.requirementTotal} covered`,
    `Important flows: ${summary.coverage.flowCovered}/${summary.coverage.flowTotal} covered`,
    `Safety: ${summary.safety.blockedActions} blocked actions, ${summary.safety.highImpactSkipped.length} high-impact skipped`,
    `Output: ${summary.output.directory}`,
    `Model: ${summary.model.calls} calls, ${summary.model.totalTokens} tokens, $${summary.model.estimatedCostUsd.toFixed(6)} estimated`,
  ];

  if (
    summary.output.files
      .length >
    0
  ) {
    lines.push(
      '',
      'Generated files:',
      ...summary.output.files
        .map(
          (file) =>
            `  - ${file}`,
        ),
    );
  }

  if (
    summary.warnings.length >
    0
  ) {
    lines.push(
      '',
      'Warnings:',
      ...summary.warnings
        .map(
          (warning) =>
            `  - ${warning}`,
        ),
    );
  }

  if (
    summary.nextSteps.length >
    0
  ) {
    lines.push(
      '',
      'Next steps:',
      ...summary.nextSteps
        .map(
          (step) =>
            `  - ${step}`,
        ),
    );
  }

  return lines.join(
    '\n',
  );
}

export async function writeGenerationSummaryJson(
  summary:
    GenerationSummary,

  path:
    string,
): Promise<void> {
  await mkdir(
    dirname(
      path,
    ),
    {
      recursive:
        true,
    },
  );

  await writeFile(
    path,
    `${JSON.stringify(
      summary,
      null,
      2,
    )}\n`,
    'utf8',
  );
}
