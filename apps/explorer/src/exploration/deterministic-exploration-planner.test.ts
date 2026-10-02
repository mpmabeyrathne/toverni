import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import type {
    PageObservation,
  } from '../contracts/page-observation.js';

  import type {
    KnowledgeContext,
  } from '../knowledge/knowledge-contracts.js';
  
  import {
    ApplicationStateModel,
  } from '../state/application-state-model.js';
  
  import {
    DeterministicExplorationPlanner,
  } from './deterministic-exploration-planner.js';
  
  function createObservation():
    PageObservation {
    return {
      capturedAt:
        '2026-09-19T00:00:00.000Z',
  
      url:
        'https://example.com/projects',
  
      title:
        'Projects',
  
      semanticText: [
        'Projects',
        'Create Project',
        'Learn More',
        'Delete Project',
      ],
  
      ariaSnapshot: `
  - heading "Projects" [level=1]
  - button "Create Project"
  - link "Learn More"
  - button "Delete Project"
  `,
  
      actions: [
        {
          type: 'button',
          tagName: 'button',
          name:
            'Create Project',
          text:
            'Create Project',
          disabled: false,
          visible: true,
        },
  
        {
          type: 'link',
          tagName: 'a',
          name:
            'Learn More',
          text:
            'Learn More',
          href:
            'https://example.com/help',
          disabled: false,
          visible: true,
        },
  
        {
          type: 'button',
          tagName: 'button',
          name:
            'Delete Project',
          text:
            'Delete Project',
          disabled: false,
          visible: true,
        },
  
        {
          type: 'input',
          tagName: 'input',
          name:
            'Search',
          inputType:
            'text',
          disabled: false,
          visible: true,
        },
      ],
  
      consoleEvents: [],
  
      networkEvents: [],
  
      supportingArtifacts: [],
    };
  }
  
  function setup() {
    const stateModel =
      new ApplicationStateModel();
  
    const observation =
      createObservation();
  
    const state =
      stateModel
        .registerObservation(
          observation,
        )
        .state;
  
    const planner =
      new DeterministicExplorationPlanner(
        stateModel,
      );
  
    return {
      stateModel,
      observation,
      state,
      planner,
    };
  }

  function createEmailObservation():
  PageObservation {
  const observation =
    createObservation();

  observation.actions.push({
    type:
      'input',

    tagName:
      'input',

    name:
      'Email',

    inputType:
      'email',

    disabled:
      false,

    visible:
      true,

    formField: {
      htmlName:
        'email',

      inputType:
        'email',

      required:
        true,
    },
  });

  return observation;
}

function createEmailKnowledge(
  includeInvite = true,
): KnowledgeContext {
  return {
    requirements:
      null,

    openApi: {
      sourcePath:
        '/fixtures/openapi.yaml',

      title:
        'Account API',

      version:
        '1.0.0',

      servers: [],

      operations: [
        {
          operationId:
            'createUser',

          method:
            'POST',

          path:
            '/users',

          parameters: [],

          requestBody: {
            content: {
              'application/json': {
                schema: {
                  $ref:
                    '#/components/schemas/CreateUserRequest',
                },
              },
            },
          },

          responses: [],

          security: [],

          tags: [],
        },

        ...(includeInvite
          ? [
              {
                operationId:
                  'inviteUser',

                method:
                  'POST',

                path:
                  '/invitations',

                parameters: [],

                requestBody: {
                  content: {
                    'application/json': {
                      schema: {
                        $ref:
                          '#/components/schemas/InviteUserRequest',
                      },
                    },
                  },
                },

                responses: [],

                security: [],

                tags: [],
              },
            ]
          : []),
      ],

      schemas: {
        CreateUserRequest: {
          type:
            'object',

          required: [
            'email',
          ],

          properties: {
            email: {
              type:
                'string',

              format:
                'email',

              example:
                'account@example.com',
            },
          },
        },

        ...(includeInvite
          ? {
              InviteUserRequest: {
                type:
                  'object',

                required: [
                  'email',
                ],

                properties: {
                  email: {
                    type:
                      'string',

                    format:
                      'email',

                    example:
                      'invite@example.com',
                  },
                },
              },
            }
          : {}),
      },
    },
  };
}

