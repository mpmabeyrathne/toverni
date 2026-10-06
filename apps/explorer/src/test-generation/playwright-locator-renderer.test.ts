import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import {
    renderPlaywrightLocator,
  } from './playwright-locator-renderer.js';
  
  describe(
    'renderPlaywrightLocator',
    () => {
      it(
        'renders a resilient role locator',
        () => {
          const result =
            renderPlaywrightLocator({
              by:
                'role',
  
              role:
                'button',
  
              name:
                'Book',
  
              exact:
                true,
            });
  
          expect(
            result,
          ).toBe(
            'page.getByRole("button", { name: "Book", exact: true })',
          );
        },
      );
  
      it(
        'normalizes whitespace in role accessible names',
        () => {
          const result =
            renderPlaywrightLocator({
              by:
                'role',

              role:
                'dialog',

              name:
                'Confirm order total $25\n\nConfirm OrderCancel',

              exact:
                true,
            });

          expect(
            result,
          ).toBe(
            'page.getByRole("dialog", { name: "Confirm order total $25 Confirm OrderCancel", exact: true })',
          );
        },
      );

      it(
        'renders a test id locator',
        () => {
          const result =
            renderPlaywrightLocator({
              by:
                'testId',
  
              value:
                'booking-submit',
            });
  
          expect(
            result,
          ).toBe(
            'page.getByTestId("booking-submit")',
          );
        },
      );
    },
  );