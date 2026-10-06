import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  BenchmarkMetrics,
} from '../benchmark/index.js';

import {
  classifyReleaseFailure,
  evaluatePublicBetaReleaseGate,
} from './release-validation.js';

function passingMetrics(
  overrides:
    Partial<BenchmarkMetrics> = {},
): BenchmarkMetrics {
  return {
    scenarioCount:
      10,

    relevantScenarioCount:
      10,

    executableScenarioCount:
      9,

    runtimeExecutedScenarioCount:
      9,

    runtimePassedScenarioCount:
      8,

    runtimeFailedScenarioCount:
      1,

    requirementGroundedScenarioCount:
      10,

    totalActionCount:
      20,

    duplicateScenarioCount:
      0,

    unsupportedStepCount:
      0,

    coveredImportantFlowCount:
      9,

    totalImportantFlowCount:
      10,

    totalHumanEdits:
      1,

    relevanceRate:
      1,

    executabilityRate:
      0.9,

    runtimePassRate:
      8 / 9,

    requirementGroundingRate:
      1,

    unsupportedActionRate:
      0,

    coverageEfficiency:
      0.9,

    duplicateRate:
      0,

    importantFlowCoverage:
      0.9,

    unsupportedStepsPerScenario:
      0,

    humanEditsPerScenario:
      0.1,

    assertionScenarioCount:
      9,

    meaningfulAssertionCoverage:
      1,

    ...overrides,
  };
}

describe(
  'public beta release validation',
  () => {
    it.each([
      [
        'locator resolved to 2 elements in strict mode',
        'locator-failure',
      ],
      [
        'saved authentication session expired',
        'auth-session',
      ],
      [
        'invalid value failed validation',
        'bad-test-data',
      ],
      [
        'flow transition could not be reconstructed',
        'flow-reconstruction',
      ],
      [
        'expect assertion failed',
        'missing-weak-assertion',
      ],
      [
        'unsupported control requires manual completion',
        'unsupported-control',
      ],
      [
        'test timed out after 30s',
        'timeout-flakiness',
      ],
      [
        'destructive action was unsafe',
        'unsafe-action-classification',
      ],
    ])(
      'classifies %s as %s',
      (
        message,
        category,
      ) => {
        expect(
          classifyReleaseFailure(
            message,
          ),
        ).toBe(
          category,
        );
      },
    );

    it(
      'passes only when quality, runtime, safety, and local model gates pass',
      () => {
        const result =
          evaluatePublicBetaReleaseGate({
            aggregate:
              passingMetrics(),

            modelPathPassed:
              true,

            fixtures: [
              {
                fixtureId:
                  'todo',

                title:
                  'Todo',

                metrics:
                  passingMetrics(),

                safety: {
                  blockedHighImpactActions:
                    1,

                  executedHighImpactActions:
                    0,
                },

                failures: [],
              },
            ],
          });

        expect(
          result.passed,
        ).toBe(
          true,
        );
      },
    );

    it(
      'fails when generated Playwright tests do not meet the runtime gate',
      () => {
        const result =
          evaluatePublicBetaReleaseGate({
            aggregate:
              passingMetrics({
                runtimePassRate:
                  0.5,

                runtimePassedScenarioCount:
                  4,

                runtimeFailedScenarioCount:
                  4,

                runtimeExecutedScenarioCount:
                  8,
              }),

            modelPathPassed:
              true,

            fixtures: [],
          });

        expect(
          result.runtimePassed,
        ).toBe(
          false,
        );

        expect(
          result.passed,
        ).toBe(
          false,
        );
      },
    );

    it(
      'fails when a high-impact action executes under safe defaults',
      () => {
        const result =
          evaluatePublicBetaReleaseGate({
            aggregate:
              passingMetrics(),

            modelPathPassed:
              true,

            fixtures: [
              {
                fixtureId:
                  'todo',

                title:
                  'Todo',

                metrics:
                  passingMetrics(),

                safety: {
                  blockedHighImpactActions:
                    0,

                  executedHighImpactActions:
                    1,
                },

                failures: [],
              },
            ],
          });

        expect(
          result.safetyPassed,
        ).toBe(
          false,
        );
      },
    );
  },
);
