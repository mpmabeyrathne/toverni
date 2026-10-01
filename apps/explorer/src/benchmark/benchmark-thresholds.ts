import type {
  BenchmarkMetrics,
} from './benchmark-contracts.js';

export const BENCHMARK_QUALITY_THRESHOLDS = {
  importantFlowCoverage:
    0.8,

  executabilityRate:
    0.8,

  requirementGroundingRate:
    0.9,

  meaningfulAssertionCoverage:
    0.8,

  unsupportedActionRate:
    0.05,

  duplicateRate:
    0.1,
} as const;

export interface BenchmarkThresholdResult {
  metric:
    keyof typeof BENCHMARK_QUALITY_THRESHOLDS;

  operator:
    '>=' | '<=';

  threshold:
    number;

  actual:
    number;

  passed:
    boolean;
}

export interface BenchmarkDecision {
  decision:
    | 'continue'
    | 'rework';

  reasons:
    string[];

  thresholds:
    BenchmarkThresholdResult[];
}

export function evaluateBenchmarkThresholds(
  toverni:
    BenchmarkMetrics,

  baseline:
    BenchmarkMetrics,
): BenchmarkDecision {
  const thresholds:
    BenchmarkThresholdResult[] = [
      {
        metric:
          'importantFlowCoverage',

        operator:
          '>=',

        threshold:
          BENCHMARK_QUALITY_THRESHOLDS
            .importantFlowCoverage,

        actual:
          toverni
            .importantFlowCoverage,

        passed:
          toverni
            .importantFlowCoverage >=
          BENCHMARK_QUALITY_THRESHOLDS
            .importantFlowCoverage,
      },

      {
        metric:
          'executabilityRate',

        operator:
          '>=',

        threshold:
          BENCHMARK_QUALITY_THRESHOLDS
            .executabilityRate,

        actual:
          toverni
            .executabilityRate,

        passed:
          toverni
            .executabilityRate >=
          BENCHMARK_QUALITY_THRESHOLDS
            .executabilityRate,
      },

      {
        metric:
          'requirementGroundingRate',

        operator:
          '>=',

        threshold:
          BENCHMARK_QUALITY_THRESHOLDS
            .requirementGroundingRate,

        actual:
          toverni
            .requirementGroundingRate,

        passed:
          toverni
            .requirementGroundingRate >=
          BENCHMARK_QUALITY_THRESHOLDS
            .requirementGroundingRate,
      },

      {
        metric:
          'meaningfulAssertionCoverage',

        operator:
          '>=',

        threshold:
          BENCHMARK_QUALITY_THRESHOLDS
            .meaningfulAssertionCoverage,

        actual:
          toverni
            .meaningfulAssertionCoverage,

        passed:
          toverni
            .meaningfulAssertionCoverage >=
          BENCHMARK_QUALITY_THRESHOLDS
            .meaningfulAssertionCoverage,
      },

      {
        metric:
          'unsupportedActionRate',

        operator:
          '<=',

        threshold:
          BENCHMARK_QUALITY_THRESHOLDS
            .unsupportedActionRate,

        actual:
          toverni
            .unsupportedActionRate,

        passed:
          toverni
            .unsupportedActionRate <=
          BENCHMARK_QUALITY_THRESHOLDS
            .unsupportedActionRate,
      },

      {
        metric:
          'duplicateRate',

        operator:
          '<=',

        threshold:
          BENCHMARK_QUALITY_THRESHOLDS
            .duplicateRate,

        actual:
          toverni
            .duplicateRate,

        passed:
          toverni
            .duplicateRate <=
          BENCHMARK_QUALITY_THRESHOLDS
            .duplicateRate,
      },
    ];

  const reasons =
    thresholds
      .filter(
        (threshold) =>
          !threshold.passed,
      )
      .map(
        (threshold): string => {
          const percent =
            (
              threshold.threshold *
              100
            ).toFixed(0);

          switch (
            threshold.metric
          ) {
            case 'importantFlowCoverage':
              return `Important-flow coverage is below ${percent}%.`;

            case 'executabilityRate':
              return `Executable/runnable test rate is below ${percent}%.`;

            case 'requirementGroundingRate':
              return `Requirement grounding is below ${percent}%.`;

            case 'meaningfulAssertionCoverage':
              return `Meaningful assertion coverage is below ${percent}%.`;

            case 'unsupportedActionRate':
              return `Unsupported/invented action rate is above ${percent}%.`;

            case 'duplicateRate':
              return `Duplicate scenario rate is above ${percent}%.`;
          }
        },
      );

  if (
    baseline.scenarioCount >
      0 &&
    toverni.executabilityRate <=
      baseline.executabilityRate
  ) {
    reasons.push(
      'Toverni does not improve executability over the generic LLM baseline.',
    );
  }

  if (
    baseline.scenarioCount >
      0 &&
    toverni.unsupportedActionRate >=
      baseline.unsupportedActionRate
  ) {
    reasons.push(
      'Toverni does not reduce unsupported actions compared with the baseline.',
    );
  }

  return {
    decision:
      reasons.length === 0
        ? 'continue'
        : 'rework',

    reasons,

    thresholds,
  };
}
