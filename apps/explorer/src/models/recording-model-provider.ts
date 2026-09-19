import type {
    ActionRankingInput,
    ActionRankingOutput,
    ModelResult,
    ModelUsage,
    ScenarioGenerationInput,
    ScenarioGenerationOutput,
    StateAnalysisInput,
    StateAnalysisOutput,
  } from './model-contracts.js';
  
  import type {
    ModelProvider,
  } from './model-provider.js';
  
  export type ModelUsageRecorder =
    (
      task: string,
      usage: ModelUsage,
    ) => Promise<void>;
  
  export class RecordingModelProvider
  implements ModelProvider {
    get name(): string {
      return this.provider.name;
    }
  
    constructor(
      private readonly provider:
        ModelProvider,
  
      private readonly recordUsage:
        ModelUsageRecorder,
    ) {}
  
    async analyzeState(
      input:
        StateAnalysisInput,
    ): Promise<
      ModelResult<
        StateAnalysisOutput
      >
    > {
      const result =
        await this.provider
          .analyzeState(
            input,
          );
  
      await this.recordUsage(
        'state-analysis',
        result.usage,
      );
  
      return result;
    }
  
    async rankActions(
      input:
        ActionRankingInput,
    ): Promise<
      ModelResult<
        ActionRankingOutput
      >
    > {
      const result =
        await this.provider
          .rankActions(
            input,
          );
  
      await this.recordUsage(
        'action-ranking',
        result.usage,
      );
  
      return result;
    }
  
    async generateScenarios(
      input:
        ScenarioGenerationInput,
    ): Promise<
      ModelResult<
        ScenarioGenerationOutput
      >
    > {
      const result =
        await this.provider
          .generateScenarios(
            input,
          );
  
      await this.recordUsage(
        'scenario-generation',
        result.usage,
      );
  
      return result;
    }
  }