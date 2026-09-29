import type {
    ActionElement,
} from '../contracts/page-observation.js';

import type {
    KnowledgeContext,
} from '../knowledge/knowledge-contracts.js';


import {
    resolveFormConstraints,
    type FormConstraintResolutionContext,
    type ResolvedFormConstraints,
} from './form-constraint-resolver.js';

export type TestDataKind =
    | 'valid'
    | 'boundary'
    | 'invalid';

export type TestDataEvidenceSource =
    | 'ui'
    | 'openapi'
    | 'requirements'
    | 'fallback';

export interface TestDataEvidence {
    source:
    TestDataEvidenceSource;

    detail:
    string;
}

export interface GeneratedTestValue {
    kind:
    TestDataKind;

    value:
    string | boolean;

    evidence:
    TestDataEvidence[];
}

export interface FormTestDataResult {
    action:
    ActionElement;

    values:
    GeneratedTestValue[];
}

export function generateFormTestData(
    action:
        ActionElement,

    knowledge?:
        KnowledgeContext,

    context?:
        FormConstraintResolutionContext,
): FormTestDataResult {
    const constraints =
        resolveFormConstraints(
            action,
            knowledge,
            context,
        );

    if (!constraints) {
        return {
            action,
            values: [],
        };
    }

    switch (action.type) {
        case 'select':
          return {
            action,
      
            values:
              generateSelectValues(
                action,
                constraints,
              ),
          };
      
        case 'combobox':
          return {
            action,
      
            values:
              action.formField
                ?.options?.length
                ? generateSelectValues(
                    action,
                    constraints,
                  )
                : action.formField
                    ?.editable
                  ? generateTextValues(
                      constraints,
                    )
                  : [],
          };
      
        case 'listbox':
          return {
            action,
      
            values:
              generateSelectValues(
                action,
                constraints,
              ),
          };
      
        case 'checkbox':
        case 'radio':
          return {
            action,
      
            values:
              generateBooleanValues(
                action,
                constraints,
              ),
          };
      
        case 'textarea':
        case 'contenteditable':
          return {
            action,
      
            values:
              generateTextValues(
                constraints,
              ),
          };
      
        case 'input':
          return {
            action,
      
            values:
              generateInputValues(
                constraints,
              ),
          };
      
        default:
          return {
            action,
      
            values: [],
          };
      }
}

function generateInputValues(
    constraints:
        ResolvedFormConstraints,
): GeneratedTestValue[] {
    switch (
    constraints.inputType
    ) {
        case 'email':
            return generateEmailValues(
                constraints,
            );

        case 'number':
        case 'range':
            return generateNumberValues(
                constraints,
            );

        case 'date':
            return generateDateValues(
                constraints,
            );

        case 'url':
            return generateUrlValues(
                constraints,
            );

        case 'tel':
            return generateTelValues(
                constraints,
            );

        case 'time':
            return generateTimeValues(
                constraints,
            );

        case 'datetime-local':
            return generateDateTimeLocalValues(
                constraints,
            );

        case 'month':
            return generateMonthValues(
                constraints,
            );

        default:
            return generateTextValues(
                constraints,
            );
    }
}

function evidenceFor(
    constraints:
        ResolvedFormConstraints,

    fields:
        Array<
            | 'required'
            | 'inputType'
            | 'min'
            | 'max'
            | 'step'
            | 'minLength'
            | 'maxLength'
            | 'pattern'
            | 'example'
            | 'options'
        >,
): TestDataEvidence[] {
    return constraints.evidence
        .filter(
            (item) =>
                fields.includes(
                    item.field,
                ),
        )
        .map(
            (item) => ({
                source:
                    item.source,

                detail:
                    item.detail,
            }),
        );
}