function setupWithObservation(
  observation:
    PageObservation,
) {
  const stateModel =
    new ApplicationStateModel();

  const state =
    stateModel
      .registerObservation(
        observation,
      )
      .state;

  const planner =
    new DeterministicExplorationPlanner(
      stateModel,
    );

  return {
    stateModel,
    observation,
    state,
    planner,
  };
}
  
  describe(
    'DeterministicExplorationPlanner',
    () => {
      it(
        'prefers a useful unexplored action',
        () => {
          const {
            observation,
            state,
            planner,
          } = setup();
  
          const decision =
            planner.plan({
              state,
              observation,
            });
  
          expect(
            decision.shouldStop,
          ).toBe(false);
  
          expect(
            decision.selected,
          ).not.toBeNull();
  
          expect(
            decision.selected
              ?.blocked,
          ).toBe(false);
  
          expect(
            [
              'Create Project',
              'Learn More',
            ],
          ).toContain(
            decision.selected
              ?.label,
          );
        },
      );
  
      it(
        'blocks destructive actions',
        () => {
          const {
            observation,
            state,
            planner,
          } = setup();
  
          const decision =
            planner.plan({
              state,
              observation,
            });
  
          const deleteCandidate =
            decision
              .rankedCandidates
              .find(
                (candidate) =>
                  candidate.label ===
                  'Delete Project',
              );
  
          expect(
            deleteCandidate
              ?.blocked,
          ).toBe(true);
  
          expect(
            deleteCandidate
              ?.blockReasons
              .some(
                (reason) =>
                  reason.includes(
                    'destructive',
                  ),
              ),
          ).toBe(true);
        },
      );
  
      it(
        'does not select the same action twice',
        () => {
          const {
            observation,
            state,
            planner,
          } = setup();
  
          const first =
            planner.plan({
              state,
              observation,
            });
  
          expect(
            first.selected,
          ).not.toBeNull();
  
          if (!first.selected) {
            throw new Error(
              'Expected selected action',
            );
          }
  
          planner.recordActionExecution(
            first.selected,
          );
  
          const second =
            planner.plan({
              state,
              observation,
            });
  
          expect(
            second.selected?.signature,
          ).not.toBe(
            first.selected.signature,
          );
        },
      );
  
      it(
        'prefers a different semantic action after the same action was executed in another state',
        () => {
          const stateModel =
            new ApplicationStateModel();
      
          const firstObservation:
            PageObservation = {
            ...createObservation(),
      
            title:
              'Todo List',
      
            semanticText: [
              'Todo List',
              'Add Todo',
            ],
      
            ariaSnapshot: `
              - main:
                - heading "Todo List" [level=1]
                - button "Add Todo"
            `,
      
            actions: [
              {
                type:
                  'button',
      
                tagName:
                  'button',
      
                name:
                  'Add Todo',
      
                text:
                  'Add Todo',
      
                disabled:
                  false,
      
                visible:
                  true,
              },
            ],
          };
      
          const firstState =
            stateModel
              .registerObservation(
                firstObservation,
              )
              .state;
      
          const planner =
            new DeterministicExplorationPlanner(
              stateModel,
            );
      
          const firstDecision =
            planner.plan({
              state:
                firstState,
      
              observation:
                firstObservation,
            });
      
          expect(
            firstDecision.selected
              ?.label,
          ).toBe(
            'Add Todo',
          );
      
          if (
            !firstDecision.selected
          ) {
            throw new Error(
              'Expected Add Todo to be selected',
            );
          }
      
          planner.recordActionExecution(
            firstDecision.selected,
          );
      
          const secondObservation:
            PageObservation = {
            ...createObservation(),
      
            title:
              'Todo List',
      
            semanticText: [
              'Todo List',
              'Created Todo',
              'Add Todo',
              'Complete Todo',
            ],
      
            ariaSnapshot: `
              - main:
                - heading "Todo List" [level=1]
                - listitem: Created Todo
                - button "Add Todo"
                - button "Complete Todo"
            `,
      
            actions: [
              {
                type:
                  'button',
      
                tagName:
                  'button',
      
                name:
                  'Add Todo',
      
                text:
                  'Add Todo',
      
                disabled:
                  false,
      
                visible:
                  true,
              },
      
              {
                type:
                  'button',
      
                tagName:
                  'button',
      
                name:
                  'Complete Todo',
      
                text:
                  'Complete Todo',
      
                disabled:
                  false,
      
                visible:
                  true,
              },
            ],
          };
      
          const secondState =
            stateModel
              .registerObservation(
                secondObservation,
              )
              .state;
      
          expect(
            secondState.id,
          ).not.toBe(
            firstState.id,
          );
      
          const secondDecision =
            planner.plan({
              state:
                secondState,
      
              observation:
                secondObservation,
            });
      
          expect(
            secondDecision.selected
              ?.label,
          ).toBe(
            'Complete Todo',
          );
        },
      );
      
      it(
        'uses product context when ranking',
        () => {
          const {
            observation,
            state,
            planner,
          } = setup();
  
          const decision =
            planner.plan({
              state,
  
              observation,
  
              productContext: {
                priorityTerms: [
                  'learn',
                ],
              },
            });
  
          expect(
            decision.selected
              ?.label,
          ).toBe(
            'Learn More',
          );
        },
      );
  
      it(
        'stops when the action budget is reached',
        () => {
          const stateModel =
            new ApplicationStateModel();
  
          const observation =
            createObservation();
  
          const state =
            stateModel
              .registerObservation(
                observation,
              )
              .state;
  
          const planner =
            new DeterministicExplorationPlanner(
              stateModel,
              {
                maxActions: 1,
              },
            );
  
          const first =
            planner.plan({
              state,
              observation,
            });
  
          if (!first.selected) {
            throw new Error(
              'Expected first action',
            );
          }
  
          planner.recordActionExecution(
            first.selected,
          );
  
          const second =
            planner.plan({
              state,
              observation,
            });
  
          expect(
            second.shouldStop,
          ).toBe(true);
  
          expect(
            second.stopReason,
          ).toBe(
            'max-actions-reached',
          );
        },
      );
  
      it(
        'records why actions were selected',
        () => {
          const {
            observation,
            state,
            planner,
          } = setup();
  
          const decision =
            planner.plan({
              state,
              observation,
            });
  
          expect(
            decision.selected
              ?.reasons.length,
          ).toBeGreaterThan(0);
  
          expect(
            planner
              .getDecisionHistory()
              .length,
          ).toBe(1);
        },
      );
      it(
        'blocks disabled actions',
        () => {
          const stateModel =
            new ApplicationStateModel();
      
          const observation =
            createObservation();
      
          const createProject =
            observation.actions.find(
              (action) =>
                action.name ===
                'Create Project',
            );
      
          if (!createProject) {
            throw new Error(
              'Expected Create Project action',
            );
          }
      
          createProject.disabled =
            true;
      
          const state =
            stateModel
              .registerObservation(
                observation,
              )
              .state;
      
          const planner =
            new DeterministicExplorationPlanner(
              stateModel,
            );
      
          const decision =
            planner.plan({
              state,
              observation,
            });
      
          const candidate =
            decision
              .rankedCandidates
              .find(
                (item) =>
                  item.label ===
                  'Create Project',
              );
      
          expect(
            candidate?.blocked,
          ).toBe(true);
      
          expect(
            candidate
              ?.blockReasons,
          ).toContain(
            'Action is disabled',
          );
      
          expect(
            decision.selected
              ?.label,
          ).not.toBe(
            'Create Project',
          );
        },
      );
      
      it(
        'blocks invisible actions',
        () => {
          const stateModel =
            new ApplicationStateModel();
      
          const observation =
            createObservation();
      
          const learnMore =
            observation.actions.find(
              (action) =>
                action.name ===
                'Learn More',
            );
      
          if (!learnMore) {
            throw new Error(
              'Expected Learn More action',
            );
          }
      
          learnMore.visible =
            false;
      
          const state =
            stateModel
              .registerObservation(
                observation,
              )
              .state;
      
          const planner =
            new DeterministicExplorationPlanner(
              stateModel,
            );
      
          const decision =
            planner.plan({
              state,
              observation,
            });
      
          const candidate =
            decision
              .rankedCandidates
              .find(
                (item) =>
                  item.label ===
                  'Learn More',
              );
      
          expect(
            candidate?.blocked,
          ).toBe(true);
      
          expect(
            candidate
              ?.blockReasons,
          ).toContain(
            'Action is not visible',
          );
      
          expect(
            decision.selected
              ?.label,
          ).not.toBe(
            'Learn More',
          );
        },
      );
      
      it(
        'blocks actions that require input data',
        () => {
          const {
            observation,
            state,
            planner,
          } = setup();
      
          const decision =
            planner.plan({
              state,
              observation,
            });
      
          const searchCandidate =
            decision
              .rankedCandidates
              .find(
                (candidate) =>
                  candidate.label ===
                  'Search',
              );
      
          expect(
            searchCandidate,
          ).toBeDefined();
      
          expect(
            searchCandidate
              ?.blocked,
          ).toBe(true);
      
          expect(
            searchCandidate
              ?.blockReasons,
          ).toContain(
            'Action requires grounded form data before it can be executed',
          );
      
          expect(
            decision.selected
              ?.label,
          ).not.toBe(
            'Search',
          );
        },
      );
      
      it(
        'never selects a blocked action even when product context increases its score',
        () => {
          const {
            observation,
            state,
            planner,
          } = setup();
      
          const decision =
            planner.plan({
              state,
      
              observation,
      
              productContext: {
                priorityTerms: [
                  'delete',
                ],
              },
            });
      
          const deleteCandidate =
            decision
              .rankedCandidates
              .find(
                (candidate) =>
                  candidate.label ===
                  'Delete Project',
              );
      
          expect(
            deleteCandidate,
          ).toBeDefined();
      
          expect(
            deleteCandidate
              ?.blocked,
          ).toBe(true);
      
          expect(
            deleteCandidate
              ?.score,
          ).toBeGreaterThan(0);
      
          expect(
            decision.selected
              ?.label,
          ).not.toBe(
            'Delete Project',
          );
      
          expect(
            decision.selected
              ?.blocked,
          ).toBe(false);
        },
      );
      it(
        'uses the contextual OpenAPI operation when creating grounded form execution',
        () => {
          const observation =
            createEmailObservation();
      
          const {
            state,
            planner,
          } =
            setupWithObservation(
              observation,
            );
      
          const knowledge =
            createEmailKnowledge();
      
          const decision =
            planner.plan({
              state,
      
              observation,
      
              knowledge,
      
              apiOperationIds: [
                'createUser',
              ],
            });
      
          const emailCandidate =
            decision
              .rankedCandidates
              .find(
                (candidate) =>
                  candidate.label ===
                  'Email',
              );
      
          expect(
            emailCandidate,
          ).toBeDefined();
      
          expect(
            emailCandidate?.blocked,
          ).toBe(false);
      
          expect(
            emailCandidate
              ?.formExecution,
          ).toEqual(
            expect.objectContaining({
              kind:
                'fill',
      
              value:
                'account@example.com',
            }),
          );
      
          expect(
            emailCandidate
              ?.formExecution
              ?.evidence
              .some(
                (item) =>
                  item.source ===
                  'openapi' &&
                  item.detail.includes(
                    'operations.createUser.requestBody',
                  ),
              ),
          ).toBe(true);
        },
      );
      it(
        'does not guess between conflicting contextual OpenAPI operations',
        () => {
          const observation =
            createEmailObservation();
      
          const {
            state,
            planner,
          } =
            setupWithObservation(
              observation,
            );
      
          const knowledge =
            createEmailKnowledge();
      
          const decision =
            planner.plan({
              state,
      
              observation,
      
              knowledge,
      
              apiOperationIds: [
                'createUser',
                'inviteUser',
              ],
            });
      
          const emailCandidate =
            decision
              .rankedCandidates
              .find(
                (candidate) =>
                  candidate.label ===
                  'Email',
              );
      
          expect(
            emailCandidate,
          ).toBeDefined();
      
          expect(
            emailCandidate
              ?.formExecution
              ?.kind,
          ).toBe(
            'fill',
          );
          
          expect(
            emailCandidate
              ?.formExecution
              ?.kind ===
            'fill'
              ? emailCandidate
                  .formExecution
                  .value
              : undefined,
          ).not.toBe(
            'account@example.com',
          );
          
          expect(
            emailCandidate
              ?.formExecution
              ?.kind ===
            'fill'
              ? emailCandidate
                  .formExecution
                  .value
              : undefined,
          ).not.toBe(
            'invite@example.com',
          );
          
          expect(
            emailCandidate
              ?.formExecution
              ?.evidence
              .some(
                (item) =>
                  item.source ===
                  'openapi',
              ),
          ).toBe(false);
      
          expect(
            emailCandidate
              ?.formExecution
              ?.kind ===
            'fill'
              ? emailCandidate
                  .formExecution
                  .value
              : undefined,
          ).not.toBe(
            'account@example.com',
          );
      
          expect(
            emailCandidate
              ?.formExecution
              ?.kind ===
            'fill'
              ? emailCandidate
                  .formExecution
                  .value
              : undefined,
          ).not.toBe(
            'invite@example.com',
          );
        },
      );

      it(
        'preserves safe global OpenAPI fallback when runtime operation context is unavailable',
        () => {
          const observation =
            createEmailObservation();
      
          const {
            state,
            planner,
          } =
            setupWithObservation(
              observation,
            );
      
          const knowledge =
            createEmailKnowledge(
              false,
            );
      
          const decision =
            planner.plan({
              state,
      
              observation,
      
              knowledge,
            });
      
          const emailCandidate =
            decision
              .rankedCandidates
              .find(
                (candidate) =>
                  candidate.label ===
                  'Email',
              );
      
          expect(
            emailCandidate,
          ).toBeDefined();
      
          expect(
            emailCandidate
              ?.formExecution,
          ).toEqual(
            expect.objectContaining({
              kind:
                'fill',
      
              value:
                'account@example.com',
            }),
          );
        },
      );
      it(
        'keeps observable UI constraints authoritative over contextual OpenAPI data',
        () => {
          const observation =
            createObservation();
      
          observation.actions.push({
            type:
              'input',
      
            tagName:
              'input',
      
            name:
              'Seats',
      
            inputType:
              'number',
      
            disabled:
              false,
      
            visible:
              true,
      
            formField: {
              htmlName:
                'seats',
      
              inputType:
                'number',
      
              required:
                true,
      
              min:
                '1',
      
              max:
                '10',
      
              step:
                '1',
            },
          });
      
          const knowledge:
            KnowledgeContext = {
            requirements:
              null,
      
            openApi: {
              sourcePath:
                '/fixtures/openapi.yaml',
      
              title:
                'Booking API',
      
              version:
                '1.0.0',
      
              servers: [],
      
              operations: [
                {
                  operationId:
                    'createBooking',
      
                  method:
                    'POST',
      
                  path:
                    '/bookings',
      
                  parameters: [],
      
                  requestBody: {
                    content: {
                      'application/json': {
                        schema: {
                          $ref:
                            '#/components/schemas/CreateBookingRequest',
                        },
                      },
                    },
                  },
      
                  responses: [],
      
                  security: [],
      
                  tags: [],
                },
              ],
      
              schemas: {
                CreateBookingRequest: {
                  type:
                    'object',
      
                  required: [
                    'seats',
                  ],
      
                  properties: {
                    seats: {
                      type:
                        'integer',
      
                      minimum:
                        5,
      
                      maximum:
                        30,
      
                      example:
                        20,
                    },
                  },
                },
              },
            },
          };
      
          const {
            state,
            planner,
          } =
            setupWithObservation(
              observation,
            );
      
          const decision =
            planner.plan({
              state,
      
              observation,
      
              knowledge,
      
              apiOperationIds: [
                'createBooking',
              ],
            });
      
          const seatsCandidate =
            decision
              .rankedCandidates
              .find(
                (candidate) =>
                  candidate.label ===
                  'Seats',
              );
      
          expect(
            seatsCandidate,
          ).toBeDefined();
      
          expect(
            seatsCandidate
              ?.formExecution
              ?.kind,
          ).toBe(
            'fill',
          );
      
          const generatedValue =
            seatsCandidate
              ?.formExecution
              ?.kind ===
            'fill'
              ? seatsCandidate
                  .formExecution
                  .value
              : undefined;
      
          expect(
            typeof generatedValue,
          ).toBe(
            'string',
          );
      
          expect(
            Number(
              generatedValue,
            ),
          ).toBeGreaterThanOrEqual(
            1,
          );
      
          expect(
            generatedValue,
          ).not.toBe(
            '20',
          );
      
          expect(
            seatsCandidate
              ?.formExecution
              ?.evidence
              .some(
                (item) =>
                  item.source ===
                  'ui',
              ),
          ).toBe(true);
        },
      );
    },
  );