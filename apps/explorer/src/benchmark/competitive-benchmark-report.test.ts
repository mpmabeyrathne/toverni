import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  BenchmarkMetrics,
} from './benchmark-contracts.js';

import {
  createCompetitiveBenchmarkReport,
  renderCompetitiveBenchmarkMarkdown,
} from './competitive-benchmark-report.js';

function metrics(
  overrides:
    Partial<BenchmarkMetrics> = {},
): BenchmarkMetrics {
  return {
    scenarioCount: 10,
    relevantScenarioCount: 10,
    executableScenarioCount: 8,
    runtimeExecutedScenarioCount: 8,
    runtimePassedScenarioCount: 7,
    runtimeFailedScenarioCount: 1,
    requirementGroundedScenarioCount: 9,
    totalActionCount: 20,
    duplicateScenarioCount: 1,
    unsupportedStepCount: 1,
    coveredImportantFlowCount: 8,
    totalImportantFlowCount: 10,
    totalHumanEdits: 2,
    relevanceRate: 1,
    executabilityRate: 0.8,
    runtimePassRate: 0.875,
    requirementGroundingRate: 0.9,
    unsupportedActionRate: 0.05,
    coverageEfficiency: 0.8,
    duplicateRate: 0.1,
    importantFlowCoverage: 0.8,
    unsupportedStepsPerScenario: 0.1,
    humanEditsPerScenario: 0.2,
    assertionScenarioCount: 8,
    meaningfulAssertionCoverage: 1,
    ...overrides,
  };
}

describe(
  'competitive benchmark report',
  () => {
    const tools = [
      {
        id: 'toverni',
        name: 'Toverni',
        category: 'toverni' as const,
        version: 'test',
        source: 'local',
        inputProtocol: 'frozen',
        executionBudget: 'equal',
        notes: [],
      },
      {
        id: 'competitor',
        name: 'Competitor',
        category: 'ai_agent' as const,
        version: 'test',
        source: 'external',
        inputProtocol: 'frozen',
        executionBudget: 'equal',
        notes: [],
      },
    ];

    it(
      'passes only when Toverni clears every absolute minimum gate',
      () => {
        const report =
          createCompetitiveBenchmarkReport(
            tools,
            [
              {
                fixtureId: 'one',
                title: 'One',
                methods: {
                  toverni:
                    metrics(),

                  competitor:
                    metrics({
                      executabilityRate: 1,
                    }),
                },
              },
            ],
            [],
          );

        expect(
          report.toverniGatePassed,
        ).toBe(true);

        expect(
          report.toverniFailedGates,
        ).toEqual([]);
      },
    );

    it(
      'fails independently of competitor performance and avoids superiority claims',
      () => {
        const report =
          createCompetitiveBenchmarkReport(
            tools,
            [
              {
                fixtureId: 'one',
                title: 'One',
                methods: {
                  toverni:
                    metrics({
                      executabilityRate:
                        0.7,

                      executableScenarioCount:
                        7,
                    }),

                  competitor:
                    metrics({
                      executabilityRate:
                        0.1,

                      executableScenarioCount:
                        1,
                    }),
                },
              },
            ],
            [
              'Different tool architecture.',
            ],
          );

        expect(
          report.toverniGatePassed,
        ).toBe(false);

        expect(
          report.toverniFailedGates,
        ).toContain(
          'executabilityRate',
        );

        const markdown =
          renderCompetitiveBenchmarkMarkdown(
            report,
          );

        expect(
          markdown,
        ).toContain(
          'No overall superiority claim is made',
        );
      },
    );
  },
);
