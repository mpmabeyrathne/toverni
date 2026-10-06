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

let baseUrl = '';

const server =
  createServer(
    (
      request,
      response,
    ) => {
      if (
        request.url
          ?.startsWith(
            '/api/session',
          )
      ) {
        response.writeHead(
          204,
        );

        response.end();

        return;
      }

      response.writeHead(
        200,
        {
          'content-type':
            'text/html',
        },
      );

      response.end(`
        <html>
          <head>
            <title>Secret Redaction</title>
          </head>
          <body>
            <label>
              Password
              <input
                aria-label="Password"
                name="password"
                type="password"
                value="super-secret-password"
              />
            </label>

            <input
              aria-label="CSRF token"
              name="csrf_token"
              type="hidden"
              value="csrf-secret-value"
            />

            <script>
              fetch(
                '/api/session?access_token=network-secret&safe=value'
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
        'Unable to resolve redaction test server.',
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
  'PlaywrightPageObserver sensitive-data redaction',
  () => {
    it(
      'redacts sensitive form values and network query parameters',
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

          await session.wait(
            100,
          );

          const observation =
            await session.observe();

          const password =
            observation.actions.find(
              (action) =>
                action.name ===
                'Password',
            );

          expect(
            password?.formField
              ?.value,
          ).toBe(
            '[REDACTED]',
          );

          const hiddenToken =
            observation.actions.find(
              (action) =>
                action.formField
                  ?.htmlName ===
                'csrf_token',
            );

          expect(
            hiddenToken?.formField
              ?.value,
          ).toBe(
            '[REDACTED]',
          );

          const sessionRequest =
            observation.networkEvents
              .find(
                (event) =>
                  event.url.includes(
                    '/api/session',
                  ),
              );

          expect(
            sessionRequest?.url,
          ).toContain(
            'access_token=%5BREDACTED%5D',
          );

          expect(
            JSON.stringify(
              observation,
            ),
          ).not.toContain(
            'super-secret-password',
          );

          expect(
            JSON.stringify(
              observation,
            ),
          ).not.toContain(
            'csrf-secret-value',
          );

          expect(
            JSON.stringify(
              observation,
            ),
          ).not.toContain(
            'network-secret',
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
