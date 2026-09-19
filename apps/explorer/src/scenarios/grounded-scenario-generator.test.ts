import {
    describe,
    expect,
    it,
} from 'vitest';

import type {
    ModelProvider,
} from '../models/index.js';

import {
    GroundedScenarioGenerator,
} from './grounded-scenario-generator.js';

describe(
    'GroundedScenarioGenerator',
    () => {
        it(
            'rejects scenarios that reference unknown evidence',
            async () => {
                const provider:
                    ModelProvider = {
                    name:
                        'fake',

                    async analyzeState() {
                        throw new Error(
                            'Not used',
                        );
                    },

                    async rankActions() {
                        throw new Error(
                            'Not used',
                        );
                    },

                    async generateScenarios() {
                        return {
                            data: {
                                scenarios: [
                                    {
                                        title:
                                            'Book available room',

                                        type:
                                            'positive',

                                        preconditions: [],

                                        actions: [
                                            'Book the room',
                                        ],

                                        expectedOutcomes: [
                                            'Booking succeeds',
                                        ],

                                        evidenceReferences: [
                                            'REQ-1',
                                        ],
                                    },

                                    {
                                        title:
                                            'Login before booking',

                                        type:
                                            'positive',

                                        preconditions: [
                                            'User is logged in',
                                        ],

                                        actions: [
                                            'Login',
                                        ],

                                        expectedOutcomes: [
                                            'User is authenticated',
                                        ],

                                        evidenceReferences: [
                                            'AUTH-999',
                                        ],
                                    },

                                    {
                                        title:
                                            'Book for minimum allowed days',

                                        type:
                                            'boundary',

                                        preconditions: [],

                                        actions: [
                                            'Book room for minimum days',
                                        ],

                                        expectedOutcomes: [
                                            'Booking succeeds',
                                        ],

                                        evidenceReferences: [
                                            'CAP-1',
                                        ],
                                    }
                                ],
                            },

                            usage: {
                                provider:
                                    'fake',

                                model:
                                    'fake-model',

                                promptTokens:
                                    10,

                                completionTokens:
                                    10,

                                totalTokens:
                                    20,

                                estimatedCostUsd:
                                    0,

                                durationMs:
                                    1,

                                reasoningTier:
                                    'complex',
                            },
                        };
                    },
                };

                const generator =
                    new GroundedScenarioGenerator(
                        provider,
                    );

                const result =
                    await generator.generate({
                        evidence: [
                            {
                                id:
                                    'REQ-1',

                                type:
                                    'requirement',

                                description:
                                    'A customer can book an available room.',

                                source:
                                    'requirements.md',
                            },
                        ],
                    });

                expect(
                    result,
                ).toHaveLength(1);

                expect(
                    result[0]?.title,
                ).toBe(
                    'Book available room',
                );

                expect(
                    result.some(
                        (scenario) =>
                            scenario.title ===
                            'Login before booking',
                    ),
                ).toBe(false);
            },
        );
        it(
            'creates a deterministic navigation scenario from discovered action evidence',
            async () => {
                const provider:
                    ModelProvider = {
                    name:
                        'fake',

                    async analyzeState() {
                        throw new Error(
                            'Not used',
                        );
                    },

                    async rankActions() {
                        throw new Error(
                            'Not used',
                        );
                    },

                    async generateScenarios() {
                        return {
                            data: {
                                scenarios: [],
                            },

                            usage: {
                                provider:
                                    'fake',

                                model:
                                    'fake-model',

                                promptTokens:
                                    1,

                                completionTokens:
                                    1,

                                totalTokens:
                                    2,

                                estimatedCostUsd:
                                    0,

                                durationMs:
                                    1,

                                reasoningTier:
                                    'complex',
                            },
                        };
                    },
                };

                const generator =
                    new GroundedScenarioGenerator(
                        provider,
                    );

                const result =
                    await generator.generate({
                        evidence: [
                            {
                                id:
                                    'ACTION-1',

                                type:
                                    'action',

                                description:
                                    'link: Learn more',

                                source:
                                    'action-db-id',
                            },
                        ],
                    });

                expect(
                    result,
                ).toHaveLength(1);

                expect(
                    result[0],
                ).toMatchObject({
                    title:
                        'Navigation: Learn more',

                    type:
                        'navigation',

                    evidenceReferences: [
                        'ACTION-1',
                    ],
                });
            },
        );
    },
);