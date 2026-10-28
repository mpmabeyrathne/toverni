import type { GraphIntegrityReport } from './workflow-model-validation.js';

export interface ReexplorationTask {
  workflowId: string;
  url: string;
  priority: number;
  prerequisites: Array<{ kind: 'fill' | 'submit'; label: string }>;
  reason: string;
  status: 'pending';
}
/** Deterministic task proposals. No browser action is executed without a
 * grounded action target and an approved value at execution time. */
export function planGraphReexploration(
  report: GraphIntegrityReport,
): ReexplorationTask[] {
  return report.reexploration.map((gap) => ({
    workflowId: gap.workflowId,
    url: gap.url,
    priority: gap.status === 'partial' ? 100 : 50,
    prerequisites: [
      ...gap.missingFields.map((field) => ({ kind: 'fill' as const, label: field })),
      ...(gap.missingSubmission
        ? [{ kind: 'submit' as const, label: 'Resolve submit control from fresh observation' }]
        : []),
    ],
    reason: gap.status === 'partial' ? 'Incomplete observed workflow' : 'Unexplored workflow',
    status: 'pending' as const,
  })).sort((a, b) => b.priority - a.priority || a.workflowId.localeCompare(b.workflowId));
}