function generateEmailValues(
    constraints:
        ResolvedFormConstraints,
): GeneratedTestValue[] {
    const values:
        GeneratedTestValue[] = [];

    const candidates:
        string[] = [];

    if (
        typeof constraints.example ===
        'string'
    ) {
        candidates.push(
            constraints.example,
        );
    }

    candidates.push(
        'test@example.com',
        'user@example.com',
        'a@b.co',
    );

    if (
        constraints.minLength !==
        undefined
    ) {
        const candidate =
            createEmailOfLength(
                constraints.minLength,
            );

        if (candidate) {
            candidates.push(
                candidate,
            );
        }
    }

    if (
        constraints.maxLength !==
        undefined
    ) {
        const candidate =
            createEmailOfLength(
                constraints.maxLength,
            );

        if (candidate) {
            candidates.push(
                candidate,
            );
        }
    }

    const validValue =
        candidates.find(
            (candidate) =>
                isValidEmailCandidate(
                    candidate,
                    constraints,
                ),
        );

    if (validValue) {
        values.push({
            kind:
                'valid',

            value:
                validValue,

            evidence:
                typeof constraints.example ===
                    'string' &&
                    validValue ===
                    constraints.example
                    ? evidenceFor(
                        constraints,
                        [
                            'example',
                            'minLength',
                            'maxLength',
                            'pattern',
                        ],
                    )
                    : [
                        ...evidenceFor(
                            constraints,
                            [
                                'minLength',
                                'maxLength',
                                'pattern',
                            ],
                        ),

                        {
                            source:
                                'fallback',

                            detail:
                                'Deterministic email candidate proven against effective constraints',
                        },
                    ],
        });
    }

    if (
        constraints.minLength !==
        undefined
    ) {
        const boundary =
            createEmailOfLength(
                constraints.minLength,
            );

        if (
            boundary &&
            isValidEmailCandidate(
                boundary,
                constraints,
            )
        ) {
            values.push({
                kind:
                    'boundary',

                value:
                    boundary,

                evidence:
                    evidenceFor(
                        constraints,
                        [
                            'minLength',
                            'pattern',
                        ],
                    ),
            });
        }
    }

    if (
        constraints.maxLength !==
        undefined
    ) {
        const boundary =
            createEmailOfLength(
                constraints.maxLength,
            );

        if (
            boundary &&
            isValidEmailCandidate(
                boundary,
                constraints,
            )
        ) {
            values.push({
                kind:
                    'boundary',

                value:
                    boundary,

                evidence:
                    evidenceFor(
                        constraints,
                        [
                            'maxLength',
                            'pattern',
                        ],
                    ),
            });
        }
    }

    if (
        constraints.required
    ) {
        values.push({
            kind:
                'invalid',

            value:
                '',

            evidence:
                evidenceFor(
                    constraints,
                    [
                        'required',
                    ],
                ),
        });
    }

    if (constraints.pattern) {
        const matcher =
            createPatternMatcher(
                constraints.pattern,
            );

        if (matcher) {
            const invalidEmail =
                [
                    'test@example.com',
                    'user@example.com',
                    'a@b.co',
                ].find(
                    (candidate) =>
                        satisfiesLengthConstraints(
                            candidate,
                            constraints,
                        ) &&
                        !matcher.test(
                            candidate,
                        ),
                );

            if (invalidEmail) {
                values.push({
                    kind:
                        'invalid',

                    value:
                        invalidEmail,

                    evidence:
                        evidenceFor(
                            constraints,
                            [
                                'pattern',
                            ],
                        ),
                });
            }
        }
    }

    return deduplicateValues(
        values,
    );
}

function generateUrlValues(
    constraints:
        ResolvedFormConstraints,
): GeneratedTestValue[] {
    const values:
        GeneratedTestValue[] = [];

    const candidates:
        string[] = [];

    if (
        typeof constraints.example ===
        'string'
    ) {
        candidates.push(
            constraints.example,
        );
    }

    candidates.push(
        'https://example.com',
        'https://example.com/test',
    );

    const validValue =
        candidates.find(
            (candidate) =>
                isValidUrlCandidate(
                    candidate,
                    constraints,
                ),
        );

    if (validValue) {
        values.push({
            kind:
                'valid',

            value:
                validValue,

            evidence:
                typeof constraints.example ===
                    'string' &&
                    validValue ===
                    constraints.example
                    ? evidenceFor(
                        constraints,
                        [
                            'example',
                            'minLength',
                            'maxLength',
                            'pattern',
                        ],
                    )
                    : [
                        ...evidenceFor(
                            constraints,
                            [
                                'minLength',
                                'maxLength',
                                'pattern',
                            ],
                        ),

                        {
                            source:
                                'fallback',

                            detail:
                                'Deterministic URL candidate proven against effective constraints',
                        },
                    ],
        });
    }

    if (
        constraints.required
    ) {
        values.push({
            kind:
                'invalid',

            value:
                '',

            evidence:
                evidenceFor(
                    constraints,
                    [
                        'required',
                    ],
                ),
        });
    }

    const invalidCandidates = [
        'not-a-url',
        'example',
        '://invalid',
    ];

    const invalidValue =
        invalidCandidates.find(
            (candidate) =>
                satisfiesLengthConstraints(
                    candidate,
                    constraints,
                ) &&
                !isValidUrlCandidate(
                    candidate,
                    constraints,
                ),
        );

    if (invalidValue) {
        values.push({
            kind:
                'invalid',

            value:
                invalidValue,

            evidence: [
                ...evidenceFor(
                    constraints,
                    [
                        'pattern',
                        'minLength',
                        'maxLength',
                    ],
                ),

                {
                    source:
                        'ui',

                    detail:
                        'Value does not satisfy URL input semantics',
                },
            ],
        });
    }

    return deduplicateValues(
        values,
    );
}

