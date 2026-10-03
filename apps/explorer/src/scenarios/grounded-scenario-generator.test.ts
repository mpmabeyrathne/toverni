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

    },
);