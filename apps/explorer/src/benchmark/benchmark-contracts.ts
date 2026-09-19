import {
    z,
  } from 'zod';
  
  export const benchmarkMethodSchema =
    z.enum([
      'toverni',
      'generic_llm',
      'human_reference',
    ]);
  
  export const benchmarkScenarioSchema =
    z.object({
      title:
        z.string(),
  
      actions:
        z.array(
          z.string(),
        ),
  
      expectedOutcomes:
        z.array(
          z.string(),
        ),
  
      executable:
        z.boolean(),
  
      evidenceReferences:
        z.array(
          z.string(),
        )
          .default([]),
  
      unsupportedSteps:
        z.array(
          z.string(),
        )
          .default([]),
  
      humanEditsRequired:
        z.number()
          .int()
          .nonnegative()
          .default(0),
    });
  
  export const benchmarkReferenceFlowSchema =
    z.object({
      id:
        z.string(),
  
      title:
        z.string(),
  
      important:
        z.boolean()
          .default(true),
  
      keywords:
        z.array(
          z.string(),
        ),
    });
  
  export const benchmarkMetricsSchema =
    z.object({
      scenarioCount:
        z.number()
          .int()
          .nonnegative(),
  
      relevantScenarioCount:
        z.number()
          .int()
          .nonnegative(),
  
      executableScenarioCount:
        z.number()
          .int()
          .nonnegative(),
  
      duplicateScenarioCount:
        z.number()
          .int()
          .nonnegative(),
  
      unsupportedStepCount:
        z.number()
          .int()
          .nonnegative(),
  
      coveredImportantFlowCount:
        z.number()
          .int()
          .nonnegative(),
  
      totalImportantFlowCount:
        z.number()
          .int()
          .nonnegative(),
  
      totalHumanEdits:
        z.number()
          .int()
          .nonnegative(),
  
      relevanceRate:
        z.number()
          .min(0)
          .max(1),
  
      executabilityRate:
        z.number()
          .min(0)
          .max(1),
  
      duplicateRate:
        z.number()
          .min(0)
          .max(1),
  
      importantFlowCoverage:
        z.number()
          .min(0)
          .max(1),
  
      unsupportedStepsPerScenario:
        z.number()
          .nonnegative(),
  
      humanEditsPerScenario:
        z.number()
          .nonnegative(),
    });
  
  export type BenchmarkMethod =
    z.infer<
      typeof benchmarkMethodSchema
    >;
  
  export type BenchmarkScenario =
    z.infer<
      typeof benchmarkScenarioSchema
    >;
  
  export type BenchmarkReferenceFlow =
    z.infer<
      typeof benchmarkReferenceFlowSchema
    >;
  
  export type BenchmarkMetrics =
    z.infer<
      typeof benchmarkMetricsSchema
    >;

    export const benchmarkFixtureManifestSchema =
  z.object({
    id:
      z.string()
        .min(1),

    title:
      z.string()
        .min(1),

    entryPath:
      z.string()
        .min(1),

    requirementsPath:
      z.string()
        .min(1),

    openApiPath:
      z.string()
        .min(1),

    humanReferencePath:
      z.string()
        .min(1),
  });

export const benchmarkHumanReferenceSchema =
  z.object({
    flows:
      z.array(
        benchmarkReferenceFlowSchema,
      ),

    scenarios:
      z.array(
        benchmarkScenarioSchema,
      ),
  });

export type BenchmarkFixtureManifest =
  z.infer<
    typeof benchmarkFixtureManifestSchema
  >;

export type BenchmarkHumanReference =
  z.infer<
    typeof benchmarkHumanReferenceSchema
  >;