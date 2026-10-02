import type {
  PageObservation,
  ActionElement,
} from '../contracts/page-observation.js';

import type {
  ExecutableAssertion,
} from './executable-test-contracts.js';

interface EvidenceItem {
  id: string;
  type: string;
  source: string;
}

export interface AssertionTransition {
  id: string;

  actionId:
    string | null;

  actionTarget:
    string | null;

  actionType?:
    string;

  explorationBlocked:
    boolean;

  occurredAt:
    Date | string;

  beforeObservation:
    PageObservation;

  afterObservation:
    PageObservation;
}

export interface BuildAssertionsInput {
  actionId:
    string;

  actionEvidenceReference:
    string;

  actionLabel:
    string;

  scenarioEvidenceReferences?:
    string[];

  evidence:
    EvidenceItem[];

  transitions:
    AssertionTransition[];
}



function observedActionKey(
  action:
    ActionElement,
): string | null {
  const label =
    action.name ??
    action.text ??
    action.testId;

  if (!label) {
    return null;
  }

  return [
    action.type,
    label,
  ].join('|');
}

function observedTarget(
  action:
    ActionElement,
): ExecutableAssertion['target'] | null {
  if (
    action.testId
  ) {
    return {
      kind:
        'locator',

      target: {
        by:
          'testId',

        value:
          action.testId,
      },
    };
  }

  const name =
    action.name ??
    action.text;

  if (!name) {
    return null;
  }

  const role =
    action.type ===
      'input' ||
    action.type ===
      'textarea' ||
    action.type ===
      'contenteditable'
      ? 'textbox'
      : action.type ===
          'select'
        ? 'combobox'
        : action.type;

  if (
    ![
      'button',
      'link',
      'textbox',
      'combobox',
      'listbox',
      'checkbox',
      'radio',
      'dialog',
      'menu',
    ].includes(
      role,
    )
  ) {
    return null;
  }

  return {
    kind:
      'locator',

    target: {
      by:
        'role',

      role,

      name,

      exact:
        true,
    },
  };
}

function transitionEvidenceReferences(
  transition:
    AssertionTransition,

  actionEvidenceReference:
    string,

  scenarioEvidenceReferences:
    string[],

  evidence:
    EvidenceItem[],
): string[] {
  const transitionEvidence =
    evidence.find(
      (item) =>
        item.type ===
          'transition' &&
        item.source ===
          transition.id,
    );

  const validEvidenceIds =
    new Set(
      evidence.map(
        (item) =>
          item.id,
      ),
    );

  return [
    ...new Set([
      actionEvidenceReference,
      ...(transitionEvidence
        ? [
            transitionEvidence.id,
          ]
        : []),
      ...scenarioEvidenceReferences
        .filter(
          (reference) =>
            validEvidenceIds.has(
              reference,
            ),
        ),
    ]),
  ];
}

function stableTransition(
  transitions:
    AssertionTransition[],

  actionId:
    string,

  actionLabel:
    string,
): AssertionTransition | null {
  const candidates =
    transitions
      .filter(
        (transition) =>
          transition.actionId ===
            actionId ||
          transition.actionTarget ===
            actionLabel,
      )
      .sort(
        (
          left,
          right,
        ) => {
          const leftExact =
            left.actionId ===
            actionId
              ? 0
              : 1;

          const rightExact =
            right.actionId ===
            actionId
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

          const leftTime =
            new Date(
              left.occurredAt,
            ).getTime();

          const rightTime =
            new Date(
              right.occurredAt,
            ).getTime();

          if (
            leftTime !==
            rightTime
          ) {
            return (
              leftTime -
              rightTime
            );
          }

          return left.id
            .localeCompare(
              right.id,
            );
        },
      );

  return candidates[0] ??
    null;
}

function uniqueSemanticText(
  values:
    string[],
): string[] {
  return [
    ...new Set(
      values
        .map(
          (value) =>
            value.trim(),
        )
        .filter(
          (value) =>
            value.length >= 2 &&
            value.length <= 120,
        ),
    ),
  ];
}

