import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  BenchmarkMetrics,
} from './benchmark-contracts.js';

import {
  BENCHMARK_QUALITY_THRESHOLDS,
  evaluateBenchmarkThresholds,
} from './benchmark-thresholds.js';

function metrics(
  overrides:
    Partial<BenchmarkMetrics> = {},
): BenchmarkMetrics {
  return {
    scenarioCount: 10,
    relevantScenarioCount: 9,
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
    relevanceRate: 0.9,
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
  'evaluateBenchmarkThresholds',
  () => {
    it(
      'continues when Toverni clears every machine-evaluable gate',
      () => {
        const result =
          evaluateBenchmarkThresholds(
            metrics(),
            metrics({
              scenarioCount: 5,
              executableScenarioCount: 2,
              runtimeExecutedScenarioCount: 0,
              runtimePassedScenarioCount: 0,
              runtimeFailedScenarioCount: 0,
              requirementGroundedScenarioCount: 0,
              totalActionCount: 10,
              unsupportedStepCount: 3,
              relevantScenarioCount: 3,
              duplicateScenarioCount: 1,
              coveredImportantFlowCount: 3,
              totalImportantFlowCount: 5,
              totalHumanEdits: 4,
              relevanceRate: 0.6,
              executabilityRate: 0.4,
              runtimePassRate: 0,
              requirementGroundingRate: 0,
              unsupportedActionRate: 0.3,
              coverageEfficiency: 0.6,
              duplicateRate: 0.2,
              importantFlowCoverage: 0.6,
              unsupportedStepsPerScenario: 0.6,
              humanEditsPerScenario: 0.8,
              assertionScenarioCount: 0,
              meaningfulAssertionCoverage: 0,
            }),
          );

        expect(
          result.decision,
        ).toBe(
          'continue',
        );

        expect(
          result.thresholds.every(
            (threshold) =>
              threshold.passed,
          ),
        ).toBe(true);
      },
    );

    it(
      'returns deterministic failed gate details',
      () => {
        const result =
          evaluateBenchmarkThresholds(
            metrics({
              requirementGroundingRate:
                0.5,

              requirementGroundedScenarioCount:
                5,
            }),
            metrics({
              scenarioCount:
                0,
            }),
          );

        const grounding =
          result.thresholds.find(
            (threshold) =>
              threshold.metric ===
              'requirementGroundingRate',
          );

        expect(
          grounding,
        ).toEqual({
          metric:
            'requirementGroundingRate',

          operator:
            '>=',

          threshold:
            BENCHMARK_QUALITY_THRESHOLDS
              .requirementGroundingRate,

          actual:
            0.5,

          passed:
            false,
        });
      },
    );

    it(
      'does not compare against an intentionally empty baseline',
      () => {
        const result =
          evaluateBenchmarkThresholds(
            metrics(),
            metrics({
              scenarioCount:
                0,
            }),
          );

        expect(
          result.reasons.some(
            (reason) =>
              reason.includes(
                'generic LLM baseline',
              ),
          ),
        ).toBe(false);
      },
    );
  },
);
