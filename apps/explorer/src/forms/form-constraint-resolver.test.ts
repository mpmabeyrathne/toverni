import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import type {
    ActionElement,
  } from '../contracts/page-observation.js';
  
  import type {
    KnowledgeContext,
  } from '../knowledge/knowledge-contracts.js';
  
  import {
    resolveFormConstraints,
  } from './form-constraint-resolver.js';
  
  function createKnowledge(
    schemas:
      Record<
        string,
        unknown
      >,
  
    constraints:
      string[] = [],
  ): KnowledgeContext {
    return {
      requirements: {
        sourcePath:
          '/fixtures/requirements.md',
  
        acceptanceCriteria:
          [],
  
        userRoles:
          [],
  
        capabilities:
          [],
  
        constraints,
  
        domainTerms:
          [],
  
        rawText:
          constraints.join(
            '\n',
          ),
      },
  
      openApi: {
        sourcePath:
          '/fixtures/openapi.yaml',
  
        title:
          'Test API',
  
        version:
          '1.0.0',
  
        servers:
          [],
  
        operations:
          [],
  
        schemas,
      },
    };
  }
  
  describe(
    'resolveFormConstraints',
    () => {
      it(
        'keeps observed UI constraints when OpenAPI conflicts',
        () => {
          const action:
            ActionElement = {
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
          };
  
          const knowledge =
            createKnowledge({
              BookingRequest: {
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
                      8,
  
                    example:
                      6,
                  },
                },
              },
            });
  
          const result =
            resolveFormConstraints(
              action,
              knowledge,
            );
  
          expect(
            result,
          ).not.toBeNull();
  
          expect(
            result?.min,
          ).toBe(
            '1',
          );
  
          expect(
            result?.max,
          ).toBe(
            '10',
          );
  
          expect(
            result?.example,
          ).toBe(
            '6',
          );
  
          expect(
            result?.conflicts,
          ).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                field:
                  'min',
  
                chosenSource:
                  'ui',
  
                rejectedSource:
                  'openapi',
  
                chosenValue:
                  '1',
  
                rejectedValue:
                  '5',
              }),
  
              expect.objectContaining({
                field:
                  'max',
  
                chosenSource:
                  'ui',
  
                rejectedSource:
                  'openapi',
  
                chosenValue:
                  '10',
  
                rejectedValue:
                  '8',
              }),
            ]),
          );
        },
      );

      it(
        'narrows OpenAPI constraints to the relevant runtime operation',
        () => {
          const action:
            ActionElement = {
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
          };
      
          const knowledge:
            KnowledgeContext = {
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
                    'subscribeNewsletter',
      
                  method:
                    'POST',
      
                  path:
                    '/newsletter',
      
                  parameters: [],
      
                  requestBody: {
                    content: {
                      'application/json': {
                        schema: {
                          $ref:
                            '#/components/schemas/NewsletterRequest',
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
      
                NewsletterRequest: {
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
                        'newsletter@example.com',
                    },
                  },
                },
              },
            },
          };
      
          // Without runtime context the same
          // field has incompatible OpenAPI
          // definitions, so resolver must not
          // guess which example belongs here.
          const globalResult =
            resolveFormConstraints(
              action,
              knowledge,
            );
      
          expect(
            globalResult?.example,
          ).toBeUndefined();
      
          // Runtime evidence identifies the
          // relevant operation.
          const contextualResult =
            resolveFormConstraints(
              action,
              knowledge,
              {
                apiOperationIds: [
                  'createUser',
                ],
              },
            );
      
          expect(
            contextualResult?.example,
          ).toBe(
            'account@example.com',
          );
      
          expect(
            contextualResult
              ?.evidence.some(
                (item) =>
                  item.source ===
                    'openapi' &&
                  item.field ===
                    'example' &&
                  item.detail.includes(
                    'operations.createUser.requestBody',
                  ),
              ),
          ).toBe(true);
        },
      );
  
      it(
        'does not guess when multiple contextual operations provide conflicting constraints',
        () => {
          const action:
            ActionElement = {
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
          };
      
          const knowledge:
            KnowledgeContext = {
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
                          type:
                            'object',
      
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
                          type:
                            'object',
      
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
                  },
      
                  responses: [],
      
                  security: [],
      
                  tags: [],
                },
              ],
      
              schemas: {},
            },
          };
      
          const result =
            resolveFormConstraints(
              action,
              knowledge,
              {
                apiOperationIds: [
                  'createUser',
                  'inviteUser',
                ],
              },
            );
      
          expect(
            result?.example,
          ).toBeUndefined();
        },
      );
      
      it(
        'fills missing UI constraints from OpenAPI',
        () => {
          const action:
            ActionElement = {
            type:
              'input',
  
            tagName:
              'input',
  
            name:
              'Username',
  
            disabled:
              false,
  
            visible:
              true,
  
            formField: {
              htmlName:
                'username',
  
              required:
                true,
            },
          };
  
          const knowledge =
            createKnowledge({
              CreateUserRequest: {
                type:
                  'object',
  
                required: [
                  'username',
                ],
  
                properties: {
                  username: {
                    type:
                      'string',
  
                    minLength:
                      3,
  
                    maxLength:
                      30,
  
                    example:
                      'pasindu',
                  },
                },
              },
            });
  
          const result =
            resolveFormConstraints(
              action,
              knowledge,
            );
  
          expect(
            result?.required,
          ).toBe(true);
  
          expect(
            result?.minLength,
          ).toBe(
            3,
          );
  
          expect(
            result?.maxLength,
          ).toBe(
            30,
          );
  
          expect(
            result?.example,
          ).toBe(
            'pasindu',
          );
  
          expect(
            result?.evidence,
          ).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                source:
                  'openapi',
  
                field:
                  'minLength',
              }),
  
              expect.objectContaining({
                source:
                  'openapi',
  
                field:
                  'example',
              }),
            ]),
          );
        },
      );
  
      it(
        'records requirement conflict without overriding observable UI',
        () => {
          const action:
            ActionElement = {
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
                false,
            },
          };
  
          const knowledge =
            createKnowledge(
              {},
              [
                'Email is required.',
              ],
            );
  
          const result =
            resolveFormConstraints(
              action,
              knowledge,
            );
  
          expect(
            result?.required,
          ).toBe(false);
  
          expect(
            result?.conflicts,
          ).toContainEqual(
            expect.objectContaining({
              field:
                'required',
  
              chosenSource:
                'ui',
  
              rejectedSource:
                'requirements',
  
              chosenValue:
                false,
  
              rejectedValue:
                true,
            }),
          );
        },
      );
  
      it(
        'uses requirement constraints when UI and OpenAPI do not provide them',
        () => {
          const action:
            ActionElement = {
            type:
              'textarea',
  
            tagName:
              'textarea',
  
            name:
              'Description',
  
            disabled:
              false,
  
            visible:
              true,
  
            formField: {
              htmlName:
                'description',
  
              required:
                false,
            },
          };
  
          const knowledge =
            createKnowledge(
              {},
              [
                'Description must be at least 10 characters.',
                'Description maximum 200 characters.',
              ],
            );
  
          const result =
            resolveFormConstraints(
              action,
              knowledge,
            );
  
          expect(
            result?.minLength,
          ).toBe(
            10,
          );
  
          expect(
            result?.maxLength,
          ).toBe(
            200,
          );
  
          expect(
            result?.evidence,
          ).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                source:
                  'requirements',
  
                field:
                  'minLength',
              }),
  
              expect.objectContaining({
                source:
                  'requirements',
  
                field:
                  'maxLength',
              }),
            ]),
          );
        },
      );
  
      it(
        'produces deterministic resolution for the same evidence',
        () => {
          const action:
            ActionElement = {
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
            },
          };
  
          const knowledge =
            createKnowledge({
              BookingRequest: {
                type:
                  'object',
  
                properties: {
                  seats: {
                    type:
                      'integer',
  
                    maximum:
                      10,
                  },
                },
              },
            });
  
          expect(
            resolveFormConstraints(
              action,
              knowledge,
            ),
          ).toEqual(
            resolveFormConstraints(
              action,
              knowledge,
            ),
          );
        },
      );
  
      it(
        'does not guess when multiple OpenAPI schemas disagree for the same field',
        () => {
          const action:
            ActionElement = {
            type:
              'input',
  
            tagName:
              'input',
  
            name:
              'Quantity',
  
            inputType:
              'number',
  
            disabled:
              false,
  
            visible:
              true,
  
            formField: {
              htmlName:
                'quantity',
  
              inputType:
                'number',
  
              required:
                false,
            },
          };
  
          const knowledge =
            createKnowledge({
              FirstRequest: {
                type:
                  'object',
  
                properties: {
                  quantity: {
                    type:
                      'integer',
  
                    maximum:
                      10,
                  },
                },
              },
  
              SecondRequest: {
                type:
                  'object',
  
                properties: {
                  quantity: {
                    type:
                      'integer',
  
                    maximum:
                      100,
                  },
                },
              },
            });
  
          const result =
            resolveFormConstraints(
              action,
              knowledge,
            );
  
          expect(
            result?.max,
          ).toBeUndefined();
        },
      );
    },
  );