function isUrlLike(
    value:
        string,
): boolean {
    try {
        const parsed =
            new URL(value);

        return (
            parsed.protocol ===
            'http:' ||
            parsed.protocol ===
            'https:'
        );
    } catch {
        return false;
    }
}

function isValidUrlCandidate(
    value:
        string,

    constraints:
        ResolvedFormConstraints,
): boolean {
    return (
        isUrlLike(
            value,
        ) &&
        satisfiesLengthConstraints(
            value,
            constraints,
        ) &&
        satisfiesPatternConstraint(
            value,
            constraints,
        )
    );
}

function generateNumberValues(
    constraints:
        ResolvedFormConstraints,
): GeneratedTestValue[] {
    const values:
        GeneratedTestValue[] = [];

    const min =
        parseFiniteNumber(
            constraints.min,
        );

    const max =
        parseFiniteNumber(
            constraints.max,
        );

    const step =
        resolveNumericStep(
            constraints.step,
        );

    const stepBase =
        min ?? 0;

    const example =
        parseExampleNumber(
            constraints.example,
        );

    if (
        example !== null &&
        isValidNumericCandidate(
            example,
            min,
            max,
            step,
            stepBase,
        )
    ) {
        values.push({
            kind:
                'valid',

            value:
                formatNumber(
                    example,
                ),

            evidence:
                evidenceFor(
                    constraints,
                    [
                        'example',
                        'min',
                        'max',
                        'step',
                    ],
                ),
        });
    } else {
        const generatedValid =
            findValidNumericValue(
                min,
                max,
                step,
                stepBase,
            );

        if (
            generatedValid !==
            null
        ) {
            values.push({
                kind:
                    'valid',

                value:
                    formatNumber(
                        generatedValid,
                    ),

                evidence: [
                    ...evidenceFor(
                        constraints,
                        [
                            'min',
                            'max',
                            'step',
                        ],
                    ),

                    {
                        source:
                            'fallback',

                        detail:
                            'Deterministic numeric value satisfying effective constraints',
                    },
                ],
            });
        }
    }

    // ------------------------------
    // Lower valid boundary
    // ------------------------------

    if (
        min !== null &&
        isValidNumericCandidate(
            min,
            min,
            max,
            step,
            stepBase,
        )
    ) {
        values.push({
            kind:
                'boundary',

            value:
                formatNumber(
                    min,
                ),

            evidence:
                evidenceFor(
                    constraints,
                    [
                        'min',
                        'step',
                    ],
                ),
        });
    }

    // ------------------------------
    // Upper reachable boundary
    // ------------------------------

    if (max !== null) {
        const upperBoundary =
            findHighestValidAtOrBelow(
                max,
                min,
                step,
                stepBase,
            );

        if (
            upperBoundary !==
            null &&
            isValidNumericCandidate(
                upperBoundary,
                min,
                max,
                step,
                stepBase,
            )
        ) {
            values.push({
                kind:
                    'boundary',

                value:
                    formatNumber(
                        upperBoundary,
                    ),

                evidence:
                    evidenceFor(
                        constraints,
                        [
                            'max',
                            'min',
                            'step',
                        ],
                    ),
            });
        }
    }

    // ------------------------------
    // Invalid below minimum
    // ------------------------------

    if (min !== null) {
        const delta =
            step ?? 1;

        values.push({
            kind:
                'invalid',

            value:
                formatNumber(
                    min - delta,
                ),

            evidence:
                evidenceFor(
                    constraints,
                    [
                        'min',
                        'step',
                    ],
                ),
        });
    }

    // ------------------------------
    // Invalid above maximum
    // ------------------------------

    if (max !== null) {
        const delta =
            step ?? 1;

        values.push({
            kind:
                'invalid',

            value:
                formatNumber(
                    max + delta,
                ),

            evidence:
                evidenceFor(
                    constraints,
                    [
                        'max',
                        'step',
                    ],
                ),
        });
    }

    // ------------------------------
    // Invalid step mismatch
    // only when explicit step exists
    // ------------------------------

    if (
        step !== null &&
        constraints.step !==
        undefined
    ) {
        const stepMismatch =
            findStepMismatchValue(
                min,
                max,
                step,
                stepBase,
            );

        if (
            stepMismatch !==
            null
        ) {
            values.push({
                kind:
                    'invalid',

                value:
                    formatNumber(
                        stepMismatch,
                    ),

                evidence:
                    evidenceFor(
                        constraints,
                        [
                            'step',
                            'min',
                            'max',
                        ],
                    ),
            });
        }
    }

    return deduplicateValues(
        values,
    );
}

