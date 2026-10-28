import type { WorkflowResult } from './workflow-branch-scheduler.js';

export interface WorkflowExecutionGraph {
  schemaVersion: 1;
  source: 'isolated-browser-execution';
  scenarios: Array<{
    branchId: string;
    datasetId: string;
    verified: boolean;
    status: string;
    states: Array<{ id: string; url: string; observedAt?: string }>;
    transitions: Array<{ fromStateId: string; toStateId: string;
      action: 'fill' | 'submit'; label: string; datasetId: string }>;
  }>;
}
/** Distinct scenario-local state identities preserve alternate outcomes.
 * This is observed evidence, not a fabricated addition to the persisted graph. */
export function buildWorkflowExecutionGraph(results: WorkflowResult[]): WorkflowExecutionGraph {
  return {
    schemaVersion: 1,
    source: 'isolated-browser-execution',
    scenarios: results.map((result) => {
      const steps = result.observedSteps ?? [];
      const prefix = result.branchId + ':' + result.datasetId;
      const observedStates = steps.map((step, index) => ({
        id: prefix + ':state-' + (index + 1), url: step.url,
        ...(step.observedAt ? { observedAt: step.observedAt } : {}),
      }));
      const states = [{ id: prefix + ':start', url: result.startUrl ?? steps[0]?.url ?? '' }, ...observedStates];
      return {
        branchId: result.branchId, datasetId: result.datasetId,
        verified: result.verified, status: result.status,
        states,
        transitions: steps.map((step, index) => ({
          fromStateId: states[index]!.id,
          toStateId: states[index + 1]!.id,
          action: step.action, label: step.label, datasetId: result.datasetId,
        })),
      };
    }),
  };
}
