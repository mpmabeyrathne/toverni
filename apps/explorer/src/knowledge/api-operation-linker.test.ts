import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import type {
    NetworkEvent,
  } from '../contracts/page-observation.js';
  
  import type {
    ApiOperation,
  } from './knowledge-contracts.js';
  
  import {
    linkNetworkEventsToOperations,
  } from './api-operation-linker.js';
  
  describe(
    'linkNetworkEventsToOperations',
    () => {
      it(
        'matches concrete runtime paths to OpenAPI templates',
        () => {
          const networkEvents:
            NetworkEvent[] = [
              {
                id: 'request-1',
  
                method: 'GET',
  
                url:
                  'https://example.com/api/rooms/123',
  
                resourceType:
                  'fetch',
  
                status: 200,
  
                ok: true,
  
                failed: false,
              },
            ];
  
          const operations:
            ApiOperation[] = [
              {
                operationId:
                  'getRoom',
  
                method: 'GET',
  
                path:
                  '/api/rooms/{roomId}',
  
                parameters: [],
  
                responses: [],
  
                security: [],
  
                tags: [],
              },
            ];
  
          const result =
            linkNetworkEventsToOperations(
              networkEvents,
              operations,
            );
  
          expect(
            result,
          ).toHaveLength(
            1,
          );
  
          expect(
            result[0]
              ?.operationId,
          ).toBe(
            'getRoom',
          );
        },
      );
    },
  );