function generateDateValues(
    constraints:
        ResolvedFormConstraints,
): GeneratedTestValue[] {
    return generateTemporalValues(
        constraints,
        '2026-01-01',
        isDateLike,
    );
}
function generateTextValues(
    constraints:
        ResolvedFormConstraints,
): GeneratedTestValue[] {
    const values:
        GeneratedTestValue[] = [];

    const validValue =
        findDeterministicTextCandidate(
            constraints,
        );

    if (
        validValue !== null
    ) {
        values.push({
            kind:
                'valid',

            value:
                validValue,

            evidence:
                typeof constraints.example ===
                    'string' &&
                    validValue ===
                    constraints.example
                    ? evidenceFor(
                        constraints,
                        [
                            'example',
                            'minLength',
                            'maxLength',
                            'pattern',
                        ],
                    )
                    : [
                        ...evidenceFor(
                            constraints,
                            [
                                'minLength',
                                'maxLength',
                                'pattern',
                            ],
                        ),

                        {
                            source:
                                'fallback',

                            detail:
                                'Deterministic text candidate proven against effective constraints',
                        },
                    ],
        });
    }

    if (
        constraints.minLength !==
        undefined
    ) {
        const boundary =
            createRepeatedText(
                constraints.minLength,
            );

        if (
            isValidTextCandidate(
                boundary,
                constraints,
            )
        ) {
            values.push({
                kind:
                    'boundary',

                value:
                    boundary,

                evidence:
                    evidenceFor(
                        constraints,
                        [
                            'minLength',
                            'pattern',
                        ],
                    ),
            });
        }
    }

    if (
        constraints.maxLength !==
        undefined
    ) {
        const boundary =
            createRepeatedText(
                constraints.maxLength,
            );

        if (
            isValidTextCandidate(
                boundary,
                constraints,
            )
        ) {
            values.push({
                kind:
                    'boundary',

                value:
                    boundary,

                evidence:
                    evidenceFor(
                        constraints,
                        [
                            'maxLength',
                            'pattern',
                        ],
                    ),
            });
        }
    }

    if (
        constraints.required
    ) {
        values.push({
            kind:
                'invalid',

            value:
                '',

            evidence:
                evidenceFor(
                    constraints,
                    [
                        'required',
                    ],
                ),
        });
    }

    if (
        constraints.minLength !==
        undefined &&
        constraints.minLength >
        0
    ) {
        values.push({
            kind:
                'invalid',

            value:
                createRepeatedText(
                    constraints.minLength -
                    1,
                ),

            evidence:
                evidenceFor(
                    constraints,
                    [
                        'minLength',
                    ],
                ),
        });
    }

    if (
        constraints.maxLength !==
        undefined
    ) {
        values.push({
            kind:
                'invalid',

            value:
                createRepeatedText(
                    constraints.maxLength +
                    1,
                ),

            evidence:
                evidenceFor(
                    constraints,
                    [
                        'maxLength',
                    ],
                ),
        });
    }

    const patternInvalid =
        findPatternInvalidCandidate(
            constraints,
        );

    if (
        patternInvalid !==
        null
    ) {
        values.push({
            kind:
                'invalid',

            value:
                patternInvalid,

            evidence:
                evidenceFor(
                    constraints,
                    [
                        'pattern',
                    ],
                ),
        });
    }

    return deduplicateValues(
        values,
    );
}

function createEmailOfLength(
    length:
        number,
): string | null {
    const suffix =
        '@b.co';

    const localLength =
        length -
        suffix.length;

    if (
        localLength < 1
    ) {
        return null;
    }

    return (
        'a'.repeat(
            localLength,
        ) +
        suffix
    );
}

function isValidEmailCandidate(
    value:
        string,

    constraints:
        ResolvedFormConstraints,
): boolean {
    return (
        isEmailLike(
            value,
        ) &&
        satisfiesLengthConstraints(
            value,
            constraints,
        ) &&
        satisfiesPatternConstraint(
            value,
            constraints,
        )
    );
}

