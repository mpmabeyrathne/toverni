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
      (request, response) => {
        if (
          request.url ===
          '/api/projects'
        ) {
          response.writeHead(
            200,
            {
              'content-type':
                'application/json',
            },
          );
  
          response.end(
            JSON.stringify({
              projects: [],
            }),
          );
  
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
          <!doctype html>
  
          <html>
            <head>
              <title>
                Toverni Observation Test
              </title>
            </head>
  
            <body>
              <h1>Projects</h1>
  
              <button
                data-testid="create-project"
              >
                Create Project
              </button>
  
              <label>
                Search
                <input
                  aria-label="Search"
                  type="text"
                />
              </label>
  
              <select
                aria-label="Project Type"
              >
                <option value="web">
                  Web
                </option>
  
                <option value="mobile">
                  Mobile
                </option>
              </select>
  
              <a href="/details">
                Open Project
              </a>
  
              <form>
                <button type="submit">
                  Save
                </button>
              </form>
  
              <menu>
                <li>Settings</li>
              </menu>
  
              <dialog open>
                Project Dialog
              </dialog>
  
              <script>
                console.warn(
                  'Observation warning'
                );
  
                console.error(
                  'Observation error'
                );
  
                fetch(
                  '/api/projects'
                );
              </script>
            </body>
          </html>
        `);
      },
    );
  
  beforeAll(async () => {
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
      address === null ||
      typeof address ===
        'string'
    ) {
      throw new Error(
        'Unable to resolve test server',
      );
    }
  
    baseUrl =
      `http://127.0.0.1:${address.port}`;
  });
  
  afterAll(async () => {
    await new Promise<void>(
      (
        resolve,
        reject,
      ) => {
        server.close(
          (error) => {
            if (error) {
              reject(error);
              return;
            }
  
            resolve();
          },
        );
      },
    );
  });
  
  describe(
    'PlaywrightPageObserver',
    () => {
      it(
        'captures structured page evidence',
        async () => {
          const controller =
            new PlaywrightBrowserController({
              headless: true,
            });
  
          await controller.start();
  
          const session =
            await controller
              .createSession();
  
          await session.navigate(
            baseUrl,
          );
  
          // Give the page fetch a moment
          // to complete.
          await session.wait(100);
  
          const observation =
            await session.observe();
  
          expect(
            observation.title,
          ).toBe(
            'Toverni Observation Test',
          );
  
          expect(
            observation.url,
          ).toBe(
            `${baseUrl}/`,
          );
  
          expect(
            observation
              .semanticText,
          ).toContain(
            'Projects',
          );
  
          expect(
            observation
              .ariaSnapshot,
          ).toContain(
            'heading "Projects"',
          );
  
          expect(
            observation.actions
              .some(
                (action) =>
                  action.type ===
                    'button' &&
                  action.name ===
                    'Create Project',
              ),
          ).toBe(true);
  
          expect(
            observation.actions
              .some(
                (action) =>
                  action.type ===
                  'input',
              ),
          ).toBe(true);
  
          expect(
            observation.actions
              .some(
                (action) =>
                  action.type ===
                  'select',
              ),
          ).toBe(true);
  
          expect(
            observation.actions
              .some(
                (action) =>
                  action.type ===
                  'link',
              ),
          ).toBe(true);
  
          expect(
            observation
              .consoleEvents
              .some(
                (event) =>
                  event.type ===
                    'warning' &&
                  event.text ===
                    'Observation warning',
              ),
          ).toBe(true);
  
          expect(
            observation
              .consoleEvents
              .some(
                (event) =>
                  event.type ===
                    'error' &&
                  event.text ===
                    'Observation error',
              ),
          ).toBe(true);
  
          expect(
            observation
              .networkEvents
              .some(
                (event) =>
                  event.url.endsWith(
                    '/api/projects',
                  ) &&
                  event.status ===
                    200,
              ),
          ).toBe(true);
  
          await session.close();
  
          await controller.close();
        },
      );
    },
  );