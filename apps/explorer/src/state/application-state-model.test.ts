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
    },
  );