import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import type {
    PageObservation,
  } from '../contracts/page-observation.js';
  
  import type {
    ApplicationStateNode,
    ApplicationTransition,
    TransitionAction,
  } from '../state/application-state.js';
  
  import {
    reconstructBusinessFlows,
  } from './reconstruct-business-flows.js';
  
  describe(
    'reconstructBusinessFlows',
    () => {
      it(
        'reconstructs an ordered complete path and preserves source ids',
        () => {
          const states = [
            createState(
              'state-a',
            ),
            createState(
              'state-b',
            ),
            createState(
              'state-c',
            ),
          ];
  
          const transitions = [
            createTransition(
              'transition-1',
              'state-a',
              'state-b',
              {
                type:
                  'click',
  
                target:
                  'Continue',
              },
              1,
            ),
  
            createTransition(
              'transition-2',
              'state-b',
              'state-c',
              {
                type:
                  'submit',
  
                target:
                  'Confirm',
              },
              2,
            ),
          ];
  
          const result =
            reconstructBusinessFlows({
              states,
              transitions,
            });
  
          expect(
            result,
          ).toHaveLength(
            1,
          );
  
          expect(
            result[0],
          ).toMatchObject({
            startStateId:
              'state-a',
  
            endStateId:
              'state-c',
  
            stateIds: [
              'state-a',
              'state-b',
              'state-c',
            ],
  
            transitionIds: [
              'transition-1',
              'transition-2',
            ],
  
            complete:
              true,
  
            termination:
              'terminal-state',
          });
  
          expect(
            result[0]?.steps.map(
              (step) =>
                step.transitionId,
            ),
          ).toEqual([
            'transition-1',
            'transition-2',
          ]);
        },
      );
  
      it(
        'reconstructs branch points as distinct paths',
        () => {
          const states = [
            createState(
              'state-a',
            ),
            createState(
              'state-b',
            ),
            createState(
              'state-c',
            ),
          ];
  
          const transitions = [
            createTransition(
              'transition-create',
              'state-a',
              'state-b',
              {
                type:
                  'click',
  
                target:
                  'Create',
              },
              1,
            ),
  
            createTransition(
              'transition-cancel',
              'state-a',
              'state-c',
              {
                type:
                  'click',
  
                target:
                  'Cancel',
              },
              2,
            ),
          ];
  
          const result =
            reconstructBusinessFlows({
              states,
              transitions,
            });
  
          expect(
            result,
          ).toHaveLength(
            2,
          );
  
          expect(
            result.map(
              (flow) =>
                flow.transitionIds,
            ),
          ).toEqual(
            expect.arrayContaining([
              [
                'transition-create',
              ],
              [
                'transition-cancel',
              ],
            ]),
          );
        },
      );
  
      it(
        'terminates cycles while preserving the repeated state',
        () => {
          const states = [
            createState(
              'state-a',
            ),
            createState(
              'state-b',
            ),
          ];
  
          const transitions = [
            createTransition(
              'transition-1',
              'state-a',
              'state-b',
              {
                type:
                  'click',
  
                target:
                  'Next',
              },
              1,
            ),
  
            createTransition(
              'transition-2',
              'state-b',
              'state-a',
              {
                type:
                  'back',
  
                target:
                  'Back',
              },
              2,
            ),
          ];
  
          const result =
            reconstructBusinessFlows({
              states,
              transitions,
            });
  
          expect(
            result,
          ).toHaveLength(
            1,
          );
  
          expect(
            result[0],
          ).toMatchObject({
            stateIds: [
              'state-a',
              'state-b',
              'state-a',
            ],
  
            transitionIds: [
              'transition-1',
              'transition-2',
            ],
  
            complete:
              false,
  
            termination:
              'cycle',
          });
        },
      );
  
      it(
        'marks a path incomplete when a transition points to a missing state',
        () => {
          const states = [
            createState(
              'state-a',
            ),
          ];
  
          const transitions = [
            createTransition(
              'transition-1',
              'state-a',
              'missing-state',
              {
                type:
                  'click',
  
                target:
                  'Continue',
              },
              1,
            ),
          ];
  
          const result =
            reconstructBusinessFlows({
              states,
              transitions,
            });
  
          expect(
            result,
          ).toHaveLength(
            1,
          );
  
          expect(
            result[0],
          ).toMatchObject({
            stateIds: [
              'state-a',
              'missing-state',
            ],
  
            transitionIds: [
              'transition-1',
            ],
  
            complete:
              false,
  
            termination:
              'missing-state',
          });
        },
      );
      it(
        'preserves an equivalent-state business action as cycle evidence',
        () => {
          const states = [
            createState(
              'todo-created',
            ),
          ];
      
          const transition = {
            ...createTransition(
              'complete-todo',
              'todo-created',
              'todo-created',
              {
                type:
                  'click',
      
                target:
                  'Complete Todo',
              },
              1,
            ),
      
            equivalentState:
              true,
      
            explorationBlocked:
              true,
          };
      
          const result =
            reconstructBusinessFlows({
              states,
      
              transitions: [
                transition,
              ],
            });
      
          expect(
            result,
          ).toHaveLength(
            1,
          );
      
          expect(
            result[0],
          ).toMatchObject({
            stateIds: [
              'todo-created',
              'todo-created',
            ],
      
            transitionIds: [
              'complete-todo',
            ],
      
            termination:
              'cycle',
          });
        },
      );

      it(
        'preserves replay-safe file setup before a later upload action',
        () => {
          const states = [
            createState(
              'upload-ready',
            ),

            createState(
              'upload-failed',
            ),
          ];

          const transitions = [
            createTransition(
              'select-file',
              'upload-ready',
              'upload-ready',
              {
                type:
                  'set-input-files',

                target:
                  'Upload file',

                value:
                  'toverni-test.txt',
              },
              1,
            ),

            createTransition(
              'upload',
              'upload-ready',
              'upload-failed',
              {
                type:
                  'click',

                target:
                  'Upload',
              },
              2,
            ),
          ];

          const result =
            reconstructBusinessFlows({
              states,
              transitions,
            });

          expect(
            result,
          ).toHaveLength(
            1,
          );

          expect(
            result[0]
              ?.transitionIds,
          ).toEqual([
            'select-file',
            'upload',
          ]);

          expect(
            result[0]
              ?.steps
              .map(
                (step) =>
                  step.action.type,
              ),
          ).toEqual([
            'set-input-files',
            'click',
          ]);

          expect(
            result[0]
              ?.termination,
          ).toBe(
            'terminal-state',
          );
        },
      );

    },
  );
  
  function createState(
    id:
      string,
  ): ApplicationStateNode {
    const observation =
      createObservation(
        id,
      );
  
    return {
      id,
  
      fingerprint:
        id,
  
      routePattern:
        `/${id}`,
  
      url:
        observation.url,
  
      title:
        observation.title,
  
      firstSeenAt:
        '2026-09-29T00:00:00.000Z',
  
      lastSeenAt:
        '2026-09-29T00:00:00.000Z',
  
      visits:
        1,
  
      observation,
    };
  }
  
  function createTransition(
    id:
      string,
  
    fromStateId:
      string,
  
    toStateId:
      string,
  
    action:
      TransitionAction,
  
    order:
      number,
  ): ApplicationTransition {
    return {
      id,
  
      fromStateId,
  
      toStateId,
  
      action,
  
      occurredAt:
        `2026-09-29T00:00:${String(
          order,
        ).padStart(
          2,
          '0',
        )}.000Z`,
  
      equivalentState:
        false,
  
      explorationBlocked:
        false,
  
      beforeObservation:
        createObservation(
          fromStateId,
        ),
  
      afterObservation:
        createObservation(
          toStateId,
        ),
  
      evidence: {
        networkEvents: [],
  
        consoleEvents: [],
      },
    };
  }
  
  function createObservation(
    id:
      string,
  ): PageObservation {
    return {
      capturedAt:
        '2026-09-29T00:00:00.000Z',
  
      url:
        `http://example.test/${id}`,
  
      title:
        id,
  
      semanticText: [
        id,
      ],
  
      ariaSnapshot:
        '- main:',
  
      actions: [],
  
      consoleEvents: [],
  
      networkEvents: [],
  
      supportingArtifacts: [],
    };
  }