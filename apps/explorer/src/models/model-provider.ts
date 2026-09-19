import type {
    ActionRankingInput,
    ActionRankingOutput,
    ModelResult,
    ScenarioGenerationInput,
    ScenarioGenerationOutput,
    StateAnalysisInput,
    StateAnalysisOutput,
  } from './model-contracts.js';
  
  export interface ModelProvider {
    readonly name:
      string;
  
    analyzeState(
      input:
        StateAnalysisInput,
    ): Promise<
      ModelResult<
        StateAnalysisOutput
      >
    >;
  
    rankActions(
      input:
        ActionRankingInput,
    ): Promise<
      ModelResult<
        ActionRankingOutput
      >
    >;
  
    generateScenarios(
      input:
        ScenarioGenerationInput,
    ): Promise<
      ModelResult<
        ScenarioGenerationOutput
      >
    >;
  }