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
  
  export interface BenchmarkReport {
    generatedAt:
      string;
  
    applications:
      BenchmarkApplicationEvaluation[];
  
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
  
        `| Executability | ${percentage(
          application
            .toverni
            .executabilityRate,
        )} | ${percentage(
          application
            .baseline
            .executabilityRate,
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
  
        `| Duplicate rate | ${percentage(
          application
            .toverni
            .duplicateRate,
        )} | ${percentage(
          application
            .baseline
            .duplicateRate,
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