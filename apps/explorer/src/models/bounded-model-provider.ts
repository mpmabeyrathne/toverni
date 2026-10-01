import type {
  ActionRankingInput,
  ActionRankingOutput,
  ModelResult,
  ScenarioGenerationInput,
  ScenarioGenerationOutput,
  StateAnalysisInput,
  StateAnalysisOutput,
} from './model-contracts.js';

import type {
  ModelProvider,
} from './model-provider.js';

export interface BoundedModelProviderOptions {
  maxCalls:
    number;

  retryAttempts:
    number;

  timeoutMs:
    number;
}

export class BoundedModelProvider
implements ModelProvider {
  private calls = 0;

  get name(): string {
    return this.provider.name;
  }

  constructor(
    private readonly provider:
      ModelProvider,

    private readonly options:
      BoundedModelProviderOptions,
  ) {}

  getCallCount():
    number {
    return this.calls;
  }

  private async invoke<T>(
    operation:
      () => Promise<T>,
  ): Promise<T> {
    if (
      this.calls >=
      this.options.maxCalls
    ) {
      throw new Error(
        'Model call budget exhausted.',
      );
    }

    this.calls +=
      1;

    let lastError:
      unknown;

    for (
      let attempt = 1;
      attempt <=
        this.options.retryAttempts;
      attempt += 1
    ) {
      try {
        let timeoutHandle:
          ReturnType<
            typeof setTimeout
          > |
          undefined;

        try {
          return await Promise.race([
            operation(),

            new Promise<never>(
              (
                _resolve,
                reject,
              ) => {
                timeoutHandle =
                  setTimeout(
                    () => {
                      reject(
                        new Error(
                          'Model call timed out.',
                        ),
                      );
                    },
                    this.options
                      .timeoutMs,
                  );
              },
            ),
          ]);
        } finally {
          if (
            timeoutHandle !==
            undefined
          ) {
            clearTimeout(
              timeoutHandle,
            );
          }
        }
      } catch (
        error:
          unknown
      ) {
        lastError =
          error;

        if (
          attempt ===
          this.options
            .retryAttempts
        ) {
          break;
        }
      }
    }

    throw lastError;
  }

  async analyzeState(
    input:
      StateAnalysisInput,
  ): Promise<
    ModelResult<
      StateAnalysisOutput
    >
  > {
    return this.invoke(
      () =>
        this.provider
          .analyzeState(
            input,
          ),
    );
  }

  async rankActions(
    input:
      ActionRankingInput,
  ): Promise<
    ModelResult<
      ActionRankingOutput
    >
  > {
    return this.invoke(
      () =>
        this.provider
          .rankActions(
            input,
          ),
    );
  }

  async generateScenarios(
    input:
      ScenarioGenerationInput,
  ): Promise<
    ModelResult<
      ScenarioGenerationOutput
    >
  > {
    return this.invoke(
      () =>
        this.provider
          .generateScenarios(
            input,
          ),
    );
  }
}
