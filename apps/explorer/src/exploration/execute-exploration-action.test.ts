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
            status: 'executed',
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
                label: 'Learn more',
                target,
              },
            );
  
          expect(
            session.click,
          ).toHaveBeenCalledWith(
            target,
          );
  
          expect(result.status).toBe(
            'executed',
          );
        },
      );
  
      it(
        'does not invent execution for unsupported actions',
        async () => {
          const session =
            createSession();
  
          const result =
            await executeExplorationAction(
              session,
              {
                type: 'input',
                label: 'Search rooms',
                target: {
                  by: 'label',
                  label: 'Search rooms',
                },
              },
            );
  
          expect(result.status).toBe(
            'unsupported',
          );
  
          expect(
            session.click,
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
                type: 'button',
                label: 'Book',
                target: null,
              },
            );
  
          expect(result.status).toBe(
            'unsupported',
          );
        },
      );
    },
  );