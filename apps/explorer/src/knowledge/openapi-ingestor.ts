import {
    readFile,
  } from 'node:fs/promises';
  
  import {
    extname,
  } from 'node:path';
  
  import {
    parse as parseYaml,
  } from 'yaml';
  
  import {
    openApiContextSchema,
    type ApiOperation,
    type OpenApiContext,
  } from './knowledge-contracts.js';
  
  type UnknownRecord =
    Record<
      string,
      unknown
    >;
  
  const HTTP_METHODS =
    new Set([
      'get',
      'post',
      'put',
      'patch',
      'delete',
      'options',
      'head',
      'trace',
    ]);
  
  function isRecord(
    value: unknown,
  ): value is UnknownRecord {
    return (
      typeof value ===
        'object' &&
      value !== null &&
      !Array.isArray(value)
    );
  }
  
  function parseDocument(
    sourcePath: string,
    content: string,
  ): unknown {
    const extension =
      extname(
        sourcePath,
      ).toLowerCase();
  
    if (
      extension ===
        '.yaml' ||
      extension ===
        '.yml'
    ) {
      return parseYaml(
        content,
      );
    }
  
    if (
      extension ===
      '.json'
    ) {
      return JSON.parse(
        content,
      );
    }
  
    throw new Error(
      `Unsupported OpenAPI file type: ${extension}`,
    );
  }
  
  function extractParameters(
    value: unknown,
  ) {
    if (
      !Array.isArray(value)
    ) {
      return [];
    }
  
    return value.flatMap(
      (parameter) => {
        if (
          !isRecord(
            parameter,
          )
        ) {
          return [];
        }
  
        const name =
          parameter.name;
  
        const location =
          parameter.in;
  
        if (
          typeof name !==
            'string' ||
          ![
            'path',
            'query',
            'header',
            'cookie',
          ].includes(
            String(location),
          )
        ) {
          return [];
        }
  
        return [
          {
            name,
  
            location:
              location as
                | 'path'
                | 'query'
                | 'header'
                | 'cookie',
  
            required:
              parameter
                .required ===
              true,
  
            ...(parameter.schema !==
            undefined
              ? {
                  schema:
                    parameter.schema,
                }
              : {}),
          },
        ];
      },
    );
  }
  
  function extractResponses(
    value: unknown,
  ) {
    if (
      !isRecord(
        value,
      )
    ) {
      return [];
    }
  
    return Object.entries(
      value,
    ).map(
      ([
        status,
        response,
      ]) => {
        if (
          !isRecord(
            response,
          )
        ) {
          return {
            status,
            description: '',
            contentTypes: [],
          };
        }
  
        const content =
          isRecord(
            response.content,
          )
            ? response.content
            : {};
  
        return {
          status,
  
          description:
            typeof response
              .description ===
            'string'
              ? response
                  .description
              : '',
  
          contentTypes:
            Object.keys(
              content,
            ),
        };
      },
    );
  }
  
  function extractSecurityNames(
    value: unknown,
  ): string[] {
    if (
      !Array.isArray(value)
    ) {
      return [];
    }
  
    return [
      ...new Set(
        value.flatMap(
          (item) =>
            isRecord(item)
              ? Object.keys(
                  item,
                )
              : [],
        ),
      ),
    ];
  }
  
  export async function ingestOpenApi(
    sourcePath: string,
  ): Promise<
    OpenApiContext
  > {
    const content =
      await readFile(
        sourcePath,
        'utf8',
      );
  
    const document =
      parseDocument(
        sourcePath,
        content,
      );
  
    if (
      !isRecord(
        document,
      )
    ) {
      throw new Error(
        'OpenAPI document must be an object',
      );
    }
  
    const info =
      isRecord(
        document.info,
      )
        ? document.info
        : {};
  
    const rootSecurity =
      extractSecurityNames(
        document.security,
      );
  
    const paths =
      isRecord(
        document.paths,
      )
        ? document.paths
        : {};
  
    const operations:
      ApiOperation[] = [];
  
    for (
      const [
        path,
        pathItem,
      ] of Object.entries(
        paths,
      )
    ) {
      if (
        !isRecord(
          pathItem,
        )
      ) {
        continue;
      }
  
      const pathParameters =
        extractParameters(
          pathItem.parameters,
        );
  
      for (
        const [
          method,
          operationValue,
        ] of Object.entries(
          pathItem,
        )
      ) {
        if (
          !HTTP_METHODS.has(
            method.toLowerCase(),
          ) ||
          !isRecord(
            operationValue,
          )
        ) {
          continue;
        }
  
        const operationParameters =
          extractParameters(
            operationValue
              .parameters,
          );
  
        const operationId =
          typeof operationValue
            .operationId ===
          'string'
            ? operationValue
                .operationId
            : `${method.toUpperCase()} ${path}`;
  
        const security =
          operationValue.security !==
          undefined
            ? extractSecurityNames(
                operationValue
                  .security,
              )
            : rootSecurity;
  
        operations.push({
          operationId,
  
          method:
            method.toUpperCase(),
  
          path,
  
          ...(typeof operationValue
            .summary ===
          'string'
            ? {
                summary:
                  operationValue
                    .summary,
              }
            : {}),
  
          parameters: [
            ...pathParameters,
            ...operationParameters,
          ],
  
          ...(operationValue
            .requestBody !==
          undefined
            ? {
                requestBody:
                  operationValue
                    .requestBody,
              }
            : {}),
  
          responses:
            extractResponses(
              operationValue
                .responses,
            ),
  
          security,
  
          tags:
            Array.isArray(
              operationValue
                .tags,
            )
              ? operationValue
                  .tags
                  .filter(
                    (
                      value,
                    ): value is string =>
                      typeof value ===
                      'string',
                  )
              : [],
        });
      }
    }
  
    const components =
      isRecord(
        document.components,
      )
        ? document.components
        : {};
  
    const schemas =
      isRecord(
        components.schemas,
      )
        ? components.schemas
        : {};
  
    const servers =
      Array.isArray(
        document.servers,
      )
        ? document.servers.flatMap(
            (server) =>
              isRecord(server) &&
              typeof server.url ===
                'string'
                ? [
                    server.url,
                  ]
                : [],
          )
        : [];
  
    return openApiContextSchema.parse({
      sourcePath,
  
      title:
        typeof info.title ===
        'string'
          ? info.title
          : 'Unknown API',
  
      version:
        typeof info.version ===
        'string'
          ? info.version
          : 'unknown',
  
      servers,
  
      operations,
  
      schemas,
    });
  }