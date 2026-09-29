import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import type {
    BrowserSession,
} from '../browser/index.js';

import type {
    KnowledgeContext,
} from '../knowledge/knowledge-contracts.js';

import {
    ApplicationStateModel,
} from '../state/index.js';

import {
    DeterministicExplorationPlanner,
} from './deterministic-exploration-planner.js';

import {
    runExplorationLoop,
    type RunExplorationLoopInput,
} from './run-exploration-loop.js';

type Observation =
    Awaited<
        ReturnType<
            BrowserSession['observe']
        >
    >;

function createObservation(
    input: {
        semanticText: string[];
        actionName: string;
    },
): Observation {
    return {
        capturedAt:
            new Date().toISOString(),

        url:
            'http://example.test/',

        title:
            'Exploration Test',

        semanticText:
            input.semanticText,

        ariaSnapshot:
            [
                '- main:',
                `  - button "${input.actionName}"`,
            ].join('\n'),

        actions: [
            {
                type:
                    'button',

                tagName:
                    'button',

                name:
                    input.actionName,

                text:
                    input.actionName,

                disabled:
                    false,

                visible:
                    true,
            },
        ],

        consoleEvents:
            [],

        networkEvents:
            [],

        supportingArtifacts:
            [],
    };
}

function createEmailObservation():
  Observation {
  return {
    capturedAt:
      '2026-09-29T00:00:00.000Z',

    url:
      'http://example.test/users',

    title:
      'Create User',

    semanticText: [
      'Create User',
      'Email',
    ],

    ariaSnapshot: [
      '- main:',
      '  - textbox "Email"',
    ].join('\n'),

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
        },
      },
    ],

    consoleEvents: [],

    networkEvents: [
      {
        id:
          'request-create-user',

        method:
          'POST',

        url:
          'http://example.test/users',

        resourceType:
          'fetch',

        status:
          200,

        ok:
          true,

        failed:
          false,
      },
    ],

    supportingArtifacts: [],
  };
}

function createInviteObservationWithCumulativeNetwork():
  Observation {
  return {
    capturedAt:
      '2026-09-29T00:00:01.000Z',

    url:
      'http://example.test/invitations',

    title:
      'Invite User',

    semanticText: [
      'Invite User',
      'Email',
    ],

    ariaSnapshot: [
      '- main:',
      '  - textbox "Email"',
    ].join('\n'),

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
        },
      },
    ],

    consoleEvents: [],

    // Intentionally cumulative.
    // request-create-user belongs to
    // the PREVIOUS observation.
    networkEvents: [
      {
        id:
          'request-create-user',

        method:
          'POST',

        url:
          'http://example.test/users',

        resourceType:
          'fetch',

        status:
          200,

        ok:
          true,

        failed:
          false,
      },

      {
        id:
          'request-invite-user',

        method:
          'POST',

        url:
          'http://example.test/invitations',

        resourceType:
          'fetch',

        status:
          200,

        ok:
          true,

        failed:
          false,
      },
    ],

    supportingArtifacts: [],
  };
}

function createCompletedObservation():
  Observation {
  return {
    capturedAt:
      '2026-09-29T00:00:01.000Z',

    url:
      'http://example.test/users',

    title:
      'Create User',

    semanticText: [
      'Create User',
      'Email entered',
    ],

    ariaSnapshot:
      '- main:',

    actions: [],

    consoleEvents: [],

    networkEvents: [],

    supportingArtifacts: [],
  };
}

function createRuntimeKnowledge():
  KnowledgeContext {
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
      },
    },
  };
}

