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
              'ready' &&
            (
              generatedTest
                .executionStatus ===
                'passed' ||
              generatedTest
                .executionStatus ===
                'failed'
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
                scenario
                  .expectedOutcomes,
              ),
  
            executable,
  
            evidenceReferences:
              asStringArray(
                scenario
                  .evidenceReferences,
              ),
  
            unsupportedSteps:
              [],
  
            humanEditsRequired:
              0,
          };
        },
      );
  }
  
  async function main():
  Promise<void> {
    const fixtureIds = [
      'booking',
      'todo',
      'commerce',
    ] as const;
  
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
  
        const rawBaselineScenarios =
          await baselineGenerator
            .generate({
              targetUrl,
  
              requirements:
                fixture.requirements,
  
              openApi:
                fixture.openApi,
  
              initialPageContext:
                explorerResult
                  .initialPageContext,
            });
  
        // --------------------------------
        // Shared support corpus
        // --------------------------------
  
        const supportCorpus =
          [
            fixture.requirements,
            fixture.openApi,
            explorerResult
              .initialPageContext,
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