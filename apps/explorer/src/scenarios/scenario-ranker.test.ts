import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import {
    rankScenario,
  } from './scenario-ranker.js';
  
  describe(
    'rankScenario',
    () => {
      it(
        'ranks a scenario using grounded evidence',
        () => {
          const result =
            rankScenario(
              {
                title:
                  'Book available room',
  
                type:
                  'positive',
  
                preconditions: [],
  
                actions: [
                  'Book an available room',
                ],
  
                expectedOutcomes: [
                  'Booking succeeds',
                ],
  
                evidenceReferences: [
                  'REQ-1',
                  'ACTION-1',
                ],
              },
  
              [
                {
                  id:
                    'REQ-1',
  
                  type:
                    'requirement',
  
                  description:
                    'Customer can book an available room',
  
                  source:
                    'requirements.md',
                },
  
                {
                  id:
                    'ACTION-1',
  
                  type:
                    'action',
  
                  description:
                    'button: Book',
  
                  source:
                    'action-1',
                },
              ],
            );
  
          expect(
            result.confidence,
          ).toBe(1);
  
          expect(
            result.relevance,
          ).toBeGreaterThan(
            50,
          );
  
          expect(
            result.risk,
          ).toBe(50);
        },
      );
    },
  );