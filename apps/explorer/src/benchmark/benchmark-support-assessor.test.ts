import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import {
    assessScenarioSupport,
  } from './benchmark-support-assessor.js';
  
  describe(
    'assessScenarioSupport',
    () => {
      it(
        'accepts discovered browser actions grounded in the corpus',
        () => {
          const result =
            assessScenarioSupport(
              [
                {
                  title:
                    'Navigation: Book Ocean Room',
  
                  actions: [
                    'Use the discovered button "Book Ocean Room"',
                  ],
  
                  expectedOutcomes: [
                    'The discovered button can be executed.',
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
  
              [
                'Room Booking',
                'Book Ocean Room',
                'Ocean Room Available',
              ].join('\n'),
            );
  
          expect(
            result[0]
              ?.unsupportedSteps,
          ).toEqual([]);
        },
      );
  
      it(
        'flags an unsupported domain action',
        () => {
          const result =
            assessScenarioSupport(
              [
                {
                  title:
                    'Refund payment',
  
                  actions: [
                    'Refund customer payment',
                  ],
  
                  expectedOutcomes: [
                    'Refund succeeds',
                  ],
  
                  executable:
                    false,
  
                  evidenceReferences: [],
  
                  unsupportedSteps: [],
  
                  humanEditsRequired:
                    0,
                },
              ],
  
              'Room Booking Book Ocean Room',
            );
  
          expect(
            result[0]
              ?.unsupportedSteps,
          ).toEqual([
            'Refund customer payment',
          ]);
        },
      );
    },
  );