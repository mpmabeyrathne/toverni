import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  calculateBenchmarkMetrics,
} from './benchmark-metrics.js';

describe(
  'calculateBenchmarkMetrics',
  () => {
    it(
      'calculates deterministic quality telemetry',
      () => {
        const result =
          calculateBenchmarkMetrics(
            [
              {
                title:
                  'Book available room',

                actions: [
                  'Select room',
                  'Book room',
                ],

                expectedOutcomes: [
                  'Booking confirmed',
                ],

                executable:
                  true,

                runtimeStatus:
                  'passed',

                evidenceReferences: [
                  'REQ-1',
                ],

                unsupportedSteps: [],

                humanEditsRequired:
                  0,

                assertionCount:
                  2,
              },

              {
                title:
                  'Book unavailable room',

                actions: [
                  'Book unavailable room',
                ],

                expectedOutcomes: [
                  'Booking rejected',
                ],

                executable:
                  false,

                runtimeStatus:
                  'not_run',

                evidenceReferences: [
                  'REQ-2',
                ],

                unsupportedSteps: [
                  'Assumed error message',
                ],

                humanEditsRequired:
                  1,

                assertionCount:
                  0,
              },
            ],

            [
              {
                id:
                  'FLOW-1',

                title:
                  'Book available room',

                important:
                  true,

                keywords: [
                  'book',
                  'room',
                ],
              },
            ],
          );

        expect(
          result.scenarioCount,
        ).toBe(2);

        expect(
          result.executableScenarioCount,
        ).toBe(1);

        expect(
          result.runtimeExecutedScenarioCount,
        ).toBe(1);

        expect(
          result.runtimePassedScenarioCount,
        ).toBe(1);

        expect(
          result.runtimePassRate,
        ).toBe(1);

        expect(
          result.requirementGroundingRate,
        ).toBe(1);

        expect(
          result.unsupportedStepCount,
        ).toBe(1);

        expect(
          result.unsupportedActionRate,
        ).toBeCloseTo(
          1 / 3,
        );

        expect(
          result.importantFlowCoverage,
        ).toBe(1);

        expect(
          result.coverageEfficiency,
        ).toBe(0.5);

        expect(
          result.humanEditsPerScenario,
        ).toBe(0.5);

        expect(
          result.meaningfulAssertionCoverage,
        ).toBe(1);
      },
    );

    it(
      'keeps runnable rate separate from runtime pass rate',
      () => {
        const result =
          calculateBenchmarkMetrics(
            [
              {
                title:
                  'Passing test',

                actions: [
                  'Book room',
                ],

                expectedOutcomes: [
                  'Room booked',
                ],

                executable:
                  true,

                runtimeStatus:
                  'passed',

                evidenceReferences: [
                  'REQ-1',
                ],

                unsupportedSteps: [],

                humanEditsRequired:
                  0,

                assertionCount:
                  1,
              },

              {
                title:
                  'Runnable failing test',

                actions: [
                  'Cancel booking',
                ],

                expectedOutcomes: [
                  'Booking cancelled',
                ],

                executable:
                  true,

                runtimeStatus:
                  'failed',

                evidenceReferences: [
                  'REQ-2',
                ],

                unsupportedSteps: [],

                humanEditsRequired:
                  0,

                assertionCount:
                  1,
              },
            ],

            [],
          );

        expect(
          result.executabilityRate,
        ).toBe(1);

        expect(
          result.runtimeExecutedScenarioCount,
        ).toBe(2);

        expect(
          result.runtimeFailedScenarioCount,
        ).toBe(1);

        expect(
          result.runtimePassRate,
        ).toBe(0.5);
      },
    );

    it(
      'requires manual work for a non executable scenario',
      () => {
        const result =
          calculateBenchmarkMetrics(
            [
              {
                title:
                  'Book room',

                actions: [
                  'Book room',
                ],

                expectedOutcomes: [
                  'Booking succeeds',
                ],

                executable:
                  false,

                runtimeStatus:
                  'not_run',

                evidenceReferences: [],

                unsupportedSteps: [],

                humanEditsRequired:
                  0,

                assertionCount:
                  0,
              },
            ],

            [
              {
                id:
                  'FLOW-1',

                title:
                  'Book room',

                important:
                  true,

                keywords: [
                  'book',
                  'room',
                ],
              },
            ],
          );

        expect(
          result.relevanceRate,
        ).toBe(1);

        expect(
          result.executabilityRate,
        ).toBe(0);

        expect(
          result.runtimePassRate,
        ).toBe(0);

        expect(
          result.humanEditsPerScenario,
        ).toBe(1);
      },
    );
  },
);
