import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  BrowserSession,
} from '../browser/index.js';

import {
  executeExplorationAction,
} from './execute-exploration-action.js';

function createSession(): BrowserSession {
  return {
    navigate: vi.fn(),
    click: vi.fn(),
    fill: vi.fn(),
    select: vi.fn(),
    setInputFiles: vi.fn(),
    submit: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    reload: vi.fn(),
    wait: vi.fn(),
    observe: vi.fn(),
    getUrl: vi.fn(),
    getTitle: vi.fn(),
    close: vi.fn(),
  };
}

describe(
  'executeExplorationAction',
  () => {
    it(
      'executes button actions by clicking the discovered target',
      async () => {
        const session =
          createSession();

        const target = {
          by: 'role',
          role: 'button',
          name: 'Book Ocean Room',
          exact: true,
        } as const;

        const result =
          await executeExplorationAction(
            session,
            {
              type: 'button',
              label:
                'Book Ocean Room',
              target,
            },
          );

        expect(
          session.click,
        ).toHaveBeenCalledWith(
          target,
        );

        expect(result).toEqual({
          status:
            'executed',
        });
      },
    );

    it(
      'executes link actions by clicking the discovered target',
      async () => {
        const session =
          createSession();

        const target = {
          by: 'role',
          role: 'link',
          name: 'Learn more',
          exact: true,
        } as const;

        const result =
          await executeExplorationAction(
            session,
            {
              type: 'link',
              label:
                'Learn more',
              target,
            },
          );

        expect(
          session.click,
        ).toHaveBeenCalledWith(
          target,
        );

        expect(
          result.status,
        ).toBe(
          'executed',
        );
      },
    );

    it(
      'fills a grounded input value',
      async () => {
        const session =
          createSession();

        const target = {
          by: 'label',
          label:
            'Search rooms',
          exact: true,
        } as const;

        const result =
          await executeExplorationAction(
            session,
            {
              type:
                'input',

              label:
                'Search rooms',

              target,

              formExecution: {
                kind:
                  'fill',

                value:
                  'ocean',

                evidence: [],
              },
            },
          );

        expect(
          session.fill,
        ).toHaveBeenCalledWith(
          target,
          'ocean',
        );

        expect(
          result.status,
        ).toBe(
          'executed',
        );
      },
    );

    it(
      'fills a grounded contenteditable control',
      async () => {
        const session =
          createSession();

        const target = {
          by:
            'role',

          role:
            'textbox',

          name:
            'Project Notes',

          exact:
            true,
        } as const;

        const result =
          await executeExplorationAction(
            session,
            {
              type:
                'contenteditable',

              label:
                'Project Notes',

              target,

              formExecution: {
                kind:
                  'fill',

                value:
                  'Grounded project notes',

                evidence: [],
              },
            },
          );

        expect(
          session.fill,
        ).toHaveBeenCalledWith(
          target,
          'Grounded project notes',
        );

        expect(
          result.status,
        ).toBe(
          'executed',
        );
      },
    );

    it(
      'executes native select using grounded value',
      async () => {
        const session =
          createSession();

        const target = {
          by:
            'label',

          label:
            'Project Type',

          exact:
            true,
        } as const;

        const result =
          await executeExplorationAction(
            session,
            {
              type:
                'select',

              label:
                'Project Type',

              target,

              formExecution: {
                kind:
                  'select',

                value:
                  'web',

                evidence: [],
              },
            },
          );

        expect(
          session.select,
        ).toHaveBeenCalledWith(
          target,
          'web',
        );

        expect(
          result.status,
        ).toBe(
          'executed',
        );
      },
    );

    it(
      'opens a combobox and chooses the grounded ARIA option',
      async () => {
        const session =
          createSession();

        const target = {
          by:
            'role',

          role:
            'combobox',

          name:
            'Country',

          exact:
            true,
        } as const;

        const result =
          await executeExplorationAction(
            session,
            {
              type:
                'combobox',

              label:
                'Country',

              target,

              formExecution: {
                kind:
                  'choose-option',

                value:
                  'Sri Lanka',

                evidence: [],
              },
            },
          );

        expect(
          session.click,
        ).toHaveBeenNthCalledWith(
          1,
          target,
        );

        expect(
          session.click,
        ).toHaveBeenNthCalledWith(
          2,
          {
            by:
              'role',

            role:
              'option',

            name:
              'Sri Lanka',

            exact:
              true,
          },
        );

        expect(
          result.status,
        ).toBe(
          'executed',
        );
      },
    );

    it(
      'fills an editable combobox when grounded execution is fill',
      async () => {
        const session =
          createSession();

        const target = {
          by:
            'role',

          role:
            'combobox',

          name:
            'Search country',

          exact:
            true,
        } as const;

        const result =
          await executeExplorationAction(
            session,
            {
              type:
                'combobox',

              label:
                'Search country',

              target,

              formExecution: {
                kind:
                  'fill',

                value:
                  'Sri Lanka',

                evidence: [],
              },
            },
          );

        expect(
          session.fill,
        ).toHaveBeenCalledWith(
          target,
          'Sri Lanka',
        );

        expect(
          session.click,
        ).not.toHaveBeenCalled();

        expect(
          result.status,
        ).toBe(
          'executed',
        );
      },
    );

    it(
      'chooses a grounded ARIA listbox option',
      async () => {
        const session =
          createSession();

        const target = {
          by:
            'role',

          role:
            'listbox',

          name:
            'Plan',

          exact:
            true,
        } as const;

        const result =
          await executeExplorationAction(
            session,
            {
              type:
                'listbox',

              label:
                'Plan',

              target,

              formExecution: {
                kind:
                  'choose-option',

                value:
                  'Premium',

                evidence: [],
              },
            },
          );

        expect(
          session.click,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          session.click,
        ).toHaveBeenCalledWith({
          by:
            'role',

          role:
            'option',

          name:
            'Premium',

          exact:
            true,
        });

        expect(
          result.status,
        ).toBe(
          'executed',
        );
      },
    );

    it(
      'clicks a checkbox when current state differs from desired state',
      async () => {
        const session =
          createSession();

        const target = {
          by:
            'role',

          role:
            'checkbox',

          name:
            'Accept Terms',

          exact:
            true,
        } as const;

        const result =
          await executeExplorationAction(
            session,
            {
              type:
                'checkbox',

              label:
                'Accept Terms',

              target,

              formExecution: {
                kind:
                  'set-checked',

                value:
                  true,

                currentValue:
                  false,

                evidence: [],
              },
            },
          );

        expect(
          session.click,
        ).toHaveBeenCalledWith(
          target,
        );

        expect(
          result.status,
        ).toBe(
          'executed',
        );
      },
    );

    it(
      'does not click a checkbox when it already has the desired state',
      async () => {
        const session =
          createSession();

        const target = {
          by:
            'role',

          role:
            'checkbox',

          name:
            'Accept Terms',

          exact:
            true,
        } as const;

        const result =
          await executeExplorationAction(
            session,
            {
              type:
                'checkbox',

              label:
                'Accept Terms',

              target,

              formExecution: {
                kind:
                  'set-checked',

                value:
                  true,

                currentValue:
                  true,

                evidence: [],
              },
            },
          );

        expect(
          session.click,
        ).not.toHaveBeenCalled();

        expect(
          result.status,
        ).toBe(
          'executed',
        );
      },
    );

    it(
      'executes grounded radio state changes',
      async () => {
        const session =
          createSession();

        const target = {
          by:
            'role',

          role:
            'radio',

          name:
            'Monthly Plan',

          exact:
            true,
        } as const;

        const result =
          await executeExplorationAction(
            session,
            {
              type:
                'radio',

              label:
                'Monthly Plan',

              target,

              formExecution: {
                kind:
                  'set-checked',

                value:
                  true,

                currentValue:
                  false,

                evidence: [],
              },
            },
          );

        expect(
          session.click,
        ).toHaveBeenCalledWith(
          target,
        );

        expect(
          result.status,
        ).toBe(
          'executed',
        );
      },
    );

    it(
      'does not invent execution when an input has no grounded value',
      async () => {
        const session =
          createSession();

        const result =
          await executeExplorationAction(
            session,
            {
              type:
                'input',

              label:
                'Search rooms',

              target: {
                by:
                  'label',

                label:
                  'Search rooms',
              },
            },
          );

        expect(
          result.status,
        ).toBe(
          'unsupported',
        );

        expect(
          session.fill,
        ).not.toHaveBeenCalled();

        expect(
          session.click,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects a combobox without grounded execution data',
      async () => {
        const session =
          createSession();

        const result =
          await executeExplorationAction(
            session,
            {
              type:
                'combobox',

              label:
                'Country',

              target: {
                by:
                  'role',

                role:
                  'combobox',

                name:
                  'Country',
              },
            },
          );

        expect(
          result.status,
        ).toBe(
          'unsupported',
        );

        expect(
          session.click,
        ).not.toHaveBeenCalled();

        expect(
          session.fill,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects actions without a browser target',
      async () => {
        const session =
          createSession();

        const result =
          await executeExplorationAction(
            session,
            {
              type:
                'button',

              label:
                'Book',

              target:
                null,
            },
          );

        expect(
          result.status,
        ).toBe(
          'unsupported',
        );
      },
    );
  },
);