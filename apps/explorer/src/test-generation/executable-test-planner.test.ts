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
      it(
        'allows exploration-history blocks to be replayed in generated tests',
        () => {
          const result =
            createExecutableTestPlan({
              scenario: {
                id:
                  'scenario-history-replay',

                title:
                  'Navigate to next page',

                evidenceReferences: [
                  'ACTION-HISTORY',
                ],
              },

              evidence: [
                {
                  id:
                    'ACTION-HISTORY',

                  type:
                    'action',

                  source:
                    'action-history',
                },
              ],

              actions: [
                {
                  id:
                    'action-history',

                  label:
                    'Next Page',

                  type:
                    'button',

                  target: {
                    by:
                      'role',

                    role:
                      'button',

                    name:
                      'Next Page',

                    exact:
                      true,
                  },

                  blocked:
                    true,

                  blockReasons: [
                    'Action has already been visited in this state',
                    'Action already exists in the discovered flow graph',
                  ],
                },
              ],

              transitions: [
                {
                  id:
                    'transition-history',

                  actionId:
                    'action-history',

                  actionTarget:
                    'Next Page',

                  explorationBlocked:
                    true,

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
                      'Page 1',
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
                      'https://example.com',

                    title:
                      'Example',

                    semanticText: [
                      'Page 2',
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
        },
      );


      it(
        'replays business-flow preconditions before the target transition',
        () => {
          const observation = (
            text:
              string,
          ) => ({
            capturedAt:
              '2026-10-02T00:00:00.000Z',

            url:
              'https://example.com',

            title:
              'Example',

            semanticText: [
              text,
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
          });

          const result =
            createExecutableTestPlan({
              scenario: {
                id:
                  'scenario-business-flow',

                title:
                  'Retry uploaded file',

                evidenceReferences: [
                  'FLOW-BUSINESS-1',
                ],
              },

              evidence: [
                {
                  id:
                    'FLOW-BUSINESS-1',

                  type:
                    'transition',

                  source:
                    'behavior-1',
                },
              ],

              actions: [
                {
                  id:
                    'action-upload',

                  label:
                    'Upload',

                  type:
                    'button',

                  target: {
                    by:
                      'role',

                    role:
                      'button',

                    name:
                      'Upload',

                    exact:
                      true,
                  },
                },

                {
                  id:
                    'action-retry',

                  label:
                    'Retry',

                  type:
                    'button',

                  target: {
                    by:
                      'role',

                    role:
                      'button',

                    name:
                      'Retry',

                    exact:
                      true,
                  },
                },
              ],

              transitions: [
                {
                  id:
                    'transition-upload',

                  actionId:
                    'action-upload',

                  actionTarget:
                    'Upload',

                  explorationBlocked:
                    false,

                  occurredAt:
                    '2026-10-02T00:00:00.000Z',

                  beforeObservation:
                    observation(
                      'Ready',
                    ),

                  afterObservation:
                    observation(
                      'Upload failed',
                    ),
                },

                {
                  id:
                    'transition-retry',

                  actionId:
                    'action-retry',

                  actionTarget:
                    'Retry',

                  explorationBlocked:
                    false,

                  occurredAt:
                    '2026-10-02T00:00:01.000Z',

                  beforeObservation:
                    observation(
                      'Upload failed',
                    ),

                  afterObservation:
                    observation(
                      'Upload succeeded',
                    ),
                },
              ],

              businessBehaviors: [
                {
                  id:
                    'behavior-1',

                  preconditionTransitionIds: [
                    'transition-upload',
                  ],

                  transitionIds: [
                    'transition-retry',
                  ],
                },
              ],
            });

          expect(
            result.status,
          ).toBe(
            'ready',
          );

          expect(
            result.steps.map(
              (step) =>
                step.description,
            ),
          ).toEqual([
            'Upload',
            'Retry',
          ]);

          expect(
            result.assertions.length,
          ).toBeGreaterThan(
            0,
          );
        },
      );

    },
  );