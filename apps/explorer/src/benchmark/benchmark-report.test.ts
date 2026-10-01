import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  BenchmarkMetrics,
} from './benchmark-contracts.js';

import {
  createBenchmarkReport,
  renderBenchmarkMarkdown,
} from './benchmark-report.js';

import {
  BENCHMARK_METRIC_DEFINITIONS_VERSION,
} from './benchmark-quality-telemetry.js';

function metrics(
  overrides:
    Partial<BenchmarkMetrics> = {},
): BenchmarkMetrics {
  return {
    scenarioCount: 5,
    relevantScenarioCount: 5,
    executableScenarioCount: 4,
    runtimeExecutedScenarioCount: 4,
    runtimePassedScenarioCount: 3,
    runtimeFailedScenarioCount: 1,
    requirementGroundedScenarioCount: 5,
    totalActionCount: 10,
    duplicateScenarioCount: 0,
    unsupportedStepCount: 0,
    coveredImportantFlowCount: 4,
    totalImportantFlowCount: 4,
    totalHumanEdits: 0,
    relevanceRate: 1,
    executabilityRate: 0.8,
    runtimePassRate: 0.75,
    requirementGroundingRate: 1,
    unsupportedActionRate: 0,
    coverageEfficiency: 0.8,
    duplicateRate: 0,
    importantFlowCoverage: 1,
    unsupportedStepsPerScenario: 0,
    humanEditsPerScenario: 0,
    assertionScenarioCount: 4,
    meaningfulAssertionCoverage: 1,
    ...overrides,
  };
}

describe(
  'benchmark report',
  () => {
    it(
      'renders versioned per-fixture and aggregate quality telemetry',
      () => {
        const report =
          createBenchmarkReport([
            {
              fixtureId:
                'booking',

              title:
                'Booking',

              toverni:
                metrics(),

              baseline:
                metrics({
                  scenarioCount: 5,
                  relevantScenarioCount: 4,
                  executableScenarioCount: 2,
                  runtimeExecutedScenarioCount: 0,
                  runtimePassedScenarioCount: 0,
                  runtimeFailedScenarioCount: 0,
                  requirementGroundedScenarioCount: 0,
                  totalActionCount: 10,
                  duplicateScenarioCount: 1,
                  unsupportedStepCount: 2,
                  coveredImportantFlowCount: 3,
                  totalImportantFlowCount: 4,
                  totalHumanEdits: 3,
                  relevanceRate: 0.8,
                  executabilityRate: 0.4,
                  runtimePassRate: 0,
                  requirementGroundingRate: 0,
                  unsupportedActionRate: 0.2,
                  coverageEfficiency: 0.6,
                  duplicateRate: 0.2,
                  importantFlowCoverage: 0.75,
                  unsupportedStepsPerScenario: 0.4,
                  humanEditsPerScenario: 0.6,
                  assertionScenarioCount: 0,
                  meaningfulAssertionCoverage: 0,
                }),

              toverniCoverage: {
                entries: [
                  {
                    target: {
                      id:
                        'BOOK-1',

                      kind:
                        'flow',

                      label:
                        'Book room',

                      evidenceReferences: [
                        'BOOK-1',
                      ],

                      supported:
                        true,

                      blocked:
                        false,
                    },

                    status:
                      'covered',

                    scenarioIds: [
                      'scenario-1',
                    ],

                    testIds: [
                      'test-1',
                    ],

                    reasons: [
                      'Covered by executable scenario.',
                    ],
                  },
                ],

                totals: {
                  total: 1,
                  covered: 1,
                  partiallyCovered: 0,
                  blocked: 0,
                  unsupported: 0,
                  uncovered: 0,
                },

                gaps: [],
              },

              baselineCoverage: {
                entries: [
                  {
                    target: {
                      id:
                        'BOOK-1',

                      kind:
                        'flow',

                      label:
                        'Book room',

                      evidenceReferences: [
                        'BOOK-1',
                      ],

                      supported:
                        true,

                      blocked:
                        false,
                    },

                    status:
                      'partially_covered',

                    scenarioIds: [
                      'baseline-scenario-1',
                    ],

                    testIds: [],

                    reasons: [
                      'Scenario exists without completed executable coverage.',
                    ],
                  },
                ],

                totals: {
                  total: 1,
                  covered: 0,
                  partiallyCovered: 1,
                  blocked: 0,
                  unsupported: 0,
                  uncovered: 0,
                },

                gaps: [],
              },

              decision: {
                decision:
                  'continue',

                reasons: [],

                thresholds: [],
              },
            },
          ]);

        const markdown =
          renderBenchmarkMarkdown(
            report,
          );

        expect(
          report.metricDefinitionsVersion,
        ).toBe(
          BENCHMARK_METRIC_DEFINITIONS_VERSION,
        );

        expect(
          report.aggregate.toverni.runtimePassRate,
        ).toBe(0.75);

        expect(
          markdown,
        ).toContain(
          'Aggregate quality telemetry',
        );

        expect(
          markdown,
        ).toContain(
          'Runtime pass rate',
        );

        expect(
          markdown,
        ).toContain(
          'Requirement grounding',
        );

        expect(
          markdown,
        ).toContain(
          'Metric definitions',
        );

        expect(
          markdown,
        ).toContain(
          BENCHMARK_METRIC_DEFINITIONS_VERSION,
        );

        expect(
          markdown,
        ).toContain(
          '| Book room | covered | partially_covered |',
        );
      },
    );
  },
);
