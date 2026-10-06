import {
  createServer,
} from 'node:http';

import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';

import {
  tmpdir,
} from 'node:os';

import {
  join,
} from 'node:path';

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import {
  BrowserControllerError,
  PlaywrightBrowserController,
} from './index.js';

let baseUrl = '';

const temporaryDirectories:
  string[] = [];

const server =
  createServer(
    (
      request,
      response,
    ) => {
      const authenticated =
        request.headers.cookie
          ?.split(';')
          .map(
            (value) =>
              value.trim(),
          )
          .includes(
            'toverni_session=valid',
          ) ??
        false;

      response.writeHead(
        200,
        {
          'content-type':
            'text/html',
        },
      );

      response.end(
        authenticated
          ? '<html><head><title>Dashboard</title></head><body><h1>Dashboard</h1></body></html>'
          : '<html><head><title>Log in</title></head><body><h1>Log in</h1></body></html>',
      );
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
        'Unable to resolve auth test server.',
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

    await Promise.all(
      temporaryDirectories
        .splice(
          0,
        )
        .map(
          (directory) =>
            rm(
              directory,
              {
                recursive:
                  true,

                force:
                  true,
              },
            ),
        ),
    );
  },
);

async function createStorageState(
  content:
    string,
): Promise<string> {
  const directory =
    await mkdtemp(
      join(
        tmpdir(),
        'toverni-auth-',
      ),
    );

  temporaryDirectories.push(
    directory,
  );

  const path =
    join(
      directory,
      'storage-state.json',
    );

  await writeFile(
    path,
    content,
    'utf8',
  );

  return path;
}

describe(
  'PlaywrightBrowserController authentication',
  () => {
    it(
      'reuses saved cookies across navigation',
      async () => {
        const storageStatePath =
          await createStorageState(
            JSON.stringify({
              cookies: [
                {
                  name:
                    'toverni_session',

                  value:
                    'valid',

                  domain:
                    '127.0.0.1',

                  path:
                    '/',

                  expires:
                    -1,

                  httpOnly:
                    true,

                  secure:
                    false,

                  sameSite:
                    'Lax',
                },
              ],

              origins: [],
            }),
          );

        const controller =
          new PlaywrightBrowserController({
            headless:
              true,

            storageStatePath,
          });

        await controller.start();

        try {
          const session =
            await controller
              .createSession();

          await session.navigate(
            `${baseUrl}/dashboard`,
          );

          expect(
            await session.getTitle(),
          ).toBe(
            'Dashboard',
          );

          await session.navigate(
            `${baseUrl}/profile`,
          );

          expect(
            await session.getTitle(),
          ).toBe(
            'Dashboard',
          );

          await session.close();
        } finally {
          await controller.close();
        }
      },
      30_000,
    );

    it(
      'returns a clear error for invalid storage-state JSON',
      async () => {
        const storageStatePath =
          await createStorageState(
            '{ invalid json',
          );

        const controller =
          new PlaywrightBrowserController({
            headless:
              true,

            storageStatePath,
          });

        await controller.start();

        try {
          await expect(
            controller.createSession(),
          ).rejects.toMatchObject({
            name:
              'BrowserControllerError',

            code:
              'SESSION_CREATION_FAILED',

            operation:
              'create-session',
          } satisfies Partial<
            BrowserControllerError
          >);
        } finally {
          await controller.close();
        }
      },
      30_000,
    );
  },
);
