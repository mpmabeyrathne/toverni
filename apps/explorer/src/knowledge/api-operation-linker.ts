import type {
    NetworkEvent,
  } from '../contracts/page-observation.js';
  
  import type {
    ApiOperation,
    ApiOperationLink,
  } from './knowledge-contracts.js';
  
  function normalizePath(
    value: string,
  ): string {
    if (
      value.length > 1 &&
      value.endsWith('/')
    ) {
      return value.slice(
        0,
        -1,
      );
    }
  
    return value;
  }
  
  function escapeRegex(
    value: string,
  ): string {
    return value.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&',
    );
  }
  
  function pathTemplateToRegex(
    template: string,
  ): RegExp {
    const normalized =
      normalizePath(
        template,
      );
  
    const segments =
      normalized
        .split('/')
        .map(
          (segment) => {
            if (
              /^\{[^}]+\}$/.test(
                segment,
              )
            ) {
              return '[^/]+';
            }
  
            return escapeRegex(
              segment,
            );
          },
        );
  
    return new RegExp(
      `^${segments.join(
        '/',
      )}$`,
    );
  }
  
  function operationMatches(
    event: NetworkEvent,
    operation: ApiOperation,
  ): boolean {
    if (
      event.method
        .toUpperCase() !==
      operation.method
        .toUpperCase()
    ) {
      return false;
    }
  
    let pathname:
      string;
  
    try {
      pathname =
        new URL(
          event.url,
        ).pathname;
    } catch {
      return false;
    }
  
    return pathTemplateToRegex(
      operation.path,
    ).test(
      normalizePath(
        pathname,
      ),
    );
  }
  
  export function linkNetworkEventsToOperations(
    networkEvents:
      NetworkEvent[],
  
    operations:
      ApiOperation[],
  ): ApiOperationLink[] {
    const links:
      ApiOperationLink[] = [];
  
    for (
      const event of
      networkEvents
    ) {
      const match =
        operations.find(
          (operation) =>
            operationMatches(
              event,
              operation,
            ),
        );
  
      if (!match) {
        continue;
      }
  
      links.push({
        networkEventId:
          event.id,
  
        method:
          event.method,
  
        url:
          event.url,
  
        operationId:
          match.operationId,
  
        operationPath:
          match.path,
  
        confidence:
          'exact',
  
        reason:
          'HTTP method and normalized path matched OpenAPI operation',
      });
    }
  
    return links;
  }