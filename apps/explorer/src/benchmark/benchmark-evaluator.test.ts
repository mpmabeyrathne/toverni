import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import {
    evaluateBenchmarkApplication,
  } from './benchmark-evaluator.js';
  
  describe(
    'evaluateBenchmarkApplication',
    () => {
      it(
        'compares Toverni with baseline',
        () => {
          const result =
            evaluateBenchmarkApplication({
              fixtureId:
                'booking',
  
              title:
                'Booking',
  
              referenceFlows: [
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
  
              toverniScenarios: [
                {
                  title:
                    'Book room',
  
                  actions: [
                    'Book room',
                  ],
  
                  expectedOutcomes: [
                    'Room booked',
                  ],
  
                  executable:
                    true,
  
                  evidenceReferences: [
                    'ACTION-1',
                  ],
  
                  unsupportedSteps: [],
  
                  humanEditsRequired:
                    0,
                },
              ],
  
              baselineScenarios: [
                {
                  title:
                    'Book room',
  
                  actions: [
                    'Book room',
                  ],
  
                  expectedOutcomes: [
                    'Success popup appears',
                  ],
  
                  executable:
                    false,
  
                  evidenceReferences: [],
  
                  unsupportedSteps: [
                    'Invented success popup',
                  ],
  
                  humanEditsRequired:
                    1,
                },
              ],
            });
  
          expect(
            result
              .toverni
              .executabilityRate,
          ).toBe(1);
  
          expect(
            result
              .baseline
              .executabilityRate,
          ).toBe(0);
  
          expect(
            result
              .toverni
              .importantFlowCoverage,
          ).toBe(1);
        },
      );
    },
  );