function generateSelectValues(
    action:
        ActionElement,

    constraints:
        ResolvedFormConstraints,
): GeneratedTestValue[] {
    const observedOptions =
        action.formField
            ?.options
            ?.filter(
                (option) =>
                    !option.disabled &&
                    option.value !==
                    '' &&
                    option.label.trim() !==
                    '',
            ) ??
        [];

    if (
        observedOptions.length ===
        0
    ) {
        return [];
    }

    const example =
        constraints.example !==
            undefined
            ? String(
                constraints.example,
            )
            : undefined;

    const exampleOption =
        example !== undefined
            ? observedOptions.find(
                (option) =>
                    option.value ===
                    example ||
                    option.label ===
                    example,
            )
            : undefined;

    const selectedOption =
        exampleOption ??
        observedOptions.find(
            (option) =>
                option.selected,
        ) ??
        observedOptions[0];

    if (!selectedOption) {
        return [];
    }

    const executionValue =
        action.type ===
            'select'
            ? selectedOption.value
            : selectedOption.label;

    return [
        {
            kind:
                'valid',

            value:
                executionValue,

            evidence:
                exampleOption
                    ? [
                        ...evidenceFor(
                            constraints,
                            [
                                'example',
                                'options',
                            ],
                        ),
                    ]
                    : evidenceFor(
                        constraints,
                        [
                            'options',
                        ],
                    ),
        },
    ];
}
function generateBooleanValues(
    action:
        ActionElement,

    constraints:
        ResolvedFormConstraints,
): GeneratedTestValue[] {
    const example =
        typeof constraints.example ===
            'boolean'
            ? constraints.example
            : undefined;

    const requiredCheckbox =
        action.type ===
        'checkbox' &&
        constraints.required;

    const values:
        GeneratedTestValue[] = [];

    values.push({
        kind:
            'valid',

        value:
            requiredCheckbox
                ? true
                : example ??
                true,

        evidence:
            requiredCheckbox
                ? evidenceFor(
                    constraints,
                    [
                        'required',
                    ],
                )
                : example !==
                    undefined
                    ? evidenceFor(
                        constraints,
                        [
                            'example',
                        ],
                    )
                    : [
                        {
                            source:
                                'ui',

                            detail:
                                'Derived deterministic boolean value from observable boolean field type',
                        },
                    ],
    });

    if (
        requiredCheckbox
    ) {
        values.push({
            kind:
                'invalid',

            value:
                false,

            evidence:
                evidenceFor(
                    constraints,
                    [
                        'required',
                    ],
                ),
        });
    }

    return deduplicateValues(
        values,
    );
}

function fitLength(
    value:
        string,

    minLength?:
        number,

    maxLength?:
        number,
): string {
    let result =
        value;

    if (
        maxLength !==
        undefined &&
        result.length >
        maxLength
    ) {
        result =
            result.slice(
                0,
                maxLength,
            );
    }

    if (
        minLength !==
        undefined &&
        result.length <
        minLength
    ) {
        result =
            result.padEnd(
                minLength,
                'x',
            );
    }

    return result;
}

function createRepeatedText(
    length:
        number,
): string {
    return 'x'.repeat(
        length,
    );
}

function createPatternMatcher(
    pattern:
        string | undefined,
): RegExp | null {
    if (!pattern) {
        return null;
    }

    try {
        return new RegExp(
            `^(?:${pattern})$`,
            'v',
        );
    } catch {
        try {
            return new RegExp(
                `^(?:${pattern})$`,
            );
        } catch {
            return null;
        }
    }
}

function satisfiesLengthConstraints(
    value:
        string,

    constraints:
        ResolvedFormConstraints,
): boolean {
    if (
        constraints.minLength !==
        undefined &&
        value.length <
        constraints.minLength
    ) {
        return false;
    }

    if (
        constraints.maxLength !==
        undefined &&
        value.length >
        constraints.maxLength
    ) {
        return false;
    }

    return true;
}

function satisfiesPatternConstraint(
    value:
        string,

    constraints:
        ResolvedFormConstraints,
): boolean {
    if (!constraints.pattern) {
        return true;
    }

    const matcher =
        createPatternMatcher(
            constraints.pattern,
        );

    if (!matcher) {
        // We cannot prove that the
        // candidate satisfies the
        // browser-observed pattern.
        return false;
    }

    return matcher.test(
        value,
    );
}

function isValidTextCandidate(
    value:
        string,

    constraints:
        ResolvedFormConstraints,
): boolean {
    return (
        satisfiesLengthConstraints(
            value,
            constraints,
        ) &&
        satisfiesPatternConstraint(
            value,
            constraints,
        )
    );
}

