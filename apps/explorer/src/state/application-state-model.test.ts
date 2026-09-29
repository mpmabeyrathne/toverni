import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import type {
    PageObservation,
  } from '../contracts/page-observation.js';
  
  import {
    ApplicationStateModel,
  } from './application-state-model.js';
  
  function createObservation(
    url: string,
    title: string,
    buttonName: string,
  ): PageObservation {
    return {
      capturedAt:
        '2026-09-19T00:00:00.000Z',
  
      url,
  
      title,
  
      semanticText: [
        title,
        buttonName,
      ],
  
      ariaSnapshot: `
  - heading "${title}" [level=1]
  - button "${buttonName}"
  `,
  
      actions: [
        {
          type: 'button',
          tagName: 'button',
          name:
            buttonName,
          text:
            buttonName,
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
    'ApplicationStateModel',
    () => {
      it(
        'reuses equivalent states',
        () => {
          const model =
            new ApplicationStateModel();
  
          const first =
            model.registerObservation(
              createObservation(
                'https://example.com/products?page=1',
                'Products',
                'Create Product',
              ),
            );
  
          const second =
            model.registerObservation(
              createObservation(
                'https://example.com/products?page=2',
                'Products',
                'Create Product',
              ),
            );
  
          expect(
            first.isNew,
          ).toBe(true);
  
          expect(
            second.isNew,
          ).toBe(false);
  
          expect(
            model.getStateCount(),
          ).toBe(1);
  
          expect(
            second.state.visits,
          ).toBe(2);
        },
      );
  
      it(
        'creates transitions between different states',
        () => {
          const model =
            new ApplicationStateModel();
  
          const before =
            createObservation(
              'https://example.com/products',
              'Products',
              'Create Product',
            );
  
          const after =
            createObservation(
              'https://example.com/products/new',
              'Create Product',
              'Save',
            );
  
          const result =
            model.recordTransition({
              before,
  
              after,
  
              action: {
                type: 'click',
  
                target:
                  'Create Product',
              },
            });
  
          expect(
            result.transition
              .equivalentState,
          ).toBe(false);
  
          expect(
            result.transition
              .explorationBlocked,
          ).toBe(false);
  
          expect(
            model.getStateCount(),
          ).toBe(2);
  
          expect(
            model.getTransitionCount(),
          ).toBe(1);
        },
      );
  
      it(
        'blocks equivalent-state loops',
        () => {
          const model =
            new ApplicationStateModel();
  
          const before =
            createObservation(
              'https://example.com/products?page=1',
              'Products',
              'Next',
            );
  
          const after =
            createObservation(
              'https://example.com/products?page=2',
              'Products',
              'Next',
            );
  
          const result =
            model.recordTransition({
              before,
  
              after,
  
              action: {
                type: 'click',
  
                target: 'Next',
              },
            });
  
          expect(
            result.transition
              .equivalentState,
          ).toBe(true);
  
          expect(
            result.transition
              .explorationBlocked,
          ).toBe(true);
        },
      );
      it(
        'clusters dynamic route instances into one canonical state',
        () => {
          const model =
            new ApplicationStateModel();
      
          const first =
            model.registerObservation(
              createObservation(
                'https://example.com/products/101',
                'Product Details',
                'Add Product',
              ),
            );
      
          const second =
            model.registerObservation(
              createObservation(
                'https://example.com/products/202',
                'Product Details',
                'Add Product',
              ),
            );
      
          expect(
            first.isNew,
          ).toBe(true);
      
          expect(
            second.isNew,
          ).toBe(false);
      
          expect(
            first.state.id,
          ).toBe(
            second.state.id,
          );
      
          expect(
            second.state
              .routePattern,
          ).toBe(
            '/products/:id',
          );
      
          expect(
            second.state.visits,
          ).toBe(2);
      
          expect(
            model.getStateCount(),
          ).toBe(1);
        },
      );
      
      it(
        'keeps behaviorally different enabled and disabled variants separate',
        () => {
          const model =
            new ApplicationStateModel();
      
          const enabled =
            createObservation(
              'https://example.com/products/101',
              'Product Details',
              'Add Product',
            );
      
          const disabled =
            createObservation(
              'https://example.com/products/202',
              'Product Details',
              'Add Product',
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
            model.registerObservation(
              enabled,
            );
      
          const second =
            model.registerObservation(
              disabled,
            );
      
          expect(
            first.isNew,
          ).toBe(true);
      
          expect(
            second.isNew,
          ).toBe(true);
      
          expect(
            first.state.id,
          ).not.toBe(
            second.state.id,
          );
      
          expect(
            model.getStateCount(),
          ).toBe(2);
        },
      );
      
      it(
        'reuses equivalent SPA dynamic route states',
        () => {
          const model =
            new ApplicationStateModel();
      
          const first =
            model.registerObservation(
              createObservation(
                'https://example.com/#/products/101',
                'Product Details',
                'Add Product',
              ),
            );
      
          const second =
            model.registerObservation(
              createObservation(
                'https://example.com/#/products/202',
                'Product Details',
                'Add Product',
              ),
            );
      
          expect(
            first.state
              .routePattern,
          ).toBe(
            '/products/:id',
          );
      
          expect(
            second.state
              .routePattern,
          ).toBe(
            '/products/:id',
          );
      
          expect(
            second.isNew,
          ).toBe(false);
      
          expect(
            first.state.id,
          ).toBe(
            second.state.id,
          );
      
          expect(
            second.state.visits,
          ).toBe(2);
      
          expect(
            model.getStateCount(),
          ).toBe(1);
        },
      );
      it(
        'returns inspectable deduplication metadata while preserving the canonical representative',
        () => {
          const model =
            new ApplicationStateModel();
      
          const firstUrl =
            'https://example.com/products/101';
      
          const secondUrl =
            'https://example.com/products/202';
      
          const first =
            model.registerObservation(
              createObservation(
                firstUrl,
                'Product Details',
                'Add Product',
              ),
            );
      
          const second =
            model.registerObservation(
              createObservation(
                secondUrl,
                'Product Details',
                'Add Product',
              ),
            );
      
          expect(
            first.deduplication
              .matchedExistingState,
          ).toBe(false);
      
          expect(
            first.deduplication
              .reason,
          ).toBe(
            'new-structural-state',
          );
      
          expect(
            second.deduplication
              .matchedExistingState,
          ).toBe(true);
      
          expect(
            second.deduplication
              .reason,
          ).toBe(
            'structural-fingerprint-match',
          );
      
          expect(
            second.deduplication
              .canonicalStateId,
          ).toBe(
            first.state.id,
          );
      
          expect(
            second.deduplication
              .routePattern,
          ).toBe(
            '/products/:id',
          );
      
          expect(
            second.deduplication
              .observedUrl,
          ).toBe(
            secondUrl,
          );
      
          // Canonical representative remains
          // the first observed instance.
          expect(
            second.state.url,
          ).toBe(
            firstUrl,
          );
      
          expect(
            second.state
              .observation.url,
          ).toBe(
            firstUrl,
          );
      
          expect(
            second.state.visits,
          ).toBe(2);
        },
      );
    },
  );