import { describe, expect, it } from 'vitest';
import { buildExplorationArtifacts } from './exploration-artifacts.js';
import type { ApplicationStateNode, ApplicationTransition } from '../state/application-state.js';

describe('reviewable exploration artifacts', () => {
  it('exports workflow dependencies and an observed graph without secret values', () => {
    const observation = {
      url: 'https://example.com/login',
      actions: [
        { type: 'input', tagName: 'input', name: 'Username', visible: true, disabled: false,
          formField: { inputType: 'text', required: true, value: 'secret-username' } },
        { type: 'input', tagName: 'input', name: 'Password', visible: true, disabled: false,
          formField: { inputType: 'password', required: true, value: 'secret-password' } },
        { type: 'button', tagName: 'button', name: 'Login', visible: true, disabled: false },
      ],
    };
    const states = [{
      id: 'state-a', url: observation.url, routePattern: '/login', visits: 1,
      observation,
    }] as unknown as ApplicationStateNode[];
    const transitions = [{
      id: 'transition-a', fromStateId: 'state-a', toStateId: 'state-a',
      action: { type: 'fill', target: 'Password', value: 'secret-password' },
      equivalentState: true, explorationBlocked: false,
    }] as unknown as ApplicationTransition[];
    const result = buildExplorationArtifacts(states, transitions);
    expect(result.functionalTree.nodes[0]?.requiredFields).toEqual(['Username', 'Password']);
    expect(result.functionalTree.nodes[0]?.verification).toBe('not-verified');
    expect(result.stateGraph.transitions[0]?.actionType).toBe('fill');
    expect(result.stateGraph.diagnostics.orphanTransitionIds).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('secret-password');
    expect(JSON.stringify(result)).not.toContain('secret-username');
  });
  it('merges login workflow observations and infers missing required metadata', () => {
    const actions = [
      { type: 'input', tagName: 'input', name: 'Username', visible: true, disabled: false },
      { type: 'input', tagName: 'input', name: 'Password', visible: true, disabled: false },
      { type: 'button', tagName: 'button', name: 'Login', visible: true, disabled: false },
    ];
    const states = ['first', 'second'].map((id) => ({
      id, url: 'https://example.com/login', routePattern: '/login', visits: 1,
      observation: { url: 'https://example.com/login', actions },
    })) as unknown as ApplicationStateNode[];
    const result = buildExplorationArtifacts(states, []);
    expect(result.functionalTree.nodes).toHaveLength(1);
    expect(result.functionalTree.nodes[0]?.observedStateIds).toEqual(['first', 'second']);
    expect(result.functionalTree.nodes[0]?.requiredFields).toEqual(['Username', 'Password']);
    expect(result.functionalTree.nodes[0]?.verification).toBe('not-verified');
  });

});
