import {
  mkdir,
  writeFile,
} from 'node:fs/promises';

import {
  join,
} from 'node:path';

import type {
  BenchmarkMetrics,
} from './benchmark-contracts.js';

import {
  aggregateBenchmarkMetrics,
} from './benchmark-quality-telemetry.js';

import {
  BENCHMARK_QUALITY_THRESHOLDS,
} from './benchmark-thresholds.js';

import type {
  CompetitiveBenchmarkReport,
  CompetitiveFixtureMetrics,
  CompetitiveToolMetadata,
} from './competitive-benchmark-contracts.js';

function percentage(
  value:
    number,
): string {
  return `${(
    value *
    100
  ).toFixed(1)}%`;
}

export function createCompetitiveBenchmarkReport(
  tools:
    CompetitiveToolMetadata[],

  applications:
    CompetitiveFixtureMetrics[],

  limitations:
    string[],
): CompetitiveBenchmarkReport {
  const aggregate:
    Record<
      string,
      BenchmarkMetrics
    > = {};

  for (
    const tool of
      tools
  ) {
    const metrics =
      applications
        .map(
          (application) =>
            application
              .methods[
                tool.id
              ],
        )
        .filter(
          (
            item,
          ): item is BenchmarkMetrics =>
            item !==
            undefined,
        );

    if (
      metrics.length >
      0
    ) {
      aggregate[
        tool.id
      ] =
        aggregateBenchmarkMetrics(
          metrics,
        );
    }
  }

  const toverni =
    aggregate.toverni;

  const failedGates:
    string[] = [];

  if (
    !toverni ||
    toverni.importantFlowCoverage <
      BENCHMARK_QUALITY_THRESHOLDS
        .importantFlowCoverage
  ) {
    failedGates.push(
      'importantFlowCoverage',
    );
  }

  if (
    !toverni ||
    toverni.executabilityRate <
      BENCHMARK_QUALITY_THRESHOLDS
        .executabilityRate
  ) {
    failedGates.push(
      'executabilityRate',
    );
  }

  if (
    !toverni ||
    toverni.requirementGroundingRate <
      BENCHMARK_QUALITY_THRESHOLDS
        .requirementGroundingRate
  ) {
    failedGates.push(
      'requirementGroundingRate',
    );
  }

  if (
    !toverni ||
    toverni.meaningfulAssertionCoverage <
      BENCHMARK_QUALITY_THRESHOLDS
        .meaningfulAssertionCoverage
  ) {
    failedGates.push(
      'meaningfulAssertionCoverage',
    );
  }

  if (
    !toverni ||
    toverni.unsupportedActionRate >
      BENCHMARK_QUALITY_THRESHOLDS
        .unsupportedActionRate
  ) {
    failedGates.push(
      'unsupportedActionRate',
    );
  }

  if (
    !toverni ||
    toverni.duplicateRate >
      BENCHMARK_QUALITY_THRESHOLDS
        .duplicateRate
  ) {
    failedGates.push(
      'duplicateRate',
    );
  }

  return {
    generatedAt:
      new Date()
        .toISOString(),

    tools,

    applications,

    aggregate,

    toverniGatePassed:
      failedGates.length ===
      0,

    toverniFailedGates:
      failedGates,

    limitations,
  };
}

export function renderCompetitiveBenchmarkMarkdown(
  report:
    CompetitiveBenchmarkReport,
): string {
  const toolIds =
    report.tools
      .map(
        (tool) =>
          tool.id,
      )
      .filter(
        (toolId) =>
          report.aggregate[
            toolId
          ] !==
          undefined,
      );

  const lines:
    string[] = [
      '# Toverni Competitive Test-Generation Benchmark',
      '',
      `Generated: ${report.generatedAt}`,
      '',
      `Toverni minimum gate: **${report.toverniGatePassed ? 'PASSED' : 'FAILED'}**`,
      '',
      '## Tool metadata',
      '',
      '| Tool | Category | Version | Input protocol | Execution budget |',
      '| --- | --- | --- | --- | --- |',
      ...report.tools.map(
        (tool) =>
          `| ${tool.name} | ${tool.category} | ${tool.version} | ${tool.inputProtocol} | ${tool.executionBudget} |`,
      ),
      '',
      '## Aggregate metrics',
      '',
      `| Metric | ${toolIds.join(' | ')} |`,
      `| --- | ${toolIds.map(() => '---:').join(' | ')} |`,
    ];

  const rows:
    Array<[
      string,
      (
        metrics:
          BenchmarkMetrics,
      ) => string,
    ]> = [
      [
        'Important-flow coverage',
        (metrics) =>
          percentage(
            metrics
              .importantFlowCoverage,
          ),
      ],
      [
        'Executable/runnable rate',
        (metrics) =>
          percentage(
            metrics
              .executabilityRate,
          ),
      ],
      [
        'Runtime pass rate',
        (metrics) =>
          percentage(
            metrics
              .runtimePassRate,
          ),
      ],
      [
        'Requirement grounding',
        (metrics) =>
          percentage(
            metrics
              .requirementGroundingRate,
          ),
      ],
      [
        'Meaningful assertion coverage',
        (metrics) =>
          percentage(
            metrics
              .meaningfulAssertionCoverage,
          ),
      ],
      [
        'Unsupported/invented action rate',
        (metrics) =>
          percentage(
            metrics
              .unsupportedActionRate,
          ),
      ],
      [
        'Duplicate scenario rate',
        (metrics) =>
          percentage(
            metrics
              .duplicateRate,
          ),
      ],
      [
        'Human edits / scenario',
        (metrics) =>
          metrics
            .humanEditsPerScenario
            .toFixed(2),
      ],
      [
        'Coverage efficiency',
        (metrics) =>
          metrics
            .coverageEfficiency
            .toFixed(2),
      ],
    ];

  for (
    const [
      label,
      render,
    ] of
      rows
  ) {
    lines.push(
      `| ${label} | ${toolIds.map((toolId) => render(report.aggregate[toolId]!)).join(' | ')} |`,
    );
  }

  lines.push('');

  if (
    report
      .toverniFailedGates
      .length >
    0
  ) {
    lines.push(
      '## Toverni failed minimum gates',
      '',
      ...report
        .toverniFailedGates
        .map(
          (gate) =>
            `- ${gate}`,
        ),
      '',
    );
  }

  lines.push(
    '## Limitations',
    '',
    ...report.limitations.map(
      (limitation) =>
        `- ${limitation}`,
    ),
    '',
    'No overall superiority claim is made from this benchmark. Each metric must be interpreted within the documented tool inputs, versions, and execution constraints.',
    '',
  );

  return lines.join(
    '\n',
  );
}

export async function writeCompetitiveBenchmarkReport(
  report:
    CompetitiveBenchmarkReport,

  outputDirectory:
    string,
): Promise<{
  jsonPath:
    string;

  markdownPath:
    string;
}> {
  await mkdir(
    outputDirectory,
    {
      recursive:
        true,
    },
  );

  const jsonPath =
    join(
      outputDirectory,
      'competitive-benchmark-report.json',
    );

  const markdownPath =
    join(
      outputDirectory,
      'competitive-benchmark-report.md',
    );

  await Promise.all([
    writeFile(
      jsonPath,
      JSON.stringify(
        report,
        null,
        2,
      ),
      'utf8',
    ),

    writeFile(
      markdownPath,
      renderCompetitiveBenchmarkMarkdown(
        report,
      ),
      'utf8',
    ),
  ]);

  return {
    jsonPath,
    markdownPath,
  };
}
