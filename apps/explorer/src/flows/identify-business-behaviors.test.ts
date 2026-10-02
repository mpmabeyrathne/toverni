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
    identifyBusinessBehaviors,
  } from './identify-business-behaviors.js';
  
  import {
    reconstructBusinessFlows,
  } from './reconstruct-business-flows.js';
  
  describe(
    'identifyBusinessBehaviors',
    () => {
      it(
        'separates booking and cancellation into distinct business behaviors',
        () => {
          const states = [
            createState(
              'landing',
            ),
            createState(
              'search-results',
            ),
            createState(
              'booked',
            ),
            createState(
              'cancelled',
            ),
          ];
  
          const transitions = [
            createTransition(
              'search',
              'landing',
              'search-results',
              {
                type:
                  'click',
  
                target:
                  'Search',
              },
              1,
            ),
  
            createTransition(
              'book',
              'search-results',
              'booked',
              {
                type:
                  'click',
  
                target:
                  'Book Ocean Room',
              },
              2,
            ),
  
            createTransition(
              'cancel',
              'booked',
              'cancelled',
              {
                type:
                  'click',
  
                target:
                  'Cancel Booking',
              },
              3,
            ),
          ];
  
          const flows =
            reconstructBusinessFlows({
              states,
              transitions,
            });
  
          const behaviors =
            identifyBusinessBehaviors({
              states,
              transitions,
              flows,
            });
  
          expect(
            behaviors,
          ).toHaveLength(
            2,
          );
  
          expect(
            behaviors[0],
          ).toMatchObject({
            name:
              'Book Ocean Room',
  
            transitionIds: [
              'search',
              'book',
            ],
  
            preconditionTransitionIds:
              [],
  
            complete:
              true,
          });
  
          expect(
            behaviors[1],
          ).toMatchObject({
            name:
              'Cancel Booking',
  
            transitionIds: [
              'cancel',
            ],
  
            preconditionTransitionIds: [
              'search',
              'book',
            ],
  
            complete:
              true,
          });
        },
      );
  
      it(
        'separates todo create complete and delete behaviors',
        () => {
          const states = [
            createState(
              'todo-start',
            ),
            createState(
              'todo-filled',
            ),
            createState(
              'todo-created',
            ),
            createState(
              'todo-completed',
            ),
            createState(
              'todo-deleted',
            ),
          ];
  
          const transitions = [
            createTransition(
              'fill-title',
              'todo-start',
              'todo-filled',
              {
                type:
                  'fill',
  
                target:
                  'Todo title',
  
                value:
                  'Buy milk',
              },
              1,
            ),
  
            createTransition(
              'add-todo',
              'todo-filled',
              'todo-created',
              {
                type:
                  'click',
  
                target:
                  'Add Todo',
              },
              2,
            ),
  
            createTransition(
              'complete-todo',
              'todo-created',
              'todo-completed',
              {
                type:
                  'click',
  
                target:
                  'Complete Todo',
              },
              3,
            ),
  
            createTransition(
              'delete-todo',
              'todo-completed',
              'todo-deleted',
              {
                type:
                  'click',
  
                target:
                  'Delete Todo',
              },
              4,
            ),
          ];
  
          const flows =
            reconstructBusinessFlows({
              states,
              transitions,
            });
  
          const behaviors =
            identifyBusinessBehaviors({
              states,
              transitions,
              flows,
            });
  
          expect(
            behaviors.map(
              (behavior) =>
                behavior.name,
            ),
          ).toEqual([
            'Add Todo',
            'Complete Todo',
            'Delete Todo',
          ]);
  
          expect(
            behaviors[0]
              ?.transitionIds,
          ).toEqual([
            'fill-title',
            'add-todo',
          ]);
  
          expect(
            behaviors[1]
              ?.preconditionTransitionIds,
          ).toEqual([
            'fill-title',
            'add-todo',
          ]);
  
          expect(
            behaviors[2]
              ?.preconditionTransitionIds,
          ).toEqual([
            'fill-title',
            'add-todo',
            'complete-todo',
          ]);
        },
      );
  
      it(
        'does not turn ordinary navigation clicks into one-click business behaviors',
        () => {
          const states = [
            createState(
              'home',
            ),
            createState(
              'details',
            ),
            createState(
              'more-details',
            ),
          ];
  
          const transitions = [
            createTransition(
              'view-details',
              'home',
              'details',
              {
                type:
                  'click',
  
                target:
                  'View Details',
              },
              1,
            ),
  
            createTransition(
              'next',
              'details',
              'more-details',
              {
                type:
                  'click',
  
                target:
                  'Next',
              },
              2,
            ),
          ];
  
          const flows =
            reconstructBusinessFlows({
              states,
              transitions,
            });
  
          const behaviors =
            identifyBusinessBehaviors({
              states,
              transitions,
              flows,
            });
  
          expect(
            behaviors,
          ).toEqual(
            [],
          );
        },
      );
  
      it(
        'marks a transactional behavior incomplete when its destination state is missing',
        () => {
          const states = [
            createState(
              'todo-created',
            ),
          ];
  
          const transitions = [
            createTransition(
              'delete-todo',
              'todo-created',
              'missing-state',
              {
                type:
                  'click',
  
                target:
                  'Delete Todo',
              },
              1,
            ),
          ];
  
          const flows =
            reconstructBusinessFlows({
              states,
              transitions,
            });
  
          const behaviors =
            identifyBusinessBehaviors({
              states,
              transitions,
              flows,
            });
  
          expect(
            behaviors,
          ).toHaveLength(
            1,
          );
  
          expect(
            behaviors[0],
          ).toMatchObject({
            name:
              'Delete Todo',
  
            complete:
              false,
  
            transitionIds: [
              'delete-todo',
            ],
          });
        },
      );
      it(
        'treats an observed equivalent-state transaction as a complete business behavior',
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
      
          const flows =
            reconstructBusinessFlows({
              states,
      
              transitions: [
                transition,
              ],
            });
      
          const behaviors =
            identifyBusinessBehaviors({
              states,
      
              transitions: [
                transition,
              ],
      
              flows,
            });
      
          expect(
            behaviors,
          ).toHaveLength(
            1,
          );
      
          expect(
            behaviors[0],
          ).toMatchObject({
            name:
              'Complete Todo',
      
            transitionIds: [
              'complete-todo',
            ],
      
            complete:
              true,
          });
        },
      );
      it(
        'deduplicates the same observed business boundary across reconstructed paths',
        () => {
          const states = [
            createState(
              'root-a',
            ),
      
            createState(
              'root-b',
            ),
      
            createState(
              'ready',
            ),
      
            createState(
              'booked',
            ),
          ];
      
          const transitions = [
            createTransition(
              'view-a',
              'root-a',
              'ready',
              {
                type:
                  'click',
      
                target:
                  'View A',
              },
              1,
            ),
      
            createTransition(
              'view-b',
              'root-b',
              'ready',
              {
                type:
                  'click',
      
                target:
                  'View B',
              },
              2,
            ),
      
            createTransition(
              'book-room',
              'ready',
              'booked',
              {
                type:
                  'click',
      
                target:
                  'Book Room',
              },
              3,
            ),
          ];
      
          const flows =
            reconstructBusinessFlows({
              states,
              transitions,
            });
      
          expect(
            flows,
          ).toHaveLength(
            2,
          );
      
          const behaviors =
            identifyBusinessBehaviors({
              states,
              transitions,
              flows,
            });
      
          expect(
            behaviors,
          ).toHaveLength(
            1,
          );
      
          const behavior =
            behaviors[0];
      
          if (!behavior) {
            throw new Error(
              'Expected a business behavior',
            );
          }
      
          expect(
            behavior.name,
          ).toBe(
            'Book Room',
          );
      
          expect(
            behavior.transitionIds[
              behavior
                .transitionIds
                .length - 1
            ],
          ).toBe(
            'book-room',
          );
      
          expect(
            behavior.sourceFlowIds,
          ).toHaveLength(
            2,
          );
      
          expect(
            new Set(
              behavior
                .sourceFlowIds,
            ).size,
          ).toBe(
            2,
          );
        },
      );
      it(
        'deduplicates repeated executions of the same semantic business behavior',
        () => {
          const states = [
            createState(
              'todo-start',
            ),
      
            createState(
              'todo-created-a',
            ),
      
            createState(
              'todo-created-b',
            ),
          ];
      
          const transitions = [
            createTransition(
              'add-todo-1',
              'todo-start',
              'todo-created-a',
              {
                type:
                  'click',
      
                target:
                  'Add Todo',
              },
              1,
            ),
      
            createTransition(
              'add-todo-2',
              'todo-created-a',
              'todo-created-b',
              {
                type:
                  'click',
      
                target:
                  'Add Todo',
              },
              2,
            ),
          ];
      
          const flows =
            reconstructBusinessFlows({
              states,
              transitions,
            });
      
          const behaviors =
            identifyBusinessBehaviors({
              states,
              transitions,
              flows,
            });
      
          const addTodoBehaviors =
            behaviors.filter(
              (behavior) =>
                behavior.name ===
                'Add Todo',
            );
      
          expect(
            addTodoBehaviors,
          ).toHaveLength(
            1,
          );
        },
      );

      it(
        'treats retry and clear actions as recovery business boundaries',
        () => {
          const states = [
            createState(
              'ready',
            ),
            createState(
              'failed',
            ),
            createState(
              'uploaded',
            ),
            createState(
              'cleared',
            ),
          ];

          const transitions = [
            createTransition(
              'upload',
              'ready',
              'failed',
              {
                type:
                  'click',

                target:
                  'Upload',
              },
              1,
            ),

            createTransition(
              'retry',
              'failed',
              'uploaded',
              {
                type:
                  'click',

                target:
                  'Retry',
              },
              2,
            ),

            createTransition(
              'clear',
              'uploaded',
              'cleared',
              {
                type:
                  'click',

                target:
                  'Clear',
              },
              3,
            ),
          ];

          const flows =
            reconstructBusinessFlows({
              states,
              transitions,
            });

          const behaviors =
            identifyBusinessBehaviors({
              states,
              transitions,
              flows,
            });

          expect(
            behaviors.map(
              (behavior) =>
                behavior.name,
            ),
          ).toEqual([
            'Upload',
            'Retry',
            'Clear',
          ]);
        },
      );


      it(
        'prefers duplicate business behavior candidates that preserve replay-safe setup',
        () => {
          const states = [
            createState(
              'start',
            ),

            createState(
              'ready',
            ),

            createState(
              'failed',
            ),
          ];

          const transitions = [
            createTransition(
              'select-file',
              'start',
              'ready',
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
              'upload-with-setup',
              'ready',
              'failed',
              {
                type:
                  'click',

                target:
                  'Upload',
              },
              2,
            ),

            createTransition(
              'upload-direct',
              'start',
              'failed',
              {
                type:
                  'click',

                target:
                  'Upload',
              },
              3,
            ),
          ];

          const flows =
            reconstructBusinessFlows({
              states,
              transitions,
            });

          const behaviors =
            identifyBusinessBehaviors({
              states,
              transitions,
              flows,
            });

          const uploadBehavior =
            behaviors.find(
              (behavior) =>
                behavior.name ===
                'Upload',
            );

          expect(
            uploadBehavior,
          ).toBeDefined();

          expect(
            uploadBehavior
              ?.transitionIds,
          ).toEqual([
            'select-file',
            'upload-with-setup',
          ]);
        },
      );


      it(
        'keeps file selection as replay setup for the upload business behavior',
        () => {
          const states = [
            createState(
              'start',
            ),
            createState(
              'ready',
            ),
            createState(
              'failed',
            ),
          ];

          const transitions = [
            createTransition(
              'select-file',
              'start',
              'ready',
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
              'ready',
              'failed',
              {
                type:
                  'click',

                target:
                  'Upload',
              },
              2,
            ),
          ];

          const flows =
            reconstructBusinessFlows({
              states,
              transitions,
            });

          const behaviors =
            identifyBusinessBehaviors({
              states,
              transitions,
              flows,
            });

          expect(
            behaviors.map(
              (behavior) =>
                behavior.name,
            ),
          ).toEqual([
            'Upload',
          ]);

          expect(
            behaviors[0]
              ?.transitionIds,
          ).toEqual([
            'select-file',
            'upload',
          ]);
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