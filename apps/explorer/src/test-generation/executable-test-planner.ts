import type {
  BrowserTarget,
} from '../browser/index.js';

import type {
  ActionElement,
} from '../contracts/page-observation.js';

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

interface BusinessBehaviorReference {
  id: string;

  transitionIds:
    string[];
}

interface ActionBinding {
  action:
    StoredAction;

  transition:
    AssertionTransition | null;

  evidenceReference:
    string;
}

const EXPLORATION_ONLY_BLOCK_REASONS =
  new Set([
    'Action has already been visited in this state',
    'Action already exists in the discovered flow graph',
  ]);

function generationBlockingReasons(
  action:
    StoredAction,
): string[] {
  if (
    action.blocked !==
    true
  ) {
    return [];
  }

  const reasons =
    action.blockReasons ??
    [];

  if (
    reasons.length ===
    0
  ) {
    return [
      'action is blocked',
    ];
  }

  return reasons.filter(
    (reason) =>
      !EXPLORATION_ONLY_BLOCK_REASONS
        .has(
          reason,
        ),
  );
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

  businessBehaviors?:
    BusinessBehaviorReference[];
}

function observedActionLabel(
  action:
    ActionElement,
): string {
  return (
    action.name ??
    action.text ??
    action.testId ??
    `${action.type}:${action.tagName}`
  );
}

function matchingObservedAction(
  action:
    StoredAction,

  transition:
    AssertionTransition,
): ActionElement | null {
  return transition
    .afterObservation
    .actions
    .find(
      (observed) =>
        observedActionLabel(
          observed,
        ) ===
        action.label,
    ) ??
    null;
}

function stableTransitionForAction(
  action:
    StoredAction,

  transitions:
    AssertionTransition[],
): AssertionTransition | null {
  return transitions
    .filter(
      (transition) =>
        transition.actionId ===
          action.id ||
        transition.actionTarget ===
          action.label,
    )
    .sort(
      (
        left,
        right,
      ) => {
        const leftExact =
          left.actionId ===
          action.id
            ? 0
            : 1;

        const rightExact =
          right.actionId ===
          action.id
            ? 0
            : 1;

        if (
          leftExact !==
          rightExact
        ) {
          return (
            leftExact -
            rightExact
          );
        }

        return (
          new Date(
            left.occurredAt,
          ).getTime() -
          new Date(
            right.occurredAt,
          ).getTime()
        );
      },
    )[0] ??
    null;
}

function actionOperation(
  action:
    StoredAction,

  transition:
    AssertionTransition | null,
): ExecutableTestPlan['steps'][number]['operation'] | null {
  if (
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

    case 'input':
    case 'textarea':
    case 'contenteditable': {
      if (!transition) {
        return null;
      }

      const observed =
        matchingObservedAction(
          action,
          transition,
        );

      const value =
        observed
          ?.formField
          ?.value;

      if (
        typeof value !==
        'string'
      ) {
        return null;
      }

      return {
        kind:
          'fill',

        target:
          action.target,

        value,
      };
    }

    case 'select': {
      if (!transition) {
        return null;
      }

      const observed =
        matchingObservedAction(
          action,
          transition,
        );

      const value =
        observed
          ?.formField
          ?.value;

      if (
        typeof value !==
        'string'
      ) {
        return null;
      }

      return {
        kind:
          'select',

        target:
          action.target,

        value,
      };
    }

    case 'checkbox':
    case 'radio': {
      if (!transition) {
        return null;
      }

      const observed =
        matchingObservedAction(
          action,
          transition,
        );

      const checked =
        observed
          ?.formField
          ?.checked;

      if (
        typeof checked !==
        'boolean'
      ) {
        return null;
      }

      return {
        kind:
          'set-checked',

        target:
          action.target,

        checked,
      };
    }

    default:
      return null;
  }
}

function actionForTransition(
  transition:
    AssertionTransition,

  actions:
    StoredAction[],
): StoredAction | null {
  if (
    transition.actionId
  ) {
    const exact =
      actions.find(
        (action) =>
          action.id ===
          transition.actionId,
      );

    if (exact) {
      return exact;
    }
  }

  if (
    transition.actionTarget
  ) {
    return (
      actions.find(
        (action) =>
          action.label ===
          transition.actionTarget,
      ) ??
      null
    );
  }

  return null;
}

function resolveActionBindings(
  evidenceReference:
    string,

  evidence:
    EvidenceItem,

  actions:
    StoredAction[],

  transitions:
    AssertionTransition[],

  businessBehaviors:
    BusinessBehaviorReference[],
): ActionBinding[] {
  if (
    evidence.type ===
    'action'
  ) {
    const action =
      actions.find(
        (candidate) =>
          candidate.id ===
          evidence.source,
      );

    if (!action) {
      return [];
    }

    return [
      {
        action,

        transition:
          stableTransitionForAction(
            action,
            transitions,
          ),

        evidenceReference,
      },
    ];
  }

  if (
    evidence.type !==
    'transition'
  ) {
    return [];
  }

  const directTransition =
    transitions.find(
      (transition) =>
        transition.id ===
        evidence.source,
    );

  const transitionSequence =
    directTransition
      ? [
          directTransition,
        ]
      : (
          businessBehaviors
            .find(
              (behavior) =>
                behavior.id ===
                evidence.source,
            )
            ?.transitionIds
            .map(
              (transitionId) =>
                transitions.find(
                  (transition) =>
                    transition.id ===
                    transitionId,
                ),
            )
            .filter(
              (
                transition,
              ): transition is
                AssertionTransition =>
                transition !==
                undefined,
            ) ??
          []
        );

  const bindings:
    ActionBinding[] = [];

  for (
    const transition of
      transitionSequence
  ) {
    const action =
      actionForTransition(
        transition,
        actions,
      );

    if (!action) {
      continue;
    }

    bindings.push({
      action,
      transition,
      evidenceReference,
    });
  }

  return bindings;
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

  const transitions =
    input.transitions ??
    [];

  const businessBehaviors =
    input.businessBehaviors ??
    [];

  const executableSteps:
    ExecutableTestPlan['steps'] =
      [];

  const seenSteps =
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

    if (!evidence) {
      continue;
    }

    const bindings =
      resolveActionBindings(
        evidenceReference,
        evidence,
        input.actions,
        transitions,
        businessBehaviors,
      );

    for (
      const binding of
        bindings
    ) {
      const {
        action,
        transition,
      } =
        binding;

      const blockingReasons =
        generationBlockingReasons(
          action,
        );

      if (
        blockingReasons.length >
        0
      ) {
        for (
          const reason of
            blockingReasons
        ) {
          blockedActionReasons.add(
            `${action.label}: ${reason}`,
          );
        }

        continue;
      }

      const operation =
        actionOperation(
          action,
          transition ??
            stableTransitionForAction(
              action,
              transitions,
            ),
        );

      if (
        operation === null
      ) {
        continue;
      }

      const stepKey =
        JSON.stringify({
          actionId:
            action.id,

          operation,
        });

      if (
        seenSteps.has(
          stepKey,
        )
      ) {
        continue;
      }

      seenSteps.add(
        stepKey,
      );

      executableSteps.push({
        actionId:
          action.id,

        description:
          action.label,

        operation,

        evidenceReference:
          binding
            .evidenceReference,
      });
    }
  }

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

          transitions,
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