function findDeterministicTextCandidate(
    constraints:
        ResolvedFormConstraints,
): string | null {
    const candidates: string[] =
        [];

    if (
        typeof constraints.example ===
        'string'
    ) {
        candidates.push(
            constraints.example,
        );
    }

    const fallbackCandidates = [
        'test-value',
        'test',
        'TEST',
        'ABC1234',
        '1234',
        'abc',
        'ABC',
    ];

    for (
        const candidate of
        fallbackCandidates
    ) {
        candidates.push(
            fitLength(
                candidate,
                constraints.minLength,
                constraints.maxLength,
            ),
        );
    }

    for (
        const candidate of
        candidates
    ) {
        if (
            isValidTextCandidate(
                candidate,
                constraints,
            )
        ) {
            return candidate;
        }
    }

    return null;
}

function findPatternInvalidCandidate(
    constraints:
        ResolvedFormConstraints,
): string | null {
    if (!constraints.pattern) {
        return null;
    }

    const matcher =
        createPatternMatcher(
            constraints.pattern,
        );

    if (!matcher) {
        return null;
    }

    const candidates = [
        'invalid',
        'test-value',
        'abc',
        'ABC',
        '1234',
        'ABC1234',
    ];

    for (
        const rawCandidate of
        candidates
    ) {
        const candidate =
            fitLength(
                rawCandidate,
                constraints.minLength,
                constraints.maxLength,
            );

        if (
            satisfiesLengthConstraints(
                candidate,
                constraints,
            ) &&
            !matcher.test(
                candidate,
            )
        ) {
            return candidate;
        }
    }

    return null;
}

function resolveNumericStep(
    rawStep:
        string | undefined,
): number | null {
    if (
        rawStep?.trim()
            .toLowerCase() ===
        'any'
    ) {
        return null;
    }

    if (
        rawStep ===
        undefined ||
        rawStep.trim() ===
        ''
    ) {
        return 1;
    }

    const parsed =
        Number(rawStep);

    if (
        !Number.isFinite(
            parsed,
        ) ||
        parsed <= 0
    ) {
        return 1;
    }

    return parsed;
}

function parseExampleNumber(
    value:
        string |
        boolean |
        undefined,
): number | null {
    if (
        typeof value ===
        'boolean' ||
        value === undefined
    ) {
        return null;
    }

    const parsed =
        Number(value);

    return Number.isFinite(
        parsed,
    )
        ? parsed
        : null;
}

function isWithinNumericBounds(
    value:
        number,

    min:
        number | null,

    max:
        number | null,
): boolean {
    if (
        min !== null &&
        value < min
    ) {
        return false;
    }

    if (
        max !== null &&
        value > max
    ) {
        return false;
    }

    return true;
}

function isStepAligned(
    value:
        number,

    step:
        number | null,

    stepBase:
        number,
): boolean {
    if (step === null) {
        return true;
    }

    const quotient =
        (value - stepBase) /
        step;

    return (
        Math.abs(
            quotient -
            Math.round(
                quotient,
            ),
        ) <
        1e-9
    );
}

function isValidNumericCandidate(
    value:
        number,

    min:
        number | null,

    max:
        number | null,

    step:
        number | null,

    stepBase:
        number,
): boolean {
    return (
        Number.isFinite(
            value,
        ) &&
        isWithinNumericBounds(
            value,
            min,
            max,
        ) &&
        isStepAligned(
            value,
            step,
            stepBase,
        )
    );
}

function generateTelValues(
    constraints:
        ResolvedFormConstraints,
): GeneratedTestValue[] {
    const values:
        GeneratedTestValue[] = [];

    const candidates:
        string[] = [];

    if (
        typeof constraints.example ===
        'string'
    ) {
        candidates.push(
            constraints.example,
        );
    }

    candidates.push(
        '+15551234567',
        '0771234567',
        '5551234567',
    );

    const validValue =
        candidates.find(
            (candidate) =>
                isValidTextCandidate(
                    candidate,
                    constraints,
                ),
        );

    if (validValue) {
        values.push({
            kind:
                'valid',

            value:
                validValue,

            evidence:
                typeof constraints.example ===
                    'string' &&
                    validValue ===
                    constraints.example
                    ? evidenceFor(
                        constraints,
                        [
                            'example',
                            'minLength',
                            'maxLength',
                            'pattern',
                        ],
                    )
                    : [
                        ...evidenceFor(
                            constraints,
                            [
                                'minLength',
                                'maxLength',
                                'pattern',
                            ],
                        ),

                        {
                            source:
                                'fallback',

                            detail:
                                'Deterministic telephone candidate proven against observable constraints',
                        },
                    ],
        });
    }

    if (
        constraints.required
    ) {
        values.push({
            kind:
                'invalid',

            value:
                '',

            evidence:
                evidenceFor(
                    constraints,
                    [
                        'required',
                    ],
                ),
        });
    }

    const patternInvalid =
        findPatternInvalidCandidate(
            constraints,
        );

    if (
        patternInvalid !==
        null
    ) {
        values.push({
            kind:
                'invalid',

            value:
                patternInvalid,

            evidence:
                evidenceFor(
                    constraints,
                    [
                        'pattern',
                    ],
                ),
        });
    }

    return deduplicateValues(
        values,
    );
}

