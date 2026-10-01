import type {
  BrowserTarget,
} from '../browser/index.js';

import type {
  ExecutableTestPlan,
} from './executable-test-contracts.js';

import {
  buildEvidenceBackedAssertions,
  type AssertionTransition,
} from './assertion-planner.js';

import {
  renderPlaywrightLocator,
} from './playwright-locator-renderer.js';

interface StoredScenario {
  id: string;
  title: string;
  evidenceReferences:
    string[];
}

interface StoredAction {
  id: string;
  label: string;
  type: string;

  target:
    BrowserTarget | null;

  blocked?: boolean;

  blockReasons?: string[];
}

interface EvidenceItem {
  id: string;
  type: string;
  source: string;
}

export interface CreateExecutablePlanInput {
  scenario:
    StoredScenario;

  evidence:
    EvidenceItem[];

  actions:
    StoredAction[];

  transitions?:
    AssertionTransition[];
}

function actionCommand(
  action:
    StoredAction,
): string | null {
  // Defense in depth:
  // a blocked action must never
  // become executable Playwright.
  if (
    action.blocked === true
  ) {
    return null;
  }

  if (
    action.target === null
  ) {
    return null;
  }

  const locator =
    renderPlaywrightLocator(
      action.target,
    );

  switch (
    action.type
  ) {
    case 'button':
    case 'link':
      return `${locator}.click();`;

    default:
      return null;
  }
}

export function createExecutableTestPlan(
  input:
    CreateExecutablePlanInput,
): ExecutableTestPlan {
  const evidenceMap =
    new Map(
      input.evidence.map(
        (item) => [
          item.id,
          item,
        ],
      ),
    );

  const actionsMap =
    new Map(
      input.actions.map(
        (action) => [
          action.id,
          action,
        ],
      ),
    );

  const executableSteps:
    ExecutableTestPlan['steps'] =
      [];

  const seenCommands =
    new Set<string>();

  const blockedActionReasons =
    new Set<string>();

  for (
    const evidenceReference of
      input.scenario
        .evidenceReferences
  ) {
    const evidence =
      evidenceMap.get(
        evidenceReference,
      );

    if (
      !evidence ||
      evidence.type !==
        'action'
    ) {
      continue;
    }

    const action =
      actionsMap.get(
        evidence.source,
      );

    if (
      !action
    ) {
      continue;
    }

    // --------------------------------
    // Block unsafe/non-actionable action
    // --------------------------------

    if (
      action.blocked === true
    ) {
      const reasons =
        action.blockReasons ??
        [];

      if (
        reasons.length ===
        0
      ) {
        blockedActionReasons.add(
          `${action.label}: action is blocked`,
        );
      } else {
        for (
          const reason of
            reasons
        ) {
          blockedActionReasons.add(
            `${action.label}: ${reason}`,
          );
        }
      }

      continue;
    }

    // --------------------------------
    // Convert to Playwright
    // --------------------------------

    const playwright =
      actionCommand(
        action,
      );

    if (
      playwright === null
    ) {
      continue;
    }

    if (
      seenCommands.has(
        playwright,
      )
    ) {
      continue;
    }

    seenCommands.add(
      playwright,
    );

    executableSteps.push({
      actionId:
        action.id,

      description:
        action.label,

      playwright,

      evidenceReference,
    });
  }

  // --------------------------------
  // Referenced blocked action
  // --------------------------------

  if (
    blockedActionReasons.size >
    0
  ) {
    return {
      scenarioId:
        input.scenario.id,

      title:
        input.scenario.title,

      status:
        'manual_required',

      reason:
        [
          'Scenario references blocked browser actions.',
          ...blockedActionReasons,
        ].join(' '),

      steps:
        [],

      assertions:
        [],

      evidenceReferences:
        input.scenario
          .evidenceReferences,
    };
  }

  // --------------------------------
  // No executable discovered actions
  // --------------------------------

  if (
    executableSteps.length ===
    0
  ) {
    return {
      scenarioId:
        input.scenario.id,

      title:
        input.scenario.title,

      status:
        'manual_required',

      reason:
        'No executable discovered browser actions support this scenario.',

      steps:
        [],

      assertions:
        [],

      evidenceReferences:
        input.scenario
          .evidenceReferences,
    };
  }

  const assertions =
    executableSteps.flatMap(
      (step) =>
        buildEvidenceBackedAssertions({
          actionId:
            step.actionId,

          actionEvidenceReference:
            step.evidenceReference,

          evidence:
            input.evidence,

          transitions:
            input.transitions ??
            [],
        }),
    );

  // --------------------------------
  // Ready
  // --------------------------------

  return {
    scenarioId:
      input.scenario.id,

    title:
      input.scenario.title,

    status:
      'ready',

    reason:
      null,

    steps:
      executableSteps,

    assertions,

    evidenceReferences:
      input.scenario
        .evidenceReferences,
  };
}