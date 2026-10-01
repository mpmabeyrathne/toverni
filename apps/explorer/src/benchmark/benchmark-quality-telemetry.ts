import type {
  BenchmarkMetrics,
} from './benchmark-contracts.js';

export const BENCHMARK_METRIC_DEFINITIONS_VERSION =
  '1.0.0';

export const BENCHMARK_METRIC_DEFINITIONS = {
  importantFlowCoverage:
    'coveredImportantFlowCount / totalImportantFlowCount',

  requirementGroundingRate:
    'requirementGroundedScenarioCount / scenarioCount',

  meaningfulAssertionCoverage:
    'assertionScenarioCount / executableScenarioCount',

  unsupportedActionRate:
    'unsupportedStepCount / totalActionCount',

  duplicateRate:
    'duplicateScenarioCount / scenarioCount',

  humanEditsPerScenario:
    'totalHumanEdits / scenarioCount',

  coverageEfficiency:
    'coveredImportantFlowCount / scenarioCount',

  executabilityRate:
    'executableScenarioCount / scenarioCount',

  runtimePassRate:
    'runtimePassedScenarioCount / runtimeExecutedScenarioCount',
} as const;

function safeDivide(
  numerator:
    number,

  denominator:
    number,
): number {
  return denominator === 0
    ? 0
    : numerator /
      denominator;
}

export function aggregateBenchmarkMetrics(
  metrics:
    BenchmarkMetrics[],
): BenchmarkMetrics {
  const totals =
    metrics.reduce(
      (
        aggregate,
        current,
      ) => ({
        scenarioCount:
          aggregate.scenarioCount +
          current.scenarioCount,

        relevantScenarioCount:
          aggregate.relevantScenarioCount +
          current.relevantScenarioCount,

        executableScenarioCount:
          aggregate.executableScenarioCount +
          current.executableScenarioCount,

        runtimeExecutedScenarioCount:
          aggregate.runtimeExecutedScenarioCount +
          current.runtimeExecutedScenarioCount,

        runtimePassedScenarioCount:
          aggregate.runtimePassedScenarioCount +
          current.runtimePassedScenarioCount,

        runtimeFailedScenarioCount:
          aggregate.runtimeFailedScenarioCount +
          current.runtimeFailedScenarioCount,

        requirementGroundedScenarioCount:
          aggregate.requirementGroundedScenarioCount +
          current.requirementGroundedScenarioCount,

        totalActionCount:
          aggregate.totalActionCount +
          current.totalActionCount,

        duplicateScenarioCount:
          aggregate.duplicateScenarioCount +
          current.duplicateScenarioCount,

        unsupportedStepCount:
          aggregate.unsupportedStepCount +
          current.unsupportedStepCount,

        coveredImportantFlowCount:
          aggregate.coveredImportantFlowCount +
          current.coveredImportantFlowCount,

        totalImportantFlowCount:
          aggregate.totalImportantFlowCount +
          current.totalImportantFlowCount,

        totalHumanEdits:
          aggregate.totalHumanEdits +
          current.totalHumanEdits,

        assertionScenarioCount:
          aggregate.assertionScenarioCount +
          current.assertionScenarioCount,
      }),
      {
        scenarioCount: 0,
        relevantScenarioCount: 0,
        executableScenarioCount: 0,
        runtimeExecutedScenarioCount: 0,
        runtimePassedScenarioCount: 0,
        runtimeFailedScenarioCount: 0,
        requirementGroundedScenarioCount: 0,
        totalActionCount: 0,
        duplicateScenarioCount: 0,
        unsupportedStepCount: 0,
        coveredImportantFlowCount: 0,
        totalImportantFlowCount: 0,
        totalHumanEdits: 0,
        assertionScenarioCount: 0,
      },
    );

  return {
    ...totals,

    relevanceRate:
      safeDivide(
        totals.relevantScenarioCount,
        totals.scenarioCount,
      ),

    executabilityRate:
      safeDivide(
        totals.executableScenarioCount,
        totals.scenarioCount,
      ),

    runtimePassRate:
      safeDivide(
        totals.runtimePassedScenarioCount,
        totals.runtimeExecutedScenarioCount,
      ),

    requirementGroundingRate:
      safeDivide(
        totals.requirementGroundedScenarioCount,
        totals.scenarioCount,
      ),

    unsupportedActionRate:
      safeDivide(
        totals.unsupportedStepCount,
        totals.totalActionCount,
      ),

    coverageEfficiency:
      safeDivide(
        totals.coveredImportantFlowCount,
        totals.scenarioCount,
      ),

    duplicateRate:
      safeDivide(
        totals.duplicateScenarioCount,
        totals.scenarioCount,
      ),

    importantFlowCoverage:
      safeDivide(
        totals.coveredImportantFlowCount,
        totals.totalImportantFlowCount,
      ),

    unsupportedStepsPerScenario:
      safeDivide(
        totals.unsupportedStepCount,
        totals.scenarioCount,
      ),

    humanEditsPerScenario:
      safeDivide(
        totals.totalHumanEdits,
        totals.scenarioCount,
      ),

    meaningfulAssertionCoverage:
      safeDivide(
        totals.assertionScenarioCount,
        totals.executableScenarioCount,
      ),
  };
}
