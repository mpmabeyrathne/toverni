import {
  createServer,
} from 'node:http';

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import {
  PlaywrightBrowserController,
} from '../browser/index.js';

import {
  createActionSignature,
  createBrowserTarget,
} from './action-candidate.js';

import {
  renderPlaywrightLocator,
} from '../test-generation/playwright-locator-renderer.js';

let baseUrl =
  '';

const server =
  createServer(
    (
      _request,
      response,
    ) => {
      response.writeHead(
        200,
        {
          'content-type':
            'text/html',
        },
      );

      response.end(`
        <!doctype html>
        <html>
          <body>
            <header>
              <nav aria-label="Primary">
                <a
                  href="#header-product"
                  onclick="document.querySelector('#status').textContent='clicked header'"
                >
                  Product
                </a>
              </nav>

              <nav
                aria-label="Mobile"
                style="display:none"
              >
                <a href="#mobile-product">
                  Product
                </a>
              </nav>
            </header>

            <main>
              <p id="status">
                not clicked
              </p>
            </main>

            <footer>
              <nav aria-label="Footer">
                <a
                  href="#footer-product"
                  onclick="document.querySelector('#status').textContent='clicked footer'"
                >
                  Product
                </a>
              </nav>
            </footer>
          </body>
        </html>
      `);
    },
  );

beforeAll(
  async () => {
    await new Promise<void>(
      (resolve) => {
        server.listen(
          0,
          '127.0.0.1',
          resolve,
        );
      },
    );

    const address =
      server.address();

    if (
      !address ||
      typeof address ===
        'string'
    ) {
      throw new Error(
        'Unable to resolve duplicate locator test server.',
      );
    }

    baseUrl =
      `http://127.0.0.1:${address.port}`;
  },
);

afterAll(
  async () => {
    await new Promise<void>(
      (
        resolve,
        reject,
      ) => {
        server.close(
          (error) => {
            if (
              error
            ) {
              reject(
                error,
              );

              return;
            }

            resolve();
          },
        );
      },
    );
  },
);

describe(
  'duplicate locator regression',
  () => {
    it(
      'indexes every visible duplicate without letting hidden copies shift Playwright nth targets',
      async () => {
        const controller =
          new PlaywrightBrowserController({
            headless:
              true,
          });

        await controller.start();

        try {
          const session =
            await controller
              .createSession();

          await session.navigate(
            baseUrl,
          );

          const initialObservation =
            await session.observe();

          const productActions =
            initialObservation
              .actions
              .filter(
                (action) =>
                  action.name ===
                  'Product',
              );

          expect(
            productActions,
          ).toHaveLength(
            3,
          );

          const visibleProductActions =
            productActions.filter(
              (action) =>
                action.visible,
            );

          const hiddenProductActions =
            productActions.filter(
              (action) =>
                !action.visible,
            );

          expect(
            visibleProductActions,
          ).toHaveLength(
            2,
          );

          expect(
            hiddenProductActions,
          ).toHaveLength(
            1,
          );

          const headerAction =
            visibleProductActions[0]!;

          const footerAction =
            visibleProductActions[1]!;

          expect(
            headerAction.locatorIndex,
          ).toBe(
            0,
          );

          expect(
            footerAction.locatorIndex,
          ).toBe(
            1,
          );

          expect(
            hiddenProductActions[0]!
              .locatorIndex,
          ).toBeUndefined();

          expect(
            createActionSignature(
              headerAction,
            ),
          ).not.toBe(
            createActionSignature(
              footerAction,
            ),
          );

          const headerTarget =
            createBrowserTarget(
              headerAction,
            );

          const footerTarget =
            createBrowserTarget(
              footerAction,
            );

          expect(
            headerTarget &&
              renderPlaywrightLocator(
                headerTarget,
              ),
          ).toBe(
            'page.getByRole("link", { name: "Product", exact: true }).nth(0)',
          );

          expect(
            footerTarget &&
              renderPlaywrightLocator(
                footerTarget,
              ),
          ).toBe(
            'page.getByRole("link", { name: "Product", exact: true }).nth(1)',
          );

          await session.click(
            headerTarget!,
          );

          let observation =
            await session.observe();

          expect(
            observation
              .semanticText
              .join(
                ' ',
              ),
          ).toContain(
            'clicked header',
          );

          await session.click(
            footerTarget!,
          );

          observation =
            await session.observe();

          expect(
            observation
              .semanticText
              .join(
                ' ',
              ),
          ).toContain(
            'clicked footer',
          );

          await session.close();
        } finally {
          await controller.close();
        }
      },
      30_000,
    );
  },
);
