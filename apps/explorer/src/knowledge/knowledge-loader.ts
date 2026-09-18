import {
    knowledgeContextSchema,
    type KnowledgeContext,
  } from './knowledge-contracts.js';
  
  import {
    ingestOpenApi,
  } from './openapi-ingestor.js';
  
  import {
    ingestRequirements,
  } from './requirement-ingestor.js';
  
  export interface LoadKnowledgeInput {
    requirementsPath?:
      string;
  
    openApiPath?:
      string;
  }
  
  export async function loadKnowledge(
    input: LoadKnowledgeInput,
  ): Promise<
    KnowledgeContext
  > {
    const [
      requirements,
      openApi,
    ] = await Promise.all([
      input.requirementsPath
        ? ingestRequirements(
            input.requirementsPath,
          )
        : Promise.resolve(
            null,
          ),
  
      input.openApiPath
        ? ingestOpenApi(
            input.openApiPath,
          )
        : Promise.resolve(
            null,
          ),
    ]);
  
    return knowledgeContextSchema.parse({
      requirements,
      openApi,
    });
  }