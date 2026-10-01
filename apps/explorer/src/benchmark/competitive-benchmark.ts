import {
  z,
} from 'zod';

export const competitiveToolSchema =
  z.object({
    id:
      z.string()
        .min(1),

    name:
      z.string()
        .min(1),

    category:
      z.enum([
        'product',
        'generic_llm',
        'ai_test_agent',
        'recorder_generator',
      ]),

    version:
      z.string()
        .min(1),

    inputMode:
      z.string()
        .min(1),

    executionMode:
      z.string()
        .min(1),

    reproducibilityNotes:
      z.string()
        .min(1),
  });

export const competitiveBenchmarkManifestSchema =
  z.object({
    version:
      z.string()
        .min(1),

    frozenFixtureIds:
      z.array(
        z.string()
          .min(1),
      )
        .min(1),

    rubricVersion:
      z.string()
        .min(1),

    tools:
      z.array(
        competitiveToolSchema,
      )
        .min(4),
  });

export type CompetitiveTool =
  z.infer<
    typeof competitiveToolSchema
  >;

export type CompetitiveBenchmarkManifest =
  z.infer<
    typeof competitiveBenchmarkManifestSchema
  >;
