import type { BrowserSession } from '../browser/browser-session.js';
import type { BrowserTarget } from '../browser/browser-target.js';

export interface BrowserScenario {
  name: string;
  startUrl: string;
  fields: Array<{ target: BrowserTarget; value: string }>;
  submitTarget: BrowserTarget;
  expectedUrl?: string;
  expectedText?: string;
}

export interface BrowserScenarioResult {
  name: string;
  passed: boolean;
  finalUrl: string;
  observedText: string[];
  failure?: string;
}

/**
 * Executes approved scenarios independently. A fresh navigation is mandatory
 * before each path; callers provide a separate isolated BrowserSession.
 * This intentionally does not persist fixture values or browser observations.
 */
export async function executeBrowserScenario(
  session: BrowserSession,
  scenario: BrowserScenario,
): Promise<BrowserScenarioResult> {
  await session.navigate(scenario.startUrl);
  const before = await session.observe();
  if (new URL(before.url).origin !== new URL(scenario.startUrl).origin) {
    throw new Error('Scenario navigation escaped the approved origin');
  }
  for (const field of scenario.fields) {
    await session.fill(field.target, field.value);
  }
  await session.click(scenario.submitTarget);
  const after = await session.observe();
  const passed =
    (!scenario.expectedUrl || after.url === scenario.expectedUrl) &&
    (!scenario.expectedText ||
      after.semanticText.some((value) => value.includes(scenario.expectedText!)));
  return {
    name: scenario.name,
    passed,
    finalUrl: after.url,
    observedText: after.semanticText,
    ...(passed ? {} : { failure: 'Observed result did not match scenario expectations' }),
  };
}

export async function executeBrowserScenarios(
  openSession: () => Promise<BrowserSession>,
  scenarios: BrowserScenario[],
): Promise<BrowserScenarioResult[]> {
  const results: BrowserScenarioResult[] = [];
  for (const scenario of scenarios) {
    const session = await openSession();
    try {
      results.push(await executeBrowserScenario(session, scenario));
    } finally {
      await session.close();
    }
  }
  return results;
}
