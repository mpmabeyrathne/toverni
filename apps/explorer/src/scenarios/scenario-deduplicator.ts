import type {
  GroundedScenarioCandidate,
} from './scenario-contracts.js';

const STOP_WORDS =
  new Set([
    'a',
    'an',
    'the',
    'to',
    'from',
    'with',
    'using',
    'use',
    'discovered',
    'observed',
    'button',
    'link',
    'action',
    'application',
    'state',
    'can',
    'be',
    'is',
    'are',
  ]);

const TRANSACTION_VERBS =
  new Set([
    'add',
    'approve',
    'assign',
    'book',
    'cancel',
    'checkout',
    'complete',
    'confirm',
    'create',
    'delete',
    'finish',
    'invite',
    'order',
    'pay',
    'publish',
    'purchase',
    'register',
    'remove',
    'reserve',
    'save',
    'send',
    'submit',
    'update',
    'upload',
  ]);

const BEHAVIOR_VARIANT_TOKENS =
  new Set([
    'available',
    'unavailable',
    'valid',
    'invalid',
    'authorized',
    'unauthorized',
    'success',
    'successful',
    'succeeds',
    'failed',
    'fails',
    'failure',
    'error',
    'empty',
    'full',
    'minimum',
    'maximum',
    'boundary',
    'insufficient',
    'duplicate',
    'expired',
    'active',
    'inactive',
    'enabled',
    'disabled',
    'positive',
    'negative',
  ]);

const STRUCTURAL_NOUNS =
  new Set([
    'account',
    'booking',
    'cart',
    'item',
    'order',
    'product',
    'project',
    'reservation',
    'room',
    'todo',
    'user',
  ]);

export interface DeduplicatedScenario {
  scenario:
    GroundedScenarioCandidate;

  deduplicationReasons:
    string[];
}

function normalize(
  value:
    string,
): string {
  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      ' ',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();
}

function tokenize(
  value:
    string,
): string[] {
  return normalize(
    value,
  )
    .split(' ')
    .filter(
      (token) =>
        token.length > 0 &&
        !STOP_WORDS.has(
          token,
        ),
    );
}

function canonicalizeSemanticPhrase(
  value:
    string,
): string {
  const tokens =
    tokenize(
      value,
    );

  const transactionIndex =
    tokens.findIndex(
      (token) =>
        TRANSACTION_VERBS.has(
          token,
        ),
    );

  if (
    transactionIndex === -1
  ) {
    return tokens
      .sort()
      .join(' ');
  }

  const verb =
    tokens[
      transactionIndex
    ];

  const variants =
    tokens
      .filter(
        (token) =>
          BEHAVIOR_VARIANT_TOKENS.has(
            token,
          ),
      )
      .sort();

  const structuralNouns =
    tokens
      .filter(
        (token) =>
          STRUCTURAL_NOUNS.has(
            token,
          ),
      )
      .sort();

  const tailTokens =
    tokens.slice(
      transactionIndex + 1,
    );

  const semanticTail =
    tailTokens
      .filter(
        (token) =>
          BEHAVIOR_VARIANT_TOKENS.has(
            token,
          ) ||
          STRUCTURAL_NOUNS.has(
            token,
          ),
      );

  return [
    verb,
    ...new Set([
      ...semanticTail,
      ...variants,
      ...structuralNouns,
    ]),
  ].join(' ');
}

function canonicalizeArray(
  values:
    string[],
): string {
  return values
    .map(
      canonicalizeSemanticPhrase,
    )
    .filter(
      Boolean,
    )
    .sort()
    .join('|');
}

function createSemanticScenarioKey(
  scenario:
    GroundedScenarioCandidate,
): string {
  return [
    scenario.type,
    canonicalizeSemanticPhrase(
      scenario.title,
    ),
    canonicalizeArray(
      scenario.actions,
    ),
    canonicalizeArray(
      scenario.expectedOutcomes,
    ),
  ].join('||');
}

function selectRepresentative(
  left:
    GroundedScenarioCandidate,

  right:
    GroundedScenarioCandidate,
): GroundedScenarioCandidate {
  const leftEvidence =
    new Set(
      left.evidenceReferences,
    ).size;

  const rightEvidence =
    new Set(
      right.evidenceReferences,
    ).size;

  if (
    rightEvidence !==
    leftEvidence
  ) {
    return rightEvidence >
      leftEvidence
      ? right
      : left;
  }

  const leftLength =
    [
      left.title,
      ...left.actions,
      ...left.expectedOutcomes,
    ].join(' ').length;

  const rightLength =
    [
      right.title,
      ...right.actions,
      ...right.expectedOutcomes,
    ].join(' ').length;

  if (
    rightLength !==
    leftLength
  ) {
    return rightLength <
      leftLength
      ? right
      : left;
  }

  return normalize(
    right.title,
  ).localeCompare(
    normalize(
      left.title,
    ),
  ) < 0
    ? right
    : left;
}

export function deduplicateScenariosWithReasons(
  scenarios:
    GroundedScenarioCandidate[],
): DeduplicatedScenario[] {
  const groups =
    new Map<
      string,
      GroundedScenarioCandidate[]
    >();

  for (
    const scenario of
      scenarios
  ) {
    const key =
      createSemanticScenarioKey(
        scenario,
      );

    const current =
      groups.get(
        key,
      ) ?? [];

    current.push(
      scenario,
    );

    groups.set(
      key,
      current,
    );
  }

  return [
    ...groups.entries(),
  ]
    .map(
      ([
        semanticKey,
        group,
      ]) => {
        const representative =
          group.reduce(
            selectRepresentative,
          );

        const mergedEvidence =
          [
            ...new Set(
              group.flatMap(
                (scenario) =>
                  scenario
                    .evidenceReferences,
              ),
            ),
          ].sort();

        return {
          scenario: {
            ...representative,

            evidenceReferences:
              mergedEvidence,
          },

          deduplicationReasons:
            group.length > 1
              ? [
                  `collapsed ${group.length} semantically equivalent scenarios`,
                  `semantic key: ${semanticKey}`,
                ]
              : [
                  `unique semantic scenario: ${semanticKey}`,
                ],
        };
      },
    )
    .sort(
      (
        left,
        right,
      ) =>
        createSemanticScenarioKey(
          left.scenario,
        ).localeCompare(
          createSemanticScenarioKey(
            right.scenario,
          ),
        ),
    );
}

export function deduplicateScenarios(
  scenarios:
    GroundedScenarioCandidate[],
): GroundedScenarioCandidate[] {
  return deduplicateScenariosWithReasons(
    scenarios,
  ).map(
    (result) =>
      result.scenario,
  );
}
