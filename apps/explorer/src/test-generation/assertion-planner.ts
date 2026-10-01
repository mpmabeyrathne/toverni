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

  scenarioEvidenceReferences?:
    string[];

  evidence:
    EvidenceItem[];

  transitions:
    AssertionTransition[];
}

function quote(
  value: string,
): string {
  return JSON.stringify(
    value,
  );
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

function observedLocator(
  action:
    ActionElement,
): string | null {
  if (action.testId) {
    return `page.getByTestId(${quote(action.testId)})`;
  }

  const name =
    action.name ??
    action.text;

  if (!name) {
    return null;
  }

  const role =
    action.type === 'input' ||
    action.type === 'textarea' ||
    action.type === 'contenteditable'
      ? 'textbox'
      : action.type === 'select'
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

  return `page.getByRole(${quote(role)}, { name: ${quote(name)}, exact: true })`;
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
): AssertionTransition | null {
  const candidates =
    transitions
      .filter(
        (transition) =>
          transition.actionId ===
            actionId &&
          !transition
            .explorationBlocked,
      )
      .sort(
        (
          left,
          right,
        ) => {
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

  const seenPlaywright =
    new Set<string>();

  const pushAssertion =
    (
      assertion:
        ExecutableAssertion,
    ): void => {
      if (
        seenPlaywright.has(
          assertion.playwright,
        )
      ) {
        return;
      }

      seenPlaywright.add(
        assertion.playwright,
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

      playwright:
        `expect(page).toHaveURL(${quote(after.url)});`,

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

    const locator =
      observedLocator(
        representative,
      );

    if (!locator) {
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

        playwright:
          `expect(${locator}).toHaveCount(${afterItems.length});`,

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

        playwright:
          `expect(${locator}).toBeVisible();`,

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

          playwright:
            afterItem.visible
              ? `expect(${locator}).toBeVisible();`
              : `expect(${locator}).toBeHidden();`,

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

          playwright:
            afterItem.disabled
              ? `expect(${locator}).toBeDisabled();`
              : `expect(${locator}).toBeEnabled();`,

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

          playwright:
            `expect(${locator}).toHaveValue(${quote(afterValue)});`,

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

      playwright:
        `expect(page.getByText(${quote(added)}, { exact: true })).toBeVisible();`,

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

      playwright:
        `expect(page.getByText(${quote(removed)}, { exact: true })).toBeHidden();`,

      evidenceReferences,
    });
  }

  return assertions;
}
