import {
    z,
  } from 'zod';
  
  import {
    businessFlowStepSchema,
  } from './business-flow.js';
  
  export const businessBoundaryEvidenceSchema =
    z.object({
      source:
        z.enum([
          'action',
          'network',
        ]),
  
      transitionId:
        z.string(),
  
      detail:
        z.string(),
  
      networkEventIds:
        z.array(
          z.string(),
        ),
    });
  
  export const businessFlowOutcomeSchema =
    z.object({
      stateId:
        z.string(),
  
      urlChanged:
        z.boolean(),
  
      titleChanged:
        z.boolean(),
  
      addedSemanticText:
        z.array(
          z.string(),
        ),
  
      removedSemanticText:
        z.array(
          z.string(),
        ),
    });
  
  export const businessBehaviorFlowSchema =
    z.object({
      id:
        z.string(),
  
      sourceFlowIds:
        z.array(
          z.string(),
        )
          .min(1),
  
      name:
        z.string()
          .min(1),
  
      startStateId:
        z.string(),
  
      endStateId:
        z.string(),
  
      stateIds:
        z.array(
          z.string(),
        )
          .min(2),
  
      transitionIds:
        z.array(
          z.string(),
        )
          .min(1),
  
      preconditionTransitionIds:
        z.array(
          z.string(),
        ),
  
      steps:
        z.array(
          businessFlowStepSchema,
        )
          .min(1),
  
      complete:
        z.boolean(),
  
      boundaryEvidence:
        z.array(
          businessBoundaryEvidenceSchema,
        )
          .min(1),
  
      outcome:
        businessFlowOutcomeSchema,
    });
  
  export type BusinessBoundaryEvidence =
    z.infer<
      typeof businessBoundaryEvidenceSchema
    >;
  
  export type BusinessBehaviorFlow =
    z.infer<
      typeof businessBehaviorFlowSchema
    >;