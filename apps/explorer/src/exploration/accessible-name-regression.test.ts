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
          <head>
            <style>
              .lab-card {
                text-transform: uppercase;
              }
            </style>
          </head>
          <body>
            <a
              href="#home"
              onclick="document.querySelector('#logo-status').textContent='logo clicked'"
            >
              <span>&lt;</span>
              <span>PM</span>
              <span>/&gt;</span>
            </a>

            <div
              class="lab-card"
              role="button"
              tabindex="0"
              onclick="document.querySelector('#status').textContent='clicked'"
            >
              Lab #01
              <span>Explore Architecture</span>
            </div>

            <p id="logo-status">
              logo not clicked
            </p>

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
        'Unable to resolve accessible-name test server.',
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
  'accessible name regression',
  () => {
    it(
      'uses DOM text for role names when CSS changes rendered casing',
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

          const logoAction =
            observation.actions.find(
              (candidate) =>
                candidate.type ===
                  'link' &&
                candidate.href
                  ?.endsWith(
                    '#home',
                  ),
            );

          expect(
            logoAction,
          ).toBeDefined();

          expect(
            logoAction?.name,
          ).toBe(
            '< PM />',
          );

          const logoTarget =
            createBrowserTarget(
              logoAction!,
            );

          expect(
            renderPlaywrightLocator(
              logoTarget!,
            ),
          ).toContain(
            'name: "< PM />"',
          );

          await session.click(
            logoTarget!,
          );

          const afterLogoClick =
            await session.observe();

          expect(
            afterLogoClick
              .semanticText
              .join(
                ' ',
              ),
          ).toContain(
            'logo clicked',
          );

          const action =
            observation.actions.find(
              (candidate) =>
                candidate.role ===
                  'button',
            );

          expect(
            action,
          ).toBeDefined();

          expect(
            action?.text,
          ).toContain(
            'LAB #01',
          );

          expect(
            action?.name,
          ).toContain(
            'Lab #01',
          );

          const target =
            createBrowserTarget(
              action!,
            );

          expect(
            target,
          ).toMatchObject({
            by:
              'role',

            role:
              'button',

            exact:
              true,
          });

          expect(
            renderPlaywrightLocator(
              target!,
            ),
          ).toContain(
            'name: "Lab #01 Explore Architecture"',
          );

          await session.click(
            target!,
          );

          const afterClick =
            await session.observe();

          expect(
            afterClick
              .semanticText
              .join(
                ' ',
              ),
          ).toContain(
            'clicked',
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
