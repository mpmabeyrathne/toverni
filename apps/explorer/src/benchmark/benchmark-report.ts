import {
    mkdir,
    writeFile,
  } from 'node:fs/promises';
  
  import {
    join,
  } from 'node:path';
  
  import type {
    BenchmarkApplicationEvaluation,
  } from './benchmark-evaluator.js';

  import type {
    BenchmarkMetrics,
  } from './benchmark-contracts.js';

  import {
    aggregateBenchmarkMetrics,
    BENCHMARK_METRIC_DEFINITIONS,
    BENCHMARK_METRIC_DEFINITIONS_VERSION,
  } from './benchmark-quality-telemetry.js';
  
  export interface BenchmarkReport {
    generatedAt:
      string;
  
    applications:
      BenchmarkApplicationEvaluation[];

    metricDefinitionsVersion:
      string;

    metricDefinitions:
      typeof BENCHMARK_METRIC_DEFINITIONS;

    aggregate: {
      toverni:
        BenchmarkMetrics;

      baseline:
        BenchmarkMetrics;
    };
  
    overallDecision:
      'continue'
      | 'rework';
  
    reasons:
      string[];
  }
  
  function percentage(
    value:
      number,
  ): string {
    return `${(
      value *
      100
    ).toFixed(1)}%`;
  }
  
  export function createBenchmarkReport(
    applications:
      BenchmarkApplicationEvaluation[],
  ): BenchmarkReport {
    const failedApplications =
      applications.filter(
        (application) =>
          application
            .decision
            .decision ===
          'rework',
      );
  
    const reasons =
      failedApplications.flatMap(
        (application) =>
          application
            .decision
            .reasons
            .map(
              (reason) =>
                `${application.title}: ${reason}`,
            ),
      );
  
    return {
      generatedAt:
        new Date()
          .toISOString(),

      metricDefinitionsVersion:
        BENCHMARK_METRIC_DEFINITIONS_VERSION,

      metricDefinitions:
        BENCHMARK_METRIC_DEFINITIONS,

      aggregate: {
        toverni:
          aggregateBenchmarkMetrics(
            applications.map(
              (application) =>
                application.toverni,
            ),
          ),

        baseline:
          aggregateBenchmarkMetrics(
            applications.map(
              (application) =>
                application.baseline,
            ),
          ),
      },
  
      applications,
  
      overallDecision:
        failedApplications.length ===
        0
          ? 'continue'
          : 'rework',
  
      reasons,
    };
  }
  
  export function renderBenchmarkMarkdown(
    report:
      BenchmarkReport,
  ): string {
    const lines:
      string[] = [];
  
    lines.push(
      '# Toverni P0 Benchmark Report',
      '',
      `Generated: ${report.generatedAt}`,
      '',
      `Overall decision: **${report.overallDecision.toUpperCase()}**`,
      '',
    );
  
    lines.push(
      '## Aggregate quality telemetry',
      '',
      '| Metric | Toverni | Generic LLM |',
      '| --- | ---: | ---: |',
      `| Executable/runnable rate | ${percentage(report.aggregate.toverni.executabilityRate)} | ${percentage(report.aggregate.baseline.executabilityRate)} |`,
      `| Runtime pass rate | ${percentage(report.aggregate.toverni.runtimePassRate)} | ${percentage(report.aggregate.baseline.runtimePassRate)} |`,
      `| Requirement grounding | ${percentage(report.aggregate.toverni.requirementGroundingRate)} | ${percentage(report.aggregate.baseline.requirementGroundingRate)} |`,
      `| Important-flow coverage | ${percentage(report.aggregate.toverni.importantFlowCoverage)} | ${percentage(report.aggregate.baseline.importantFlowCoverage)} |`,
      `| Meaningful assertion coverage | ${percentage(report.aggregate.toverni.meaningfulAssertionCoverage)} | ${percentage(report.aggregate.baseline.meaningfulAssertionCoverage)} |`,
      `| Unsupported/invented action rate | ${percentage(report.aggregate.toverni.unsupportedActionRate)} | ${percentage(report.aggregate.baseline.unsupportedActionRate)} |`,
      `| Duplicate rate | ${percentage(report.aggregate.toverni.duplicateRate)} | ${percentage(report.aggregate.baseline.duplicateRate)} |`,
      `| Human edits / scenario | ${report.aggregate.toverni.humanEditsPerScenario.toFixed(2)} | ${report.aggregate.baseline.humanEditsPerScenario.toFixed(2)} |`,
      `| Coverage efficiency | ${report.aggregate.toverni.coverageEfficiency.toFixed(2)} | ${report.aggregate.baseline.coverageEfficiency.toFixed(2)} |`,
      '',
    );

    for (
      const application of
        report.applications
    ) {
      lines.push(
        `## ${application.title}`,
        '',
        '| Metric | Toverni | Generic LLM |',
        '| --- | ---: | ---: |',
  
        `| Relevance | ${percentage(
          application
            .toverni
            .relevanceRate,
        )} | ${percentage(
          application
            .baseline
            .relevanceRate,
        )} |`,
  
        `| Executable/runnable rate | ${percentage(
          application
            .toverni
            .executabilityRate,
        )} | ${percentage(
          application
            .baseline
            .executabilityRate,
        )} |`,

        `| Runtime pass rate | ${percentage(
          application
            .toverni
            .runtimePassRate,
        )} | ${percentage(
          application
            .baseline
            .runtimePassRate,
        )} |`,

        `| Requirement grounding | ${percentage(
          application
            .toverni
            .requirementGroundingRate,
        )} | ${percentage(
          application
            .baseline
            .requirementGroundingRate,
        )} |`,
  
        `| Important-flow coverage | ${percentage(
          application
            .toverni
            .importantFlowCoverage,
        )} | ${percentage(
          application
            .baseline
            .importantFlowCoverage,
        )} |`,

        `| Meaningful assertion coverage | ${percentage(
          application
            .toverni
            .meaningfulAssertionCoverage,
        )} | ${percentage(
          application
            .baseline
            .meaningfulAssertionCoverage,
        )} |`,
  
        `| Duplicate rate | ${percentage(
          application
            .toverni
            .duplicateRate,
        )} | ${percentage(
          application
            .baseline
            .duplicateRate,
        )} |`,
  
        `| Unsupported/invented action rate | ${percentage(
          application
            .toverni
            .unsupportedActionRate,
        )} | ${percentage(
          application
            .baseline
            .unsupportedActionRate,
        )} |`,

        `| Unsupported steps / scenario | ${application
          .toverni
          .unsupportedStepsPerScenario
          .toFixed(
            2,
          )} | ${application
          .baseline
          .unsupportedStepsPerScenario
          .toFixed(
            2,
          )} |`,
  
        `| Human edits / scenario | ${application
          .toverni
          .humanEditsPerScenario
          .toFixed(
            2,
          )} | ${application
          .baseline
          .humanEditsPerScenario
          .toFixed(
            2,
          )} |`,

        `| Coverage efficiency | ${application
          .toverni
          .coverageEfficiency
          .toFixed(
            2,
          )} | ${application
          .baseline
          .coverageEfficiency
          .toFixed(
            2,
          )} |`,
  
        '',
        '### Reference flow coverage',
        '',
        '| Flow | Toverni | Generic LLM |',
        '| --- | --- | --- |',
        ...application
          .toverniCoverage
          .entries
          .map(
            (entry) => {
              const baselineEntry =
                application
                  .baselineCoverage
                  .entries
                  .find(
                    (candidate) =>
                      candidate
                        .target.id ===
                      entry.target.id,
                  );

              return `| ${entry.target.label} | ${entry.status} | ${baselineEntry?.status ?? 'uncovered'} |`;
            },
          ),
        '',
        `Decision: **${application.decision.decision.toUpperCase()}**`,
        '',
      );
  
      if (
        application
          .decision
          .reasons
          .length >
        0
      ) {
        lines.push(
          'Reasons:',
          '',
        );
  
        for (
          const reason of
            application
              .decision
              .reasons
        ) {
          lines.push(
            `- ${reason}`,
          );
        }
  
        lines.push('');
      }
    }
  
    if (
      report.reasons.length >
      0
    ) {
      lines.push(
        '## Overall blockers',
        '',
      );
  
      for (
        const reason of
          report.reasons
      ) {
        lines.push(
          `- ${reason}`,
        );
      }
  
      lines.push('');
    }
  
    lines.push(
      '## Metric definitions',
      '',
      `Definitions version: **${report.metricDefinitionsVersion}**`,
      '',
      '| Metric | Deterministic calculation |',
      '| --- | --- |',
      ...Object.entries(
        report.metricDefinitions,
      ).map(
        ([metric, definition]) =>
          `| ${metric} | ${definition} |`,
      ),
      '',
    );

    return lines.join(
      '\n',
    );
  }
  
  export async function writeBenchmarkReport(
    report:
      BenchmarkReport,
  
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
        'benchmark-report.json',
      );
  
    const markdownPath =
      join(
        outputDirectory,
        'benchmark-report.md',
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
        renderBenchmarkMarkdown(
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