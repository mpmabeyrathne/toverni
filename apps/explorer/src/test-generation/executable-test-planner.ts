import type {
  BrowserTarget,
} from '../browser/index.js';

import type {
  ActionElement,
} from '../contracts/page-observation.js';

import {
  createBrowserTarget,
} from '../exploration/action-candidate.js';

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

  description?:
    string;
}

interface BusinessBehaviorReference {
  id: string;

  preconditionTransitionIds:
    string[];

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

  filePayloadMode?:
    'valid' |
    'invalid';

  negativeAssertionTarget?:
    BrowserTarget;
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
    transition
      .beforeObservation
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

function replayActionFromTransition(
  transition:
    AssertionTransition,
): StoredAction | null {
  const targetLabel =
    transition.actionTarget
      ?.trim();

  if (!targetLabel) {
    return null;
  }

  const observed =
    [
      ...transition
        .afterObservation
        .actions,
      ...transition
        .beforeObservation
        .actions,
    ].find(
      (candidate) =>
        observedActionLabel(
          candidate,
        ) ===
        targetLabel,
    );

  if (!observed) {
    return null;
  }

  const target =
    createBrowserTarget(
      observed,
    );

  if (!target) {
    return null;
  }

  return {
    id:
      transition.actionId ??
      `transition:${transition.id}`,

    label:
      targetLabel,

    type:
      observed.type,

    target,

    blocked:
      false,

    blockReasons:
      [],
  };
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

function deterministicFilePayload(
  action:
    ActionElement,
): {
  name: string;
  mimeType: string;
  content: string;
} {
  const accept =
    action.formField
      ?.accept
      ?.split(',')
      .map(
        (value) =>
          value.trim(),
      )
      .find(
        (value) =>
          value.length >
          0,
      );

  let extension =
    'txt';

  let mimeType =
    'text/plain';

  if (
    accept?.startsWith(
      '.',
    )
  ) {
    extension =
      accept
        .slice(1)
        .replace(
          /[^a-z0-9]+/gi,
          '',
        ) ||
      'txt';

    const mimeByExtension:
      Record<
        string,
        string
      > = {
        txt:
          'text/plain',

        csv:
          'text/csv',

        json:
          'application/json',

        pdf:
          'application/pdf',

        png:
          'image/png',

        jpg:
          'image/jpeg',

        jpeg:
          'image/jpeg',
      };

    mimeType =
      mimeByExtension[
        extension
          .toLowerCase()
      ] ??
      'application/octet-stream';
  } else if (
    accept?.includes(
      '/',
    )
  ) {
    mimeType =
      accept;

    const subtype =
      accept
        .split('/')[1]
        ?.split('+')[0]
        ?.replace(
          /[^a-z0-9]+/gi,
          '',
        );

    if (subtype) {
      extension =
        subtype ===
          'plain'
          ? 'txt'
          : subtype;
    }
  }

  return {
    name:
      `toverni-test.${extension}`,

    mimeType,

    content:
      'Toverni deterministic upload fixture',
  };
}

const NEGATIVE_FILE_EVIDENCE_PATTERN =
  /\b(?:unsupported|invalid|reject(?:ed|s|ing)?|not allowed|forbidden|validation error)\b/i;

function isNegativeFileEvidence(
  evidence:
    EvidenceItem,
): boolean {
  const description =
    evidence.description ??
    '';

  return (
    (
      evidence.type ===
        'requirement' ||
      evidence.type ===
        'constraint'
    ) &&
    /\bfiles?\b/i.test(
      description,
    ) &&
    NEGATIVE_FILE_EVIDENCE_PATTERN
      .test(
        description,
      )
  );
}

function invalidFilePayload(
  action:
    ActionElement,
): {
  name: string;
  mimeType: string;
  content: string;
} | null {
  const accepts =
    (
      action.formField
        ?.accept ??
      ''
    )
      .split(',')
      .map(
        (value) =>
          value
            .trim()
            .toLowerCase(),
      )
      .filter(
        Boolean,
      );

  if (
    accepts.includes(
      '*/*',
    )
  ) {
    return null;
  }

  const candidates = [
    {
      extension:
        'bin',

      mimeType:
        'application/octet-stream',
    },
    {
      extension:
        'txt',

      mimeType:
        'text/plain',
    },
    {
      extension:
        'png',

      mimeType:
        'image/png',
    },
    {
      extension:
        'pdf',

      mimeType:
        'application/pdf',
    },
  ];

  const accepted =
    (
      candidate:
        typeof candidates[number],
    ): boolean =>
      accepts.some(
        (accept) => {
          if (
            accept.startsWith(
              '.',
            )
          ) {
            return (
              accept ===
              `.${candidate.extension}`
            );
          }

          if (
            accept.endsWith(
              '/*',
            )
          ) {
            return candidate
              .mimeType
              .startsWith(
                accept.slice(
                  0,
                  -1,
                ),
              );
          }

          return (
            accept ===
            candidate.mimeType
          );
        },
      );

  const candidate =
    candidates.find(
      (value) =>
        !accepted(
          value,
        ),
    );

  if (!candidate) {
    return null;
  }

  return {
    name:
      `toverni-invalid.${candidate.extension}`,

    mimeType:
      candidate.mimeType,

    content:
      'Toverni deterministic invalid upload fixture',
  };
}

function negativeFileBinding(
  evidenceReference:
    string,

  evidence:
    EvidenceItem,

  transitions:
    AssertionTransition[],
): ActionBinding | null {
  if (
    !isNegativeFileEvidence(
      evidence,
    )
  ) {
    return null;
  }

  const candidates =
    [...transitions]
      .sort(
        (
          left,
          right,
        ) =>
          new Date(
            left.occurredAt,
          ).getTime() -
          new Date(
            right.occurredAt,
          ).getTime(),
      );

  for (
    const transition of
      candidates
  ) {
    const observedActions = [
      ...transition
        .beforeObservation
        .actions,
      ...transition
        .afterObservation
        .actions,
    ];

    const fileInput =
      observedActions.find(
        (action) =>
          action
            .formField
            ?.inputType
            ?.toLowerCase() ===
            'file' &&
          Boolean(
            action.formField
              ?.accept
              ?.trim(),
          ),
      );

    if (!fileInput) {
      continue;
    }

    const invalidPayload =
      invalidFilePayload(
        fileInput,
      );

    if (!invalidPayload) {
      continue;
    }

    const fileTarget =
      createBrowserTarget(
        fileInput,
      );

    if (!fileTarget) {
      continue;
    }

    const disabledAction =
      transition
        .beforeObservation
        .actions
        .find(
          (action) =>
            action.visible &&
            action.disabled &&
            (
              action.type ===
                'button' ||
              action.type ===
                'link'
            ),
        );

    if (!disabledAction) {
      continue;
    }

    const assertionTarget =
      createBrowserTarget(
        disabledAction,
      );

    if (!assertionTarget) {
      continue;
    }

    return {
      action: {
        id:
          `negative-file:${transition.id}`,

        label:
          observedActionLabel(
            fileInput,
          ),

        type:
          fileInput.type,

        target:
          fileTarget,

        blocked:
          false,

        blockReasons:
          [],
      },

      transition,

      evidenceReference,

      filePayloadMode:
        'invalid',

      negativeAssertionTarget:
        assertionTarget,
    };
  }

  return null;
}

function actionOperation(
  action:
    StoredAction,

  transition:
    AssertionTransition | null,

  filePayloadMode:
    'valid' |
    'invalid' =
      'valid',
): ExecutableTestPlan['steps'][number]['operation'] | null {
  if (
    action.target === null
  ) {
    return null;
  }

  if (
    transition
      ?.actionType ===
      'set-input-files'
  ) {
    const observed =
      matchingObservedAction(
        action,
        transition,
      );

    if (!observed) {
      return null;
    }

    const file =
      filePayloadMode ===
        'invalid'
        ? invalidFilePayload(
            observed,
          )
        : deterministicFilePayload(
            observed,
          );

    if (!file) {
      return null;
    }

    return {
      kind:
        'set-input-files',

      target:
        action.target,

      file,
    };
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

      if (
        observed
          ?.formField
          ?.inputType
          ?.toLowerCase() ===
        'file'
      ) {
        return {
          kind:
            'set-input-files',

          target:
            action.target,

          file:
            deterministicFilePayload(
              observed,
            ),
        };
      }

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
    const byLabel =
      actions.find(
        (action) =>
          action.label ===
          transition.actionTarget,
      );

    if (byLabel) {
      return byLabel;
    }
  }

  return replayActionFromTransition(
    transition,
  );
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
  const negativeFile =
    negativeFileBinding(
      evidenceReference,
      evidence,
      transitions,
    );

  if (negativeFile) {
    return [
      negativeFile,
    ];
  }

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

    const actionTransition =
      stableTransitionForAction(
        action,
        transitions,
      );

    if (!actionTransition) {
      return [
        {
          action,

          transition:
            null,

          evidenceReference,
        },
      ];
    }

    const enclosingBehavior =
      businessBehaviors.find(
        (behavior) =>
          behavior
            .transitionIds
            .includes(
              actionTransition.id,
            ),
      );

    if (!enclosingBehavior) {
      return [
        {
          action,

          transition:
            actionTransition,

          evidenceReference,
        },
      ];
    }

    const targetIndex =
      enclosingBehavior
        .transitionIds
        .indexOf(
          actionTransition.id,
        );

    const replayTransitionIds = [
      ...enclosingBehavior
        .preconditionTransitionIds,

      ...enclosingBehavior
        .transitionIds
        .slice(
          0,
          targetIndex + 1,
        ),
    ];

    return replayTransitionIds
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
      )
      .flatMap(
        (transition) => {
          const replayAction =
            actionForTransition(
              transition,
              actions,
            );

          return replayAction
            ? [
                {
                  action:
                    replayAction,

                  transition,

                  evidenceReference,
                },
              ]
            : [];
        },
      );
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
          (() => {
            const behavior =
              businessBehaviors
                .find(
                  (candidate) =>
                    candidate.id ===
                    evidence.source,
                );

            if (!behavior) {
              return [];
            }

            return [
              ...behavior
                .preconditionTransitionIds,

              ...behavior
                .transitionIds,
            ];
          })()
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

  const negativeAssertions =
    new Map<
      string,
      ExecutableTestPlan[
        'assertions'
      ][number]
    >();

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
          binding
            .filePayloadMode ??
            'valid',
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

          transitionId:
            transition
              ?.id ??
            null,

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

        ...(transition
          ? {
              transitionId:
                transition.id,
            }
          : {}),

        description:
          action.label,

        operation,

        evidenceReference:
          binding
            .evidenceReference,
      });

      if (
        binding
          .negativeAssertionTarget
      ) {
        negativeAssertions.set(
          JSON.stringify({
            actionId:
              action.id,

            transitionId:
              transition
                ?.id ??
              null,

            evidenceReference:
              binding
                .evidenceReference,
          }),

          {
            afterActionId:
              action.id,

            ...(transition
              ? {
                  afterTransitionId:
                    transition.id,
                }
              : {}),

            kind:
              'disabled',

            description:
              'Observed action remains disabled for an invalid file selection',

            target: {
              kind:
                'locator',

              target:
                binding
                  .negativeAssertionTarget,
            },

            matcher:
              'disabled',

            evidenceReferences: [
              binding
                .evidenceReference,
            ],
          },
        );
      }
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
      (step) => {
        const negativeAssertion =
          negativeAssertions.get(
            JSON.stringify({
              actionId:
                step.actionId,

              transitionId:
                step.transitionId ??
                null,

              evidenceReference:
                step
                  .evidenceReference,
            }),
          );

        if (negativeAssertion) {
          return [
            negativeAssertion,
          ];
        }

        return buildEvidenceBackedAssertions({
          actionId:
            step.actionId,

          actionEvidenceReference:
            step.evidenceReference,

          actionLabel:
            step.description,

          ...(step.transitionId
            ? {
                transitionId:
                  step.transitionId,
              }
            : {}),

          scenarioEvidenceReferences:
            input.scenario
              .evidenceReferences,

          evidence:
            input.evidence,

          transitions,
        });
      },
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
