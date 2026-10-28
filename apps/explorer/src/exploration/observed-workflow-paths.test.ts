import { describe, expect, it } from 'vitest';
import { findObservedWorkflowPaths } from './observed-workflow-paths.js';
import type { FunctionalTreeExport, StateGraphExport } from './exploration-artifacts.js';

const tree: FunctionalTreeExport = {
  schemaVersion: 1, source: 'observed-ui',
  nodes: [{
    id: 'login', stateId: 's1', observedStateIds: ['s1', 's2', 's3', 's4'],
    url: 'https://example.com/login', submitLabel: 'Login',
    requiredFields: ['Username', 'Password'],
    dependencies: [{ field: 'Username', kind: 'required-input' },
      { field: 'Password', kind: 'required-input' }],
    status: 'discovered', verification: 'not-verified',
  }],
};
const states = ['s1', 's2', 's3', 's4'].map((id) =>
  ({ id, url: 'https://example.com/login', routePattern: '/login', visits: 1 }));
const edge = (id: string, fromStateId: string, toStateId: string,
  actionType: string, actionTarget: string) =>
  ({ id, fromStateId, toStateId, actionType, actionTarget,
    equivalentState: false, explorationBlocked: false });
const graph: StateGraphExport = {
  schemaVersion: 1, source: 'persisted-browser-observations',
  states, transitions: [
    edge('username', 's1', 's2', 'fill', 'Username'),
    edge('password', 's2', 's3', 'fill', 'Password'),
    edge('submit', 's3', 's4', 'click', 'Login'),
  ],
  diagnostics: { orphanTransitionIds: [], discoveredStates: 4, observedTransitions: 3 },
};
describe('ordered observed workflow paths', () => {
  it('only accepts a connected sequence with all prerequisites before submit', () => {
    expect(findObservedWorkflowPaths(tree, graph)[0]?.transitionIds)
      .toEqual(['username', 'password', 'submit']);
    expect(findObservedWorkflowPaths(tree, graph)[0]?.status)
      .toBe('actions-observed-outcome-unverified');
  });
  it('rejects incomplete login even when submit was clicked', () => {
    expect(findObservedWorkflowPaths(tree, {
      ...graph, transitions: graph.transitions.filter((t) => t.id !== 'password'),
    })).toEqual([]);
  });
});
