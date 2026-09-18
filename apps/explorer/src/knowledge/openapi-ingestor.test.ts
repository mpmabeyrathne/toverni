import {
    fileURLToPath,
  } from 'node:url';
  
  import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import {
    ingestOpenApi,
  } from './openapi-ingestor.js';
  
  const openApiPath =
    fileURLToPath(
      new URL(
        '../../../../fixtures/knowledge/openapi.yaml',
        import.meta.url,
      ),
    );
  
  describe(
    'ingestOpenApi',
    () => {
      it(
        'extracts API operations and security context',
        async () => {
          const result =
            await ingestOpenApi(
              openApiPath,
            );
  
          expect(
            result.title,
          ).toBe(
            'Booking API',
          );
  
          expect(
            result.operations
              .some(
                (operation) =>
                  operation.operationId ===
                    'createBooking' &&
                  operation.method ===
                    'POST',
              ),
          ).toBe(true);
  
          const getRoom =
            result.operations.find(
              (operation) =>
                operation.operationId ===
                'getRoom',
            );
  
          expect(
            getRoom?.parameters
              .some(
                (parameter) =>
                  parameter.name ===
                  'roomId',
              ),
          ).toBe(true);
  
          expect(
            getRoom?.security,
          ).toContain(
            'bearerAuth',
          );
        },
      );
    },
  );