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
        it('generates deterministic scenarios with model reasoning disabled', async () => {
            let modelCalled = false;
            const provider: ModelProvider = {
                name: 'disabled-model',
                async analyzeState() { throw new Error('Not used'); },
                async rankActions() { throw new Error('Not used'); },
                async generateScenarios() {
                    modelCalled = true;
                    throw new Error('Model must not run');
                },
            };
            const generator = new GroundedScenarioGenerator(provider);
            const result = await generator.generate({
                evidence: [{
                    id: 'ACTION-NAV',
                    type: 'action',
                    description: 'link: Visit pricing',
                    source: 'action-pricing',
                }],
            }, { skipModel: true });
            expect(modelCalled).toBe(false);
            expect(result.some((scenario) =>
                scenario.title === 'Navigation: Visit pricing'
            )).toBe(true);
        });

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

        it(
            'prioritizes scenarios that close uncovered flow gaps',
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
                                            'Covered booking variant',

                                        type:
                                            'recovery',

                                        preconditions: [],

                                        actions: [
                                            'Recover booking',
                                        ],

                                        expectedOutcomes: [
                                            'Booking recovers',
                                        ],

                                        evidenceReferences: [
                                            'REQ-1',
                                        ],
                                    },

                                    {
                                        title:
                                            'Cancel booking',

                                        type:
                                            'positive',

                                        preconditions: [],

                                        actions: [
                                            'Cancel booking',
                                        ],

                                        expectedOutcomes: [
                                            'Booking is cancelled',
                                        ],

                                        evidenceReferences: [
                                            'FLOW-BUSINESS-2',
                                        ],
                                    },
                                ],
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
                                    'REQ-1',

                                type:
                                    'requirement',

                                description:
                                    'Customer can book a room.',

                                source:
                                    'requirements.md',
                            },

                            {
                                id:
                                    'FLOW-BUSINESS-2',

                                type:
                                    'transition',

                                description:
                                    'Business flow: Cancel booking.',

                                source:
                                    'behavior-2',
                            },
                        ],

                        coverageGaps: [
                            {
                                targetId:
                                    'FLOW-BUSINESS-2',

                                kind:
                                    'flow',

                                status:
                                    'uncovered',

                                evidenceReferences: [
                                    'FLOW-BUSINESS-2',
                                ],
                            },
                        ],
                    });

                expect(
                    result[0]?.title,
                ).toBe(
                    'Cancel booking',
                );

                expect(
                    result[0]
                        ?.rankingReasons
                        .some(
                            (reason) =>
                                reason.includes(
                                    'uncovered coverage evidence',
                                ),
                        ),
                ).toBe(
                    true,
                );
            },
        );

        it(
            'rejects a scenario spanning unrelated transaction boundaries without business-flow evidence',
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
                                            'Book and cancel room',

                                        type:
                                            'positive',

                                        preconditions: [],

                                        actions: [
                                            'Book room',
                                            'Cancel booking',
                                        ],

                                        expectedOutcomes: [
                                            'Booking is cancelled',
                                        ],

                                        evidenceReferences: [
                                            'REQ-1',
                                        ],
                                    },
                                ],
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
                                    'REQ-1',

                                type:
                                    'requirement',

                                description:
                                    'Customer can manage a booking.',

                                source:
                                    'requirements.md',
                            },
                        ],
                    });

                expect(
                    result,
                ).toEqual([]);
            },
        );

        it(
            'allows a multi-transaction scenario only when one grounded business flow explicitly supports it',
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
                                            'Create and submit order',

                                        type:
                                            'positive',

                                        preconditions: [],

                                        actions: [
                                            'Create order',
                                            'Submit order',
                                        ],

                                        expectedOutcomes: [
                                            'Order is submitted',
                                        ],

                                        evidenceReferences: [
                                            'FLOW-BUSINESS-1',
                                        ],
                                    },
                                ],
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
                                    'FLOW-BUSINESS-1',

                                type:
                                    'transition',

                                description:
                                    'Business flow: create order and submit order.',

                                source:
                                    'behavior-1',
                            },
                        ],
                    });

                expect(
                    result,
                ).toHaveLength(1);
            },
        );

        it(
            'retains semantic deduplication reasons in scenario ranking reasons',
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
                                            'Add Mechanical Keyboard to Cart',

                                        type:
                                            'positive',

                                        preconditions: [],

                                        actions: [
                                            'Add Mechanical Keyboard to Cart',
                                        ],

                                        expectedOutcomes: [
                                            'Mechanical Keyboard added to cart',
                                        ],

                                        evidenceReferences: [
                                            'REQ-1',
                                        ],
                                    },

                                    {
                                        title:
                                            'Add Gaming Mouse to Cart',

                                        type:
                                            'positive',

                                        preconditions: [],

                                        actions: [
                                            'Add Gaming Mouse to Cart',
                                        ],

                                        expectedOutcomes: [
                                            'Gaming Mouse added to cart',
                                        ],

                                        evidenceReferences: [
                                            'REQ-1',
                                        ],
                                    },
                                ],
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
                                    'REQ-1',

                                type:
                                    'requirement',

                                description:
                                    'Customer can add a product to cart.',

                                source:
                                    'requirements.md',
                            },
                        ],
                    });

                expect(
                    result,
                ).toHaveLength(1);

                expect(
                    result[0]
                        ?.rankingReasons
                        .some(
                            (reason) =>
                                reason.includes(
                                    'collapsed 2 semantically equivalent scenarios',
                                ),
                        ),
                ).toBe(true);
            },
        );

        it(
            'produces reproducible ordering for the same evidence snapshot',
            async () => {
                let callCount =
                    0;

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
                        callCount +=
                            1;

                        const scenarios = [
                            {
                                title:
                                    'Book room',

                                type:
                                    'positive' as const,

                                preconditions: [],

                                actions: [
                                    'Book room',
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
                                    'Cancel booking',

                                type:
                                    'positive' as const,

                                preconditions: [],

                                actions: [
                                    'Cancel booking',
                                ],

                                expectedOutcomes: [
                                    'Booking is cancelled',
                                ],

                                evidenceReferences: [
                                    'REQ-2',
                                ],
                            },
                        ];

                        return {
                            data: {
                                scenarios:
                                    callCount % 2 ===
                                    0
                                        ? [
                                            ...scenarios,
                                        ].reverse()
                                        : scenarios,
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

                const input = {
                    evidence: [
                        {
                            id:
                                'REQ-1',

                            type:
                                'requirement' as const,

                            description:
                                'Customer can book a room.',

                            source:
                                'requirements.md',
                        },

                        {
                            id:
                                'REQ-2',

                            type:
                                'requirement' as const,

                            description:
                                'Customer can cancel a booking.',

                            source:
                                'requirements.md',
                        },
                    ],
                };

                const first =
                    await generator.generate(
                        input,
                    );

                const second =
                    await generator.generate(
                        input,
                    );

                expect(
                    first.map(
                        (scenario) =>
                            scenario.title,
                    ),
                ).toEqual(
                    second.map(
                        (scenario) =>
                            scenario.title,
                    ),
                );
            },
        );


        it(
            'propagates linked requirement provenance from grounded business-flow evidence',
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
                                            'Upload valid file',

                                        type:
                                            'positive',

                                        preconditions: [],

                                        actions: [
                                            'Upload valid file',
                                        ],

                                        expectedOutcomes: [
                                            'Upload is accepted',
                                        ],

                                        evidenceReferences: [
                                            'FLOW-BUSINESS-1',
                                        ],
                                    },
                                ],
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
                                    'REQ-1',

                                type:
                                    'requirement',

                                description:
                                    'A valid text file can be uploaded.',

                                source:
                                    'requirements.md',
                            },

                            {
                                id:
                                    'FLOW-BUSINESS-1',

                                type:
                                    'transition',

                                description:
                                    'Business flow: upload valid file.',

                                source:
                                    'behavior-1',

                                linkedEvidenceReferences: [
                                    'REQ-1',
                                ],
                            },
                        ],
                    });

                expect(
                    result,
                ).toHaveLength(1);

                expect(
                    result[0]
                        ?.evidenceReferences,
                ).toEqual([
                    'FLOW-BUSINESS-1',
                    'REQ-1',
                ]);
            },
        );

        it(
            'seeds a deterministic scenario from a grounded business behavior',
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
                                    'REQ-4',

                                type:
                                    'requirement',

                                description:
                                    'Retrying succeeds and shows Uploaded.',

                                source:
                                    'requirements.md',
                            },

                            {
                                id:
                                    'FLOW-BUSINESS-1',

                                type:
                                    'transition',

                                description:
                                    'Business flow: Retry.',

                                source:
                                    'behavior-retry',

                                linkedEvidenceReferences: [
                                    'REQ-4',
                                ],
                            },
                        ],

                        businessBehaviors: [
                            {
                                id:
                                    'behavior-retry',

                                sourceFlowIds: [
                                    'flow-1',
                                ],

                                name:
                                    'Retry',

                                startStateId:
                                    'failed',

                                endStateId:
                                    'uploaded',

                                stateIds: [
                                    'failed',
                                    'uploaded',
                                ],

                                transitionIds: [
                                    'transition-retry',
                                ],

                                preconditionTransitionIds: [
                                    'transition-upload',
                                ],

                                steps: [
                                    {
                                        transitionId:
                                            'transition-retry',

                                        fromStateId:
                                            'failed',

                                        toStateId:
                                            'uploaded',

                                        action: {
                                            type:
                                                'click',

                                            target:
                                                'Retry',
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
                                            'transition-retry',

                                        detail:
                                            'Observed recovery action Retry',

                                        networkEventIds: [],
                                    },
                                ],

                                outcome: {
                                    stateId:
                                        'uploaded',

                                    urlChanged:
                                        false,

                                    titleChanged:
                                        false,

                                    addedSemanticText: [
                                        'Uploaded',
                                    ],

                                    removedSemanticText: [
                                        'Upload failed',
                                    ],
                                },

                                requirementEvidenceIds: [
                                    'REQ-4',
                                ],

                                apiOperationIds: [],

                                apiOperationLinks: [],
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
                        'Observed flow: Retry',

                    type:
                        'recovery',

                    actions: [
                        'Retry',
                    ],

                    expectedOutcomes: [
                        'Uploaded',
                        'Retrying succeeds and shows Uploaded.',
                    ],

                    evidenceReferences: [
                        'FLOW-BUSINESS-1',
                        'REQ-4',
                    ],
                });
            },
        );


        it(
            'binds requirement scenarios to matching observed business flow evidence',
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
                                            'Retry succeeds',

                                        type:
                                            'positive',

                                        preconditions: [],

                                        actions: [
                                            'Click Retry',
                                        ],

                                        expectedOutcomes: [
                                            'Uploaded',
                                        ],

                                        evidenceReferences: [
                                            'REQ-4',
                                        ],
                                    },
                                ],
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
                                    'REQ-4',

                                type:
                                    'requirement',

                                description:
                                    'Retrying succeeds and shows Uploaded.',

                                source:
                                    'requirements.md',
                            },

                            {
                                id:
                                    'FLOW-BUSINESS-1',

                                type:
                                    'transition',

                                description:
                                    'Business flow: Retry. Actions: click Retry.',

                                source:
                                    'behavior-retry',

                                linkedEvidenceReferences: [
                                    'REQ-4',
                                ],
                            },

                            {
                                id:
                                    'ACTION-RETRY',

                                type:
                                    'action',

                                description:
                                    'button: Retry',

                                source:
                                    'action-retry',
                            },
                        ],

                        businessBehaviors: [
                            {
                                id:
                                    'behavior-retry',

                                sourceFlowIds: [
                                    'flow-1',
                                ],

                                name:
                                    'Retry',

                                startStateId:
                                    'failed',

                                endStateId:
                                    'uploaded',

                                stateIds: [
                                    'failed',
                                    'uploaded',
                                ],

                                transitionIds: [
                                    'transition-retry',
                                ],

                                preconditionTransitionIds:
                                    [],

                                steps: [
                                    {
                                        transitionId:
                                            'transition-retry',

                                        fromStateId:
                                            'failed',

                                        toStateId:
                                            'uploaded',

                                        action: {
                                            type:
                                                'click',

                                            target:
                                                'Retry',
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
                                            'transition-retry',

                                        detail:
                                            'Observed transactional action "Retry"',

                                        networkEventIds:
                                            [],
                                    },
                                ],

                                outcome: {
                                    stateId:
                                        'uploaded',

                                    urlChanged:
                                        false,

                                    titleChanged:
                                        false,

                                    addedSemanticText: [
                                        'Uploaded',
                                    ],

                                    removedSemanticText: [
                                        'Upload failed',
                                    ],
                                },

                                requirementEvidenceIds: [
                                    'REQ-4',
                                ],

                                apiOperationIds:
                                    [],

                                apiOperationLinks:
                                    [],
                            },
                        ],
                    });

                expect(
                    result.some(
                        (scenario) =>
                            scenario.title ===
                                'Retry succeeds' &&
                            scenario
                                .evidenceReferences
                                .includes(
                                    'FLOW-BUSINESS-1',
                                ),
                    ),
                ).toBe(true);

                expect(
                    result.some(
                        (scenario) =>
                            scenario.title ===
                            'Navigation: Retry',
                    ),
                ).toBe(false);
            },
        );


        it(
            'seeds explicit unsupported requirements as deterministic negative scenarios',
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
                                    'REQ-2',

                                type:
                                    'requirement',

                                description:
                                    'Unsupported file types show a validation error.',

                                source:
                                    'requirements.md',
                            },
                        ],
                    });

                expect(
                    result,
                ).toHaveLength(
                    1,
                );

                expect(
                    result[0],
                ).toMatchObject({
                    type:
                        'negative',

                    evidenceReferences: [
                        'REQ-2',
                    ],
                });

                expect(
                    [
                        result[0]?.title,
                        ...(
                            result[0]
                                ?.actions ??
                            []
                        ),
                        ...(
                            result[0]
                                ?.expectedOutcomes ??
                            []
                        ),
                    ]
                        .join(
                            ' ',
                        )
                        .toLowerCase(),
                ).toContain(
                    'unsupported file types',
                );
            },
        );


        it(
            'does not let stacked coverage references crowd out a distinct uncovered flow',
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
                                            'Combined recovery requirements',

                                        type:
                                            'recovery',

                                        preconditions: [],

                                        actions: [
                                            'Retry',
                                        ],

                                        expectedOutcomes: [
                                            'Uploaded',
                                        ],

                                        evidenceReferences: [
                                            'REQ-3',
                                            'REQ-4',
                                        ],
                                    },
                                ],
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
                                    'REQ-3',

                                type:
                                    'requirement',

                                description:
                                    'First upload attempt fails.',

                                source:
                                    'requirements.md',
                            },

                            {
                                id:
                                    'REQ-4',

                                type:
                                    'requirement',

                                description:
                                    'Retry succeeds.',

                                source:
                                    'requirements.md',
                            },

                            {
                                id:
                                    'FLOW-BUSINESS-CLEAR',

                                type:
                                    'transition',

                                description:
                                    'Business flow: Clear.',

                                source:
                                    'behavior-clear',
                            },
                        ],

                        coverageGaps: [
                            {
                                targetId:
                                    'REQ-3',

                                kind:
                                    'requirement',

                                status:
                                    'uncovered',

                                evidenceReferences: [
                                    'REQ-3',
                                ],
                            },

                            {
                                targetId:
                                    'REQ-4',

                                kind:
                                    'requirement',

                                status:
                                    'uncovered',

                                evidenceReferences: [
                                    'REQ-4',
                                ],
                            },

                            {
                                targetId:
                                    'FLOW-BUSINESS-CLEAR',

                                kind:
                                    'flow',

                                status:
                                    'uncovered',

                                evidenceReferences: [
                                    'FLOW-BUSINESS-CLEAR',
                                ],
                            },
                        ],

                        businessBehaviors: [
                            {
                                id:
                                    'behavior-clear',

                                sourceFlowIds: [
                                    'flow-clear',
                                ],

                                name:
                                    'Clear',

                                startStateId:
                                    'uploaded',

                                endStateId:
                                    'cleared',

                                stateIds: [
                                    'uploaded',
                                    'cleared',
                                ],

                                transitionIds: [
                                    'transition-clear',
                                ],

                                preconditionTransitionIds:
                                    [],

                                steps: [
                                    {
                                        transitionId:
                                            'transition-clear',

                                        fromStateId:
                                            'uploaded',

                                        toStateId:
                                            'cleared',

                                        action: {
                                            type:
                                                'click',

                                            target:
                                                'Clear',
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
                                            'transition-clear',

                                        detail:
                                            'Observed recovery action Clear',

                                        networkEventIds:
                                            [],
                                    },
                                ],

                                outcome: {
                                    stateId:
                                        'cleared',

                                    urlChanged:
                                        false,

                                    titleChanged:
                                        false,

                                    addedSemanticText: [
                                        'No file selected',
                                    ],

                                    removedSemanticText: [
                                        'Uploaded',
                                    ],
                                },

                                requirementEvidenceIds:
                                    [],

                                apiOperationIds:
                                    [],

                                apiOperationLinks:
                                    [],
                            },
                        ],
                    });

                expect(
                    result[0]
                        ?.evidenceReferences,
                ).toContain(
                    'FLOW-BUSINESS-CLEAR',
                );
            },
        );


        it(
            'propagates requirement and observed action provenance into navigation scenarios',
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
                                            'Navigation: Navigate between dashboard and profile',

                                        type:
                                            'navigation',

                                        preconditions:
                                            [],

                                        actions: [
                                            'Click dashboard',
                                            'Click profile',
                                        ],

                                        expectedOutcomes: [
                                            'Signed in session remains active while navigating inside the app',
                                        ],

                                        evidenceReferences: [
                                            'CAP-2',
                                        ],
                                    },
                                ],
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
                                    'REQ-1',

                                type:
                                    'requirement',

                                description:
                                    'A valid user can sign in and a signed-in session remains active while navigating inside the app.',

                                source:
                                    'requirements.md',
                            },

                            {
                                id:
                                    'CAP-2',

                                type:
                                    'capability',

                                description:
                                    'Navigate between dashboard and profile without losing session state.',

                                source:
                                    'requirements.md',
                            },

                            {
                                id:
                                    'ACTION-1',

                                type:
                                    'action',

                                description:
                                    'button: Dashboard',

                                source:
                                    'dashboard-action',
                            },

                            {
                                id:
                                    'ACTION-2',

                                type:
                                    'action',

                                description:
                                    'button: Profile',

                                source:
                                    'profile-action',
                            },
                        ],
                    });

                const navigation =
                    result.find(
                        (scenario) =>
                            scenario.title ===
                            'Navigation: Navigate between dashboard and profile',
                    );

                expect(
                    navigation,
                ).toBeDefined();

                expect(
                    navigation
                        ?.evidenceReferences,
                ).toEqual(
                    expect.arrayContaining([
                        'CAP-2',
                        'REQ-1',
                        'ACTION-2',
                    ]),
                );
            },
        );


        it(
            'maps invalid authentication constraint provenance to the matching negative requirement',
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
                                    'REQ-2',

                                type:
                                    'requirement',

                                description:
                                    'An invalid password shows an authentication error and does not create a session.',

                                source:
                                    'requirements.md',
                            },

                            {
                                id:
                                    'CON-1',

                                type:
                                    'constraint',

                                description:
                                    'Invalid credentials must not authenticate.',

                                source:
                                    'requirements.md',
                            },
                        ],
                    });

                const negative =
                    result.find(
                        (scenario) =>
                            scenario.title.includes(
                                'Invalid credentials must not authenticate',
                            ),
                    );

                expect(
                    negative
                        ?.evidenceReferences,
                ).toEqual(
                    expect.arrayContaining([
                        'CON-1',
                        'REQ-2',
                    ]),
                );
            },
        );


        it(
            'keeps positive admin navigation away from negative forbidden requirements',
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
                                            'Navigation: Admin Panel',

                                        type:
                                            'navigation',

                                        preconditions:
                                            [],

                                        actions: [
                                            'Open admin panel',
                                        ],

                                        expectedOutcomes: [
                                            'Admin panel is displayed',
                                        ],

                                        evidenceReferences: [
                                            'CAP-3',
                                        ],
                                    },
                                ],
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
                                    'REQ-3',

                                type:
                                    'requirement',

                                description:
                                    'Admin users can open the admin panel.',

                                source:
                                    'requirements.md',
                            },

                            {
                                id:
                                    'REQ-4',

                                type:
                                    'requirement',

                                description:
                                    'Standard users are prevented from opening the admin panel.',

                                source:
                                    'requirements.md',
                            },

                            {
                                id:
                                    'CAP-3',

                                type:
                                    'capability',

                                description:
                                    'Role-based admin access.',

                                source:
                                    'requirements.md',
                            },

                            {
                                id:
                                    'ACTION-1',

                                type:
                                    'action',

                                description:
                                    'button: Admin Panel',

                                source:
                                    'admin-action',
                            },
                        ],
                    });

                const admin =
                    result.find(
                        (scenario) =>
                            scenario.title ===
                            'Navigation: Admin Panel',
                    );

                expect(
                    admin
                        ?.evidenceReferences,
                ).toContain(
                    'REQ-3',
                );

                expect(
                    admin
                        ?.evidenceReferences,
                ).not.toContain(
                    'REQ-4',
                );
            },
        );


        it(
            'prioritizes distinct uncovered evidence before stacking variants of the same target',
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
                                            'REQ-1 variant A',

                                        type:
                                            'negative',

                                        preconditions:
                                            [],

                                        actions: [
                                            'Do first invalid case',
                                        ],

                                        expectedOutcomes: [
                                            'First error',
                                        ],

                                        evidenceReferences: [
                                            'REQ-1',
                                        ],
                                    },

                                    {
                                        title:
                                            'REQ-1 variant B',

                                        type:
                                            'negative',

                                        preconditions:
                                            [],

                                        actions: [
                                            'Do second invalid case',
                                        ],

                                        expectedOutcomes: [
                                            'Second error',
                                        ],

                                        evidenceReferences: [
                                            'REQ-1',
                                        ],
                                    },

                                    {
                                        title:
                                            'REQ-2 scenario',

                                        type:
                                            'positive',

                                        preconditions:
                                            [],

                                        actions: [
                                            'Use second capability',
                                        ],

                                        expectedOutcomes: [
                                            'Second outcome',
                                        ],

                                        evidenceReferences: [
                                            'REQ-2',
                                        ],
                                    },

                                    {
                                        title:
                                            'REQ-3 scenario',

                                        type:
                                            'positive',

                                        preconditions:
                                            [],

                                        actions: [
                                            'Use third capability',
                                        ],

                                        expectedOutcomes: [
                                            'Third outcome',
                                        ],

                                        evidenceReferences: [
                                            'REQ-3',
                                        ],
                                    },
                                ],
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
                                    'REQ-1',

                                type:
                                    'requirement',

                                description:
                                    'Invalid first case shows an error.',

                                source:
                                    'requirements.md',
                            },

                            {
                                id:
                                    'REQ-2',

                                type:
                                    'requirement',

                                description:
                                    'Second capability succeeds.',

                                source:
                                    'requirements.md',
                            },

                            {
                                id:
                                    'REQ-3',

                                type:
                                    'requirement',

                                description:
                                    'Third capability succeeds.',

                                source:
                                    'requirements.md',
                            },
                        ],

                        coverageGaps: [
                            {
                                targetId:
                                    'REQ-1',

                                kind:
                                    'requirement',

                                status:
                                    'uncovered',

                                evidenceReferences: [
                                    'REQ-1',
                                ],
                            },

                            {
                                targetId:
                                    'REQ-2',

                                kind:
                                    'requirement',

                                status:
                                    'uncovered',

                                evidenceReferences: [
                                    'REQ-2',
                                ],
                            },

                            {
                                targetId:
                                    'REQ-3',

                                kind:
                                    'requirement',

                                status:
                                    'uncovered',

                                evidenceReferences: [
                                    'REQ-3',
                                ],
                            },
                        ],
                    });

                expect(
                    result
                        .slice(
                            0,
                            3,
                        )
                        .map(
                            (scenario) =>
                                scenario
                                    .evidenceReferences
                                    .find(
                                        (reference) =>
                                            reference.startsWith(
                                                'REQ-',
                                            ),
                                    ),
                        ),
                ).toEqual([
                    'REQ-1',
                    'REQ-2',
                    'REQ-3',
                ]);
            },
        );



        it(
            'grounds negative requirement scenarios from a strongly matching observed business outcome',
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
                                    'REQ-3',

                                type:
                                    'requirement',

                                description:
                                    'Invalid card input shows a validation error.',

                                source:
                                    'requirements.md',
                            },

                            {
                                id:
                                    'CON-2',

                                type:
                                    'constraint',

                                description:
                                    'Card values other than 4242424242424242 are rejected.',

                                source:
                                    'requirements.md',
                            },

                            {
                                id:
                                    'FLOW-BUSINESS-1',

                                type:
                                    'transition',

                                description:
                                    'Business flow: Review Order.',

                                source:
                                    'behavior-invalid-card',
                            },
                        ],

                        businessBehaviors: [
                            {
                                id:
                                    'behavior-invalid-card',

                                sourceFlowIds: [
                                    'flow-invalid-card',
                                ],

                                name:
                                    'Review Order',

                                startStateId:
                                    'card-ready',

                                endStateId:
                                    'card-invalid',

                                stateIds: [
                                    'card-ready',
                                    'card-invalid',
                                ],

                                transitionIds: [
                                    'transition-invalid-card',
                                ],

                                preconditionTransitionIds: [
                                    'transition-fill-invalid-card',
                                ],

                                steps: [
                                    {
                                        transitionId:
                                            'transition-invalid-card',

                                        fromStateId:
                                            'card-ready',

                                        toStateId:
                                            'card-invalid',

                                        action: {
                                            type:
                                                'click',

                                            target:
                                                'Review Order',
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
                                            'transition-invalid-card',

                                        detail:
                                            'Observed invalid-card validation outcome',

                                        networkEventIds: [],
                                    },
                                ],

                                outcome: {
                                    stateId:
                                        'card-invalid',

                                    urlChanged:
                                        false,

                                    titleChanged:
                                        false,

                                    addedSemanticText: [
                                        'Invalid card',
                                    ],

                                    removedSemanticText: [],
                                },

                                requirementEvidenceIds: [],

                                apiOperationIds: [],

                                apiOperationLinks: [],
                            },
                        ],
                    });

                const requirementScenario =
                    result.find(
                        (scenario) =>
                            scenario.title.includes(
                                'Invalid card input shows a validation error',
                            ),
                    );

                const constraintScenario =
                    result.find(
                        (scenario) =>
                            scenario.title.includes(
                                'Card values other than 4242424242424242 are rejected',
                            ),
                    );

                for (
                    const scenario of [
                        requirementScenario,
                        constraintScenario,
                    ]
                ) {
                    expect(
                        scenario,
                    ).toBeDefined();

                    expect(
                        scenario
                            ?.evidenceReferences,
                    ).toContain(
                        'FLOW-BUSINESS-1',
                    );

                    expect(
                        scenario?.actions,
                    ).toEqual([
                        'Review Order',
                    ]);
                }
            },
        );


        it(
            'keeps replayable observed read-query behaviors when canonical completeness is false',
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
                                    'REQ-1',

                                type:
                                    'requirement',

                                description:
                                    'Search filters rows by customer name.',

                                source:
                                    'requirements.md',
                            },

                            {
                                id:
                                    'FLOW-BUSINESS-1',

                                type:
                                    'transition',

                                description:
                                    'Business flow: Search customers.',

                                source:
                                    'behavior-search',

                                linkedEvidenceReferences: [
                                    'REQ-1',
                                ],
                            },
                        ],

                        businessBehaviors: [
                            {
                                id:
                                    'behavior-search',

                                sourceFlowIds: [
                                    'flow-search',
                                ],

                                name:
                                    'Search customers',

                                startStateId:
                                    'grid-all',

                                endStateId:
                                    'grid-filtered',

                                stateIds: [
                                    'grid-all',
                                    'grid-filtered',
                                ],

                                transitionIds: [
                                    'transition-search',
                                ],

                                preconditionTransitionIds: [],

                                steps: [
                                    {
                                        transitionId:
                                            'transition-search',

                                        fromStateId:
                                            'grid-all',

                                        toStateId:
                                            'grid-filtered',

                                        action: {
                                            type:
                                                'fill',

                                            target:
                                                'Search customers',
                                        },
                                    },
                                ],

                                complete:
                                    false,

                                boundaryEvidence: [
                                    {
                                        source:
                                            'action',

                                        transitionId:
                                            'transition-search',

                                        detail:
                                            'Observed read/query interaction "Search customers" with a visible outcome',

                                        networkEventIds: [],
                                    },
                                ],

                                outcome: {
                                    stateId:
                                        'grid-filtered',

                                    urlChanged:
                                        false,

                                    titleChanged:
                                        false,

                                    addedSemanticText: [
                                        'Dan Pending 20',
                                    ],

                                    removedSemanticText: [
                                        'Bob Pending 10',
                                    ],
                                },

                                requirementEvidenceIds: [
                                    'REQ-1',
                                ],

                                apiOperationIds: [],

                                apiOperationLinks: [],
                            },
                        ],
                    });

                expect(
                    result.some(
                        (scenario) =>
                            scenario.title ===
                            'Observed flow: Search customers',
                    ),
                ).toBe(true);
            },
        );


        it(
            'grounds required-field constraint scenarios from an observed validation outcome',
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
                                    'REQ-1',

                                type:
                                    'requirement',

                                description:
                                    'Checkout requires a customer name before continuing.',

                                source:
                                    'requirements.md',
                            },

                            {
                                id:
                                    'CON-1',

                                type:
                                    'constraint',

                                description:
                                    'Empty required fields cannot advance.',

                                source:
                                    'requirements.md',
                            },

                            {
                                id:
                                    'FLOW-BUSINESS-VALIDATE',

                                type:
                                    'transition',

                                description:
                                    'Business flow: Continue.',

                                source:
                                    'behavior-required-name',
                            },
                        ],

                        businessBehaviors: [
                            {
                                id:
                                    'behavior-required-name',

                                sourceFlowIds: [
                                    'flow-required-name',
                                ],

                                name:
                                    'Continue',

                                startStateId:
                                    'checkout-empty-name',

                                endStateId:
                                    'checkout-name-error',

                                stateIds: [
                                    'checkout-empty-name',
                                    'checkout-name-error',
                                ],

                                transitionIds: [
                                    'transition-required-name',
                                ],

                                preconditionTransitionIds: [],

                                steps: [
                                    {
                                        transitionId:
                                            'transition-required-name',

                                        fromStateId:
                                            'checkout-empty-name',

                                        toStateId:
                                            'checkout-name-error',

                                        action: {
                                            type:
                                                'click',

                                            target:
                                                'Continue',
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
                                            'transition-required-name',

                                        detail:
                                            'Observed validation action Continue',

                                        networkEventIds: [],
                                    },
                                ],

                                outcome: {
                                    stateId:
                                        'checkout-name-error',

                                    urlChanged:
                                        false,

                                    titleChanged:
                                        false,

                                    addedSemanticText: [
                                        'Name is required',
                                    ],

                                    removedSemanticText: [],
                                },

                                requirementEvidenceIds: [],

                                apiOperationIds: [],

                                apiOperationLinks: [],
                            },
                        ],
                    });

                const constraintScenario =
                    result.find(
                        (scenario) =>
                            scenario.title.includes(
                                'Empty required fields cannot advance',
                            ),
                    );

                expect(
                    constraintScenario,
                ).toBeDefined();

                expect(
                    constraintScenario
                        ?.evidenceReferences,
                ).toContain(
                    'FLOW-BUSINESS-VALIDATE',
                );

                expect(
                    constraintScenario
                        ?.actions,
                ).toEqual([
                    'Continue',
                ]);
            },
        );
    },
);