export function buildEvidenceBackedAssertions(
  input:
    BuildAssertionsInput,
): ExecutableAssertion[] {
  const transition =
    stableTransition(
      input.transitions,
      input.actionId,
      input.actionLabel,
    );

  if (!transition) {
    return [];
  }

  const evidenceReferences =
    transitionEvidenceReferences(
      transition,
      input.actionEvidenceReference,
      input.scenarioEvidenceReferences ??
        [],
      input.evidence,
    );

  const assertions:
    ExecutableAssertion[] = [];

  const seenAssertions =
    new Set<string>();

  const pushAssertion =
    (
      assertion:
        ExecutableAssertion,
    ): void => {
      const assertionKey =
        JSON.stringify({
          target:
            assertion.target,

          matcher:
            assertion.matcher,

          expected:
            assertion.expected,
        });

      if (
        seenAssertions.has(
          assertionKey,
        )
      ) {
        return;
      }

      seenAssertions.add(
        assertionKey,
      );

      assertions.push(
        assertion,
      );
    };

  const before =
    transition
      .beforeObservation;

  const after =
    transition
      .afterObservation;

  // --------------------------------
  // URL delta
  // --------------------------------

  if (
    before.url !==
    after.url
  ) {
    pushAssertion({
      afterActionId:
        input.actionId,

      kind:
        'url',

      description:
        `URL changed to ${after.url}`,

      target: {
        kind:
          'page',
      },

      matcher:
        'url',

      expected:
        after.url,

      evidenceReferences,
    });
  }

  // --------------------------------
  // Action/UI state deltas
  // --------------------------------

  const beforeByKey =
    new Map<
      string,
      ActionElement[]
    >();

  const afterByKey =
    new Map<
      string,
      ActionElement[]
    >();

  for (
    const action of
      before.actions
  ) {
    const key =
      observedActionKey(
        action,
      );

    if (!key) {
      continue;
    }

    const values =
      beforeByKey.get(
        key,
      ) ?? [];

    values.push(
      action,
    );

    beforeByKey.set(
      key,
      values,
    );
  }

  for (
    const action of
      after.actions
  ) {
    const key =
      observedActionKey(
        action,
      );

    if (!key) {
      continue;
    }

    const values =
      afterByKey.get(
        key,
      ) ?? [];

    values.push(
      action,
    );

    afterByKey.set(
      key,
      values,
    );
  }

  const allKeys =
    new Set([
      ...beforeByKey.keys(),
      ...afterByKey.keys(),
    ]);

  for (
    const key of
      [...allKeys]
        .sort()
  ) {
    const beforeItems =
      beforeByKey.get(
        key,
      ) ?? [];

    const afterItems =
      afterByKey.get(
        key,
      ) ?? [];

    const representative =
      afterItems[0] ??
      beforeItems[0];

    if (!representative) {
      continue;
    }

    const target =
      observedTarget(
        representative,
      );

    if (!target) {
      continue;
    }

    if (
      beforeItems.length !==
      afterItems.length &&
      afterItems.length > 0
    ) {
      pushAssertion({
        afterActionId:
          input.actionId,

        kind:
          'count',

        description:
          `${representative.name ?? representative.text ?? representative.type} count became ${afterItems.length}`,

        target,

        matcher:
          'count',

        expected:
          afterItems.length,

        evidenceReferences,
      });
    }

    if (
      beforeItems.length ===
        0 &&
      afterItems.some(
        (item) =>
          item.visible,
      )
    ) {
      pushAssertion({
        afterActionId:
          input.actionId,

        kind:
          'visibility',

        description:
          `${representative.name ?? representative.text ?? representative.type} became visible`,

        target,

        matcher:
          'visible',

        evidenceReferences,
      });
    }

    const beforeItem =
      beforeItems[0];

    const afterItem =
      afterItems[0];

    if (
      beforeItem &&
      afterItem
    ) {
      if (
        beforeItem.visible !==
        afterItem.visible
      ) {
        pushAssertion({
          afterActionId:
            input.actionId,

          kind:
            'visibility',

          description:
            `${afterItem.name ?? afterItem.text ?? afterItem.type} visibility changed`,

          target,

          matcher:
            afterItem.visible
              ? 'visible'
              : 'hidden',

          evidenceReferences,
        });
      }

      if (
        beforeItem.disabled !==
        afterItem.disabled
      ) {
        pushAssertion({
          afterActionId:
            input.actionId,

          kind:
            afterItem.disabled
              ? 'disabled'
              : 'enabled',

          description:
            `${afterItem.name ?? afterItem.text ?? afterItem.type} became ${afterItem.disabled ? 'disabled' : 'enabled'}`,

          target,

          matcher:
            afterItem.disabled
              ? 'disabled'
              : 'enabled',

          evidenceReferences,
        });
      }

      const beforeValue =
        beforeItem
          .formField
          ?.value;

      const afterValue =
        afterItem
          .formField
          ?.value;

      if (
        afterValue !==
          undefined &&
        beforeValue !==
          afterValue
      ) {
        pushAssertion({
          afterActionId:
            input.actionId,

          kind:
            'value',

          description:
            `${afterItem.name ?? afterItem.text ?? afterItem.type} value became ${afterValue}`,

          target,

          matcher:
            'value',

          expected:
            afterValue,

          evidenceReferences,
        });
      }
    }
  }

  // --------------------------------
  // Semantic text deltas
  // --------------------------------

  const beforeText =
    new Set(
      uniqueSemanticText(
        before.semanticText,
      ),
    );

  const afterText =
    new Set(
      uniqueSemanticText(
        after.semanticText,
      ),
    );

  const addedText =
    [...afterText]
      .filter(
        (value) =>
          !beforeText.has(
            value,
          ),
      )
      .sort();

  const removedText =
    [...beforeText]
      .filter(
        (value) =>
          !afterText.has(
            value,
          ),
      )
      .sort();

  const added =
    addedText[0];

  if (added) {
    pushAssertion({
      afterActionId:
        input.actionId,

      kind:
        'text',

      description:
        `Observed text appeared: ${added}`,

      target: {
        kind:
          'locator',

        target: {
          by:
            'text',

          text:
            added,

          exact:
            true,
        },
      },

      matcher:
        'visible',

      evidenceReferences,
    });
  }

  const removed =
    removedText[0];

  if (removed) {
    pushAssertion({
      afterActionId:
        input.actionId,

      kind:
        'visibility',

      description:
        `Observed text disappeared: ${removed}`,

      target: {
        kind:
          'locator',

        target: {
          by:
            'text',

          text:
            removed,

          exact:
            true,
        },
      },

      matcher:
        'hidden',

      evidenceReferences,
    });
  }

  return assertions;
}
