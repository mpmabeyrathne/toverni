import type { ApplicationStateNode, ApplicationTransition } from '../state/application-state.js';
import { discoverWorkflowBranches } from './workflow-branch-scheduler.js';

/** Workflow-first artifacts: proposals are not observed or verified executions. */
export interface FunctionalTreeExport {
  schemaVersion: 1;
  source: 'observed-ui';
  nodes: Array<{
    id: string;
    stateId: string;
    observedStateIds: string[];
    url: string;
    submitLabel: string;
    requiredFields: string[];
    dependencies: Array<{ field: string; kind: 'required-input' }>;
    status: 'discovered';
    verification: 'not-verified';
  }>;
}
export interface StateGraphExport {
  schemaVersion: 1;
  source: 'persisted-browser-observations';
  states: Array<{ id: string; url: string; routePattern: string; visits: number }>;
  transitions: Array<{
    id: string;
    fromStateId: string;
    toStateId: string;
    actionType: string;
    actionTarget?: string;
    equivalentState: boolean;
    explorationBlocked: boolean;
  }>;
  diagnostics: { orphanTransitionIds: string[]; discoveredStates: number;
    observedTransitions: number };
}

export function buildExplorationArtifacts(
  states: ApplicationStateNode[],
  transitions: ApplicationTransition[],
): { functionalTree: FunctionalTreeExport; stateGraph: StateGraphExport } {
  const stateIds = new Set(states.map((state) => state.id));
  const grouped = new Map<string, FunctionalTreeExport['nodes'][number]>();
  for (const state of states) {
    for (const branch of discoverWorkflowBranches(state.observation)) {
      const key = state.url + '::' + branch.submitLabel.toLowerCase().trim();
      const existing = grouped.get(key);
      if (existing) {
        existing.observedStateIds.push(state.id);
        existing.requiredFields = [...new Set([...existing.requiredFields, ...branch.requiredFields])];
        existing.dependencies = existing.requiredFields.map((field) =>
          ({ field, kind: 'required-input' as const }));
      } else {
        grouped.set(key, {
          id: 'workflow-' + grouped.size,
          stateId: state.id,
          observedStateIds: [state.id],
          url: state.url,
          submitLabel: branch.submitLabel,
          requiredFields: [...branch.requiredFields],
          dependencies: branch.requiredFields.map((field) =>
            ({ field, kind: 'required-input' as const })),
          status: 'discovered',
          verification: 'not-verified',
        });
      }
    }
  }
  const nodes = [...grouped.values()];
  const functionalTree: FunctionalTreeExport = {
    schemaVersion: 1, source: 'observed-ui', nodes,
  };
  const stateGraph: StateGraphExport = {
    schemaVersion: 1,
    source: 'persisted-browser-observations',
    states: states.map((state) => ({
      id: state.id, url: state.url, routePattern: state.routePattern,
      visits: state.visits,
    })),
    transitions: transitions.map((transition) => ({
      id: transition.id,
      fromStateId: transition.fromStateId,
      toStateId: transition.toStateId,
      actionType: transition.action.type,
      ...(transition.action.target ? { actionTarget: transition.action.target } : {}),
      equivalentState: transition.equivalentState,
      explorationBlocked: transition.explorationBlocked,
    })),
    diagnostics: {
      orphanTransitionIds: transitions.filter((transition) =>
        !stateIds.has(transition.fromStateId) || !stateIds.has(transition.toStateId))
        .map((transition) => transition.id),
      discoveredStates: states.length,
      observedTransitions: transitions.length,
    },
  };
  return { functionalTree, stateGraph };
}
