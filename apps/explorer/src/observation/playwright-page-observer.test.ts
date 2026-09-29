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
              Email

              <input
                aria-label="Email"
                name="email"
                type="email"
                required
                placeholder="name@example.com"
                minlength="5"
                maxlength="120"
                pattern=".+@.+[.].+"
              />
            </label>

            <label>
              Project Seats

              <input
                aria-label="Project Seats"
                name="seats"
                type="number"
                required
                min="1"
                max="10"
                step="1"
              />
            </label>

            <label>
              Accept Terms

              <input
                aria-label="Accept Terms"
                name="terms"
                type="checkbox"
                required
                checked
              />
            </label>

            <label>
              Description

              <textarea
                aria-label="Description"
                name="description"
                required
                placeholder="Project description"
                minlength="10"
                maxlength="500"
              ></textarea>
            </label>

            <select
              aria-label="Project Type"
              name="projectType"
              required
            >
              <option value="">
                Choose Project Type
              </option>

              <option
                value="web"
                selected
              >
                Web
              </option>

              <option
                value="mobile"
                disabled
              >
                Mobile
              </option>
            </select>

            <span id="country-label">
              Country
            </span>

            <div
              role="combobox"
              aria-labelledby="country-label"
              aria-controls="country-options"
              aria-required="true"
              aria-expanded="true"
              tabindex="0"
            >
            </div>

            <div
              id="country-options"
              role="listbox"
              aria-label="Country Options"
            >
              <div
                role="option"
                data-value="lk"
                aria-selected="true"
              >
                Sri Lanka
              </div>

              <div
                role="option"
                data-value="au"
                aria-disabled="true"
                aria-selected="false"
              >
                Australia
              </div>
            </div>

            <div
              role="checkbox"
              aria-label="Enable Notifications"
              aria-required="true"
              aria-checked="false"
              tabindex="0"
            >
            </div>

            <div
              role="radio"
              aria-label="Monthly Plan"
              aria-required="true"
              aria-checked="true"
              tabindex="0"
            >
            </div>

            <div
              role="textbox"
              aria-label="Project Notes"
              aria-required="true"
              aria-placeholder="Add project notes"
              contenteditable="true"
            >
            </div>

            <a href="/details">
              Open Project
            </a>

            </select>

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
              reject(error);

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

        // --------------------------------
        // Basic page evidence
        // --------------------------------

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

        // --------------------------------
        // Basic action discovery
        // --------------------------------

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
                'textarea',
            ),
        ).toBe(true);

        expect(
          observation.actions
            .some(
              (action) =>
                action.type ===
                'checkbox',
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

        // --------------------------------
        // Email field metadata
        // --------------------------------

        const emailAction =
          observation.actions.find(
            (action) =>
              action.name ===
              'Email',
          );

        expect(
          emailAction,
        ).toBeDefined();

        expect(
          emailAction?.type,
        ).toBe(
          'input',
        );

        expect(
          emailAction?.formField,
        ).toEqual({
          htmlName:
            'email',

          inputType:
            'email',

          required:
            true,

          placeholder:
            'name@example.com',

          minLength:
            5,

          maxLength:
            120,

          pattern:
            '.+@.+[.].+',
        });

        // --------------------------------
        // Number field metadata
        // --------------------------------

        const numberAction =
          observation.actions.find(
            (action) =>
              action.name ===
              'Project Seats',
          );

        expect(
          numberAction,
        ).toBeDefined();

        expect(
          numberAction?.type,
        ).toBe(
          'input',
        );

        expect(
          numberAction?.formField,
        ).toEqual({
          htmlName:
            'seats',

          inputType:
            'number',

          required:
            true,

          min:
            '1',

          max:
            '10',

          step:
            '1',
        });

        // --------------------------------
        // Checkbox metadata
        // --------------------------------

        const checkboxAction =
          observation.actions.find(
            (action) =>
              action.name ===
              'Accept Terms',
          );

        expect(
          checkboxAction,
        ).toBeDefined();

        expect(
          checkboxAction?.type,
        ).toBe(
          'checkbox',
        );

        expect(
          checkboxAction?.formField,
        ).toEqual({
          htmlName:
            'terms',

          inputType:
            'checkbox',

          required:
            true,

          checked:
            true,
        });

        // --------------------------------
        // Textarea metadata
        // --------------------------------

        const textareaAction =
          observation.actions.find(
            (action) =>
              action.name ===
              'Description',
          );

        expect(
          textareaAction,
        ).toBeDefined();

        expect(
          textareaAction?.type,
        ).toBe(
          'textarea',
        );

        expect(
          textareaAction?.formField,
        ).toEqual({
          htmlName:
            'description',

          required:
            true,

          placeholder:
            'Project description',

          minLength:
            10,

          maxLength:
            500,
        });

        // --------------------------------
        // Select metadata
        // --------------------------------

        const selectAction =
          observation.actions.find(
            (action) =>
              action.name ===
              'Project Type',
          );

        expect(
          selectAction,
        ).toBeDefined();

        expect(
          selectAction?.type,
        ).toBe(
          'select',
        );

        expect(
          selectAction?.formField,
        ).toEqual({
          htmlName:
            'projectType',

          required:
            true,

          multiple:
            false,

          options: [
            {
              value:
                '',

              label:
                'Choose Project Type',

              disabled:
                false,

              selected:
                false,
            },

            {
              value:
                'web',

              label:
                'Web',

              disabled:
                false,

              selected:
                true,
            },

            {
              value:
                'mobile',

              label:
                'Mobile',

              disabled:
                true,

              selected:
                false,
            },
          ],
        });

        // --------------------------------
        // ARIA combobox metadata
        // --------------------------------

        const comboboxAction =
          observation.actions.find(
            (action) =>
              action.name ===
              'Country',
          );

        expect(
          comboboxAction,
        ).toBeDefined();

        expect(
          comboboxAction?.type,
        ).toBe(
          'combobox',
        );

        expect(
          comboboxAction?.role,
        ).toBe(
          'combobox',
        );

        expect(
          comboboxAction?.formField,
        ).toEqual({
          required:
            true,

          editable:
            false,

          options: [
            {
              value:
                'lk',

              label:
                'Sri Lanka',

              disabled:
                false,

              selected:
                true,
            },

            {
              value:
                'au',

              label:
                'Australia',

              disabled:
                true,

              selected:
                false,
            },
          ],
        });

        // --------------------------------
        // ARIA listbox metadata
        // --------------------------------

        const listboxAction =
          observation.actions.find(
            (action) =>
              action.name ===
              'Country Options',
          );

        expect(
          listboxAction,
        ).toBeDefined();

        expect(
          listboxAction?.type,
        ).toBe(
          'listbox',
        );

        expect(
          listboxAction?.formField,
        ).toEqual({
          required:
            false,

          editable:
            false,

          options: [
            {
              value:
                'lk',

              label:
                'Sri Lanka',

              disabled:
                false,

              selected:
                true,
            },

            {
              value:
                'au',

              label:
                'Australia',

              disabled:
                true,

              selected:
                false,
            },
          ],
        });

        // --------------------------------
        // Custom checkbox metadata
        // --------------------------------

        const customCheckboxAction =
          observation.actions.find(
            (action) =>
              action.name ===
              'Enable Notifications',
          );

        expect(
          customCheckboxAction,
        ).toBeDefined();

        expect(
          customCheckboxAction?.type,
        ).toBe(
          'checkbox',
        );

        expect(
          customCheckboxAction?.formField,
        ).toEqual({
          required:
            true,

          checked:
            false,

          editable:
            false,
        });

        // --------------------------------
        // Custom radio metadata
        // --------------------------------

        const customRadioAction =
          observation.actions.find(
            (action) =>
              action.name ===
              'Monthly Plan',
          );

        expect(
          customRadioAction,
        ).toBeDefined();

        expect(
          customRadioAction?.type,
        ).toBe(
          'radio',
        );

        expect(
          customRadioAction?.formField,
        ).toEqual({
          required:
            true,

          checked:
            true,

          editable:
            false,
        });

        // --------------------------------
        // Contenteditable metadata
        // --------------------------------

        const contentEditableAction =
          observation.actions.find(
            (action) =>
              action.name ===
              'Project Notes',
          );

        expect(
          contentEditableAction,
        ).toBeDefined();

        expect(
          contentEditableAction?.type,
        ).toBe(
          'contenteditable',
        );

        expect(
          contentEditableAction?.role,
        ).toBe(
          'textbox',
        );

        expect(
          contentEditableAction?.formField,
        ).toEqual({
          required:
            true,

          inputType:
            'text',

          editable:
            true,

          placeholder:
            'Add project notes',
        });

        // --------------------------------
        // Console evidence
        // --------------------------------

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

        // --------------------------------
        // Network evidence
        // --------------------------------

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