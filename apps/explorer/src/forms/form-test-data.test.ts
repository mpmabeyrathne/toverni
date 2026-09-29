import {
    describe,
    expect,
    it,
} from 'vitest';

import type {
    KnowledgeContext,
} from '../knowledge/knowledge-contracts.js';
import type {
    ActionElement,
} from '../contracts/page-observation.js';

import {
    generateFormTestData,
} from './form-test-data.js';

describe(
    'generateFormTestData',
    () => {
        it(
            'generates deterministic number values from UI constraints',
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

                const result =
                    generateFormTestData(
                        action,
                    );

                expect(
                    result.values,
                ).toContainEqual(
                    expect.objectContaining({
                        kind:
                            'boundary',

                        value:
                            '1',
                    }),
                );

                expect(
                    result.values,
                ).toContainEqual(
                    expect.objectContaining({
                        kind:
                            'boundary',

                        value:
                            '10',
                    }),
                );

                expect(
                    result.values,
                ).toContainEqual(
                    expect.objectContaining({
                        kind:
                            'invalid',

                        value:
                            '0',
                    }),
                );
            },
        );

        it(
            'uses an observed select option instead of inventing a value',
            () => {
                const action:
                    ActionElement = {
                    type:
                        'select',

                    tagName:
                        'select',

                    name:
                        'Project Type',

                    disabled:
                        false,

                    visible:
                        true,

                    formField: {
                        htmlName:
                            'projectType',

                        required:
                            true,

                        multiple:
                            false,

                        options: [
                            {
                                value:
                                    '',

                                label:
                                    'Choose',

                                disabled:
                                    false,

                                selected:
                                    false,
                            },

                            {
                                value:
                                    'web',

                                label:
                                    'Web',

                                disabled:
                                    false,

                                selected:
                                    true,
                            },

                            {
                                value:
                                    'mobile',

                                label:
                                    'Mobile',

                                disabled:
                                    true,

                                selected:
                                    false,
                            },
                        ],
                    },
                };

                const result =
                    generateFormTestData(
                        action,
                    );

                    expect(
                        result.values,
                      ).toEqual([
                        expect.objectContaining({
                          kind:
                            'valid',
                      
                          value:
                            'web',
                      
                          evidence:
                            expect.arrayContaining([
                              expect.objectContaining({
                                source:
                                  'ui',
                              }),
                            ]),
                        }),
                      ]);
            },
        );

        it(
            'only creates an invalid empty value when required evidence exists',
            () => {
                const requiredAction:
                    ActionElement = {
                    type:
                        'textarea',

                    tagName:
                        'textarea',

                    disabled:
                        false,

                    visible:
                        true,

                    formField: {
                        required:
                            true,

                        minLength:
                            3,
                    },
                };

                const optionalAction:
                    ActionElement = {
                    type:
                        'textarea',

                    tagName:
                        'textarea',

                    disabled:
                        false,

                    visible:
                        true,

                    formField: {
                        required:
                            false,
                    },
                };

                expect(
                    generateFormTestData(
                        requiredAction,
                    ).values.some(
                        (value) =>
                            value.kind ===
                            'invalid' &&
                            value.value ===
                            '',
                    ),
                ).toBe(true);

                expect(
                    generateFormTestData(
                        optionalAction,
                    ).values.some(
                        (value) =>
                            value.kind ===
                            'invalid',
                    ),
                ).toBe(false);
            },
        );

        it(
            'produces reproducible values for the same field',
            () => {
                const action:
                    ActionElement = {
                    type:
                        'input',

                    tagName:
                        'input',

                    disabled:
                        false,

                    visible:
                        true,

                    inputType:
                        'email',

                    formField: {
                        inputType:
                            'email',

                        required:
                            true,

                        placeholder:
                            'test@example.com',
                    },
                };

                expect(
                    generateFormTestData(
                        action,
                    ),
                ).toEqual(
                    generateFormTestData(
                        action,
                    ),
                );
            },
        );
        it(
            'uses OpenAPI example while preserving UI boundaries',
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

                        operations: [],

                        schemas: {
                            BookingRequest: {
                                type:
                                    'object',

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
                        },
                    },
                };

                const result =
                    generateFormTestData(
                        action,
                        knowledge,
                    );

                expect(
                    result.values,
                ).toContainEqual(
                    expect.objectContaining({
                        kind:
                            'valid',

                        value:
                            '6',
                    }),
                );

                expect(
                    result.values,
                ).toContainEqual(
                    expect.objectContaining({
                        kind:
                            'boundary',

                        value:
                            '1',
                    }),
                );

                expect(
                    result.values,
                ).toContainEqual(
                    expect.objectContaining({
                        kind:
                            'boundary',

                        value:
                            '10',
                    }),
                );

                const validValue =
                    result.values.find(
                        (value) =>
                            value.kind ===
                            'valid',
                    );

                expect(
                    validValue?.evidence,
                ).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            source:
                                'openapi',
                        }),
                    ]),
                );
            },
        );

        it(
            'respects numeric step when choosing valid and boundary values',
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
                    true,
          
                  min:
                    '0',
          
                  max:
                    '10',
          
                  step:
                    '3',
                },
              };
          
              const result =
                generateFormTestData(
                  action,
                );
          
              const validValues =
                result.values.filter(
                  (value) =>
                    value.kind ===
                    'valid',
                );
          
              expect(
                validValues.length,
              ).toBeGreaterThan(0);
          
              for (
                const value of
                validValues
              ) {
                const number =
                  Number(
                    value.value,
                  );
          
                expect(
                  number,
                ).toBeGreaterThanOrEqual(
                  0,
                );
          
                expect(
                  number,
                ).toBeLessThanOrEqual(
                  10,
                );
          
                expect(
                  number % 3,
                ).toBe(0);
              }
          
              expect(
                result.values,
              ).toContainEqual(
                expect.objectContaining({
                  kind:
                    'boundary',
          
                  value:
                    '0',
                }),
              );
          
              expect(
                result.values,
              ).toContainEqual(
                expect.objectContaining({
                  kind:
                    'boundary',
          
                  value:
                    '9',
                }),
              );
          
              expect(
                result.values,
              ).not.toContainEqual(
                expect.objectContaining({
                  kind:
                    'boundary',
          
                  value:
                    '10',
                }),
              );
            },
          );

          it(
            'only marks a text value valid when it satisfies the observed pattern',
            () => {
              const action:
                ActionElement = {
                type:
                  'input',
          
                tagName:
                  'input',
          
                name:
                  'Reference',
          
                inputType:
                  'text',
          
                disabled:
                  false,
          
                visible:
                  true,
          
                formField: {
                  htmlName:
                    'reference',
          
                  inputType:
                    'text',
          
                  required:
                    true,
          
                  pattern:
                    '[A-Z]{3}[0-9]{4}',
                },
              };
          
              const result =
                generateFormTestData(
                  action,
                );
          
              const valid =
                result.values.find(
                  (value) =>
                    value.kind ===
                    'valid',
                );
          
              expect(
                valid?.value,
              ).toBe(
                'ABC1234',
              );
          
              expect(
                /^[A-Z]{3}[0-9]{4}$/.test(
                  String(
                    valid?.value,
                  ),
                ),
              ).toBe(true);
            },
          );

          it(
            'does not invent a valid value when an observed pattern cannot be satisfied deterministically',
            () => {
              const action:
                ActionElement = {
                type:
                  'input',
          
                tagName:
                  'input',
          
                name:
                  'Special Code',
          
                inputType:
                  'text',
          
                disabled:
                  false,
          
                visible:
                  true,
          
                formField: {
                  htmlName:
                    'specialCode',
          
                  inputType:
                    'text',
          
                  required:
                    true,
          
                  pattern:
                    'ZXCV-[0-9]{12}-ONLY',
                },
              };
          
              const result =
                generateFormTestData(
                  action,
                );
          
              expect(
                result.values.some(
                  (value) =>
                    value.kind ===
                    'valid',
                ),
              ).toBe(false);
          
              expect(
                result.values,
              ).toContainEqual(
                expect.objectContaining({
                  kind:
                    'invalid',
          
                  value:
                    '',
                }),
              );
            },
          );

          it(
            'generates a valid URL value',
            () => {
              const action:
                ActionElement = {
                type:
                  'input',
          
                tagName:
                  'input',
          
                inputType:
                  'url',
          
                disabled:
                  false,
          
                visible:
                  true,
          
                formField: {
                  inputType:
                    'url',
          
                  required:
                    true,
                },
              };
          
              const result =
                generateFormTestData(
                  action,
                );
          
              expect(
                result.values,
              ).toContainEqual(
                expect.objectContaining({
                  kind:
                    'valid',
          
                  value:
                    'https://example.com',
                }),
              );
            },
          );
          
          it(
            'respects telephone pattern evidence',
            () => {
              const action:
                ActionElement = {
                type:
                  'input',
          
                tagName:
                  'input',
          
                inputType:
                  'tel',
          
                disabled:
                  false,
          
                visible:
                  true,
          
                formField: {
                  inputType:
                    'tel',
          
                  required:
                    true,
          
                  pattern:
                    '[0-9]{10}',
                },
              };
          
              const result =
                generateFormTestData(
                  action,
                );
          
              const valid =
                result.values.find(
                  (value) =>
                    value.kind ===
                    'valid',
                );
          
              expect(
                valid?.value,
              ).toBe(
                '0771234567',
              );
            },
          );
          
          it(
            'generates bounded time values',
            () => {
              const action:
                ActionElement = {
                type:
                  'input',
          
                tagName:
                  'input',
          
                inputType:
                  'time',
          
                disabled:
                  false,
          
                visible:
                  true,
          
                formField: {
                  inputType:
                    'time',
          
                  required:
                    true,
          
                  min:
                    '09:00',
          
                  max:
                    '17:00',
                },
              };
          
              const result =
                generateFormTestData(
                  action,
                );
          
              expect(
                result.values,
              ).toContainEqual(
                expect.objectContaining({
                  kind:
                    'valid',
          
                  value:
                    '09:00',
                }),
              );
          
              expect(
                result.values,
              ).toContainEqual(
                expect.objectContaining({
                  kind:
                    'boundary',
          
                  value:
                    '17:00',
                }),
              );
            },
          );
          
          it(
            'generates valid datetime-local values',
            () => {
              const action:
                ActionElement = {
                type:
                  'input',
          
                tagName:
                  'input',
          
                inputType:
                  'datetime-local',
          
                disabled:
                  false,
          
                visible:
                  true,
          
                formField: {
                  inputType:
                    'datetime-local',
          
                  required:
                    true,
                },
              };
          
              const result =
                generateFormTestData(
                  action,
                );
          
              expect(
                result.values,
              ).toContainEqual(
                expect.objectContaining({
                  kind:
                    'valid',
          
                  value:
                    '2026-01-01T12:00',
                }),
              );
            },
          );
          
          it(
            'generates valid month values',
            () => {
              const action:
                ActionElement = {
                type:
                  'input',
          
                tagName:
                  'input',
          
                inputType:
                  'month',
          
                disabled:
                  false,
          
                visible:
                  true,
          
                formField: {
                  inputType:
                    'month',
          
                  required:
                    true,
          
                  min:
                    '2026-01',
          
                  max:
                    '2026-12',
                },
              };
          
              const result =
                generateFormTestData(
                  action,
                );
          
              expect(
                result.values,
              ).toContainEqual(
                expect.objectContaining({
                  kind:
                    'boundary',
          
                  value:
                    '2026-01',
                }),
              );
          
              expect(
                result.values,
              ).toContainEqual(
                expect.objectContaining({
                  kind:
                    'boundary',
          
                  value:
                    '2026-12',
                }),
              );
            },
          );
          
          it(
            'uses numeric constraint logic for range inputs',
            () => {
              const action:
                ActionElement = {
                type:
                  'input',
          
                tagName:
                  'input',
          
                inputType:
                  'range',
          
                disabled:
                  false,
          
                visible:
                  true,
          
                formField: {
                  inputType:
                    'range',
          
                  required:
                    true,
          
                  min:
                    '0',
          
                  max:
                    '100',
          
                  step:
                    '10',
                },
              };
          
              const result =
                generateFormTestData(
                  action,
                );
          
              const valid =
                result.values.find(
                  (value) =>
                    value.kind ===
                    'valid',
                );
          
              expect(
                Number(
                  valid?.value,
                ) % 10,
              ).toBe(0);
            },
          );
          it(
            'generates valid checked and invalid unchecked values for a required checkbox',
            () => {
              const action:
                ActionElement = {
                type:
                  'checkbox',
          
                tagName:
                  'input',
          
                name:
                  'Accept Terms',
          
                inputType:
                  'checkbox',
          
                disabled:
                  false,
          
                visible:
                  true,
          
                formField: {
                  htmlName:
                    'acceptTerms',
          
                  inputType:
                    'checkbox',
          
                  required:
                    true,
          
                  checked:
                    false,
                },
              };
          
              const result =
                generateFormTestData(
                  action,
                );
          
              expect(
                result.values,
              ).toContainEqual(
                expect.objectContaining({
                  kind:
                    'valid',
          
                  value:
                    true,
          
                  evidence:
                    expect.arrayContaining([
                      expect.objectContaining({
                        source:
                          'ui',
                      }),
                    ]),
                }),
              );
          
              expect(
                result.values,
              ).toContainEqual(
                expect.objectContaining({
                  kind:
                    'invalid',
          
                  value:
                    false,
          
                  evidence:
                    expect.arrayContaining([
                      expect.objectContaining({
                        source:
                          'ui',
                      }),
                    ]),
                }),
              );
            },
          );
          it(
            'uses an observed combobox option instead of inventing a value',
            () => {
              const action:
                ActionElement = {
                type:
                  'combobox',
          
                tagName:
                  'div',
          
                role:
                  'combobox',
          
                name:
                  'Country',
          
                disabled:
                  false,
          
                visible:
                  true,
          
                formField: {
                  required:
                    true,
          
                  editable:
                    false,
          
                  options: [
                    {
                      value:
                        'Sri Lanka',
          
                      label:
                        'Sri Lanka',
          
                      disabled:
                        false,
          
                      selected:
                        false,
                    },
          
                    {
                      value:
                        'au',
          
                      label:
                        'Australia',
          
                      disabled:
                        true,
          
                      selected:
                        false,
                    },
                  ],
                },
              };
          
              const result =
                generateFormTestData(
                  action,
                );
          
              expect(
                result.values,
              ).toEqual([
                expect.objectContaining({
                  kind:
                    'valid',
          
                  value:
                    'Sri Lanka',
          
                  evidence:
                    expect.arrayContaining([
                      expect.objectContaining({
                        source:
                          'ui',
                      }),
                    ]),
                }),
              ]);
            },
          );
          it(
            'generates deterministic text for an editable combobox without observed options',
            () => {
              const action:
                ActionElement = {
                type:
                  'combobox',
          
                tagName:
                  'input',
          
                role:
                  'combobox',
          
                name:
                  'City',
          
                disabled:
                  false,
          
                visible:
                  true,
          
                formField: {
                  inputType:
                    'text',
          
                  required:
                    true,
          
                  editable:
                    true,
                },
              };
          
              const result =
                generateFormTestData(
                  action,
                );
          
              expect(
                result.values,
              ).toContainEqual(
                expect.objectContaining({
                  kind:
                    'valid',
          
                  value:
                    'test-value',
                }),
              );
          
              expect(
                result.values,
              ).toContainEqual(
                expect.objectContaining({
                  kind:
                    'invalid',
          
                  value:
                    '',
                }),
              );
            },
          );
          it(
            'uses an observed listbox option instead of inventing a value',
            () => {
              const action:
                ActionElement = {
                type:
                  'listbox',
          
                tagName:
                  'div',
          
                role:
                  'listbox',
          
                name:
                  'Plan',
          
                disabled:
                  false,
          
                visible:
                  true,
          
                formField: {
                  required:
                    true,
          
                  editable:
                    false,
          
                  options: [
                    {
                      value:
                        'Starter',
          
                      label:
                        'Starter',
          
                      disabled:
                        false,
          
                      selected:
                        false,
                    },
          
                    {
                      value:
                        'enterprise',
          
                      label:
                        'Enterprise',
          
                      disabled:
                        true,
          
                      selected:
                        false,
                    },
                  ],
                },
              };
          
              const result =
                generateFormTestData(
                  action,
                );
          
              expect(
                result.values,
              ).toEqual([
                expect.objectContaining({
                  kind:
                    'valid',
          
                  value:
                    'Starter',
                }),
              ]);
            },
          );
          it(
            'generates deterministic text values for contenteditable controls',
            () => {
              const action:
                ActionElement = {
                type:
                  'contenteditable',
          
                tagName:
                  'div',
          
                role:
                  'textbox',
          
                name:
                  'Description',
          
                disabled:
                  false,
          
                visible:
                  true,
          
                formField: {
                  inputType:
                    'text',
          
                  required:
                    true,
          
                  editable:
                    true,
          
                  minLength:
                    3,
                },
              };
          
              const result =
                generateFormTestData(
                  action,
                );
          
              expect(
                result.values,
              ).toContainEqual(
                expect.objectContaining({
                  kind:
                    'valid',
          
                  value:
                    expect.any(
                      String,
                    ),
                }),
              );
          
              expect(
                result.values,
              ).toContainEqual(
                expect.objectContaining({
                  kind:
                    'boundary',
          
                  value:
                    'xxx',
                }),
              );
          
              expect(
                result.values,
              ).toContainEqual(
                expect.objectContaining({
                  kind:
                    'invalid',
          
                  value:
                    '',
                }),
              );
            },
          );
    },
);