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
            <button disabled>
              Complete Todo
            </button>

            <button
              onclick="document.querySelector('#status').textContent='clicked second'"
            >
              Complete Todo
            </button>

            <p id="status">
              not clicked
            </p>
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
      'keeps repeated controls distinct and clicks the intended occurrence',
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

          const completeActions =
            initialObservation
              .actions
              .filter(
                (action) =>
                  action.name ===
                  'Complete Todo',
              );

          expect(
            completeActions,
          ).toHaveLength(
            2,
          );

          const first =
            completeActions[0]!;

          const second =
            completeActions[1]!;

          expect(
            first.locatorIndex,
          ).toBeUndefined();

          expect(
            second.locatorIndex,
          ).toBe(
            1,
          );

          expect(
            createActionSignature(
              first,
            ),
          ).not.toBe(
            createActionSignature(
              second,
            ),
          );

          const target =
            createBrowserTarget(
              second,
            );

          expect(
            target,
          ).toEqual({
            by:
              'role',

            role:
              'button',

            name:
              'Complete Todo',

            exact:
              true,

            index:
              1,
          });

          expect(
            target &&
              renderPlaywrightLocator(
                target,
              ),
          ).toBe(
            'page.getByRole("button", { name: "Complete Todo", exact: true }).nth(1)',
          );

          await session.click(
            target!,
          );

          const observation =
            await session.observe();

          expect(
            observation
              .semanticText
              .join(
                ' ',
              ),
          ).toContain(
            'clicked second',
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
