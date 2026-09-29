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

    title:
      'Products',

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
        type:
          'button',

        tagName:
          'button',

        name:
          'Add Product',

        text:
          'Add Product',

        disabled:
          false,

        visible:
          true,
      },

      {
        type:
          'link',

        tagName:
          'a',

        name:
          `Product ${productNumber}`,

        text:
          `Product ${productNumber}`,

        href:
          `https://example.com/products/${productNumber}`,

        disabled:
          false,

        visible:
          true,
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

    it(
      'produces the same fingerprint when only dynamic content values change',
      () => {
        const first =
          createObservation(
            'https://example.com/products/101',
            101,
          );

        first.ariaSnapshot = `
- main:
  - heading "Product Details" [level=1]
  - paragraph: Price: 1200
  - paragraph: SKU: 101
  - button "Add Product"
`;

        const second =
          createObservation(
            'https://example.com/products/202',
            202,
          );

        second.ariaSnapshot = `
- main:
  - heading "Product Details" [level=1]
  - paragraph: Price: 2500
  - paragraph: SKU: 202
  - button "Add Product"
`;

        const firstFingerprint =
          createStateFingerprint(
            first,
          );

        const secondFingerprint =
          createStateFingerprint(
            second,
          );

        expect(
          firstFingerprint
            .routePattern,
        ).toBe(
          '/products/:id',
        );

        expect(
          secondFingerprint
            .routePattern,
        ).toBe(
          '/products/:id',
        );

        expect(
          firstFingerprint
            .fingerprint,
        ).toBe(
          secondFingerprint
            .fingerprint,
        );
      },
    );

    it(
      'keeps enabled and disabled action variants as different states',
      () => {
        const enabled =
          createObservation(
            'https://example.com/products/101',
            101,
          );

        const disabled =
          createObservation(
            'https://example.com/products/202',
            202,
          );

        const enabledAction =
          enabled.actions[0];

        const disabledAction =
          disabled.actions[0];

        if (
          !enabledAction ||
          !disabledAction
        ) {
          throw new Error(
            'Expected product actions',
          );
        }

        enabledAction.disabled =
          false;

        disabledAction.disabled =
          true;

        const first =
          createStateFingerprint(
            enabled,
          );

        const second =
          createStateFingerprint(
            disabled,
          );

        expect(
          first.fingerprint,
        ).not.toBe(
          second.fingerprint,
        );
      },
    );

    it(
      'preserves meaningful query parameter variants',
      () => {
        const active =
          createStateFingerprint(
            createObservation(
              'https://example.com/orders?status=active',
              1,
            ),
          );

        const completed =
          createStateFingerprint(
            createObservation(
              'https://example.com/orders?status=completed',
              1,
            ),
          );

        expect(
          active.routePattern,
        ).toBe(
          '/orders?status=active',
        );

        expect(
          completed.routePattern,
        ).toBe(
          '/orders?status=completed',
        );

        expect(
          active.fingerprint,
        ).not.toBe(
          completed.fingerprint,
        );
      },
    );

    it(
      'normalizes query parameter ordering',
      () => {
        const first =
          createStateFingerprint(
            createObservation(
              'https://example.com/products?category=keyboard&sort=price',
              1,
            ),
          );

        const second =
          createStateFingerprint(
            createObservation(
              'https://example.com/products?sort=price&category=keyboard',
              1,
            ),
          );

        expect(
          first.routePattern,
        ).toBe(
          second.routePattern,
        );

        expect(
          first.fingerprint,
        ).toBe(
          second.fingerprint,
        );
      },
    );

    it(
      'distinguishes SPA hash routes',
      () => {
        const product =
          createObservation(
            'https://example.com/#/products/101',
            1,
          );

        const cart =
          createObservation(
            'https://example.com/#/cart',
            1,
          );

        const productState =
          createStateFingerprint(
            product,
          );

        const cartState =
          createStateFingerprint(
            cart,
          );

        expect(
          productState
            .routePattern,
        ).not.toBe(
          cartState
            .routePattern,
        );

        expect(
          productState
            .fingerprint,
        ).not.toBe(
          cartState
            .fingerprint,
        );
      },
    );

    it(
      'keeps success and error semantic variants as different states',
      () => {
        const success =
          createObservation(
            'https://example.com/checkout/101',
            101,
          );
    
        success.title =
          'Checkout';
    
        success.ariaSnapshot = `
    - main:
      - heading "Checkout" [level=1]
      - paragraph: Payment successful
      - button "Continue"
    `;
    
        const error =
          createObservation(
            'https://example.com/checkout/202',
            202,
          );
    
        error.title =
          'Checkout';
    
        error.ariaSnapshot = `
    - main:
      - heading "Checkout" [level=1]
      - paragraph: Payment failed
      - button "Continue"
    `;
    
        const successState =
          createStateFingerprint(
            success,
          );
    
        const errorState =
          createStateFingerprint(
            error,
          );
    
        expect(
          successState.routePattern,
        ).toBe(
          '/checkout/:id',
        );
    
        expect(
          errorState.routePattern,
        ).toBe(
          '/checkout/:id',
        );
    
        expect(
          successState.fingerprint,
        ).not.toBe(
          errorState.fingerprint,
        );
      },
    );
    
    it(
      'keeps authenticated and unauthenticated variants as different states',
      () => {
        const authenticated =
          createObservation(
            'https://example.com/account',
            1,
          );
    
        authenticated.title =
          'Account';
    
        authenticated.ariaSnapshot = `
    - main:
      - heading "Account" [level=1]
      - paragraph: Authenticated user
      - button "Sign Out"
    `;
    
        const authenticatedAction =
          authenticated.actions[0];
    
        if (!authenticatedAction) {
          throw new Error(
            'Expected account action',
          );
        }
    
        authenticatedAction.name =
          'Sign Out';
    
        authenticatedAction.text =
          'Sign Out';
    
        const unauthenticated =
          createObservation(
            'https://example.com/account',
            1,
          );
    
        unauthenticated.title =
          'Account';
    
        unauthenticated.ariaSnapshot = `
    - main:
      - heading "Account" [level=1]
      - paragraph: Unauthenticated user
      - button "Sign In"
    `;
    
        const unauthenticatedAction =
          unauthenticated.actions[0];
    
        if (!unauthenticatedAction) {
          throw new Error(
            'Expected account action',
          );
        }
    
        unauthenticatedAction.name =
          'Sign In';
    
        unauthenticatedAction.text =
          'Sign In';
    
        const authenticatedState =
          createStateFingerprint(
            authenticated,
          );
    
        const unauthenticatedState =
          createStateFingerprint(
            unauthenticated,
          );
    
        expect(
          authenticatedState.routePattern,
        ).toBe(
          '/account',
        );
    
        expect(
          unauthenticatedState.routePattern,
        ).toBe(
          '/account',
        );
    
        expect(
          authenticatedState.fingerprint,
        ).not.toBe(
          unauthenticatedState.fingerprint,
        );
      },
    );
  },
);