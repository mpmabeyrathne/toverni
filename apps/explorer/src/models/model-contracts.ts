import { z } from 'zod';

export const reasoningTierSchema =
  z.enum([
    'cheap',
    'complex',
  ]);

export const modelUsageSchema =
  z.object({
    provider:
      z.string(),

    model:
      z.string(),

    promptTokens:
      z.number()
        .int()
        .nonnegative(),

    completionTokens:
      z.number()
        .int()
        .nonnegative(),

    totalTokens:
      z.number()
        .int()
        .nonnegative(),

    estimatedCostUsd:
      z.number()
        .nonnegative(),

    durationMs:
      z.number()
        .nonnegative(),

    reasoningTier:
      reasoningTierSchema,
  });

export const stateAnalysisInputSchema =
  z.object({
    url:
      z.string(),

    title:
      z.string(),

    semanticText:
      z.array(
        z.string(),
      ),

    actions:
      z.array(
        z.object({
          type:
            z.string(),

          name:
            z.string()
              .optional(),

          text:
            z.string()
              .optional(),
        }),
      ),
  });

export const stateAnalysisOutputSchema =
  z.object({
    summary:
      z.string(),

    pageType:
      z.string(),

    capabilities:
      z.array(
        z.string(),
      ),

    risks:
      z.array(
        z.string(),
      ),

    confidence:
      z.number()
        .min(0)
        .max(1),
  });

export const actionRankingInputSchema =
  z.object({
    stateSummary:
      z.string(),

    actions:
      z.array(
        z.object({
          id:
            z.string(),

          label:
            z.string(),

          type:
            z.string(),

          deterministicScore:
            z.number(),
        }),
      ),
  });

export const actionRankingOutputSchema =
  z.object({
    rankedActions:
      z.array(
        z.object({
          id:
            z.string(),

            score:
            z.number()
              .int()
              .min(0)
              .max(100),

          reason:
            z.string(),
        }),
      ),
  });

export const scenarioGenerationInputSchema =
  z.object({
    applicationSummary:
      z.string(),

    capabilities:
      z.array(
        z.string(),
      ),

    requirements:
      z.array(
        z.string(),
      ),

    discoveredFlows:
      z.array(
        z.string(),
      ),
  });

export const scenarioGenerationOutputSchema =
  z.object({
    scenarios:
      z.array(
        z.object({
          title:
            z.string(),

          preconditions:
            z.array(
              z.string(),
            ),

          actions:
            z.array(
              z.string(),
            ),

          expectedOutcomes:
            z.array(
              z.string(),
            ),

          sourceReferences:
            z.array(
              z.string(),
            ),
        }),
      ),
  });

export type ReasoningTier =
  z.infer<
    typeof reasoningTierSchema
  >;

export type ModelUsage =
  z.infer<
    typeof modelUsageSchema
  >;

export type StateAnalysisInput =
  z.infer<
    typeof stateAnalysisInputSchema
  >;

export type StateAnalysisOutput =
  z.infer<
    typeof stateAnalysisOutputSchema
  >;

export type ActionRankingInput =
  z.infer<
    typeof actionRankingInputSchema
  >;

export type ActionRankingOutput =
  z.infer<
    typeof actionRankingOutputSchema
  >;

export type ScenarioGenerationInput =
  z.infer<
    typeof scenarioGenerationInputSchema
  >;

export type ScenarioGenerationOutput =
  z.infer<
    typeof scenarioGenerationOutputSchema
  >;

export interface ModelResult<T> {
  data: T;
  usage: ModelUsage;
}