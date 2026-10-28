import { describe, expect, it, vi } from 'vitest';
import type { BrowserSession } from '../browser/browser-session.js';
import type { PageObservation } from '../contracts/page-observation.js';
import { discoverWorkflowBranches, executeWorkflowBranches, planWorkflowBranch, verifiedWorkflowPaths } from './workflow-branch-scheduler.js';

const observation = (url: string, text: string[]): PageObservation => ({
  url, title: 'Login', capturedAt: '2026-10-28T00:00:00.000Z', semanticText: text,
  ariaSnapshot: '', consoleEvents: [], networkEvents: [], supportingArtifacts: [],
  actions: [
    { type: 'input', tagName: 'input', name: 'Username', inputType: 'text',
      visible: true, disabled: false },
    { type: 'input', tagName: 'input', name: 'Password', inputType: 'password',
      visible: true, disabled: false },
    { type: 'button', tagName: 'button', name: 'Login',
      visible: true, disabled: false },
  ],
});

describe('workflow branch scheduler', () => {
  const branch = {
    id: 'login', startUrl: 'https://example.com/login', submitLabel: 'Login',
    requiredFields: ['Username', 'Password'],
    datasets: [
      { id: 'positive', expectedUrl: 'https://example.com/secure' },
      { id: 'negative', expectedText: 'Your password is invalid!' },
    ],
  };
  it('discovers observed submit branches without inventing datasets', () => {
    const page = observation('https://example.com/login', []);
    page.actions = page.actions.map((action) =>
      action.type === 'input' ? { ...action, formField: {
        inputType: action.inputType ?? 'text', required: true, value: '',
      } } : action);
    const branches = discoverWorkflowBranches(page);
    expect(branches).toHaveLength(1);
    expect(branches[0]?.requiredFields).toEqual(['Username', 'Password']);
    expect(branches[0]?.datasets).toEqual([]);
  });

  it('identifies missing required dependencies before execution', () => {
    const page = observation(branch.startUrl, []);
    page.actions = page.actions.filter((action) => action.name !== 'Password');
    expect(planWorkflowBranch(page, branch).missingDependencies).toEqual(['Password']);
  });

  it('executes isolated branches and retains only verified traces without secret values', async () => {
    const closes: Array<ReturnType<typeof vi.fn>> = [];
    const values: string[] = [];
    let number = 0;
    const openSession = async () => {
      const index = number++;
      const close = vi.fn(async () => {});
      closes.push(close);
      let observations = 0;
      return {
        navigate: vi.fn(async () => {}),
        observe: vi.fn(async () => {
          observations++;
          return observations === 1 ? observation(branch.startUrl, []) :
            observation(index === 0 ? 'https://example.com/secure' : branch.startUrl,
              index === 0 ? ['You logged into a secure area!'] :
                ['Your password is invalid!']);
        }),
        fill: vi.fn(async (_target: unknown, value: string) => { values.push(value); }),
        click: vi.fn(async () => {}),
        close,
      } as unknown as BrowserSession;
    };
    const results = await executeWorkflowBranches(openSession, [branch],
      { origin: 'https://example.com', fields: { Username: 'practice', Password: 'secret-fixture' } });
    expect(results.map((result) => result.status)).toEqual(['completed', 'completed']);
    expect(values).toEqual(['practice', 'secret-fixture', 'practice', 'secret-fixture']);
    expect(closes.every((close) => close.mock.calls.length === 1)).toBe(true);
    expect(verifiedWorkflowPaths(results)).toHaveLength(2);
    expect(JSON.stringify(results)).not.toContain('secret-fixture');
  });

  it('blocks branches with no independently specified outcome', async () => {
    const open = vi.fn(async () => ({} as BrowserSession));
    const results = await executeWorkflowBranches(open, [
      { ...branch, datasets: [{ id: 'unknown' }] },
    ], { origin: 'https://example.com', fields: { Username: 'u', Password: 'p' } });
    expect(results[0]?.status).toBe('blocked');
    expect(open).not.toHaveBeenCalled();
    expect(verifiedWorkflowPaths(results)).toEqual([]);
  });
});
