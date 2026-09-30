import {
    z,
  } from 'zod';
  
  import {
    transitionActionSchema,
  } from '../state/application-state.js';
  
  export const businessFlowTerminationSchema =
    z.enum([
      'terminal-state',
      'cycle',
      'missing-state',
      'max-depth',
    ]);
  
  export const businessFlowStepSchema =
    z.object({
      transitionId:
        z.string(),
  
      fromStateId:
        z.string(),
  
      toStateId:
        z.string(),
  
      action:
        transitionActionSchema,
    });
  
  export const reconstructedBusinessFlowSchema =
    z.object({
      id:
        z.string(),
  
      startStateId:
        z.string(),
  
      endStateId:
        z.string(),
  
      stateIds:
        z.array(
          z.string(),
        ).min(1),
  
      transitionIds:
        z.array(
          z.string(),
        ),
  
      steps:
        z.array(
          businessFlowStepSchema,
        ),
  
      complete:
        z.boolean(),
  
      termination:
        businessFlowTerminationSchema,
    });
  
  export type BusinessFlowTermination =
    z.infer<
      typeof businessFlowTerminationSchema
    >;
  
  export type BusinessFlowStep =
    z.infer<
      typeof businessFlowStepSchema
    >;
  
  export type ReconstructedBusinessFlow =
    z.infer<
      typeof reconstructedBusinessFlowSchema
    >;