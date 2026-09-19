import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import {
    deduplicateScenarios,
  } from './scenario-deduplicator.js';
  
  describe(
    'deduplicateScenarios',
    () => {
      it(
        'removes duplicate scenarios',
        () => {
          const scenarios = [
            {
              title:
                'Book available room',
  
              type:
                'positive' as const,
  
              preconditions: [],
  
              actions: [
                'Book an available room',
              ],
  
              expectedOutcomes: [
                'Booking succeeds',
              ],
  
              evidenceReferences: [
                'REQ-1',
              ],
            },
  
            {
              title:
                'Book available room',
  
              type:
                'positive' as const,
  
              preconditions: [],
  
              actions: [
                'Book an available room',
              ],
  
              expectedOutcomes: [
                'Booking succeeds',
              ],
  
              evidenceReferences: [
                'REQ-1',
              ],
            },
          ];
  
          const result =
            deduplicateScenarios(
              scenarios,
            );
  
          expect(
            result,
          ).toHaveLength(1);
        },
      );
    },
  );