describe(
    'runExplorationLoop',
    () => {
        it(
            'executes multiple actions and persists linked transitions',
            async () => {
                // --------------------------------
                // Observations
                // --------------------------------

                const stateA =
                    createObservation({
                        semanticText: [
                            'Page A',
                            'Next',
                        ],

                        actionName:
                            'Next',
                    });

                const stateB =
                    createObservation({
                        semanticText: [
                            'Page B',
                            'Back',
                        ],

                        actionName:
                            'Back',
                    });

                /*
                 * Flow:
                 *
                 * State A
                 *   ↓ Next
                 * State B
                 *   ↓ Back
                 * State A
                 *
                 * When State A appears again,
                 * Next was already executed
                 * in this state.
                 *
                 * Planner should stop.
                 */

                const observations = [
                    stateA,
                    stateB,
                    stateA,
                ];

                let observationIndex =
                    0;

                // --------------------------------
                // Fake browser session
                // --------------------------------

                const observe =
                    vi.fn(
                        async () => {
                            const observation =
                                observations[
                                observationIndex
                                ];

                            if (
                                !observation
                            ) {
                                throw new Error(
                                    'Unexpected observation request',
                                );
                            }

                            observationIndex +=
                                1;

                            return observation;
                        },
                    );

                const click =
                    vi.fn(
                        async () => {
                            // Browser side-effect is
                            // represented by the next
                            // observation.
                        },
                    );

                const session =
                    {
                        observe,
                        click,
                    } as unknown as
                    BrowserSession;

                // --------------------------------
                // State model
                // --------------------------------

                const stateModel =
                    new ApplicationStateModel();

                // --------------------------------
                // Planner
                // --------------------------------

                const planner =
                    new DeterministicExplorationPlanner(
                        stateModel,
                        {
                            maxActions:
                                10,

                            maxActionsPerState:
                                5,

                            maxStates:
                                10,
                        },
                    );

                // --------------------------------
                // Persistence spies
                // --------------------------------

                const savedTransitions:
                    Array<{
                        actionId:
                        string | null;

                        transition: {
                            action: {
                                type:
                                string;

                                target?:
                                string | null;
                            };

                            equivalentState:
                            boolean;
                        };
                    }> = [];

                const saveState =
                    vi.fn(
                        async (
                            _applicationId:
                                string,

                            state: {
                                id:
                                string;
                            },
                        ) => {
                            return {
                                id:
                                    state.id,
                            };
                        },
                    );

                const saveObservationEvidence =
                    vi.fn(
                        async () => {
                            // No-op.
                        },
                    );

                let decisionNumber =
                    0;

                let actionNumber =
                    0;

                const saveDecision =
                    vi.fn(
                        async (
                            _runId:
                                string,

                            _stateId:
                                string,

                            decision: {
                                selected:
                                unknown | null;
                            },
                        ) => {
                            decisionNumber +=
                                1;

                            const selectedActionId =
                                decision.selected
                                    ? `action-${++actionNumber}`
                                    : null;

                            return {
                                decision: {
                                    id:
                                        `decision-${decisionNumber}`,
                                },

                                selectedActionId,
                            };
                        },
                    );

                const saveTransition =
                    vi.fn(
                        async (
                            input: {
                                actionId:
                                string | null;

                                transition: {
                                    action: {
                                        type:
                                        string;

                                        target?:
                                        string | null;
                                    };

                                    equivalentState:
                                    boolean;
                                };
                            },
                        ) => {
                            savedTransitions.push(
                                input,
                            );
                        },
                    );

                const repository =
                    {
                        saveState,

                        saveObservationEvidence,

                        saveDecision,

                        saveTransition,
                    } as unknown as
                    RunExplorationLoopInput[
                    'repository'
                    ];

                // --------------------------------
                // Execute exploration
                // --------------------------------

                const result =
                    await runExplorationLoop({
                        session,

                        stateModel,

                        planner,

                        repository,

                        applicationId:
                            'application-1',

                        runId:
                            'run-1',

                        priorityTerms:
                            [],
                    });

                // --------------------------------
                // Verify browser execution
                // --------------------------------

                expect(
                    result.executedActions,
                ).toBe(2);

                expect(
                    click,
                ).toHaveBeenCalledTimes(
                    2,
                );

                /*
                 * Initial observation
                 * + after Next
                 * + after Back
                 */
                expect(
                    observe,
                ).toHaveBeenCalledTimes(
                    3,
                );

                // --------------------------------
                // Verify planner decisions
                // --------------------------------

                /*
                 * Decision 1 -> Next
                 * Decision 2 -> Back
                 * Decision 3 -> Stop
                 */
                expect(
                    saveDecision,
                ).toHaveBeenCalledTimes(
                    3,
                );

                // --------------------------------
                // Verify transitions
                // --------------------------------

                expect(
                    saveTransition,
                ).toHaveBeenCalledTimes(
                    2,
                );

                expect(
                    savedTransitions,
                ).toHaveLength(
                    2,
                );

                // --------------------------------
                // Verify action FK linkage
                // --------------------------------

                expect(
                    savedTransitions[0]
                        ?.actionId,
                ).toBe(
                    'action-1',
                );

                expect(
                    savedTransitions[1]
                        ?.actionId,
                ).toBe(
                    'action-2',
                );

                // --------------------------------
                // Verify action order
                // --------------------------------

                expect(
                    savedTransitions[0]
                        ?.transition
                        .action
                        .target,
                ).toBe(
                    'Next',
                );

                expect(
                    savedTransitions[1]
                        ?.transition
                        .action
                        .target,
                ).toBe(
                    'Back',
                );

                // --------------------------------
                // Verify real state transitions
                // --------------------------------

                expect(
                    savedTransitions[0]
                        ?.transition
                        .equivalentState,
                ).toBe(false);

                expect(
                    savedTransitions[1]
                        ?.transition
                        .equivalentState,
                ).toBe(false);

                // --------------------------------
                // Verify deterministic stop
                // --------------------------------

                expect(
                    result.stopReason,
                ).toBe(
                    'no-eligible-actions',
                );

                expect(
                    result.finalObservation,
                ).toEqual(
                    stateA,
                );
            },
        );
        it(
            'derives contextual OpenAPI operation from runtime network evidence',
            async () => {
              const initialObservation =
                createEmailObservation();
          
              const completedObservation =
                createCompletedObservation();
          
              const observations = [
                initialObservation,
                completedObservation,
              ];
          
              let observationIndex =
                0;
          
              const observe =
                vi.fn(
                  async () => {
                    const observation =
                      observations[
                        observationIndex
                      ];
          
                    if (!observation) {
                      throw new Error(
                        'Unexpected observation request',
                      );
                    }
          
                    observationIndex +=
                      1;
          
                    return observation;
                  },
                );
          
              const fill =
                vi.fn(
                  async () => {
                    // Browser side effect represented
                    // by next observation.
                  },
                );
          
              const session = {
                observe,
                fill,
              } as unknown as
                BrowserSession;
          
              const stateModel =
                new ApplicationStateModel();
          
              const planner =
                new DeterministicExplorationPlanner(
                  stateModel,
                );
          
              const saveState =
                vi.fn(
                  async (
                    _applicationId:
                      string,
          
                    state: {
                      id:
                        string;
                    },
                  ) => ({
                    id:
                      state.id,
                  }),
                );
          
              const saveObservationEvidence =
                vi.fn(
                  async () => {
                    // No-op.
                  },
                );
          
              let decisionNumber =
                0;
          
              let actionNumber =
                0;
          
              const saveDecision =
                vi.fn(
                  async (
                    _runId:
                      string,
          
                    _stateId:
                      string,
          
                    decision: {
                      selected:
                        unknown | null;
                    },
                  ) => {
                    decisionNumber +=
                      1;
          
                    return {
                      decision: {
                        id:
                          `decision-${decisionNumber}`,
                      },
          
                      selectedActionId:
                        decision.selected
                          ? `action-${++actionNumber}`
                          : null,
                    };
                  },
                );
          
              const saveTransition =
                vi.fn(
                  async () => {
                    // No-op.
                  },
                );
          
              const repository = {
                saveState,
                saveObservationEvidence,
                saveDecision,
                saveTransition,
              } as unknown as
                RunExplorationLoopInput[
                  'repository'
                ];
          
              const knowledge =
                createRuntimeKnowledge();
          
              const result =
                await runExplorationLoop({
                  session,
          
                  stateModel,
          
                  planner,
          
                  repository,
          
                  applicationId:
                    'application-1',
          
                  runId:
                    'run-openapi-context',
          
                  priorityTerms: [],
          
                  knowledge,
                });
          
              expect(
                fill,
              ).toHaveBeenCalledTimes(
                1,
              );
          
              expect(
                fill,
              ).toHaveBeenCalledWith(
                {
                  by:
                    'label',
          
                  label:
                    'Email',
          
                  exact:
                    true,
                },
          
                'account@example.com',
              );
          
              expect(
                result.executedActions,
              ).toBe(
                1,
              );
          
              expect(
                result.stopReason,
              ).toBe(
                'no-eligible-actions',
              );
            },
          );
          it(
            'does not reuse stale network operations from previous observations',
            async () => {
              const stateA =
                createEmailObservation();
          
              const stateB =
                createInviteObservationWithCumulativeNetwork();
          
              const stateC =
                createCompletedObservation();
          
              const observations = [
                stateA,
                stateB,
                stateC,
              ];
          
              let observationIndex =
                0;
          
              const observe =
                vi.fn(
                  async () => {
                    const observation =
                      observations[
                        observationIndex
                      ];
          
                    if (!observation) {
                      throw new Error(
                        'Unexpected observation request',
                      );
                    }
          
                    observationIndex +=
                      1;
          
                    return observation;
                  },
                );
          
              const fill =
                vi.fn(
                  async () => {
                    // Browser side effect is represented
                    // by the next observation.
                  },
                );
          
              const session = {
                observe,
                fill,
              } as unknown as
                BrowserSession;
          
              const stateModel =
                new ApplicationStateModel();
          
              const planner =
                new DeterministicExplorationPlanner(
                  stateModel,
                );
          
              const saveState =
                vi.fn(
                  async (
                    _applicationId:
                      string,
          
                    state: {
                      id:
                        string;
                    },
                  ) => ({
                    id:
                      state.id,
                  }),
                );
          
              const saveObservationEvidence =
                vi.fn(
                  async () => {
                    // No-op.
                  },
                );
          
              let decisionNumber =
                0;
          
              let actionNumber =
                0;
          
              const saveDecision =
                vi.fn(
                  async (
                    _runId:
                      string,
          
                    _stateId:
                      string,
          
                    decision: {
                      selected:
                        unknown | null;
                    },
                  ) => {
                    decisionNumber +=
                      1;
          
                    return {
                      decision: {
                        id:
                          `decision-${decisionNumber}`,
                      },
          
                      selectedActionId:
                        decision.selected
                          ? `action-${++actionNumber}`
                          : null,
                    };
                  },
                );
          
              const saveTransition =
                vi.fn(
                  async () => {
                    // No-op.
                  },
                );
          
              const repository = {
                saveState,
                saveObservationEvidence,
                saveDecision,
                saveTransition,
              } as unknown as
                RunExplorationLoopInput[
                  'repository'
                ];
          
              const result =
                await runExplorationLoop({
                  session,
          
                  stateModel,
          
                  planner,
          
                  repository,
          
                  applicationId:
                    'application-1',
          
                  runId:
                    'run-network-scope',
          
                  priorityTerms: [],
          
                  knowledge:
                    createRuntimeKnowledge(),
                });
          
              expect(
                fill,
              ).toHaveBeenCalledTimes(
                2,
              );
          
              expect(
                fill,
              ).toHaveBeenNthCalledWith(
                1,
                {
                  by:
                    'label',
          
                  label:
                    'Email',
          
                  exact:
                    true,
                },
                'account@example.com',
              );
          
              expect(
                fill,
              ).toHaveBeenNthCalledWith(
                2,
                {
                  by:
                    'label',
          
                  label:
                    'Email',
          
                  exact:
                    true,
                },
                'invite@example.com',
              );
          
              expect(
                result.executedActions,
              ).toBe(
                2,
              );
          
              expect(
                result.stopReason,
              ).toBe(
                'no-eligible-actions',
              );
            },
          );
    },
);