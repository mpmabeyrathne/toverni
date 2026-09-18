import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import {
    deriveRoutePattern,
  } from './route-pattern.js';
  
  describe(
    'deriveRoutePattern',
    () => {
      it(
        'ignores pagination query parameters',
        () => {
          expect(
            deriveRoutePattern(
              'https://example.com/products?page=1',
            ),
          ).toBe(
            '/products',
          );
  
          expect(
            deriveRoutePattern(
              'https://example.com/products?page=25',
            ),
          ).toBe(
            '/products',
          );
        },
      );
  
      it(
        'normalizes numeric ids',
        () => {
          expect(
            deriveRoutePattern(
              'https://example.com/users/123',
            ),
          ).toBe(
            '/users/:id',
          );
        },
      );
  
      it(
        'keeps meaningful query parameters',
        () => {
          expect(
            deriveRoutePattern(
              'https://example.com/products?status=active',
            ),
          ).toBe(
            '/products?status=active',
          );
        },
      );
    },
  );