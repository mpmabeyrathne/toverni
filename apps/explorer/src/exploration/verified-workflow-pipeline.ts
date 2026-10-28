import type { BrowserSession } from '../browser/browser-session.js';
import type { PageObservation } from '../contracts/page-observation.js';
import { discoverWorkflowBranches, executeWorkflowBranches, verifiedWorkflowPaths, type WorkflowDataset } from './workflow-branch-scheduler.js';
import type { ApprovedFormFixture } from '../forms/approved-form-fixtures.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface VerifiedWorkflowPipelineInput {
  initialObservation: PageObservation;
  fixture: ApprovedFormFixture;
  openSession: () => Promise<BrowserSession>;
  outputDirectory: string;
  /** JSON array of datasets with explicit outcome assertions. */
  datasetsJson: string;
  fieldEnvJson: string;
}
export interface VerifiedWorkflowPipelineResult {
  discoveredBranches: number;
  completed: number;
  blocked: number;
  failed: number;
  generatedSpecs: number;
  diagnostic: string;
}
function parseDatasets(json: string): WorkflowDataset[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) throw Error('TOVERNI_WORKFLOW_DATASETS must be an array');
  return parsed.map((item: unknown, index): WorkflowDataset => {
    if (!item || typeof item !== 'object') throw Error('Invalid workflow dataset');
    const data = item as Record<string, unknown>;
    if (typeof data.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(data.id) ||
        (typeof data.expectedUrl !== 'string' && typeof data.expectedText !== 'string')) {
      throw Error('Dataset requires safe id and expectedUrl or expectedText');
    }
    return {
      id: data.id,
      ...(typeof data.expectedUrl === 'string' ? { expectedUrl: data.expectedUrl } : {}),
      ...(typeof data.expectedText === 'string' ? { expectedText: data.expectedText } : {}),
      ...(data.fieldEnv && typeof data.fieldEnv === 'object' && !Array.isArray(data.fieldEnv)
        ? { fieldEnv: data.fieldEnv as Record<string, string> } : {}),
    };
  });
}
function renderSpec(
  startUrl: string,
  submitLabel: string,
  fields: string[],
  envNames: Record<string, string>,
  dataset: WorkflowDataset,
): string {
  const quote = (value: string): string => JSON.stringify(value);
  const lines = [
    "import { test, expect } from '@playwright/test';",
    '',
    `test(${quote('Verified workflow: ' + dataset.id)}, async ({ page }) => {`,
    `  await page.goto(${quote(startUrl)});`,
  ];
  for (const label of fields) {
    const envName = dataset.fieldEnv?.[label] ?? envNames[label];
    if (!envName || !/^[A-Z][A-Z0-9_]*$/.test(envName)) throw Error('No approved env reference for ' + label);
    lines.push(`  const ${'value' + lines.length} = process.env[${quote(envName)}];`);
    const name = 'value' + (lines.length - 1);
    lines.push(`  if (!${name}) throw new Error(${quote('Missing approved fixture: ' + envName)});`);
    lines.push(`  await page.getByLabel(${quote(label)}, { exact: true }).fill(${name});`);
  }
  lines.push(`  await page.getByRole('button', { name: ${quote(submitLabel)}, exact: true }).click();`);
  if (dataset.expectedUrl) lines.push(`  await expect(page).toHaveURL(${quote(dataset.expectedUrl)});`);
  if (dataset.expectedText) lines.push(`  await expect(page.getByText(${quote(dataset.expectedText)}, { exact: false }).first()).toBeVisible();`);
  lines.push('});', '');
  return lines.join('\n');
}

export async function runVerifiedWorkflowPipeline(
  input: VerifiedWorkflowPipelineInput,
): Promise<VerifiedWorkflowPipelineResult> {
  const datasets = parseDatasets(input.datasetsJson);
  const envNames = JSON.parse(input.fieldEnvJson) as Record<string, string>;
  const observed = input.initialObservation;
  const approvedLabels = Object.keys(input.fixture.fields);
  const branches = discoverWorkflowBranches(observed)
    .map((branch) => ({
      ...branch,
      // The browser observer may omit the HTML required attribute. Approved
      // and observed input labels are also trusted setup dependencies.
      requiredFields: [...new Set([
        ...branch.requiredFields,
        ...approvedLabels.filter((label) => observed.actions.some((action) =>
          ['input', 'textarea', 'contenteditable'].includes(action.type) &&
          action.visible && !action.disabled &&
          (action.name ?? action.text ?? '').trim().toLowerCase() === label.trim().toLowerCase())),
      ])],
      datasets,
    }))
    .filter((branch) => branch.requiredFields.length > 0);
  const results = await executeWorkflowBranches(input.openSession, branches, input.fixture);
  const verified = verifiedWorkflowPaths(results);
  await mkdir(input.outputDirectory, { recursive: true });
  let generatedSpecs = 0;
  for (const result of verified) {
    const branch = branches.find((candidate) => candidate.id === result.branchId);
    const dataset = datasets.find((candidate) => candidate.id === result.datasetId);
    if (!branch || !dataset) continue;
    const source = renderSpec(branch.startUrl, branch.submitLabel, branch.requiredFields, envNames, dataset);
    await writeFile(join(input.outputDirectory, `verified-workflow-${branch.id}-${dataset.id}.spec.ts`), source, 'utf8');
    generatedSpecs++;
  }
  return { discoveredBranches: branches.length,
    completed: results.filter((result) => result.status === 'completed').length,
    blocked: results.filter((result) => result.status === 'blocked').length,
    failed: results.filter((result) => result.status === 'failed').length,
    generatedSpecs,
    diagnostic: branches.length === 0 ? 'No observed submission with approved fields' :
      results.some((result) => result.status === 'failed') ? 'Some workflows failed browser verification' :
      verified.length === 0 ? 'No workflow satisfied explicit outcome assertions' :
      'Verified workflow specs written',
  };
}
