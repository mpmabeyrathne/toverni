import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import {
    buildEvidenceCatalog,
  } from './evidence-catalog.js';
  
  describe(
    'buildEvidenceCatalog',
    () => {
      it(
        'combines requirements, discovered flow, and API evidence',
        () => {
          const catalog =
            buildEvidenceCatalog(
              {
                requirements: {
                  sourcePath:
                    'requirements.md',
  
                  acceptanceCriteria: [
                    'Customer can book an available room.',
                  ],
  
                  userRoles: [
                    'customer',
                  ],
  
                  capabilities: [
                    'Create booking',
                  ],
  
                  constraints: [
                    'Unavailable rooms must not be bookable.',
                  ],
  
                  domainTerms: [
                    'Booking',
                  ],
  
                  rawText:
                    'Booking requirements',
                },
  
                openApi: {
                  sourcePath:
                    'openapi.yaml',
  
                  title:
                    'Booking API',
  
                  version:
                    '1.0.0',
  
                  servers: [],
  
                  schemas: {},
  
                  operations: [
                    {
                      operationId:
                        'createBooking',
  
                      method:
                        'POST',
  
                      path:
                        '/api/bookings',
  
                      parameters: [],
  
                      responses: [],
  
                      security: [],
  
                      tags: [],
                    },
                  ],
                },
              },
  
              {
                states: [
                  {
                    id:
                      'state-1',
  
                    routePattern:
                      '/rooms',
                  },
                ],
  
                actions: [
                  {
                    id:
                      'action-1',
  
                    label:
                      'Book',
  
                    type:
                      'button',
                  },
                ],
  
                transitions: [],
              },
            );
  
          expect(
            catalog.some(
              (item) =>
                item.id ===
                'REQ-1',
            ),
          ).toBe(true);
  
          expect(
            catalog.some(
              (item) =>
                item.id ===
                'ACTION-1',
            ),
          ).toBe(true);
  
          expect(
            catalog.some(
              (item) =>
                item.id ===
                'API-1',
            ),
          ).toBe(true);
        },
      );
    },
  );