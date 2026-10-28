import { describe, expect, it, vi } from 'vitest';
import type { BrowserSession } from '../browser/browser-session.js';
import type { BrowserTarget } from '../browser/browser-target.js';
import { executeBrowserScenarios } from './execute-browser-scenarios.js';

describe('isolated browser scenarios', () => {
  it('resets sessions between branches and verifies outcomes', async () => {
    const closed: Array<ReturnType<typeof vi.fn>> = [];
    const filled: string[] = [];
    const openSession = async () => {
      const close = vi.fn(async () => {});
      closed.push(close);
      return {
        navigate: vi.fn(async () => {}),
        observe: vi.fn(async () => ({
          url: 'https://example.com/login',
          semanticText: ['Your password is invalid!'],
        })),
        fill: vi.fn(async (_target: BrowserTarget, value: string) => {
          filled.push(value);
        }),
        click: vi.fn(async () => {}),
        close,
      } as unknown as BrowserSession;
    };
    const target = { by: 'role', role: 'textbox', name: 'Username' } as BrowserTarget;
    const submitTarget = { by: 'role', role: 'button', name: 'Login' } as BrowserTarget;
    const results = await executeBrowserScenarios(openSession, [
      { name: 'invalid username', startUrl: 'https://example.com/login',
        fields: [{ target, value: 'wrongUser' }], submitTarget,
        expectedUrl: 'https://example.com/login', expectedText: 'Your password is invalid!' },
      { name: 'invalid password', startUrl: 'https://example.com/login',
        fields: [{ target, value: 'practice' }], submitTarget,
        expectedUrl: 'https://example.com/login', expectedText: 'Your password is invalid!' },
    ]);
    expect(results.map((result) => result.passed)).toEqual([true, true]);
    expect(filled).toEqual(['wrongUser', 'practice']);
    expect(closed).toHaveLength(2);
    expect(closed.every((close) => close.mock.calls.length === 1)).toBe(true);
  });
});
