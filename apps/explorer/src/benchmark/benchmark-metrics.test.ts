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
        'calculates benchmark quality metrics',
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
  
                  evidenceReferences: [
                    'REQ-1',
                  ],
  
                  unsupportedSteps: [],
  
                  humanEditsRequired:
                    0,
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
  
                  evidenceReferences: [
                    'REQ-2',
                  ],
  
                  unsupportedSteps: [
                    'Assumed error message',
                  ],
  
                  humanEditsRequired:
                    1,
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
            result.unsupportedStepCount,
          ).toBe(1);
  
          expect(
            result.importantFlowCoverage,
          ).toBe(1);
  
          expect(
            result.humanEditsPerScenario,
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
  
                  evidenceReferences: [],
  
                  unsupportedSteps: [],
  
                  humanEditsRequired:
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
            result.humanEditsPerScenario,
          ).toBe(1);
        },
      );
    },
  );