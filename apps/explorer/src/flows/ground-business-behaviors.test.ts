import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import type {
    NetworkEvent,
    PageObservation,
  } from '../contracts/page-observation.js';
  
  import type {
    KnowledgeContext,
  } from '../knowledge/knowledge-contracts.js';
  
  import type {
    ApplicationTransition,
  } from '../state/application-state.js';
  
  import type {
    BusinessBehaviorFlow,
  } from './business-behavior.js';
  
  import {
    groundBusinessBehaviors,
  } from './ground-business-behaviors.js';
  
  describe(
    'groundBusinessBehaviors',
    () => {
      it(
        'links a booking behavior to matching requirements and an exact OpenAPI operation',
        () => {
          const staleEvent =
            createNetworkEvent(
              'request-1',
              'GET',
              'http://example.test/rooms',
            );
  
          const bookingEvent =
            createNetworkEvent(
              'request-2',
              'POST',
              'http://example.test/bookings',
            );
  
          const transition =
            createTransition(
              'transition-book',
              'rooms',
              'booked',
              'Book Ocean Room',
              [
                staleEvent,
              ],
              [
                staleEvent,
                bookingEvent,
              ],
            );
  
          const behavior =
            createBehavior({
              id:
                'behavior-book',
  
              name:
                'Book Ocean Room',
  
              transitionId:
                transition.id,
  
              fromStateId:
                'rooms',
  
              toStateId:
                'booked',
            });
  
          const result =
            groundBusinessBehaviors({
              behaviors: [
                behavior,
              ],
  
              transitions: [
                transition,
              ],
  
              knowledge:
                createBookingKnowledge(),
            });
  
          expect(
            result,
          ).toHaveLength(
            1,
          );
  
          expect(
            result[0]
              ?.requirementEvidenceIds,
          ).toContain(
            'REQ-1',
          );
  
          expect(
            result[0]
              ?.apiOperationIds,
          ).toEqual([
            'createBooking',
          ]);
  
          expect(
            result[0]
              ?.apiOperationLinks,
          ).toEqual([
            expect.objectContaining({
              networkEventId:
                'request-2',
  
              operationId:
                'createBooking',
  
              confidence:
                'exact',
            }),
          ]);
        },
      );
  
      it(
        'does not reuse stale network evidence when grounding an API operation',
        () => {
          const staleEvent =
            createNetworkEvent(
              'request-1',
              'POST',
              'http://example.test/bookings',
            );
  
          const transition =
            createTransition(
              'transition-book',
              'rooms',
              'booked',
              'Book Ocean Room',
              [
                staleEvent,
              ],
              [
                staleEvent,
              ],
            );
  
          const result =
            groundBusinessBehaviors({
              behaviors: [
                createBehavior({
                  id:
                    'behavior-book',
  
                  name:
                    'Book Ocean Room',
  
                  transitionId:
                    transition.id,
  
                  fromStateId:
                    'rooms',
  
                  toStateId:
                    'booked',
                }),
              ],
  
              transitions: [
                transition,
              ],
  
              knowledge:
                createBookingKnowledge(),
            });
  
          expect(
            result[0]
              ?.apiOperationIds,
          ).toEqual(
            [],
          );
  
          expect(
            result[0]
              ?.apiOperationLinks,
          ).toEqual(
            [],
          );
        },
      );
  
      it(
        'matches deterministic transaction aliases such as add to create',
        () => {
          const transition =
            createTransition(
              'transition-add',
              'todo-form',
              'todo-created',
              'Add Todo',
              [],
              [],
            );
  
          const knowledge:
            KnowledgeContext = {
              requirements: {
                sourcePath:
                  'requirements.md',
  
                acceptanceCriteria: [
                  'User can create a todo item.',
                ],
  
                userRoles: [
                  'User',
                ],
  
                capabilities: [],
  
                constraints: [],
  
                domainTerms: [
                  'todo',
                ],
  
                rawText:
                  'User can create a todo item.',
              },
  
              openApi:
                null,
            };
  
          const result =
            groundBusinessBehaviors({
              behaviors: [
                createBehavior({
                  id:
                    'behavior-add',
  
                  name:
                    'Add Todo',
  
                  transitionId:
                    transition.id,
  
                  fromStateId:
                    'todo-form',
  
                  toStateId:
                    'todo-created',
                }),
              ],
  
              transitions: [
                transition,
              ],
  
              knowledge,
            });
  
          expect(
            result[0]
              ?.requirementEvidenceIds,
          ).toEqual([
            'REQ-1',
          ]);
        },
      );
    },
  );
  
  function createBehavior(
    input: {
      id:
        string;
  
      name:
        string;
  
      transitionId:
        string;
  
      fromStateId:
        string;
  
      toStateId:
        string;
    },
  ): BusinessBehaviorFlow {
    return {
      id:
        input.id,
  
      sourceFlowIds: [
        'flow-1',
      ],
  
      name:
        input.name,
  
      startStateId:
        input.fromStateId,
  
      endStateId:
        input.toStateId,
  
      stateIds: [
        input.fromStateId,
        input.toStateId,
      ],
  
      transitionIds: [
        input.transitionId,
      ],
  
      preconditionTransitionIds:
        [],
  
      steps: [
        {
          transitionId:
            input.transitionId,
  
          fromStateId:
            input.fromStateId,
  
          toStateId:
            input.toStateId,
  
          action: {
            type:
              'click',
  
            target:
              input.name,
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
            input.transitionId,
  
          detail:
            `Observed transactional action "${input.name}"`,
  
          networkEventIds:
            [],
        },
      ],
  
      outcome: {
        stateId:
          input.toStateId,
  
        urlChanged:
          false,
  
        titleChanged:
          false,
  
        addedSemanticText:
          [],
  
        removedSemanticText:
          [],
      },
    };
  }
  
  function createTransition(
    id:
      string,
  
    fromStateId:
      string,
  
    toStateId:
      string,
  
    target:
      string,
  
    beforeNetworkEvents:
      NetworkEvent[],
  
    afterNetworkEvents:
      NetworkEvent[],
  ): ApplicationTransition {
    return {
      id,
  
      fromStateId,
  
      toStateId,
  
      action: {
        type:
          'click',
  
        target,
      },
  
      occurredAt:
        '2026-09-29T00:00:00.000Z',
  
      equivalentState:
        false,
  
      explorationBlocked:
        false,
  
      beforeObservation:
        createObservation(
          fromStateId,
          beforeNetworkEvents,
        ),
  
      afterObservation:
        createObservation(
          toStateId,
          afterNetworkEvents,
        ),
  
      evidence: {
        networkEvents: [
          ...afterNetworkEvents,
        ],
  
        consoleEvents: [],
      },
    };
  }
  
  function createObservation(
    id:
      string,
  
    networkEvents:
      NetworkEvent[],
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
  
      networkEvents,
  
      supportingArtifacts: [],
    };
  }
  
  function createNetworkEvent(
    id:
      string,
  
    method:
      string,
  
    url:
      string,
  ): NetworkEvent {
    return {
      id,
  
      method,
  
      url,
  
      resourceType:
        'fetch',
  
      status:
        200,
  
      ok:
        true,
  
      failed:
        false,
    };
  }
  
  function createBookingKnowledge():
    KnowledgeContext {
    return {
      requirements: {
        sourcePath:
          'requirements.md',
  
        acceptanceCriteria: [
          'Customer can book an available room.',
          'Customer can cancel an existing booking.',
        ],
  
        userRoles: [
          'Customer',
        ],
  
        capabilities: [
          'Customer can create a booking.',
        ],
  
        constraints: [],
  
        domainTerms: [
          'booking',
          'room',
        ],
  
        rawText:
          'Booking requirements',
      },
  
      openApi: {
        sourcePath:
          'openapi.yaml',
  
        title:
          'Booking API',
  
        version:
          '1.0.0',
  
        servers: [
          'http://example.test',
        ],
  
        operations: [
          {
            operationId:
              'createBooking',
  
            method:
              'POST',
  
            path:
              '/bookings',
  
            parameters: [],
  
            responses: [],
  
            security: [],
  
            tags: [
              'booking',
            ],
          },
        ],
  
        schemas: {},
      },
    };
  }