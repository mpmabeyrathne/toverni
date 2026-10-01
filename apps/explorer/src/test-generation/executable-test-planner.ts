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

function actionOperation(
  action:
    StoredAction,
): ExecutableTestPlan['steps'][number]['operation'] | null {
  if (
    action.blocked === true ||
    action.target === null
  ) {
    return null;
  }

  switch (
    action.type
  ) {
    case 'button':
    case 'link':
      return {
        kind:
          'click',

        target:
          action.target,
      };

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

  const seenOperations =
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

    const operation =
      actionOperation(
        action,
      );

    if (
      operation === null
    ) {
      continue;
    }

    const operationKey =
      JSON.stringify(
        operation,
      );

    if (
      seenOperations.has(
        operationKey,
      )
    ) {
      continue;
    }

    seenOperations.add(
      operationKey,
    );

    executableSteps.push({
      actionId:
        action.id,

      description:
        action.label,

      operation,

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

      metadata: {
        irVersion:
          '1',

        generator:
          'toverni',
      },
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

      metadata: {
        irVersion:
          '1',

        generator:
          'toverni',
      },
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

          actionLabel:
            step.description,

          scenarioEvidenceReferences:
            input.scenario
              .evidenceReferences,

          evidence:
            input.evidence,

          transitions:
            input.transitions ??
            [],
        }),
    );

  if (
    assertions.length ===
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
        'Browser actions are executable, but no evidence-backed business outcome assertion was observed.',

      steps:
        [],

      assertions:
        [],

      evidenceReferences:
        input.scenario
          .evidenceReferences,

      metadata: {
        irVersion:
          '1',

        generator:
          'toverni',
      },
    };
  }

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

    metadata: {
      irVersion:
        '1',

      generator:
        'toverni',
    },
  };
}