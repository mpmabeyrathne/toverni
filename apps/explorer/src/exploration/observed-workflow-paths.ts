import type { FunctionalTreeExport, StateGraphExport } from './exploration-artifacts.js';

export interface VerifiedGraphPath {
  workflowId: string;
  startStateId: string;
  endStateId: string;
  transitionIds: string[];
  /** A complete action path alone does not prove the business outcome. */
  status: 'actions-observed-outcome-unverified';
}
/** Finds ordered transitions in one connected path, with prerequisite fills
 * before the submission. Does not claim successful authentication or purchase. */
export function findObservedWorkflowPaths(
  tree: FunctionalTreeExport,
  graph: StateGraphExport,
  maxDepth = 25,
): VerifiedGraphPath[] {
  const result: VerifiedGraphPath[] = [];
  for (const workflow of tree.nodes) {
    const pending: Array<{ stateId: string; filled: string[];
      path: string[]; visited: Set<string> }> = [{
        stateId: workflow.stateId, filled: [], path: [],
        visited: new Set(),
      }];
    while (pending.length) {
      const current = pending.pop()!;
      if (current.path.length >= maxDepth) continue;
      for (const transition of graph.transitions) {
        if (transition.fromStateId !== current.stateId || transition.explorationBlocked) continue;
        if (current.visited.has(transition.id)) continue;
        const filled = transition.actionType === 'fill' && transition.actionTarget
          ? [...current.filled, transition.actionTarget.toLowerCase()]
          : current.filled;
        const path = [...current.path, transition.id];
        const required = workflow.requiredFields.every((field) =>
          filled.includes(field.toLowerCase()));
        const submit = ['click', 'submit'].includes(transition.actionType) &&
          transition.actionTarget?.toLowerCase() === workflow.submitLabel.toLowerCase();
        if (submit) {
          if (required) result.push({
            workflowId: workflow.id,
            startStateId: workflow.stateId,
            endStateId: transition.toStateId,
            transitionIds: path,
            status: 'actions-observed-outcome-unverified',
          });
          continue;
        }
        pending.push({
          stateId: transition.toStateId, filled, path,
          visited: new Set([...current.visited, transition.id]),
        });
      }
    }
  }
  return result;
}
