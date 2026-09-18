import type {
    ExplorationCandidate,
    ExplorationProductContext,
  } from './exploration-contracts.js';
  
  export interface LlmActionRankingInput {
    candidates:
      ExplorationCandidate[];
  
    productContext?:
      ExplorationProductContext;
  }
  
  export interface LlmActionRankingResult {
    orderedCandidateIds:
      string[];
  
    reasoning: string;
  }
  
  export interface LlmActionRanker {
    rank(
      input:
        LlmActionRankingInput,
    ): Promise<
      LlmActionRankingResult
    >;
  }