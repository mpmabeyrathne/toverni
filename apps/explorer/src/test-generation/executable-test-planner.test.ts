import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import {
    createExecutableTestPlan,
  } from './executable-test-planner.js';
  
  describe(
    'createExecutableTestPlan',
    () => {
      it(
        'creates executable step from discovered action evidence',
        () => {
          const result =
            createExecutableTestPlan({
              scenario: {
                id:
                  'scenario-1',
  
                title:
                  'Navigate to learn more',
  
                evidenceReferences: [
                  'ACTION-1',
                ],
              },
  
              evidence: [
                {
                  id:
                    'ACTION-1',
  
                  type:
                    'action',
  
                  source:
                    'action-db-1',
                },
              ],
  
              actions: [
                {
                  id:
                    'action-db-1',
  
                  label:
                    'Learn more',
  
                  type:
                    'link',
  
                  target: {
                    by:
                      'role',
  
                    role:
                      'link',
  
                    name:
                      'Learn more',
  
                    exact:
                      true,
                  },
                },
              ],
            });
  
          expect(
            result.status,
          ).toBe(
            'ready',
          );
  
          expect(
            result.steps,
          ).toHaveLength(1);
  
          expect(
            result.steps[0]
              ?.playwright,
          ).toBe(
            'page.getByRole("link", { name: "Learn more", exact: true }).click();',
          );
        },
      );
  
      it(
        'requires manual completion when no discovered action supports the scenario',
        () => {
          const result =
            createExecutableTestPlan({
              scenario: {
                id:
                  'scenario-2',
  
                title:
                  'Book available room',
  
                evidenceReferences: [
                  'REQ-1',
                ],
              },
  
              evidence: [
                {
                  id:
                    'REQ-1',
  
                  type:
                    'requirement',
  
                  source:
                    'requirements.md',
                },
              ],
  
              actions: [],
            });
  
          expect(
            result.status,
          ).toBe(
            'manual_required',
          );
  
          expect(
            result.steps,
          ).toEqual([]);
        },
      );
    },
  );