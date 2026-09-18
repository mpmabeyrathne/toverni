import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import type {
    PageObservation,
  } from '../contracts/page-observation.js';
  
  import {
    createStateFingerprint,
  } from './state-fingerprint.js';
  
  function createObservation(
    url: string,
    productNumber: number,
  ): PageObservation {
    return {
      capturedAt:
        '2026-09-19T00:00:00.000Z',
  
      url,
  
      title: 'Products',
  
      semanticText: [
        'Products',
        `Product ${productNumber}`,
      ],
  
      ariaSnapshot: `
  - heading "Products" [level=1]
  - button "Add Product"
  - link "Product ${productNumber}"
  `,
  
      actions: [
        {
          type: 'button',
          tagName: 'button',
          name:
            'Add Product',
          text:
            'Add Product',
          disabled: false,
          visible: true,
        },
  
        {
          type: 'link',
          tagName: 'a',
          name:
            `Product ${productNumber}`,
          text:
            `Product ${productNumber}`,
          href:
            `https://example.com/products/${productNumber}`,
          disabled: false,
          visible: true,
        },
      ],
  
      consoleEvents: [],
  
      networkEvents: [],
  
      supportingArtifacts: [],
    };
  }
  
  describe(
    'createStateFingerprint',
    () => {
      it(
        'produces the same fingerprint for equivalent paginated states',
        () => {
          const first =
            createStateFingerprint(
              createObservation(
                'https://example.com/products?page=1',
                1,
              ),
            );
  
          const second =
            createStateFingerprint(
              createObservation(
                'https://example.com/products?page=2',
                22,
              ),
            );
  
          expect(
            first.fingerprint,
          ).toBe(
            second.fingerprint,
          );
  
          expect(
            first.routePattern,
          ).toBe(
            '/products',
          );
        },
      );
    },
  );