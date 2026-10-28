import type { BrowserSession } from '../browser/browser-session.js';
import type { PageObservation } from '../contracts/page-observation.js';
import { createBrowserTarget, getActionLabel } from './action-candidate.js';
import { resolveApprovedFormValue, type ApprovedFormFixture } from '../forms/approved-form-fixtures.js';

export type WorkflowStatus = 'unexplored' | 'blocked' | 'failed' | 'completed';
export interface WorkflowDataset {
  id: string;
  /** Overrides are operator-approved references to environment variables, not values. */
  fieldEnv?: Record<string, string>;
  expectedUrl?: string;
  expectedText?: string;
}
export interface WorkflowBranch {
  id: string;
  startUrl: string;
  submitLabel: string;
  requiredFields: string[];
  datasets: WorkflowDataset[];
}
export interface WorkflowEdge {
  branchId: string;
  datasetId: string;
  from: string;
  to: string;
  action: 'fill' | 'submit';
  label: string;
}
export interface WorkflowResult {
  branchId: string;
  datasetId: string;
  status: WorkflowStatus;
  reason?: string;
  /** Only structural evidence. Never include input values. */
  trace: WorkflowEdge[];
  finalUrl?: string;
  verified: boolean;
}
export interface WorkflowPlan {
  branch: WorkflowBranch;
  status: WorkflowStatus;
  missingDependencies: string[];
}

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

/** Discover actionable form submissions and required input dependencies from UI evidence. */
export function discoverWorkflowBranches(
  observation: PageObservation,
): WorkflowBranch[] {
  const requiredFields = observation.actions.filter((action) =>
    ['input', 'textarea', 'contenteditable'].includes(action.type) &&
    action.visible && !action.disabled && action.formField?.required)
    .map(getActionLabel);
  return observation.actions
    .filter((action) => action.type === 'button' && action.visible &&
      !action.disabled && /\b(?:login|log\s*in|sign\s*in|submit|register|save|continue)\b/i
        .test(getActionLabel(action)) && createBrowserTarget(action) !== null)
    .map((action, index) => ({
      id: 'observed-submit-' + index,
      startUrl: observation.url,
      submitLabel: getActionLabel(action),
      requiredFields: [...new Set(requiredFields)],
      // Discovery never invents expected outcomes or credential datasets.
      datasets: [],
    }));
}

export function planWorkflowBranch(
  observation: PageObservation,
  branch: WorkflowBranch,
): WorkflowPlan {
  const missingDependencies = branch.requiredFields.filter((label) =>
    !observation.actions.some((action) =>
      getActionLabel(action).toLowerCase().trim() === normalize(label) &&
      ['input', 'textarea', 'contenteditable'].includes(action.type) &&
      action.visible && !action.disabled && createBrowserTarget(action) !== null));
  if (!observation.actions.some((action) =>
    normalize(getActionLabel(action)) === normalize(branch.submitLabel) &&
    action.type === 'button' && action.visible && !action.disabled &&
    createBrowserTarget(action) !== null)) {
    missingDependencies.push('submit:' + branch.submitLabel);
  }
  return { branch, status: missingDependencies.length ? 'blocked' : 'unexplored',
    missingDependencies };
}

export async function executeWorkflowBranches(
  openSession: () => Promise<BrowserSession>,
  branches: WorkflowBranch[],
  fixture: ApprovedFormFixture,
  env: NodeJS.ProcessEnv = process.env,
): Promise<WorkflowResult[]> {
  const results: WorkflowResult[] = [];
  for (const branch of branches) {
    for (const dataset of branch.datasets) {
      const trace: WorkflowEdge[] = [];
      let session: BrowserSession | undefined;
      try {
        if (!dataset.expectedUrl && !dataset.expectedText) {
          results.push({ branchId: branch.id, datasetId: dataset.id,
            status: 'blocked', reason: 'No independently specified expected outcome',
            trace, verified: false });
          continue;
        }
        // Reject cross-origin expectations before opening a browser.
        const origin = new URL(branch.startUrl).origin;
        if (origin !== new URL(fixture.origin).origin ||
            (dataset.expectedUrl && new URL(dataset.expectedUrl).origin !== origin)) {
          results.push({ branchId: branch.id, datasetId: dataset.id,
            status: 'blocked', reason: 'Origin is outside approved scope',
            trace, verified: false });
          continue;
        }
        session = await openSession();
        await session.navigate(branch.startUrl);
        const before = await session.observe();
        if (new URL(before.url).origin !== origin) throw Error('Redirected outside approved origin');
        const plan = planWorkflowBranch(before, branch);
        if (plan.status === 'blocked') {
          results.push({ branchId: branch.id, datasetId: dataset.id,
            status: 'blocked', reason: 'Missing required action: ' + plan.missingDependencies.join(', '),
            trace, verified: false });
          continue;
        }
        let state = 'start';
        for (const label of branch.requiredFields) {
          const field = before.actions.find((action) =>
            normalize(getActionLabel(action)) === normalize(label) &&
            ['input', 'textarea', 'contenteditable'].includes(action.type));
          const target = field && createBrowserTarget(field);
          if (!target) throw Error('Required field is unavailable: ' + label);
          const approvedValue = resolveApprovedFormValue(fixture, before.url, label);
          const envKey = dataset.fieldEnv?.[label];
          // An override may change an already-approved field, never grant a
          // new field permission or bypass the approved origin.
          const value = approvedValue === undefined ? undefined :
            envKey ? (/^[A-Z][A-Z0-9_]*$/.test(envKey) ? env[envKey] : undefined)
              : approvedValue;
          if (!value) throw Error('Approved fixture unavailable for field: ' + label);
          await session.fill(target, value);
          const next = 'filled:' + normalize(label);
          trace.push({ branchId: branch.id, datasetId: dataset.id,
            from: state, to: next, action: 'fill', label });
          state = next;
        }
        const submit = before.actions.find((action) =>
          action.type === 'button' && normalize(getActionLabel(action)) === normalize(branch.submitLabel));
        const submitTarget = submit && createBrowserTarget(submit);
        if (!submitTarget) throw Error('Submit action unavailable');
        await session.click(submitTarget);
        const after = await session.observe();
        if (new URL(after.url).origin !== origin) throw Error('Submission left approved origin');
        trace.push({ branchId: branch.id, datasetId: dataset.id, from: state,
          to: 'observed-outcome', action: 'submit', label: branch.submitLabel });
        const verified = (!dataset.expectedUrl || after.url === dataset.expectedUrl) &&
          (!dataset.expectedText || after.semanticText.some((text) =>
            text.includes(dataset.expectedText!)));
        results.push({ branchId: branch.id, datasetId: dataset.id,
          status: verified ? 'completed' : 'failed',
          ...(!verified ? { reason: 'Observed outcome did not match expectations' } : {}),
          finalUrl: after.url, trace, verified });
      } catch {
        // Browser errors and tool details can contain typed input values.
        results.push({ branchId: branch.id, datasetId: dataset.id,
          status: 'failed', reason: 'Browser execution failed', trace, verified: false });
      } finally {
        await session?.close();
      }
    }
  }
  return results;
}

/** Only completed, independently verified workflow paths are eligible for generation. */
export function verifiedWorkflowPaths(results: WorkflowResult[]): WorkflowResult[] {
  return results.filter((result) =>
    result.status === 'completed' && result.verified &&
    result.trace.some((step) => step.action === 'fill') &&
    result.trace.some((step) => step.action === 'submit'));
}
