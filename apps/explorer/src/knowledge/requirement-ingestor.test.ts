import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import {
    ingestRequirements,
  } from './requirement-ingestor.js';
  
  describe(
    'ingestRequirements',
    () => {
      it(
        'extracts structured requirement context',
        async () => {
          const result =
            await ingestRequirements(
              '../../fixtures/knowledge/requirements.md',
            );
  
          expect(
            result.acceptanceCriteria,
          ).toContain(
            'A customer can book an available room.',
          );
  
          expect(
            result.userRoles,
          ).toEqual([
            'customer',
            'admin',
          ]);
  
          expect(
            result.constraints.length,
          ).toBeGreaterThan(
            0,
          );
        },
      );
    },
  );