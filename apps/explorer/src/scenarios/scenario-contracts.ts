import {
    z,
  } from 'zod';
  
  export const scenarioTypeSchema =
    z.enum([
      'positive',
      'negative',
      'boundary',
      'navigation',
      'recovery',
    ]);
  
  export const evidenceTypeSchema =
    z.enum([
      'requirement',
      'capability',
      'constraint',
      'state',
      'action',
      'transition',
      'api-operation',
    ]);
  
  export const scenarioEvidenceSchema =
    z.object({
      id:
        z.string(),
  
      type:
        evidenceTypeSchema,
  
      description:
        z.string(),
  
      source:
        z.string(),
    });
  
  export const groundedScenarioSchema =
    z.object({
      title:
        z.string()
          .min(1),
  
      type:
        scenarioTypeSchema,
  
      preconditions:
        z.array(
          z.string(),
        ),
  
      actions:
        z.array(
          z.string(),
        )
          .min(1),
  
      expectedOutcomes:
        z.array(
          z.string(),
        )
          .min(1),
  
      evidenceReferences:
        z.array(
          z.string(),
        )
          .min(1),
  
      relevance:
        z.number()
          .min(0)
          .max(100),
  
      risk:
        z.number()
          .min(0)
          .max(100),
  
      confidence:
        z.number()
          .min(0)
          .max(1),
    });
  
  export const groundedScenarioCandidateSchema =
    groundedScenarioSchema.omit({
      relevance:
        true,
  
      risk:
        true,
  
      confidence:
        true,
    });
  
  export type ScenarioType =
    z.infer<
      typeof scenarioTypeSchema
    >;
  
  export type ScenarioEvidence =
    z.infer<
      typeof scenarioEvidenceSchema
    >;
  
  export type GroundedScenario =
    z.infer<
      typeof groundedScenarioSchema
    >;
  
  export type GroundedScenarioCandidate =
    z.infer<
      typeof groundedScenarioCandidateSchema
    >;