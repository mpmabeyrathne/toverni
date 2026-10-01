import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  BenchmarkMetrics,
} from './benchmark-contracts.js';

import {
  aggregateBenchmarkMetrics,
} from './benchmark-quality-telemetry.js';

function metrics(
  input: {
    scenarios:
      number;

    executable:
      number;

    runtimeExecuted:
      number;

    runtimePassed:
      number;
  },
): BenchmarkMetrics {
  return {
    scenarioCount:
      input.scenarios,

    relevantScenarioCount:
      input.scenarios,

    executableScenarioCount:
      input.executable,

    runtimeExecutedScenarioCount:
      input.runtimeExecuted,

    runtimePassedScenarioCount:
      input.runtimePassed,

    runtimeFailedScenarioCount:
      input.runtimeExecuted -
      input.runtimePassed,

    requirementGroundedScenarioCount:
      input.scenarios,

    totalActionCount:
      input.scenarios,

    duplicateScenarioCount:
      0,

    unsupportedStepCount:
      0,

    coveredImportantFlowCount:
      input.executable,

    totalImportantFlowCount:
      input.scenarios,

    totalHumanEdits:
      0,

    relevanceRate:
      1,

    executabilityRate:
      input.scenarios === 0
        ? 0
        : input.executable /
          input.scenarios,

    runtimePassRate:
      input.runtimeExecuted === 0
        ? 0
        : input.runtimePassed /
          input.runtimeExecuted,

    requirementGroundingRate:
      input.scenarios === 0
        ? 0
        : 1,

    unsupportedActionRate:
      0,

    coverageEfficiency:
      input.scenarios === 0
        ? 0
        : input.executable /
          input.scenarios,

    duplicateRate:
      0,

    importantFlowCoverage:
      input.scenarios === 0
        ? 0
        : input.executable /
          input.scenarios,

    unsupportedStepsPerScenario:
      0,

    humanEditsPerScenario:
      0,

    assertionScenarioCount:
      input.executable,

    meaningfulAssertionCoverage:
      input.executable === 0
        ? 0
        : 1,
  };
}

describe(
  'aggregateBenchmarkMetrics',
  () => {
    it(
      'recomputes aggregate rates from summed counts instead of averaging fixture rates',
      () => {
        const aggregate =
          aggregateBenchmarkMetrics([
            metrics({
              scenarios:
                1,

              executable:
                1,

              runtimeExecuted:
                1,

              runtimePassed:
                1,
            }),

            metrics({
              scenarios:
                9,

              executable:
                0,

              runtimeExecuted:
                9,

              runtimePassed:
                0,
            }),
          ]);

        expect(
          aggregate.executabilityRate,
        ).toBe(0.1);

        expect(
          aggregate.runtimePassRate,
        ).toBe(0.1);

        expect(
          aggregate.scenarioCount,
        ).toBe(10);
      },
    );
  },
);
