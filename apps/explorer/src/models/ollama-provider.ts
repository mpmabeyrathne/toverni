import {
    z,
    type ZodType,
} from 'zod';

import {
    actionRankingOutputSchema,
    scenarioGenerationOutputSchema,
    stateAnalysisOutputSchema,
    type ActionRankingInput,
    type ActionRankingOutput,
    type ModelResult,
    type ReasoningTier,
    type ScenarioGenerationInput,
    type ScenarioGenerationOutput,
    type StateAnalysisInput,
    type StateAnalysisOutput,
} from './model-contracts.js';

import type {
    ModelProvider,
} from './model-provider.js';

interface OllamaProviderOptions {
    baseUrl:
    string;

    cheapModel:
    string;

    complexModel:
    string;
}

interface OllamaChatResponse {
    model:
    string;

    message: {
        role:
        string;

        content:
        string;
    };

    prompt_eval_count?:
    number;

    eval_count?:
    number;

    total_duration?:
    number;
}

export class OllamaProvider
    implements ModelProvider {
    readonly name =
        'ollama';

    constructor(
        private readonly options:
            OllamaProviderOptions,
    ) { }

    async analyzeState(
        input:
            StateAnalysisInput,
    ): Promise<
        ModelResult<
            StateAnalysisOutput
        >
    > {
        return this.request(
            'cheap',
            stateAnalysisOutputSchema,
            [
                'Analyze this observed web application state.',
                'Use only supplied evidence.',
                'Do not invent application behavior.',
                '',
                JSON.stringify(
                    input,
                    null,
                    2,
                ),
            ].join('\n'),
        );
    }

    async rankActions(
        input:
            ActionRankingInput,
    ): Promise<
        ModelResult<
            ActionRankingOutput
        >
    > {
        return this.request(
            'cheap',
            actionRankingOutputSchema,
            [
                'Rank the supplied exploration actions.',
                'Deterministic browser facts are already known.',
                'Reason only about semantic exploration value.',
                'Give every action an integer semantic score from 0 to 100.',
                'Higher score means higher exploration value.',
                'Preserve the supplied action id exactly.',
                '',
                JSON.stringify(
                    input,
                    null,
                    2,
                ),
            ].join('\n'),
        );
    }

    async generateScenarios(
        input:
            ScenarioGenerationInput,
    ): Promise<
        ModelResult<
            ScenarioGenerationOutput
        >
    > {
        return this.request(
            'complex',
            scenarioGenerationOutputSchema,
            [
                'Generate grounded QA test scenarios.',
                '',
                'STRICT RULES:',
                '1. Use only the supplied application knowledge.',
                '2. Do not invent unsupported application behavior.',
                '3. Do not assume login, permissions, validation, errors, states, navigation, or recovery behavior unless explicitly supported.',
                '4. Every scenario must include at least one evidenceReferences value.',
                '5. Every evidenceReferences value must be copied verbatim from the Allowed evidence IDs supplied in the input.',
                '6. Never invent an evidence ID.',
                '7. If a scenario cannot be supported by the supplied evidence, do not generate it.',
                '8. Avoid duplicate or near-duplicate scenarios.',
                '9. Use only these scenario types: positive, negative, boundary, navigation, recovery.',
                '',
                JSON.stringify(
                    input,
                    null,
                    2,
                ),
            ].join('\n'),
        );
    }
    private async request<T>(
        reasoningTier:
            ReasoningTier,

        schema:
            ZodType<T>,

        prompt:
            string,
    ): Promise<
        ModelResult<T>
    > {
        const model =
            reasoningTier ===
                'cheap'
                ? this.options
                    .cheapModel
                : this.options
                    .complexModel;

        const startedAt =
            Date.now();

        const response =
            await fetch(
                `${this.options.baseUrl}/api/chat`,
                {
                    method:
                        'POST',

                    headers: {
                        'content-type':
                            'application/json',
                    },

                    body:
                        JSON.stringify({
                            model,

                            stream:
                                false,

                            messages: [
                                {
                                    role:
                                        'system',

                                    content:
                                        'Return only valid JSON matching the requested schema.',
                                },

                                {
                                    role:
                                        'user',

                                    content:
                                        prompt,
                                },
                            ],

                            format:
                                z.toJSONSchema(
                                    schema,
                                ),

                            options: {
                                temperature:
                                    0,
                            },
                        }),
                },
            );

        if (
            !response.ok
        ) {
            const errorBody =
                await response.text();

            throw new Error(
                [
                    `Ollama request failed with status ${response.status}`,
                    errorBody,
                ].join(': '),
            );
        }

        const raw =
            await response.json() as
            OllamaChatResponse;

        let parsedJson:
            unknown;

        try {
            parsedJson =
                JSON.parse(
                    raw.message.content,
                );
        } catch {
            throw new Error(
                'Ollama returned invalid JSON',
            );
        }

        const data =
            schema.parse(
                parsedJson,
            );

        const promptTokens =
            raw.prompt_eval_count ??
            0;

        const completionTokens =
            raw.eval_count ??
            0;

        return {
            data,

            usage: {
                provider:
                    this.name,

                model:
                    raw.model,

                promptTokens,

                completionTokens,

                totalTokens:
                    promptTokens +
                    completionTokens,

                estimatedCostUsd:
                    0,

                durationMs:
                    raw.total_duration
                        ? raw.total_duration /
                        1_000_000
                        : Date.now() -
                        startedAt,

                reasoningTier,
            },
        };
    }
}