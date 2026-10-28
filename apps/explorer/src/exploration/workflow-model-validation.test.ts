import { describe, expect, it } from 'vitest';
import { validateExplorationModels } from './workflow-model-validation.js';
import type { FunctionalTreeExport, StateGraphExport } from './exploration-artifacts.js';

const tree: FunctionalTreeExport = {
  schemaVersion: 1, source: 'observed-ui',
  nodes: [{
    id: 'login', stateId: 's1', observedStateIds: ['s1', 's2'],
    url: 'https://example.com/login', submitLabel: 'Login',
    requiredFields: ['Username', 'Password'],
    dependencies: [
      { field: 'Username', kind: 'required-input' },
      { field: 'Password', kind: 'required-input' },
    ],
    status: 'discovered', verification: 'not-verified',
  }],
};
const graph: StateGraphExport = {
  schemaVersion: 1, source: 'persisted-browser-observations',
  states: [
    { id: 's1', url: 'https://example.com/login', routePattern: '/login', visits: 1 },
    { id: 's2', url: 'https://example.com/login', routePattern: '/login', visits: 1 },
  ],
  transitions: [
    { id: 't1', fromStateId: 's1', toStateId: 's2', actionType: 'fill',
      actionTarget: 'Username', equivalentState: false, explorationBlocked: false },
    { id: 't2', fromStateId: 's2', toStateId: 's2', actionType: 'click',
      actionTarget: 'Login', equivalentState: true, explorationBlocked: false },
  ],
  diagnostics: { orphanTransitionIds: [], discoveredStates: 2, observedTransitions: 2 },
};

describe('workflow model validation', () => {
  it('reports missing Password transition without inventing an observed edge', () => {
    const report = validateExplorationModels(tree, graph);
    expect(report.valid).toBe(true);
    expect(report.reexploration).toEqual([{
      workflowId: 'login', url: 'https://example.com/login',
      missingFields: ['Password'], missingSubmission: false, status: 'partial',
    }]);
    expect(graph.transitions).toHaveLength(2);
  });
  it('rejects orphan graph edges and unknown source states', () => {
    const report = validateExplorationModels(tree, {
      ...graph, transitions: [
        { ...graph.transitions[0]!, fromStateId: 'missing' },
        graph.transitions[1]!,
      ],
    });
    expect(report.valid).toBe(false);
    expect(report.issues).toContain('Orphan transition: t1');
  });
  it('rejects duplicate workflow identities', () => {
    const report = validateExplorationModels(
      { ...tree, nodes: [tree.nodes[0]!, tree.nodes[0]!] }, graph);
    expect(report.valid).toBe(false);
    expect(report.issues).toContain('Duplicate workflow IDs');
  });
});
