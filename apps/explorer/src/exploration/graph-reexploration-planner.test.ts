import { describe, expect, it } from 'vitest';
import { planGraphReexploration } from './graph-reexploration-planner.js';
import type { GraphIntegrityReport } from './workflow-model-validation.js';

describe('graph-guided re-exploration planning', () => {
  it('prioritizes partially explored workflows and missing prerequisites', () => {
    const report: GraphIntegrityReport = {
      valid: true, issues: [],
      reexploration: [
        { workflowId: 'registration', url: 'https://example.com/register',
          missingFields: ['Email'], missingSubmission: true, status: 'unexplored' },
        { workflowId: 'login', url: 'https://example.com/login',
          missingFields: ['Password'], missingSubmission: false, status: 'partial' },
      ],
    };
    const tasks = planGraphReexploration(report);
    expect(tasks.map((task) => task.workflowId)).toEqual(['login', 'registration']);
    expect(tasks[0]?.prerequisites).toEqual([{ kind: 'fill', label: 'Password' }]);
    expect(tasks.every((task) => task.status === 'pending')).toBe(true);
  });
});
