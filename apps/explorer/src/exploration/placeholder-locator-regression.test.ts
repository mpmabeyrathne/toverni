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
            <input
              name="roomName"
              placeholder="Room name"
            />

            <p id="status">
              empty
            </p>

            <script>
              const input =
                document.querySelector(
                  'input[name="roomName"]',
                );

              input.addEventListener(
                'input',
                () => {
                  document.querySelector(
                    '#status',
                  ).textContent =
                    input.value;
                },
              );
            </script>
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
        'Unable to resolve placeholder locator test server.',
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
            if (error) {
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
  'placeholder locator regression',
  () => {
    it(
      'uses getByPlaceholder for a placeholder-only input and can fill it',
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

          const observation =
            await session.observe();

          const roomNameAction =
            observation.actions.find(
              (action) =>
                action.type ===
                  'input' &&
                action.name ===
                  'Room name',
            );

          expect(
            roomNameAction,
          ).toBeDefined();

          expect(
            roomNameAction
              ?.formField
              ?.placeholder,
          ).toBe(
            'Room name',
          );

          const target =
            createBrowserTarget(
              roomNameAction!,
            );

          expect(
            target,
          ).toEqual({
            by:
              'placeholder',

            placeholder:
              'Room name',

            exact:
              true,
          });

          expect(
            renderPlaywrightLocator(
              target!,
            ),
          ).toBe(
            'page.getByPlaceholder("Room name", { exact: true })',
          );

          await session.fill(
            target!,
            'Ocean View',
          );

          const afterFill =
            await session.observe();

          expect(
            afterFill
              .semanticText
              .join(
                ' ',
              ),
          ).toContain(
            'Ocean View',
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
