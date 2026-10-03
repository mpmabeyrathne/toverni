import {
  readFile,
} from 'node:fs/promises';

import {
  join,
} from 'node:path';

import {
  fileURLToPath,
} from 'node:url';

import {
  calculateBenchmarkMetrics,
  createCompetitiveBenchmarkReport,
  loadBenchmarkFixture,
  loadCompetitiveToolFixtureOutput,
  loadCompetitiveToolMetadata,
  writeCompetitiveBenchmarkReport,
} from './index.js';

import type {
  BenchmarkReport,
} from './benchmark-report.js';

import type {
  CompetitiveFixtureMetrics,
} from './competitive-benchmark-contracts.js';

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

const externalToolIds = [
  'playwright_agents',
  'hercules',
] as const;

async function readBaseReport():
  Promise<BenchmarkReport> {
  const path =
    join(
      process.cwd(),
      'artifacts',
      'benchmark',
      'benchmark-report.json',
    );

  const raw =
    await readFile(
      path,
      'utf8',
    );

  const report =
    JSON.parse(
      raw,
    ) as BenchmarkReport;

  if (
    report.aggregate
      .baseline
      .scenarioCount ===
    0
  ) {
    throw new Error(
      'Competitive benchmark requires a non-empty generic LLM baseline. Re-run pnpm benchmark without BENCHMARK_SKIP_GENERIC_BASELINE=true.',
    );
  }

  return report;
}

async function main():
  Promise<void> {
  const baseReport =
    await readBaseReport();

  const tools =
    await loadCompetitiveToolMetadata(
      join(
        repositoryRoot,
        'fixtures',
        'benchmark',
        'competitive-tools.json',
      ),
    );

  const applications:
    CompetitiveFixtureMetrics[] =
    [];

  for (
    const fixtureId of
      fixtureIds
  ) {
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

    const baseApplication =
      baseReport
        .applications
        .find(
          (application) =>
            application
              .fixtureId ===
            fixtureId,
        );

    if (
      !baseApplication
    ) {
      throw new Error(
        `Base benchmark report is missing fixture "${fixtureId}".`,
      );
    }

    const methods =
      {
        toverni:
          baseApplication
            .toverni,

        generic_llm:
          baseApplication
            .baseline,
      };

    const externalMethods:
      Record<
        string,
        ReturnType<
          typeof calculateBenchmarkMetrics
        >
      > = {};

    for (
      const toolId of
        externalToolIds
    ) {
      const artifactPath =
        join(
          process.cwd(),
          'artifacts',
          'competitive',
          toolId,
          `${fixtureId}.json`,
        );

      let output;

      try {
        output =
          await loadCompetitiveToolFixtureOutput(
            artifactPath,
          );
      } catch (
        error:
          unknown
      ) {
        const message =
          error instanceof Error
            ? error.message
            : String(
                error,
              );

        throw new Error(
          `Missing or invalid competitive artifact for ${toolId}/${fixtureId}: ${message}`,
        );
      }

      if (
        output.fixtureId !==
        fixtureId
      ) {
        throw new Error(
          `Competitive artifact fixture mismatch for ${toolId}: expected ${fixtureId}, received ${output.fixtureId}.`,
        );
      }

      externalMethods[
        toolId
      ] =
        calculateBenchmarkMetrics(
          output.scenarios,
          fixture
            .humanReference
            .flows,
        );
    }

    applications.push({
      fixtureId,
      title:
        fixture
          .manifest
          .title,

      methods: {
        ...methods,
        ...externalMethods,
      },
    });
  }

  const report =
    createCompetitiveBenchmarkReport(
      tools,
      applications,
      [
        'External tools differ in planning, browser-control, and generation architecture; results are compared by normalized output metrics, not by claiming identical internal behavior.',
        'Tool versions, model/provider configuration, and raw artifacts must be preserved with each benchmark run.',
        'Runtime pass rate is reported separately from runnable/executable rate.',
        'Toverni TOV-99 quality gates are absolute minimum gates and are not relaxed based on competitor performance.',
      ],
    );

  const written =
    await writeCompetitiveBenchmarkReport(
      report,
      join(
        process.cwd(),
        'artifacts',
        'benchmark',
      ),
    );

  console.log(
    JSON.stringify(
      {
        toverniGatePassed:
          report
            .toverniGatePassed,

        failedGates:
          report
            .toverniFailedGates,

        jsonReport:
          written.jsonPath,

        markdownReport:
          written.markdownPath,
      },
      null,
      2,
    ),
  );
}

await main();
