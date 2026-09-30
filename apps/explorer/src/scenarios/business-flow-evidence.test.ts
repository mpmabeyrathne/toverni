import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import type {
    GroundedBusinessBehavior,
  } from '../flows/grounded-business-behavior.js';
  
  import {
    buildEvidenceCatalog,
  } from './evidence-catalog.js';
  
  describe(
    'business flow evidence',
    () => {
      it(
        'exposes ordered grounded business behavior as FLOW evidence',
        () => {
          const behavior:
            GroundedBusinessBehavior = {
              id:
                'behavior-create-todo',
  
              sourceFlowIds: [
                'flow-1',
              ],
  
              name:
                'Add Todo',
  
              startStateId:
                'todo-start',
  
              endStateId:
                'todo-created',
  
              stateIds: [
                'todo-start',
                'todo-filled',
                'todo-created',
              ],
  
              transitionIds: [
                'fill-title',
                'add-todo',
              ],
  
              preconditionTransitionIds:
                [],
  
              steps: [
                {
                  transitionId:
                    'fill-title',
  
                  fromStateId:
                    'todo-start',
  
                  toStateId:
                    'todo-filled',
  
                  action: {
                    type:
                      'fill',
  
                    target:
                      'Todo title',
  
                    value:
                      'Buy milk',
                  },
                },
  
                {
                  transitionId:
                    'add-todo',
  
                  fromStateId:
                    'todo-filled',
  
                  toStateId:
                    'todo-created',
  
                  action: {
                    type:
                      'click',
  
                    target:
                      'Add Todo',
                  },
                },
              ],
  
              complete:
                true,
  
              boundaryEvidence: [
                {
                  source:
                    'action',
  
                  transitionId:
                    'add-todo',
  
                  detail:
                    'Observed transactional action "Add Todo"',
  
                  networkEventIds: [
                    'request-2',
                  ],
                },
              ],
  
              outcome: {
                stateId:
                  'todo-created',
  
                urlChanged:
                  false,
  
                titleChanged:
                  false,
  
                addedSemanticText: [
                  'Buy milk',
                ],
  
                removedSemanticText:
                  [],
              },
  
              requirementEvidenceIds: [
                'REQ-1',
              ],
  
              apiOperationIds: [
                'createTodo',
              ],
  
              apiOperationLinks: [],
            };
  
          const catalog =
            buildEvidenceCatalog(
              {
                requirements:
                  null,
  
                openApi:
                  null,
              },
  
              {
                states: [],
  
                actions: [],
  
                transitions: [],
              },
  
              [
                behavior,
              ],
            );
  
          expect(
            catalog,
          ).toContainEqual(
            expect.objectContaining({
              id:
                'FLOW-BUSINESS-1',
  
              type:
                'transition',
  
              source:
                'behavior-create-todo',
  
              description:
                expect.stringContaining(
                  'Ordered transitions: fill-title -> add-todo',
                ),
            }),
          );
  
          const evidence =
            catalog.find(
              (item) =>
                item.id ===
                'FLOW-BUSINESS-1',
            );
  
          expect(
            evidence
              ?.description,
          ).toContain(
            'Linked requirements: REQ-1',
          );
  
          expect(
            evidence
              ?.description,
          ).toContain(
            'Linked API operations: createTodo',
          );
        },
      );
    },
  );