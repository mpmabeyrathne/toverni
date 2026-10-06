import {
  Agent,
  fetch,
} from 'undici';

import {
  OllamaProvider,
} from './ollama-provider.js';

import type {
  ModelProvider,
} from './model-provider.js';

export type ModelProviderKind =
  'ollama';

export interface ModelRuntimeConfiguration {
  provider:
    ModelProviderKind;

  baseUrl:
    string;

  cheapModel:
    string;

  complexModel:
    string;
}

export interface ModelPreflightResult {
  provider:
    ModelProviderKind;

  local:
    boolean;

  availableModels:
    string[];
}

export interface ModelProviderRuntime {
  provider:
    ModelProvider;

  kind:
    ModelProviderKind;

  local:
    boolean;

  requiresUserCredentials:
    boolean;

  preflight():
    Promise<
      ModelPreflightResult
    >;
}

interface OllamaTagsResponse {
  models?:
    Array<{
      name?:
        string;

      model?:
        string;
    }>;
}

function normalizeBaseUrl(
  value:
    string,
): string {
  return value.replace(
    /\/+$/,
    '',
  );
}

export function createModelProviderRuntime(
  configuration:
    ModelRuntimeConfiguration,
): ModelProviderRuntime {
  switch (
    configuration.provider
  ) {
    case 'ollama': {
      const baseUrl =
        normalizeBaseUrl(
          configuration.baseUrl,
        );

      const provider =
        new OllamaProvider({
          baseUrl,

          cheapModel:
            configuration
              .cheapModel,

          complexModel:
            configuration
              .complexModel,
        });

      const dispatcher =
        new Agent({
          headersTimeout:
            15_000,

          bodyTimeout:
            15_000,

          connectTimeout:
            5_000,
        });

      return {
        provider,

        kind:
          'ollama',

        local:
          true,

        requiresUserCredentials:
          false,

        async preflight() {
          let versionResponse;
          let tagsResponse;

          try {
            [
              versionResponse,
              tagsResponse,
            ] =
              await Promise.all([
                fetch(
                  `${baseUrl}/api/version`,
                  {
                    dispatcher,
                  },
                ),

                fetch(
                  `${baseUrl}/api/tags`,
                  {
                    dispatcher,
                  },
                ),
              ]);
          } catch (
            error:
              unknown
          ) {
            throw new Error(
              [
                'Ollama is not reachable.',
                `Expected server: ${baseUrl}`,
                'Start Ollama and retry.',
              ].join(
                ' ',
              ),
              {
                cause:
                  error,
              },
            );
          }

          if (
            !versionResponse.ok ||
            !tagsResponse.ok
          ) {
            throw new Error(
              [
                'Ollama preflight failed.',
                `Server: ${baseUrl}`,
                `version status=${versionResponse.status}`,
                `models status=${tagsResponse.status}`,
              ].join(
                ' ',
              ),
            );
          }

          const tags =
            await tagsResponse
              .json() as
                OllamaTagsResponse;

          const availableModels =
            [
              ...new Set(
                (
                  tags.models ??
                  []
                )
                  .flatMap(
                    (model) => [
                      model.name,
                      model.model,
                    ],
                  )
                  .filter(
                    (
                      value,
                    ): value is string =>
                      typeof value ===
                        'string' &&
                      value.length >
                        0,
                  ),
              ),
            ];

          const requiredModels =
            [
              ...new Set([
                configuration
                  .cheapModel,
                configuration
                  .complexModel,
              ]),
            ];

          const missingModels =
            requiredModels
              .filter(
                (model) =>
                  !availableModels
                    .includes(
                      model,
                    ),
              );

          if (
            missingModels.length >
            0
          ) {
            throw new Error(
              [
                'Ollama is running, but required model(s) are not installed:',
                missingModels
                  .join(
                    ', ',
                  ),
                'Install them with:',
                missingModels
                  .map(
                    (model) =>
                      `ollama pull ${model}`,
                  )
                  .join(
                    ' && ',
                  ),
              ].join(
                ' ',
              ),
            );
          }

          return {
            provider:
              'ollama',

            local:
              true,

            availableModels,
          };
        },
      };
    }
  }
}
