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

      it(
        'creates deterministic file upload execution from observed accept constraints',
        () => {
          const observation =
            createObservation();

          observation.actions.push({
            type:
              'input',

            tagName:
              'input',

            name:
              'Upload file',

            inputType:
              'file',

            disabled:
              false,

            visible:
              true,

            formField: {
              inputType:
                'file',

              required:
                true,

              accept:
                '.txt',
            },
          });

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
            });

          const uploadCandidate =
            decision
              .rankedCandidates
              .find(
                (candidate) =>
                  candidate.label ===
                  'Upload file',
              );

          expect(
            uploadCandidate
              ?.blocked,
          ).toBe(false);

          expect(
            uploadCandidate
              ?.formExecution,
          ).toEqual(
            expect.objectContaining({
              kind:
                'upload-file',

              file: {
                name:
                  'toverni-test.txt',

                mimeType:
                  'text/plain',

                content:
                  'Toverni deterministic upload fixture',
              },
            }),
          );
        },
      );


      it(
        'executes a sensitive field only when an explicit OpenAPI example grounds the value',
        () => {
          const observation:
            PageObservation = {
            ...createObservation(),

            actions: [
              {
                type:
                  'input',

                tagName:
                  'input',

                name:
                  'Password',

                inputType:
                  'password',

                disabled:
                  false,

                visible:
                  true,

                formField: {
                  htmlName:
                    'password',

                  inputType:
                    'password',

                  required:
                    true,

                  value:
                    '',
                },
              },
            ],
          };

          const {
            state,
            planner,
          } =
            setupWithObservation(
              observation,
            );

          const knowledge:
            KnowledgeContext = {
            requirements:
              null,

            openApi: {
              sourcePath:
                '/fixtures/auth.yaml',

              title:
                'Auth API',

              version:
                '1.0.0',

              servers: [],

              operations: [
                {
                  operationId:
                    'createSession',

                  method:
                    'POST',

                  path:
                    '/api/session',

                  parameters: [],

                  requestBody: {
                    content: {
                      'application/json': {
                        schema: {
                          $ref:
                            '#/components/schemas/SessionRequest',
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
                SessionRequest: {
                  type:
                    'object',

                  required: [
                    'password',
                  ],

                  properties: {
                    password: {
                      type:
                        'string',

                      example:
                        'pass',
                    },
                  },
                },
              },
            },
          };

          const decision =
            planner.plan({
              state,

              observation,

              knowledge,

              apiOperationIds: [
                'createSession',
              ],
            });

          expect(
            decision.selected
              ?.label,
          ).toBe(
            'Password',
          );

          expect(
            decision.selected
              ?.formExecution,
          ).toMatchObject({
            kind:
              'fill',

            value:
              'pass',
          });

          expect(
            decision.selected
              ?.blocked,
          ).toBe(false);
        },
      );


      it(
        'explores a requirement-grounded invalid sensitive value before recovering to the allowed value',
        () => {
          const knowledge:
            KnowledgeContext = {
            requirements: {
              sourcePath:
                '/fixtures/checkout-requirements.md',

              acceptanceCriteria: [
                'Invalid card input shows a validation error.',
                'A valid local test card opens an order confirmation dialog.',
              ],

              userRoles: [],

              capabilities: [
                'Local payment-like validation.',
              ],

              constraints: [
                'Card values other than 4242424242424242 are rejected.',
              ],

              domainTerms: [
                'card',
              ],

              rawText:
                'Card values other than 4242424242424242 are rejected.',
            },

            openApi:
              null,
          };

          const emptyObservation:
            PageObservation = {
            ...createObservation(),

            actions: [
              {
                type:
                  'input',

                tagName:
                  'input',

                name:
                  'Card number',

                inputType:
                  'text',

                disabled:
                  false,

                visible:
                  true,

                formField: {
                  inputType:
                    'text',

                  required:
                    false,

                  value:
                    '',
                },
              },
            ],
          };

          const {
            state,
            planner,
          } =
            setupWithObservation(
              emptyObservation,
            );

          const negativeDecision =
            planner.plan({
              state,

              observation:
                emptyObservation,

              knowledge,
            });

          expect(
            negativeDecision.selected
              ?.formExecution,
          ).toMatchObject({
            kind:
              'fill',
          });

          const negativeValue =
            negativeDecision.selected
              ?.formExecution
              ?.kind ===
              'fill'
                ? negativeDecision.selected
                    .formExecution.value
                : undefined;

          expect(
            negativeValue,
          ).toBeDefined();

          expect(
            negativeValue,
          ).not.toBe(
            '4242424242424242',
          );

          const invalidObservation:
            PageObservation = {
            ...emptyObservation,

            actions:
              emptyObservation.actions.map(
                (action) => ({
                  ...action,

                  formField:
                    action.formField
                      ? {
                          ...action.formField,

                          value:
                            negativeValue ??
                            '',
                        }
                      : undefined,
                }),
              ),
          };

          const invalidState =
            setupWithObservation(
              invalidObservation,
            ).state;

          const recoveryDecision =
            planner.plan({
              state:
                invalidState,

              observation:
                invalidObservation,

              knowledge,
            });

          const card =
            recoveryDecision
              .rankedCandidates
              .find(
                (candidate) =>
                  candidate.label ===
                  'Card number',
              );

          expect(
            card?.formExecution,
          ).toMatchObject({
            kind:
              'fill',

            value:
              '4242424242424242',
          });
        },
      );


      it(
        'recovers a sensitive field to the sole allowed test value when a prior value is present',
        () => {
          const observation:
            PageObservation = {
            ...createObservation(),

            actions: [
              {
                type:
                  'input',

                tagName:
                  'input',

                name:
                  'Card number',

                inputType:
                  'text',

                disabled:
                  false,

                visible:
                  true,

                formField: {
                  inputType:
                    'text',

                  required:
                    false,

                  value:
                    '4242424242424240',
                },
              },
            ],
          };

          const {
            state,
            planner,
          } =
            setupWithObservation(
              observation,
            );

          const knowledge:
            KnowledgeContext = {
            requirements: {
              sourcePath:
                '/fixtures/checkout-requirements.md',

              acceptanceCriteria: [
                'A valid local test card opens an order confirmation dialog.',
              ],

              userRoles: [],

              capabilities: [
                'Local payment-like validation.',
              ],

              constraints: [
                'Card values other than 4242424242424242 are rejected.',
              ],

              domainTerms: [
                'card',
              ],

              rawText:
                'Card values other than 4242424242424242 are rejected.',
            },

            openApi:
              null,
          };

          const decision =
            planner.plan({
              state,
              observation,
              knowledge,
            });

          const card =
            decision
              .rankedCandidates
              .find(
                (candidate) =>
                  candidate.label ===
                  'Card number',
              );

          expect(
            card?.formExecution,
          ).toMatchObject({
            kind:
              'fill',

            value:
              '4242424242424242',
          });

          expect(
            card?.blocked,
          ).toBe(false);
        },
      );


      it(
        'keeps a sensitive field blocked without explicit value evidence',
        () => {
          const observation:
            PageObservation = {
            ...createObservation(),

            actions: [
              {
                type:
                  'input',

                tagName:
                  'input',

                name:
                  'Password',

                inputType:
                  'password',

                disabled:
                  false,

                visible:
                  true,

                formField: {
                  htmlName:
                    'password',

                  inputType:
                    'password',

                  required:
                    true,

                  value:
                    '',
                },
              },
            ],
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
            });

          const password =
            decision
              .rankedCandidates[0];

          expect(
            password?.blocked,
          ).toBe(true);

          expect(
            password
              ?.blockReasons
              .some(
                (reason) =>
                  reason.includes(
                    'explicit trusted test value',
                  ),
              ),
          ).toBe(true);
        },
      );


      it(
        'probes a requirement-grounded required field before autofill and then recovers',
        () => {
          const knowledge:
            KnowledgeContext = {
            requirements: {
              sourcePath:
                '/fixtures/checkout-requirements.md',

              acceptanceCriteria: [
                'Checkout requires a customer name before continuing.',
              ],

              userRoles: [],

              capabilities: [
                'Multi-step checkout.',
              ],

              constraints: [
                'Empty required fields cannot advance.',
              ],

              domainTerms: [
                'checkout',
                'customer',
                'name',
              ],

              rawText:
                'Checkout requires a customer name before continuing.',
            },

            openApi:
              null,
          };

          const observation:
            PageObservation = {
            ...createObservation(),

            actions: [
              {
                type:
                  'input',

                tagName:
                  'input',

                name:
                  'Customer name',

                inputType:
                  'text',

                disabled:
                  false,

                visible:
                  true,

                formField: {
                  inputType:
                    'text',

                  required:
                    false,

                  value:
                    '',
                },
              },

              {
                type:
                  'button',

                tagName:
                  'button',

                name:
                  'Continue',

                text:
                  'Continue',

                disabled:
                  false,

                visible:
                  true,
              },
            ],
          };

          const {
            state,
            planner,
          } =
            setupWithObservation(
              observation,
            );

          const validationDecision =
            planner.plan({
              state,

              observation,

              knowledge,
            });

          expect(
            validationDecision.selected
              ?.label,
          ).toBe(
            'Continue',
          );

          planner.recordActionExecution(
            validationDecision.selected!,
          );

          const validationObservation:
            PageObservation = {
            ...observation,

            semanticText: [
              'Checkout',
              'Name is required',
            ],
          };

          const validationState =
            setupWithObservation(
              validationObservation,
            ).state;

          const recoveryDecision =
            planner.plan({
              state:
                validationState,

              observation:
                validationObservation,

              knowledge,
            });

          expect(
            recoveryDecision.selected
              ?.label,
          ).toBe(
            'Customer name',
          );

          expect(
            recoveryDecision.selected
              ?.formExecution,
          ).toMatchObject({
            kind:
              'fill',
          });
        },
      );


      it(
        'derives search and filter values from observed table data',
        () => {
          const knowledge:
            KnowledgeContext = {
            requirements: {
              sourcePath:
                '/fixtures/data-grid/requirements.md',

              acceptanceCriteria: [
                'Search filters rows by customer name.',
                'Status filtering shows only matching rows.',
              ],

              userRoles: [],

              capabilities: [
                'Search and filter.',
              ],

              constraints: [],

              domainTerms: [
                'search',
                'status',
                'customer',
              ],

              rawText:
                'Search filters rows by customer name. Status filtering shows only matching rows.',
            },

            openApi:
              null,
          };

          const observation:
            PageObservation = {
            ...createObservation(),

            semanticText: [
              'Orders',
              'Customer\tStatus\tAmount',
              'Bob\tPending\t10',
              'Dan\tPending\t20',
            ],

            actions: [
              {
                type:
                  'input',

                tagName:
                  'input',

                name:
                  'Search customers',

                inputType:
                  'text',

                disabled:
                  false,

                visible:
                  true,

                formField: {
                  inputType:
                    'text',

                  required:
                    false,

                  value:
                    '',
                },
              },

              {
                type:
                  'select',

                tagName:
                  'select',

                name:
                  'Status filter',

                disabled:
                  false,

                visible:
                  true,

                formField: {
                  required:
                    false,

                  multiple:
                    false,

                  value:
                    'All',

                  options: [
                    {
                      value:
                        'All',

                      label:
                        'All',

                      disabled:
                        false,

                      selected:
                        true,
                    },

                    {
                      value:
                        'Paid',

                      label:
                        'Paid',

                      disabled:
                        false,

                      selected:
                        false,
                    },

                    {
                      value:
                        'Pending',

                      label:
                        'Pending',

                      disabled:
                        false,

                      selected:
                        false,
                    },
                  ],
                },
              },
            ],
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
            });

          const search =
            decision
              .rankedCandidates
              .find(
                (candidate) =>
                  candidate.label ===
                    'Search customers',
              );

          const filter =
            decision
              .rankedCandidates
              .find(
                (candidate) =>
                  candidate.label ===
                    'Status filter',
              );

          expect(
            search?.formExecution,
          ).toMatchObject({
            kind:
              'fill',

            value:
              'Bob',
          });

          expect(
            filter?.formExecution,
          ).toMatchObject({
            kind:
              'select',

            value:
              'Pending',
          });
        },
      );


      it(
        'prioritizes requirement-grounded data controls before generic empty text setup',
        () => {
          const knowledge:
            KnowledgeContext = {
            requirements: {
              sourcePath:
                '/fixtures/data-grid/requirements.md',

              acceptanceCriteria: [
                'Sorting by amount toggles ascending and descending order.',
                'Pagination changes the visible result set.',
                'Refresh updates the table status using a local API-like update.',
              ],

              userRoles: [],

              capabilities: [
                'Sort dynamic table.',
                'Paginate results.',
                'Refresh API-driven status.',
              ],

              constraints: [],

              domainTerms: [
                'sort',
                'page',
                'refresh',
              ],

              rawText:
                'Sort, paginate, and refresh the data grid.',
            },

            openApi:
              null,
          };

          const observation:
            PageObservation = {
            ...createObservation(),

            actions: [
              {
                type:
                  'input',

                tagName:
                  'input',

                name:
                  'Search customers',

                inputType:
                  'text',

                disabled:
                  false,

                visible:
                  true,

                formField: {
                  inputType:
                    'text',

                  required:
                    false,

                  value:
                    '',
                },
              },

              {
                type:
                  'button',

                tagName:
                  'button',

                name:
                  'Sort Amount',

                text:
                  'Sort Amount',

                disabled:
                  false,

                visible:
                  true,
              },
            ],
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
            });

          expect(
            decision.selected
              ?.label,
          ).toBe(
            'Sort Amount',
          );
        },
      );


      it(
        'prioritizes unfilled grounded form setup before a submit button',
        () => {
          const observation:
            PageObservation = {
            ...createObservation(),

            actions: [
              {
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

                  value:
                    '',
                },
              },

              {
                type:
                  'button',

                tagName:
                  'button',

                name:
                  'Sign In',

                text:
                  'Sign In',

                disabled:
                  false,

                visible:
                  true,
              },
            ],
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
            });

          expect(
            decision.selected
              ?.label,
          ).toBe(
            'Email',
          );
        },
      );


      it('prioritizes grounded login inputs ahead of submit and navigation', () => {
        const observation: PageObservation = {
          ...createObservation(),
          url: 'https://example.com/login',
          title: 'Login',
          actions: [
            { type: 'link', tagName: 'a', name: 'About', text: 'About',
              href: 'https://example.com/about', disabled: false, visible: true },
            { type: 'input', tagName: 'input', name: 'Email', inputType: 'email',
              formField: { htmlName: 'email', inputType: 'email', required: true, value: '' },
              disabled: false, visible: true },
            { type: 'button', tagName: 'button', name: 'Login', text: 'Login',
              disabled: false, visible: true },
          ],
        };
        const { state, planner } = setupWithObservation(observation);
        const decision = planner.plan({ state, observation,
          productContext: { targetOrigin: 'https://example.com' } });
        expect(decision.selected?.label).toBe('Email');
        expect(decision.selected?.formExecution?.kind).toBe('fill');
      });

      it('requires both approved login fields before enabling submission', () => {
        const observation: PageObservation = {
          ...createObservation(),
          url: 'https://example.com/login',
          actions: [
            { type: 'input', tagName: 'input', name: 'Username', inputType: 'text',
              formField: { inputType: 'text', value: 'practice', required: true },
              disabled: false, visible: true },
            { type: 'input', tagName: 'input', name: 'Password', inputType: 'password',
              formField: { inputType: 'password', value: '', required: true },
              disabled: false, visible: true },
            { type: 'button', tagName: 'button', name: 'Login', text: 'Login',
              disabled: false, visible: true },
          ],
        };
        const { state, planner } = setupWithObservation(observation);
        const decision = planner.plan({
          state, observation,
          approvedFixtureFields: new Set(['username', 'password']),
          productContext: { targetOrigin: 'https://example.com' },
        });
        expect(decision.selected?.label).toBe('Password');
        expect(decision.selected?.blocked).toBe(false);
        expect(decision.rankedCandidates.find(candidate =>
          candidate.label === 'Login')?.blocked).toBe(true);
        expect(decision.rankedCandidates.find(candidate =>
          candidate.label === 'Password')?.formExecution?.value).not.toBe('SuperSecretPassword!');
      });

      it('prioritizes grounded form fields over generic links on other form pages', () => {
        const observation: PageObservation = {
          ...createObservation(),
          url: 'https://example.com/contact',
          actions: [
            { type: 'link', tagName: 'a', name: 'About', text: 'About',
              href: 'https://example.com/about', disabled: false, visible: true },
            { type: 'input', tagName: 'input', name: 'Email', inputType: 'email',
              formField: { htmlName: 'email', inputType: 'email', required: true, value: '' },
              disabled: false, visible: true },
            { type: 'button', tagName: 'button', name: 'Submit', text: 'Submit',
              disabled: false, visible: true },
          ],
        };
        const { state, planner } = setupWithObservation(observation);
        const decision = planner.plan({ state, observation,
          productContext: { targetOrigin: 'https://example.com' } });
        expect(decision.selected?.label).toBe('Email');
        expect(decision.selected?.formExecution?.kind).toBe('fill');
      });

      it('organizes exploration candidates into inspectable functional branches', () => {
        const observation: PageObservation = {
          ...createObservation(),
          url: 'https://example.com/login',
          actions: [
            { type: 'input', tagName: 'input', name: 'Username',
              inputType: 'text', formField: { htmlName: 'username',
                inputType: 'text', value: '', required: true },
              visible: true, disabled: false },
            { type: 'button', tagName: 'button', name: 'Login',
              text: 'Login', visible: true, disabled: false },
            { type: 'link', tagName: 'a', name: 'About',
              href: 'https://example.com/about', visible: true, disabled: false },
          ],
        };
        const { state, planner } = setupWithObservation(observation);
        const decision = planner.plan({ state, observation,
          productContext: { targetOrigin: 'https://example.com' } });
        expect(decision.functionalTree?.stateId).toBe(state.id);
        expect(decision.selected?.label).toBe('Username');
        const branches = decision.functionalTree!.branches;
        expect(branches.find(b => b.kind === 'form-setup')?.candidateIds).toHaveLength(1);
        expect(branches.find(b => b.kind === 'submission')?.candidateIds).toHaveLength(1);
        expect(branches.find(b => b.kind === 'navigation')?.candidateIds).toHaveLength(1);
        const all = branches.flatMap(b => b.candidateIds);
        expect(new Set(all).size).toBe(all.length);
      });

      it('prioritizes login submission over generic navigation', () => {
        const observation: PageObservation = {
          ...createObservation(),
          url: 'https://example.com/login',
          title: 'Login',
          actions: [
            { type: 'link', tagName: 'a', name: 'About', text: 'About',
              href: 'https://example.com/about', disabled: false, visible: true },
            { type: 'button', tagName: 'button', name: 'Login', text: 'Login',
              disabled: false, visible: true },
          ],
        };
        const { state, planner } = setupWithObservation(observation);
        const decision = planner.plan({ state, observation,
          productContext: { targetOrigin: 'https://example.com' } });
        expect(decision.selected?.label).toBe('Login');
      });

      it(
        'blocks external navigation while keeping same-origin links eligible',
        () => {
          const observation:
            PageObservation = {
            ...createObservation(),

            actions: [
              {
                type:
                  'link',

                tagName:
                  'a',

                name:
                  'Register',

                text:
                  'Register',

                href:
                  'https://example.com/register',

                disabled:
                  false,

                visible:
                  true,
              },

              {
                type:
                  'link',

                tagName:
                  'a',

                name:
                  'External Docs',

                text:
                  'External Docs',

                href:
                  'https://docs.example.net/start',

                disabled:
                  false,

                visible:
                  true,
              },
            ],
          };

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

          const decision =
            planner.plan({
              state,

              observation,

              productContext: {
                targetOrigin:
                  'https://example.com',
              },
            });

          const register =
            decision
              .rankedCandidates
              .find(
                (candidate) =>
                  candidate.label ===
                    'Register',
              );

          const external =
            decision
              .rankedCandidates
              .find(
                (candidate) =>
                  candidate.label ===
                    'External Docs',
              );

          expect(
            register?.blocked,
          ).toBe(false);

          expect(
            external?.blocked,
          ).toBe(true);

          expect(
            external
              ?.blockReasons
              .some(
                (reason) =>
                  reason.includes(
                    'outside the autonomous exploration origin',
                  ),
              ),
          ).toBe(true);

          expect(
            decision.selected
              ?.label,
          ).toBe(
            'Register',
          );
        },
      );


      it(
        'treats sign out as reversible session navigation rather than destructive data mutation',
        () => {
          const observation:
            PageObservation = {
            ...createObservation(),

            actions: [
              {
                type:
                  'button',

                tagName:
                  'button',

                name:
                  'Sign Out',

                text:
                  'Sign Out',

                disabled:
                  false,

                visible:
                  true,
              },
            ],
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
            });

          expect(
            decision.selected
              ?.label,
          ).toBe(
            'Sign Out',
          );

          expect(
            decision.selected
              ?.blocked,
          ).toBe(false);
        },
      );

    },
  );