import type {
    ModelUsage,
  } from './model-contracts.js';
  
  export class ModelUsageTracker {
    private readonly entries:
      ModelUsage[] = [];
  
    record(
      usage: ModelUsage,
    ): void {
      this.entries.push(
        usage,
      );
    }
  
    getEntries():
      ModelUsage[] {
      return [
        ...this.entries,
      ];
    }
  
    getSummary() {
      return this.entries.reduce(
        (
          summary,
          usage,
        ) => ({
          promptTokens:
            summary.promptTokens +
            usage.promptTokens,
  
          completionTokens:
            summary
              .completionTokens +
            usage
              .completionTokens,
  
          totalTokens:
            summary.totalTokens +
            usage.totalTokens,
  
          estimatedCostUsd:
            summary
              .estimatedCostUsd +
            usage
              .estimatedCostUsd,
        }),
        {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          estimatedCostUsd: 0,
        },
      );
    }
  }