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

              transitions: [
                {
                  id:
                    'transition-1',

                  actionId:
                    'action-db-1',

                  actionTarget:
                    'Learn more',

                  explorationBlocked:
                    false,

                  occurredAt:
                    '2026-10-01T00:00:00.000Z',

                  beforeObservation: {
                    capturedAt:
                      '2026-10-01T00:00:00.000Z',

                    url:
                      'https://example.com',

                    title:
                      'Example',

                    semanticText: [
                      'Home',
                    ],

                    ariaSnapshot:
                      '',

                    actions:
                      [],

                    consoleEvents:
                      [],

                    networkEvents:
                      [],

                    supportingArtifacts:
                      [],
                  },

                  afterObservation: {
                    capturedAt:
                      '2026-10-01T00:00:01.000Z',

                    url:
                      'https://example.com/learn',

                    title:
                      'Learn',

                    semanticText: [
                      'Learn',
                    ],

                    ariaSnapshot:
                      '',

                    actions:
                      [],

                    consoleEvents:
                      [],

                    networkEvents:
                      [],

                    supportingArtifacts:
                      [],
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
            result.assertions.length,
          ).toBeGreaterThan(0);

          expect(
            result.assertions.some(
              (assertion) =>
                assertion.kind ===
                  'url' &&
                assertion.matcher ===
                  'url' &&
                assertion.expected ===
                  'https://example.com/learn',
            ),
          ).toBe(true);
  
          expect(
            result.steps[0]
              ?.operation,
          ).toEqual({
            kind:
              'click',

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
          });

          expect(
            result.metadata,
          ).toEqual({
            irVersion:
              '1',

            generator:
              'toverni',
          });
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
      it(
        'requires manual completion when referenced action is blocked',
        () => {
          const result =
            createExecutableTestPlan({
              scenario: {
                id:
                  'scenario-3',
      
                title:
                  'Book unavailable room',
      
                evidenceReferences: [
                  'ACTION-2',
                ],
              },
      
              evidence: [
                {
                  id:
                    'ACTION-2',
      
                  type:
                    'action',
      
                  source:
                    'action-db-2',
                },
              ],
      
              actions: [
                {
                  id:
                    'action-db-2',
      
                  label:
                    'Book Garden Room',
      
                  type:
                    'button',
      
                  target: {
                    by:
                      'role',
      
                    role:
                      'button',
      
                    name:
                      'Book Garden Room',
      
                    exact:
                      true,
                  },
      
                  blocked:
                    true,
      
                  blockReasons: [
                    'Action is disabled',
                  ],
                },
              ],
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