import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BrowserSession } from '../browser/browser-session.js';
import { runVerifiedWorkflowPipeline } from './verified-workflow-pipeline.js';

describe('verified workflow integration', () => {
  it('executes a complete login branch and writes a credential-free spec', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'toverni-workflow-'));
    const origin = 'https://example.com';
    const observe = vi.fn().mockResolvedValueOnce({
      url: origin + '/login', title: 'Login', capturedAt: '2026-10-28T00:00:00.000Z',
      semanticText: [], ariaSnapshot: '', consoleEvents: [], networkEvents: [],
      supportingArtifacts: [],
      actions: [
        { type: 'input', tagName: 'input', name: 'Username', inputType: 'text',
          visible: true, disabled: false,
          formField: { inputType: 'text', required: true, value: '' } },
        { type: 'input', tagName: 'input', name: 'Password', inputType: 'password',
          visible: true, disabled: false,
          formField: { inputType: 'password', required: true, value: '' } },
        { type: 'button', tagName: 'button', name: 'Login',
          visible: true, disabled: false },
      ],
    }).mockResolvedValue({ url: origin + '/secure',
      semanticText: ['You logged into a secure area!'] });
    const input = {
      initialObservation: {
        url: origin + '/login', title: 'Login', capturedAt: '2026-10-28T00:00:00.000Z',
        semanticText: [], ariaSnapshot: '', consoleEvents: [], networkEvents: [],
        supportingArtifacts: [],
        actions: [
          { type: 'input' as const, tagName: 'input', name: 'Username', inputType: 'text',
            visible: true, disabled: false,
            formField: { inputType: 'text', required: true, value: '' } },
          { type: 'input' as const, tagName: 'input', name: 'Password', inputType: 'password',
            visible: true, disabled: false,
            formField: { inputType: 'password', required: true, value: '' } },
          { type: 'button' as const, tagName: 'button', name: 'Login',
            visible: true, disabled: false },
        ],
      },
      fixture: { origin, fields: { Username: 'practice', Password: 'secret-fixture' } },
      openSession: async () => ({
        navigate: vi.fn(async () => {}), observe,
        fill: vi.fn(async () => {}), click: vi.fn(async () => {}),
        close: vi.fn(async () => {}),
      }) as unknown as BrowserSession,
      outputDirectory: directory,
      datasetsJson: JSON.stringify([{ id: 'positive', expectedUrl: origin + '/secure' }]),
      fieldEnvJson: JSON.stringify({ Username: 'TOVERNI_TEST_USERNAME',
        Password: 'TOVERNI_TEST_PASSWORD' }),
    };
    try {
      const result = await runVerifiedWorkflowPipeline(input);
      expect(result.completed).toBe(1);
      expect(result.generatedSpecs).toBe(1);
      const files = await readdir(directory);
      expect(files).toHaveLength(1);
      const source = await readFile(join(directory, files[0]!), 'utf8');
      expect(source).toContain('TOVERNI_TEST_PASSWORD');
      expect(source).toContain('getByLabel("Password"');
      expect(source).not.toContain('secret-fixture');
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
