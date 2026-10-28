import { z } from 'zod';
import type { FunctionalTreeExport, StateGraphExport } from './exploration-artifacts.js';

const workflowNode = z.object({
  id: z.string().min(1), stateId: z.string().min(1),
  observedStateIds: z.array(z.string().min(1)).min(1),
  url: z.string().url(), submitLabel: z.string().min(1),
  requiredFields: z.array(z.string()),
  dependencies: z.array(z.object({ field: z.string(), kind: z.literal('required-input') })),
  status: z.literal('discovered'), verification: z.literal('not-verified'),
});
export const functionalTreeSchema = z.object({
  schemaVersion: z.literal(1), source: z.literal('observed-ui'),
  nodes: z.array(workflowNode),
});
export const stateGraphSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.literal('persisted-browser-observations'),
  states: z.array(z.object({
    id: z.string().min(1), url: z.string().url(),
    routePattern: z.string(), visits: z.number().int().positive(),
  })),
  transitions: z.array(z.object({
    id: z.string().min(1), fromStateId: z.string().min(1),
    toStateId: z.string().min(1), actionType: z.string().min(1),
    actionTarget: z.string().optional(),
    equivalentState: z.boolean(), explorationBlocked: z.boolean(),
  })),
  diagnostics: z.object({
    orphanTransitionIds: z.array(z.string()),
    discoveredStates: z.number().int().nonnegative(),
    observedTransitions: z.number().int().nonnegative(),
  }),
});

export interface GraphIntegrityReport {
  valid: boolean;
  issues: string[];
  /** Missing steps are proposals, never represented as executed graph edges. */
  reexploration: Array<{
    workflowId: string;
    url: string;
    missingFields: string[];
    missingSubmission: boolean;
    status: 'unexplored' | 'partial';
  }>;
}
export function validateExplorationModels(
  tree: FunctionalTreeExport, graph: StateGraphExport,
): GraphIntegrityReport {
  const issues: string[] = [];
  const treeParsed = functionalTreeSchema.safeParse(tree);
  const graphParsed = stateGraphSchema.safeParse(graph);
  if (!treeParsed.success) issues.push('Functional tree does not match schema');
  if (!graphParsed.success) issues.push('State graph does not match schema');
  if (!treeParsed.success || !graphParsed.success) {
    return { valid: false, issues, reexploration: [] };
  }
  const states = new Set(graph.states.map((state) => state.id));
  if (states.size !== graph.states.length) issues.push('Duplicate state IDs');
  const transitionIds = new Set(graph.transitions.map((edge) => edge.id));
  if (transitionIds.size !== graph.transitions.length) issues.push('Duplicate transition IDs');
  const workflowIds = new Set(tree.nodes.map((node) => node.id));
  if (workflowIds.size !== tree.nodes.length) issues.push('Duplicate workflow IDs');
  for (const edge of graph.transitions) {
    if (!states.has(edge.fromStateId) || !states.has(edge.toStateId)) {
      issues.push('Orphan transition: ' + edge.id);
    }
  }
  if (graph.diagnostics.discoveredStates !== graph.states.length ||
      graph.diagnostics.observedTransitions !== graph.transitions.length) {
    issues.push('Graph diagnostic counts are inconsistent');
  }
  const reexploration: GraphIntegrityReport['reexploration'] = [];
  for (const node of tree.nodes) {
    if (!states.has(node.stateId) || node.observedStateIds.some((id) => !states.has(id))) {
      issues.push('Workflow references missing state: ' + node.id);
    }
    if (new Set(node.requiredFields).size !== node.requiredFields.length ||
        node.dependencies.some((dependency) => !node.requiredFields.includes(dependency.field))) {
      issues.push('Invalid workflow dependencies: ' + node.id);
    }
    const relevant = graph.transitions.filter((edge) =>
      node.observedStateIds.includes(edge.fromStateId) ||
      node.observedStateIds.includes(edge.toStateId));
    const missingFields = node.requiredFields.filter((field) =>
      !relevant.some((edge) => edge.actionType === 'fill' &&
        edge.actionTarget?.toLowerCase() === field.toLowerCase()));
    const missingSubmission = !relevant.some((edge) =>
      (edge.actionType === 'click' || edge.actionType === 'submit') &&
      edge.actionTarget?.toLowerCase() === node.submitLabel.toLowerCase());
    if (missingFields.length || missingSubmission) {
      reexploration.push({
        workflowId: node.id, url: node.url, missingFields, missingSubmission,
        status: relevant.length ? 'partial' : 'unexplored',
      });
    }
  }
  return { valid: issues.length === 0, issues, reexploration };
}