function generateTemporalValues(
    constraints:
        ResolvedFormConstraints,

    fallback:
        string,

    validator: (
        value:
            string,
    ) => boolean,
): GeneratedTestValue[] {
    const values:
        GeneratedTestValue[] = [];

    const candidates:
        string[] = [];

    if (
        typeof constraints.example ===
        'string'
    ) {
        candidates.push(
            constraints.example,
        );
    }

    if (constraints.min) {
        candidates.push(
            constraints.min,
        );
    }

    if (constraints.max) {
        candidates.push(
            constraints.max,
        );
    }

    candidates.push(
        fallback,
    );

    const validValue =
        candidates.find(
            (candidate) =>
                validator(
                    candidate,
                ) &&
                isTemporalWithinBounds(
                    candidate,
                    constraints.min,
                    constraints.max,
                ),
        );

    if (validValue) {
        values.push({
            kind:
                'valid',

            value:
                validValue,

            evidence:
                typeof constraints.example ===
                    'string' &&
                    validValue ===
                    constraints.example
                    ? evidenceFor(
                        constraints,
                        [
                            'example',
                            'min',
                            'max',
                        ],
                    )
                    : validValue ===
                        constraints.min
                        ? evidenceFor(
                            constraints,
                            [
                                'min',
                            ],
                        )
                        : validValue ===
                            constraints.max
                            ? evidenceFor(
                                constraints,
                                [
                                    'max',
                                ],
                            )
                            : [
                                {
                                    source:
                                        'fallback',

                                    detail:
                                        'Deterministic temporal fallback satisfying effective bounds',
                                },
                            ],
        });
    }

    if (
        constraints.min &&
        validator(
            constraints.min,
        )
    ) {
        values.push({
            kind:
                'boundary',

            value:
                constraints.min,

            evidence:
                evidenceFor(
                    constraints,
                    [
                        'min',
                    ],
                ),
        });
    }

    if (
        constraints.max &&
        validator(
            constraints.max,
        )
    ) {
        values.push({
            kind:
                'boundary',

            value:
                constraints.max,

            evidence:
                evidenceFor(
                    constraints,
                    [
                        'max',
                    ],
                ),
        });
    }

    if (
        constraints.required
    ) {
        values.push({
            kind:
                'invalid',

            value:
                '',

            evidence:
                evidenceFor(
                    constraints,
                    [
                        'required',
                    ],
                ),
        });
    }

    return deduplicateValues(
        values,
    );
}

function isTemporalWithinBounds(
    value:
        string,

    min:
        string | undefined,

    max:
        string | undefined,
): boolean {
    if (
        min !== undefined &&
        value < min
    ) {
        return false;
    }

    if (
        max !== undefined &&
        value > max
    ) {
        return false;
    }

    return true;
}

function generateTimeValues(
    constraints:
        ResolvedFormConstraints,
): GeneratedTestValue[] {
    return generateTemporalValues(
        constraints,
        '12:00',
        isTimeLike,
    );
}

function generateDateTimeLocalValues(
    constraints:
        ResolvedFormConstraints,
): GeneratedTestValue[] {
    return generateTemporalValues(
        constraints,
        '2026-01-01T12:00',
        isDateTimeLocalLike,
    );
}

function generateMonthValues(
    constraints:
        ResolvedFormConstraints,
): GeneratedTestValue[] {
    return generateTemporalValues(
        constraints,
        '2026-01',
        isMonthLike,
    );
}

function isTimeLike(
    value:
        string,
): boolean {
    if (
        !/^\d{2}:\d{2}(?::\d{2})?$/.test(
            value,
        )
    ) {
        return false;
    }

    const [
        hourText,
        minuteText,
        secondText,
    ] =
        value.split(':');

    const hour =
        Number(
            hourText,
        );

    const minute =
        Number(
            minuteText,
        );

    const second =
        secondText ===
            undefined
            ? 0
            : Number(
                secondText,
            );

    return (
        hour >= 0 &&
        hour <= 23 &&
        minute >= 0 &&
        minute <= 59 &&
        second >= 0 &&
        second <= 59
    );
}

