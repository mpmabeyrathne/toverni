import type {
  BenchmarkMetrics,
} from '../benchmark/index.js';

import {
  BENCHMARK_QUALITY_THRESHOLDS,
} from '../benchmark/index.js';

export const PUBLIC_BETA_RUNTIME_PASS_RATE =
  0.8;

export type ReleaseFailureCategory =
  | 'locator-failure'
  | 'state-abstraction-dedup'
  | 'auth-session'
  | 'bad-test-data'
  | 'flow-reconstruction'
  | 'missing-weak-assertion'
  | 'unsupported-control'
  | 'timeout-flakiness'
  | 'unsafe-action-classification'
  | 'unclassified';

export interface ReleaseFailure {
  category:
    ReleaseFailureCategory;

  fixtureId:
    string;

  source:
    'generated-test'
    | 'safety';

  message:
    string;
}

export interface ReleaseFixtureResult {
  fixtureId:
    string;

  title:
    string;

  metrics:
    BenchmarkMetrics;

  safety: {
    blockedHighImpactActions:
      number;

    executedHighImpactActions:
      number;
  };

  failures:
    ReleaseFailure[];
}

export interface PublicBetaReleaseGate {
  passed:
    boolean;

  qualityPassed:
    boolean;

  runtimePassed:
    boolean;

  safetyPassed:
    boolean;

  modelPathPassed:
    boolean;

  fixtureCount:
    number;

  aggregate:
    BenchmarkMetrics;

  failedChecks:
    string[];

  failureCounts:
    Record<
      ReleaseFailureCategory,
      number
    >;
}

const failureCategories:
  ReleaseFailureCategory[] = [
    'locator-failure',
    'state-abstraction-dedup',
    'auth-session',
    'bad-test-data',
    'flow-reconstruction',
    'missing-weak-assertion',
    'unsupported-control',
    'timeout-flakiness',
    'unsafe-action-classification',
    'unclassified',
  ];

export function classifyReleaseFailure(
  message:
    string,
): ReleaseFailureCategory {
  const value =
    message.toLowerCase();

  if (
    /locator|strict mode|element.*not found|selector/
      .test(
        value,
      )
  ) {
    return 'locator-failure';
  }

  if (
    /state|fingerprint|dedup|duplicate/
      .test(
        value,
      )
  ) {
    return 'state-abstraction-dedup';
  }

  if (
    /auth|session|storage.?state|log.?in|sign.?in/
      .test(
        value,
      )
  ) {
    return 'auth-session';
  }

  if (
    /test data|invalid value|required field|validation/
      .test(
        value,
      )
  ) {
    return 'bad-test-data';
  }

  if (
    /flow|transition|reconstruct/
      .test(
        value,
      )
  ) {
    return 'flow-reconstruction';
  }

  if (
    /assert|expect|expected/
      .test(
        value,
      )
  ) {
    return 'missing-weak-assertion';
  }

  if (
    /unsupported|manual|required interaction|control/
      .test(
        value,
      )
  ) {
    return 'unsupported-control';
  }

  if (
    /timeout|timed out|flaky|intermittent/
      .test(
        value,
      )
  ) {
    return 'timeout-flakiness';
  }

  if (
    /unsafe|destructive|high-impact|safety/
      .test(
        value,
      )
  ) {
    return 'unsafe-action-classification';
  }

  return 'unclassified';
}

export function evaluatePublicBetaReleaseGate(
  input: {
    aggregate:
      BenchmarkMetrics;

    fixtures:
      ReleaseFixtureResult[];

    modelPathPassed:
      boolean;
  },
): PublicBetaReleaseGate {
  const failedChecks:
    string[] = [];

  const qualityChecks = [
    input.aggregate
      .importantFlowCoverage >=
      BENCHMARK_QUALITY_THRESHOLDS
        .importantFlowCoverage,

    input.aggregate
      .executabilityRate >=
      BENCHMARK_QUALITY_THRESHOLDS
        .executabilityRate,

    input.aggregate
      .requirementGroundingRate >=
      BENCHMARK_QUALITY_THRESHOLDS
        .requirementGroundingRate,

    input.aggregate
      .meaningfulAssertionCoverage >=
      BENCHMARK_QUALITY_THRESHOLDS
        .meaningfulAssertionCoverage,

    input.aggregate
      .unsupportedActionRate <=
      BENCHMARK_QUALITY_THRESHOLDS
        .unsupportedActionRate,

    input.aggregate
      .duplicateRate <=
      BENCHMARK_QUALITY_THRESHOLDS
        .duplicateRate,
  ];

  const qualityPassed =
    qualityChecks.every(
      Boolean,
    );

  if (
    !qualityPassed
  ) {
    failedChecks.push(
      'One or more existing Toverni quality thresholds failed.',
    );
  }

  const runtimePassed =
    input.aggregate
      .runtimeExecutedScenarioCount >
      0 &&
    input.aggregate
      .runtimePassRate >=
      PUBLIC_BETA_RUNTIME_PASS_RATE;

  if (
    !runtimePassed
  ) {
    failedChecks.push(
      `Runtime pass rate must be at least ${PUBLIC_BETA_RUNTIME_PASS_RATE * 100}% with at least one executed generated test.`,
    );
  }

  const safetyPassed =
    input.fixtures.every(
      (fixture) =>
        fixture.safety
          .executedHighImpactActions ===
        0,
    );

  if (
    !safetyPassed
  ) {
    failedChecks.push(
      'A high-impact action was executed while the release gate was using safe defaults.',
    );
  }

  if (
    !input.modelPathPassed
  ) {
    failedChecks.push(
      'Local Ollama model preflight did not pass.',
    );
  }

  const failureCounts =
    Object.fromEntries(
      failureCategories.map(
        (category) => [
          category,
          0,
        ],
      ),
    ) as Record<
      ReleaseFailureCategory,
      number
    >;

  for (
    const fixture of
      input.fixtures
  ) {
    for (
      const failure of
        fixture.failures
    ) {
      failureCounts[
        failure.category
      ] +=
        1;
    }
  }

  return {
    passed:
      failedChecks.length ===
      0,

    qualityPassed,

    runtimePassed,

    safetyPassed,

    modelPathPassed:
      input.modelPathPassed,

    fixtureCount:
      input.fixtures.length,

    aggregate:
      input.aggregate,

    failedChecks,

    failureCounts,
  };
}
