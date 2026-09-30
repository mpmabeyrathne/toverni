import {
    z,
  } from 'zod';
  
  import {
    apiOperationLinkSchema,
  } from '../knowledge/knowledge-contracts.js';
  
  import {
    businessBehaviorFlowSchema,
  } from './business-behavior.js';
  
  export const groundedBusinessBehaviorSchema =
    businessBehaviorFlowSchema.extend({
      requirementEvidenceIds:
        z.array(
          z.string(),
        ),
  
      apiOperationIds:
        z.array(
          z.string(),
        ),
  
      apiOperationLinks:
        z.array(
          apiOperationLinkSchema,
        ),
    });
  
  export type GroundedBusinessBehavior =
    z.infer<
      typeof groundedBusinessBehaviorSchema
    >;