function isMonthLike(
    value:
        string,
): boolean {
    const match =
        /^(\d{4})-(\d{2})$/.exec(
            value,
        );

    if (!match) {
        return false;
    }

    const month =
        Number(
            match[2],
        );

    return (
        month >= 1 &&
        month <= 12
    );
}

function isDateTimeLocalLike(
    value:
        string,
): boolean {
    const match =
        /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)$/.exec(
            value,
        );

    if (!match) {
        return false;
    }

    const datePart =
        match[1];

    const timePart =
        match[2];

    if (
        datePart ===
        undefined ||
        timePart ===
        undefined
    ) {
        return false;
    }

    return (
        isDateLike(
            datePart,
        ) &&
        isTimeLike(
            timePart,
        )
    );
}


function isDateLike(
    value:
        string,
): boolean {
    const match =
        /^(\d{4})-(\d{2})-(\d{2})$/.exec(
            value,
        );

    if (!match) {
        return false;
    }

    const year =
        Number(
            match[1],
        );

    const month =
        Number(
            match[2],
        );

    const day =
        Number(
            match[3],
        );

    const date =
        new Date(
            Date.UTC(
                year,
                month - 1,
                day,
            ),
        );

    return (
        date.getUTCFullYear() ===
        year &&
        date.getUTCMonth() ===
        month - 1 &&
        date.getUTCDate() ===
        day
    );
}

function findValidNumericValue(
    min:
        number | null,

    max:
        number | null,

    step:
        number | null,

    stepBase:
        number,
): number | null {
    if (step === null) {
        if (
            min !== null &&
            max !== null
        ) {
            return (
                min +
                (max - min) /
                2
            );
        }

        if (min !== null) {
            return min;
        }

        if (max !== null) {
            return max;
        }

        return 1;
    }

    if (
        min !== null &&
        max !== null
    ) {
        const availableSteps =
            Math.floor(
                (max - stepBase) /
                step +
                1e-9,
            );

        if (
            availableSteps < 0
        ) {
            return null;
        }

        const middleStep =
            Math.floor(
                availableSteps /
                2,
            );

        return (
            stepBase +
            middleStep * step
        );
    }

    if (min !== null) {
        return min;
    }

    if (max !== null) {
        return findHighestValidAtOrBelow(
            max,
            min,
            step,
            stepBase,
        );
    }

    return step;
}

function findHighestValidAtOrBelow(
    max:
        number,

    min:
        number | null,

    step:
        number | null,

    stepBase:
        number,
): number | null {
    if (step === null) {
        return max;
    }

    const stepCount =
        Math.floor(
            (max - stepBase) /
            step +
            1e-9,
        );

    if (stepCount < 0) {
        return null;
    }

    const candidate =
        stepBase +
        stepCount * step;

    if (
        min !== null &&
        candidate < min
    ) {
        return null;
    }

    return candidate;
}

function findStepMismatchValue(
    min:
        number | null,

    max:
        number | null,

    step:
        number,

    stepBase:
        number,
): number | null {
    const candidate =
        stepBase +
        step / 2;

    if (
        !isWithinNumericBounds(
            candidate,
            min,
            max,
        )
    ) {
        return null;
    }

    if (
        isStepAligned(
            candidate,
            step,
            stepBase,
        )
    ) {
        return null;
    }

    return candidate;
}

function formatNumber(
    value:
        number,
): string {
    const normalized =
        Math.abs(value) <
            1e-12
            ? 0
            : Number(
                value.toFixed(
                    12,
                ),
            );

    return String(
        normalized,
    );
}

function parseFiniteNumber(
    value:
        string | undefined,
): number | null {
    if (
        value ===
        undefined ||
        value.trim() === ''
    ) {
        return null;
    }

    const parsed =
        Number(value);

    return Number.isFinite(
        parsed,
    )
        ? parsed
        : null;
}

function isEmailLike(
    value:
        string,
): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        value,
    );
}

function deduplicateValues(
    values:
        GeneratedTestValue[],
): GeneratedTestValue[] {
    const seen =
        new Set<string>();

    return values.filter(
        (item) => {
            const key =
                `${item.kind}:${String(item.value)}`;

            if (
                seen.has(key)
            ) {
                return false;
            }

            seen.add(key);

            return true;
        },
    );
}