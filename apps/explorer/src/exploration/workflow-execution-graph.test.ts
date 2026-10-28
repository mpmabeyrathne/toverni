import { describe, expect, it } from 'vitest';
import { buildWorkflowExecutionGraph } from './workflow-execution-graph.js';
import type { WorkflowResult } from './workflow-branch-scheduler.js';

describe('isolated workflow execution graph', () => {
  it('records each observed step with a connected scenario identity and no input values', () => {
    const result: WorkflowResult = {
      branchId: 'login', datasetId: 'positive', status: 'completed',
      verified: true, startUrl: 'https://example.com/login',
      finalUrl: 'https://example.com/secure', trace: [],
      observedSteps: [
        { action: 'fill', label: 'Username', url: 'https://example.com/login',
          observedAt: '2026-10-28T00:00:01Z' },
        { action: 'fill', label: 'Password', url: 'https://example.com/login',
          observedAt: '2026-10-28T00:00:02Z' },
        { action: 'submit', label: 'Login', url: 'https://example.com/secure',
          observedAt: '2026-10-28T00:00:03Z' },
      ],
    };
    const graph = buildWorkflowExecutionGraph([result]);
    const scenario = graph.scenarios[0]!;
    expect(scenario.states).toHaveLength(4);
    expect(scenario.transitions.map((edge) => edge.action)).toEqual(['fill', 'fill', 'submit']);
    expect(scenario.transitions[0]?.fromStateId).toBe(scenario.states[0]?.id);
    expect(scenario.transitions[2]?.toStateId).toBe(scenario.states[3]?.id);
    expect(scenario.states[0]?.url).toBe('https://example.com/login');
    expect(JSON.stringify(graph)).not.toContain('SuperSecretPassword!');
  });
});
