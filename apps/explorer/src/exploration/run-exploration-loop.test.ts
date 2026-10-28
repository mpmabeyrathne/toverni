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
    createActionSignature,
} from './action-candidate.js';

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

const TEST_BUDGET = {
    maxActions: 10,
    maxActionsPerState: 5,
    maxStates: 10,
    maxDepth: 10,
    maxVisitsPerState: 10,
    maxFailures: 3,
    maxModelCalls: 10,
    maxDurationMs: 60_000,
} as const;

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

                        saveRunCheckpoint:
                            vi.fn(
                                async () => {
                                    // No-op.
                                },
                            ),
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

                        budget:
                            TEST_BUDGET,
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

                saveRunCheckpoint:
                  vi.fn(
                    async () => {
                      // No-op.
                    },
                  ),
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

                  budget:
                    TEST_BUDGET,
          
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

                saveRunCheckpoint:
                  vi.fn(
                    async () => {
                      // No-op.
                    },
                  ),
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

                  budget:
                    TEST_BUDGET,
          
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

          it(
            'skips a failed browser action and continues with another eligible action',
            async () => {
              const initialObservation:
                Observation = {
                capturedAt:
                  '2026-10-08T00:00:00.000Z',

                url:
                  'http://example.test/',

                title:
                  'Recoverable Action Failure',

                semanticText: [
                  'Unstable',
                  'Working',
                ],

                ariaSnapshot: [
                  '- main:',
                  '  - button "Unstable"',
                  '  - button "Working"',
                ].join('\n'),

                actions: [
                  {
                    type:
                      'button',

                    tagName:
                      'button',

                    name:
                      'Unstable',

                    text:
                      'Unstable',

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
                      'Working',

                    text:
                      'Working',

                    disabled:
                      false,

                    visible:
                      true,
                  },
                ],

                consoleEvents: [],

                networkEvents: [],

                supportingArtifacts: [],
              };

              const completedObservation:
                Observation = {
                ...initialObservation,

                capturedAt:
                  '2026-10-08T00:00:01.000Z',

                semanticText: [
                  'Done',
                ],

                ariaSnapshot:
                  '- main:\n  - text: Done',

                actions: [],
              };

              const observe =
                vi.fn()
                  .mockResolvedValueOnce(
                    initialObservation,
                  )
                  .mockResolvedValueOnce(
                    completedObservation,
                  );

              const click =
                vi.fn(
                  async (
                    target,
                  ) => {
                    if (
                      'name' in target &&
                      target.name ===
                        'Unstable'
                    ) {
                      throw new Error(
                        'element is not stable',
                      );
                    }
                  },
                );

              const session = {
                observe,
                click,
              } as unknown as
                BrowserSession;

              const stateModel =
                new ApplicationStateModel();

              const planner =
                new DeterministicExplorationPlanner(
                  stateModel,
                  TEST_BUDGET,
                );

              const saveTransition =
                vi.fn(
                  async () => {
                    // No-op.
                  },
                );

              const repository = {
                saveState:
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
                  ),

                saveObservationEvidence:
                  vi.fn(
                    async () => {
                      // No-op.
                    },
                  ),

                saveDecision:
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
                    ) => ({
                      decision: {
                        id:
                          'decision',
                      },

                      selectedActionId:
                        decision.selected
                          ? 'action'
                          : null,
                    }),
                  ),

                saveTransition,

                saveRunCheckpoint:
                  vi.fn(
                    async () => {
                      // No-op.
                    },
                  ),
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
                    'run-recoverable-failure',

                  priorityTerms: [],

                  budget:
                    TEST_BUDGET,

                  retryAttempts:
                    1,
                });

              expect(
                click,
              ).toHaveBeenCalledTimes(
                2,
              );

              expect(
                click,
              ).toHaveBeenNthCalledWith(
                1,
                {
                  by:
                    'role',

                  role:
                    'button',

                  name:
                    'Unstable',

                  exact:
                    true,
                },
              );

              expect(
                click,
              ).toHaveBeenNthCalledWith(
                2,
                {
                  by:
                    'role',

                  role:
                    'button',

                  name:
                    'Working',

                  exact:
                    true,
                },
              );

              expect(
                saveTransition,
              ).toHaveBeenCalledTimes(
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
            'resumes from checkpoint without re-executing a completed action',
            async () => {
              const observation =
                createObservation({
                  semanticText: [
                    'Page A',
                    'Next',
                  ],

                  actionName:
                    'Next',
                });

              const observe =
                vi.fn(
                  async () =>
                    observation,
                );

              const click =
                vi.fn(
                  async () => {
                    // Must not run for completed action.
                  },
                );

              const session = {
                observe,
                click,
              } as unknown as
                BrowserSession;

              const stateModel =
                new ApplicationStateModel();

              const initialState =
                stateModel
                  .registerObservation(
                    observation,
                  )
                  .state;

              const planner =
                new DeterministicExplorationPlanner(
                  stateModel,
                  TEST_BUDGET,
                );

              const saveRunCheckpoint =
                vi.fn(
                  async () => {
                    // No-op.
                  },
                );

              const repository = {
                saveState:
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
                  ),

                saveObservationEvidence:
                  vi.fn(
                    async () => {
                      // No-op.
                    },
                  ),

                saveDecision:
                  vi.fn(
                    async () => ({
                      decision: {
                        id:
                          'decision-resume',
                      },

                      selectedActionId:
                        null,
                    }),
                  ),

                saveTransition:
                  vi.fn(
                    async () => {
                      // No-op.
                    },
                  ),

                saveRunCheckpoint,
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
                    'run-resume',

                  priorityTerms: [],

                  budget:
                    TEST_BUDGET,

                  checkpoint: {
                    version:
                      1,

                    currentUrl:
                      observation.url,

                    depth:
                      1,

                    failures:
                      0,

                    modelCalls:
                      0,

                    startedAt:
                      new Date()
                        .toISOString(),

                    updatedAt:
                      new Date()
                        .toISOString(),

                    completedExecutions: [
                      {
                        stateId:
                          initialState.id,

                        signature:
                          createActionSignature(
                            observation.actions[0]!,
                          ),

                        actionType:
                          'button',

                        label:
                          'Next',
                      },
                    ],
                  },
                });

              expect(
                click,
              ).not.toHaveBeenCalled();

              expect(
                result.stopReason,
              ).toBe(
                'no-eligible-actions',
              );
            },
          );

          it(
            'restores a source route and explores remaining actions after a dead end',
            async () => {
              const home:
                Observation = {
                capturedAt:
                  '2026-10-08T01:00:00.000Z',

                url:
                  'http://example.test/',

                title:
                  'Home',

                semanticText: [
                  'Home',
                  'First',
                  'Second',
                ],

                ariaSnapshot: [
                  '- main:',
                  '  - link "First"',
                  '  - link "Second"',
                ].join(
                  '\n',
                ),

                actions: [
                  {
                    type:
                      'link',

                    tagName:
                      'a',

                    name:
                      'First',

                    text:
                      'First',

                    href:
                      'http://example.test/first',

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
                      'Second',

                    text:
                      'Second',

                    href:
                      'http://example.test/second',

                    disabled:
                      false,

                    visible:
                      true,
                  },
                ],

                consoleEvents: [],

                networkEvents: [],

                supportingArtifacts: [],
              };

              const first:
                Observation = {
                ...home,

                capturedAt:
                  '2026-10-08T01:00:01.000Z',

                url:
                  'http://example.test/first',

                title:
                  'First',

                semanticText: [
                  'First destination',
                ],

                ariaSnapshot:
                  '- main:\n  - text: First destination',

                actions: [],
              };

              const second:
                Observation = {
                ...first,

                capturedAt:
                  '2026-10-08T01:00:02.000Z',

                url:
                  'http://example.test/second',

                title:
                  'Second',

                semanticText: [
                  'Second destination',
                ],

                ariaSnapshot:
                  '- main:\n  - text: Second destination',
              };

              const observations = [
                home,
                first,
                home,
                second,
              ];

              const observe =
                vi.fn(
                  async () => {
                    const next =
                      observations.shift();

                    if (!next) {
                      return second;
                    }

                    return next;
                  },
                );

              const navigate =
                vi.fn(
                  async (
                    _url:
                      string,
                  ) => {
                    // Observation sequence
                    // models route restoration.
                  },
                );

              const click =
                vi.fn(
                  async () => {
                    // Observation sequence
                    // models clicked navigation.
                  },
                );

              const session = {
                observe,
                navigate,
                click,
              } as unknown as
                BrowserSession;

              const stateModel =
                new ApplicationStateModel();

              const planner =
                new DeterministicExplorationPlanner(
                  stateModel,
                  TEST_BUDGET,
                );

              const saveTransition =
                vi.fn(
                  async () => {
                    // No-op.
                  },
                );

              const repository = {
                saveState:
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
                  ),

                saveObservationEvidence:
                  vi.fn(
                    async () => {
                      // No-op.
                    },
                  ),

                saveDecision:
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
                    ) => ({
                      decision: {
                        id:
                          'decision',
                      },

                      selectedActionId:
                        decision.selected
                          ? 'action'
                          : null,
                    }),
                  ),

                saveTransition,

                saveRunCheckpoint:
                  vi.fn(
                    async () => {
                      // No-op.
                    },
                  ),
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
                    'run-frontier',

                  priorityTerms: [],

                  budget:
                    TEST_BUDGET,

                  retryAttempts:
                    1,
                });

              expect(
                click,
              ).toHaveBeenCalledTimes(
                2,
              );

              expect(
                navigate,
              ).toHaveBeenCalledWith(
                'http://example.test/',
              );

              expect(
                saveTransition,
              ).toHaveBeenCalledTimes(
                2,
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

          it('records approved runtime fixture fills without exposing their value', async () => {
            const initial: Observation = {
              ...createObservation({ semanticText: ['Login'], actionName: 'Unused' }),
              url: 'https://example.test/login',
              actions: [{
                type: 'input', tagName: 'input', name: 'Username',
                inputType: 'text', disabled: false, visible: true,
                formField: { inputType: 'text', required: true, value: '' },
              }],
            };
            const filled: Observation = {
              ...initial,
              semanticText: ['Login', 'Username entered'],
              actions: [],
            };
            const observe = vi.fn()
              .mockResolvedValueOnce(initial)
              .mockResolvedValue(filled);
            const fill = vi.fn(async () => {});
            const session = { observe, fill } as unknown as BrowserSession;
            const stateModel = new ApplicationStateModel();
            const planner = new DeterministicExplorationPlanner(stateModel, TEST_BUDGET);
            const saveTransition = vi.fn(async () => {});
            const repository = {
              saveState: vi.fn(async (_id: string, state: { id: string }) =>
                ({ id: state.id })),
              saveObservationEvidence: vi.fn(async () => {}),
              saveDecision: vi.fn(async () => ({ selectedActionId: 'action-1' })),
              saveTransition,
              saveRunCheckpoint: vi.fn(async () => {}),
            } as unknown as RunExplorationLoopInput['repository'];
            await runExplorationLoop({
              session, stateModel, planner, repository,
              applicationId: 'app', runId: 'fixture-run', priorityTerms: [],
              approvedFixture: { origin: 'https://example.test',
                fields: { Username: 'private-demo-fixture' } },
              budget: { ...TEST_BUDGET, maxActions: 1 },
            });
            expect(fill).toHaveBeenCalledTimes(1);
            expect(fill.mock.calls[0]).toBeDefined();
            const saved = saveTransition.mock.calls.map(call => call[0]);
            expect(JSON.stringify(saved)).not.toContain('private-demo-fixture');
            expect(JSON.stringify(saved)).toContain('"type":"fill"');
          });

          it(
            'stops with an explainable runtime budget reason',
            async () => {
              const observation =
                createObservation({
                  semanticText: [
                    'Page A',
                    'Next',
                  ],

                  actionName:
                    'Next',
                });

              const session = {
                observe:
                  vi.fn(
                    async () =>
                      observation,
                  ),

                click:
                  vi.fn(
                    async () => {
                      // Should not execute.
                    },
                  ),
              } as unknown as
                BrowserSession;

              const stateModel =
                new ApplicationStateModel();

              const planner =
                new DeterministicExplorationPlanner(
                  stateModel,
                  TEST_BUDGET,
                );

              const repository = {
                saveState:
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
                  ),

                saveObservationEvidence:
                  vi.fn(
                    async () => {
                      // No-op.
                    },
                  ),

                saveDecision:
                  vi.fn(),

                saveTransition:
                  vi.fn(),

                saveRunCheckpoint:
                  vi.fn(
                    async () => {
                      // No-op.
                    },
                  ),
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
                    'run-budget',

                  priorityTerms: [],

                  budget: {
                    ...TEST_BUDGET,

                    maxDepth:
                      0,
                  },
                });

              expect(
                result.stopReason,
              ).toBe(
                'max-depth-reached',
              );
            },
          );
    },
);