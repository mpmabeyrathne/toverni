import type {
    ModelProvider,
  } from '../models/index.js';

  import type {
    GroundedBusinessBehavior,
  } from '../flows/index.js';
  
  import {
    deduplicateScenariosWithReasons,
  } from './scenario-deduplicator.js';
  
  import {
    rankScenario,
  } from './scenario-ranker.js';
  
  import type {
    GroundedScenario,
    GroundedScenarioCandidate,
    ScenarioEvidence,
  } from './scenario-contracts.js';
  
  export type ScenarioCoverageGapStatus =
    | 'uncovered'
    | 'partially_covered';

  export interface ScenarioCoverageGap {
    targetId:
      string;

    kind:
      | 'requirement'
      | 'capability'
      | 'constraint'
      | 'flow'
      | 'api_operation';

    status:
      ScenarioCoverageGapStatus;

    evidenceReferences:
      string[];
  }

  export interface GenerateGroundedScenariosInput {
    evidence:
      ScenarioEvidence[];

    coverageGaps?:
      ScenarioCoverageGap[];

    businessBehaviors?:
      GroundedBusinessBehavior[];
  }
  
  function formatEvidence(
    evidence:
      ScenarioEvidence,
  ): string {
    return [
      `[${evidence.id}]`,
      `type=${evidence.type}`,
      evidence.description,
    ].join(' ');
  }
  
  function normalizeEvidenceReference(
    reference: string,
    validEvidenceIds:
      Set<string>,
  ): string | null {
    const trimmed =
      reference.trim();

    return validEvidenceIds.has(
      trimmed,
    )
      ? trimmed
      : null;
  }
  
  function expandLinkedEvidenceReferences(
    evidenceReferences:
      string[],

    evidenceById:
      Map<
        string,
        ScenarioEvidence
      >,

    validEvidenceIds:
      Set<string>,
  ): string[] {
    const expanded =
      new Set(
        evidenceReferences,
      );

    for (
      const reference of
        evidenceReferences
    ) {
      const linked =
        evidenceById
          .get(
            reference,
          )
          ?.linkedEvidenceReferences ??
        [];

      for (
        const linkedReference of
          linked
      ) {
        if (
          validEvidenceIds.has(
            linkedReference,
          )
        ) {
          expanded.add(
            linkedReference,
          );
        }
      }
    }

    return [
      ...expanded,
    ].sort();
  }

  function groundScenario(
    scenario:
      GroundedScenarioCandidate,
  
    validEvidenceIds:
      Set<string>,

    evidenceById:
      Map<
        string,
        ScenarioEvidence
      >,
  ): GroundedScenarioCandidate | null {
    const normalizedReferences =
      scenario
        .evidenceReferences
        .map(
          (reference) =>
            normalizeEvidenceReference(
              reference,
              validEvidenceIds,
            ),
        );
  
    if (
      normalizedReferences.some(
        (reference) =>
          reference === null,
      )
    ) {
      return null;
    }
  
    const evidenceReferences =
      expandLinkedEvidenceReferences(
        [
          ...new Set(
            normalizedReferences.filter(
              (
                reference,
              ): reference is string =>
                reference !== null,
            ),
          ),
        ],

        evidenceById,
        validEvidenceIds,
      );
  
    if (
      evidenceReferences.length ===
      0
    ) {
      return null;
    }
  
    return {
      ...scenario,
      evidenceReferences,
    };
  }
  
  function hasRequiredEvidenceForScenarioType(
    scenario:
      GroundedScenarioCandidate,
  
    evidence:
      ScenarioEvidence[],
  ): boolean {
    const evidenceMap =
      new Map(
        evidence.map(
          (item) => [
            item.id,
            item,
          ],
        ),
      );
  
    const referencedEvidence =
      scenario
        .evidenceReferences
        .flatMap(
          (reference) => {
            const item =
              evidenceMap.get(
                reference,
              );
  
            return item
              ? [item]
              : [];
          },
        );
  
    switch (
      scenario.type
    ) {
      case 'positive':
        return referencedEvidence.some(
          (item) =>
            item.type ===
              'requirement' ||
            item.type ===
              'capability' ||
            item.type ===
              'action' ||
            item.type ===
              'transition' ||
            item.type ===
              'api-operation',
        );
  
      case 'navigation':
        return referencedEvidence.some(
          (item) =>
            item.type ===
              'state' ||
            item.type ===
              'action' ||
            item.type ===
              'transition' ||
            item.type ===
              'capability',
        );
  
      case 'negative':
      case 'boundary':
        return referencedEvidence.some(
          (item) =>
            item.type ===
              'requirement' ||
            item.type ===
              'constraint' ||
            item.type ===
              'api-operation',
        );
  
      case 'recovery':
        return referencedEvidence.some(
          (item) =>
            item.type ===
              'requirement' ||
            item.type ===
              'constraint' ||
            item.type ===
              'transition',
        );
    }
  }
  
  function normalizeActionDescription(
    value: string,
  ): string {
    return value
      .toLowerCase()
      .replace(
        /\s+/g,
        ' ',
      )
      .trim();
  }
  
  function createActionNavigationScenarios(
    evidence:
      ScenarioEvidence[],

    behaviors:
      GroundedBusinessBehavior[] =
        [],
  ): GroundedScenarioCandidate[] {
    const businessActionLabels =
      new Set(
        behaviors
          .flatMap(
            (behavior) =>
              behavior.steps,
          )
          .map(
            (step) =>
              step.action.target
                ?.trim(),
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(value),
          )
          .map(
            normalizeActionDescription,
          ),
      );
    const scenarios:
      GroundedScenarioCandidate[] =
        [];
  
    const seenActions =
      new Set<string>();
  
    for (
      const item of evidence
    ) {
      if (
        item.type !==
        'action'
      ) {
        continue;
      }
  
      const separatorIndex =
        item.description
          .indexOf(':');
  
      if (
        separatorIndex === -1
      ) {
        continue;
      }
  
      const actionType =
        item.description
          .slice(
            0,
            separatorIndex,
          )
          .trim()
          .toLowerCase();
  
      const label =
        item.description
          .slice(
            separatorIndex + 1,
          )
          .trim();
  
      // TOV-97 currently knows how to
      // deterministically execute these.
      if (
        actionType !==
          'link' &&
        actionType !==
          'button'
      ) {
        continue;
      }
  
      if (
        label.length ===
        0 ||
        label ===
          'unnamed action'
      ) {
        continue;
      }
  
      if (
        businessActionLabels.has(
          normalizeActionDescription(
            label,
          ),
        )
      ) {
        continue;
      }

      const signature =
        normalizeActionDescription(
          `${actionType}:${label}`,
        );
  
      // Historical runs may contain the
      // same discovered action many times.
      if (
        seenActions.has(
          signature,
        )
      ) {
        continue;
      }
  
      seenActions.add(
        signature,
      );
  
      scenarios.push({
        title:
          `Navigation: ${label}`,
  
        type:
          'navigation',
  
        preconditions: [],
  
        actions: [
          `Use the discovered ${actionType} "${label}"`,
        ],
  
        expectedOutcomes: [
          `The discovered ${actionType} "${label}" can be executed from the observed application state.`,
        ],
  
        evidenceReferences: [
          item.id,
        ],
      });
    }
  
    return scenarios;
  }
  
  const SCENARIO_MATCH_TOKEN_ALIASES:
    Readonly<
      Record<
        string,
        string
      >
    > = {
      sign:
        'auth',
      signed:
        'auth',
      signing:
        'auth',
      login:
        'auth',
      logged:
        'auth',
      authenticate:
        'auth',
      authenticated:
        'auth',
      authentication:
        'auth',

      navigate:
        'navigate',

      navigates:
        'navigate',

      navigating:
        'navigate',

      navigation:
        'navigate',

      credentials:
        'credential',

      users:
        'user',

      admins:
        'admin',
    };

  const SCENARIO_MATCH_STOP_WORDS =
    new Set([
      'a',
      'an',
      'and',
      'the',
      'to',
      'of',
      'in',
      'on',
      'for',
      'with',
      'is',
      'are',
      'be',
      'can',
      'should',
      'then',
      'flow',
      'button',
      'click',
      'use',
      'observed',
      'business',
    ]);

  function semanticTokens(
    values:
      string[],
  ): Set<string> {
    return new Set(
      values
        .join(' ')
        .toLowerCase()
        .replace(
          /[^a-z0-9]+/g,
          ' ',
        )
        .split(
          /\s+/,
        )
        .map(
          (value) =>
            value.trim(),
        )
        .map(
          (value) =>
            SCENARIO_MATCH_TOKEN_ALIASES[
              value
            ] ??
            value,
        )
        .filter(
          (value) =>
            value.length >=
              2 &&
            !SCENARIO_MATCH_STOP_WORDS
              .has(
                value,
              ),
        ),
    );
  }

  const NEGATIVE_REQUIREMENT_LANGUAGE =
    /\b(?:invalid|reject(?:ed|s|ing)?|forbidden|prevent(?:ed|s|ing)?|must not|does not|cannot|can't|not allowed|validation error|access denied)\b/i;

  function scenarioPolarityMatchesRequirement(
    scenario:
      GroundedScenarioCandidate,

    description:
      string,
  ): boolean {
    const requirementIsNegative =
      NEGATIVE_REQUIREMENT_LANGUAGE
        .test(
          description,
        );

    if (
      scenario.type ===
        'negative' ||
      scenario.type ===
        'boundary'
    ) {
      return requirementIsNegative;
    }

    if (
      scenario.type ===
        'positive' ||
      scenario.type ===
        'navigation'
    ) {
      return !requirementIsNegative;
    }

    return true;
  }

  function tokenOverlapCount(
    first:
      Set<string>,

    second:
      Set<string>,
  ): number {
    return [
      ...first,
    ].filter(
      (token) =>
        second.has(
          token,
        ),
    ).length;
  }

  function navigationFocusTokens(
    scenario:
      GroundedScenarioCandidate,
  ): Set<string> {
    if (
      scenario.type !==
      'navigation'
    ) {
      return new Set();
    }

    return semanticTokens([
      scenario.title.replace(
        /^navigation:\s*/i,
        '',
      ),
    ]);
  }

  function enrichScenarioWithRequirementEvidence(
    scenario:
      GroundedScenarioCandidate,

    evidence:
      ScenarioEvidence[],
  ): GroundedScenarioCandidate {
    if (
      scenario
        .evidenceReferences
        .some(
          (reference) =>
            reference.startsWith(
              'REQ-',
            ),
        )
    ) {
      return scenario;
    }

    const evidenceById =
      new Map(
        evidence.map(
          (item) => [
            item.id,
            item,
          ],
        ),
      );

    const baseValues = [
      scenario.title,
      ...scenario.actions,
      ...scenario
        .expectedOutcomes,
      ...scenario
        .evidenceReferences
        .flatMap(
          (reference) => {
            const item =
              evidenceById.get(
                reference,
              );

            return item
              ? [
                  item.description,
                ]
              : [];
          },
        ),
    ];

    const baseTokens =
      semanticTokens(
        baseValues,
      );

    const focusTokens =
      navigationFocusTokens(
        scenario,
      );

    const supportingEvidence =
      evidence
        .filter(
          (item) =>
            item.type ===
              'capability' ||
            item.type ===
              'constraint',
        )
        .map(
          (item) => {
            const tokens =
              semanticTokens([
                item.description,
              ]);

            const overlap =
              tokenOverlapCount(
                baseTokens,
                tokens,
              );

            const focusMatch =
              focusTokens.size >
                0 &&
              [
                ...focusTokens,
              ].every(
                (token) =>
                  tokens.has(
                    token,
                  ),
              );

            return {
              item,
              overlap,
              focusMatch,
            };
          },
        )
        .filter(
          (candidate) =>
            candidate.overlap >=
              2 ||
            candidate.focusMatch,
        )
        .sort(
          (
            left,
            right,
          ) =>
            Number(
              right.focusMatch,
            ) -
              Number(
                left.focusMatch,
              ) ||
            right.overlap -
              left.overlap ||
            left.item.id
              .localeCompare(
                right.item.id,
              ),
        )
        .slice(
          0,
          2,
        );

    const extendedValues = [
      ...baseValues,
      ...supportingEvidence.map(
        (candidate) =>
          candidate.item
            .description,
      ),
    ];

    const extendedTokens =
      semanticTokens(
        extendedValues,
      );

    const requirementCandidates =
      evidence
        .filter(
          (item) =>
            item.type ===
              'requirement' &&
            scenarioPolarityMatchesRequirement(
              scenario,
              item.description,
            ),
        )
        .map(
          (item) => {
            const tokens =
              semanticTokens([
                item.description,
              ]);

            const overlap =
              tokenOverlapCount(
                extendedTokens,
                tokens,
              );

            const focusMatch =
              focusTokens.size >
                0 &&
              [
                ...focusTokens,
              ].every(
                (token) =>
                  tokens.has(
                    token,
                  ),
              );

            return {
              item,
              overlap,
              focusMatch,
            };
          },
        )
        .filter(
          (candidate) =>
            candidate.overlap >=
              2 ||
            candidate.focusMatch,
        )
        .sort(
          (
            left,
            right,
          ) =>
            Number(
              right.focusMatch,
            ) -
              Number(
                left.focusMatch,
              ) ||
            right.overlap -
              left.overlap ||
            left.item.id
              .localeCompare(
                right.item.id,
              ),
        );

    const best =
      requirementCandidates[0];

    if (!best) {
      return scenario;
    }

    return {
      ...scenario,

      evidenceReferences: [
        ...new Set([
          ...scenario
            .evidenceReferences,
          ...supportingEvidence.map(
            (candidate) =>
              candidate.item.id,
          ),
          best.item.id,
        ]),
      ].sort(),
    };
  }

  function enrichScenarioWithActionEvidence(
    scenario:
      GroundedScenarioCandidate,

    evidence:
      ScenarioEvidence[],
  ): GroundedScenarioCandidate {
    if (
      (
        scenario.type !==
          'navigation' &&
        scenario.type !==
          'positive'
      ) ||
      scenario
        .evidenceReferences
        .some(
          (reference) =>
            reference.startsWith(
              'ACTION-',
            ) ||
            reference.startsWith(
              'FLOW-BUSINESS-',
            ),
        )
    ) {
      return scenario;
    }

    const scenarioTokens =
      semanticTokens([
        scenario.title,
        ...scenario.actions,
        ...scenario
          .expectedOutcomes,
      ]);

    const orderedActionText =
      normalizeActionDescription(
        scenario.actions
          .join(' '),
      );

    const candidates =
      evidence
        .filter(
          (item) =>
            item.type ===
              'action',
        )
        .flatMap(
          (item) => {
            const separatorIndex =
              item.description
                .indexOf(':');

            if (
              separatorIndex ===
              -1
            ) {
              return [];
            }

            const label =
              item.description
                .slice(
                  separatorIndex +
                    1,
                )
                .trim();

            const labelTokens =
              semanticTokens([
                label,
              ]);

            if (
              labelTokens.size ===
                0 ||
              ![
                ...labelTokens,
              ].every(
                (token) =>
                  scenarioTokens.has(
                    token,
                  ),
              )
            ) {
              return [];
            }

            return [
              {
                item,
                label,
                labelTokenCount:
                  labelTokens.size,
                actionOrder:
                  orderedActionText
                    .lastIndexOf(
                      normalizeActionDescription(
                        label,
                      ),
                    ),
              },
            ];
          },
        )
        .sort(
          (
            left,
            right,
          ) =>
            right.actionOrder -
              left.actionOrder ||
            right.labelTokenCount -
              left.labelTokenCount ||
            left.item.id
              .localeCompare(
                right.item.id,
              ),
        );

    const best =
      candidates[0];

    if (!best) {
      return scenario;
    }

    return {
      ...scenario,

      evidenceReferences: [
        ...new Set([
          ...scenario
            .evidenceReferences,
          best.item.id,
        ]),
      ].sort(),
    };
  }

  function enrichScenarioWithBusinessEvidence(
    scenario:
      GroundedScenarioCandidate,

    behaviors:
      GroundedBusinessBehavior[],

    evidence:
      ScenarioEvidence[],
  ): GroundedScenarioCandidate {
    if (
      scenario
        .evidenceReferences
        .some(
          (reference) =>
            reference.startsWith(
              'FLOW-BUSINESS-',
            ),
        )
    ) {
      return scenario;
    }

    const scenarioEvidence =
      new Set(
        scenario
          .evidenceReferences,
      );

    const scenarioTokens =
      semanticTokens([
        scenario.title,
        ...scenario.actions,
        ...scenario
          .expectedOutcomes,
      ]);

    const flowEvidenceBySource =
      new Map(
        evidence
          .filter(
            (item) =>
              item.type ===
                'transition' &&
              item.id.startsWith(
                'FLOW-BUSINESS-',
              ),
          )
          .map(
            (item) => [
              item.source,
              item.id,
            ],
          ),
      );

    const candidates =
      behaviors
        .filter(
          (behavior) =>
            behavior
              .requirementEvidenceIds
              .some(
                (reference) =>
                  scenarioEvidence.has(
                    reference,
                  ),
              ),
        )
        .map(
          (behavior) => {
            const behaviorTokens =
              semanticTokens([
                behavior.name,
                ...behavior.steps.map(
                  (step) =>
                    step.action
                      .target ??
                    '',
                ),
                ...behavior
                  .outcome
                  .addedSemanticText,
                ...behavior
                  .outcome
                  .removedSemanticText,
              ]);

            const overlap =
              [
                ...scenarioTokens,
              ].filter(
                (token) =>
                  behaviorTokens.has(
                    token,
                  ),
              ).length;

            const nameTokens =
              semanticTokens([
                behavior.name,
              ]);

            const nameOverlap =
              [
                ...nameTokens,
              ].filter(
                (token) =>
                  scenarioTokens.has(
                    token,
                  ),
              ).length;

            return {
              behavior,
              overlap,
              nameOverlap,
            };
          },
        )
        .filter(
          (candidate) =>
            candidate.overlap >
              0 &&
            candidate.nameOverlap >
              0,
        )
        .sort(
          (
            left,
            right,
          ) =>
            right.nameOverlap -
              left.nameOverlap ||
            right.overlap -
              left.overlap ||
            left.behavior
              .transitionIds
              .length -
              right.behavior
                .transitionIds
                .length ||
            left.behavior.id
              .localeCompare(
                right.behavior.id,
              ),
        );

    const best =
      candidates[0];

    if (!best) {
      return scenario;
    }

    const flowEvidenceId =
      flowEvidenceBySource.get(
        best.behavior.id,
      );

    if (!flowEvidenceId) {
      return scenario;
    }

    return {
      ...scenario,

      evidenceReferences: [
        ...new Set([
          ...scenario
            .evidenceReferences,
          flowEvidenceId,
        ]),
      ].sort(),
    };
  }

  const EXPLICIT_NEGATIVE_REQUIREMENT_PATTERN =
    /\b(?:unsupported|invalid|reject(?:ed|s|ing)?|not allowed|forbidden|validation error)\b/i;

  function createDeterministicNegativeRequirementScenarios(
    evidence:
      ScenarioEvidence[],
  ): GroundedScenarioCandidate[] {
    return evidence
      .filter(
        (item) =>
          (
            item.type ===
              'requirement' ||
            item.type ===
              'constraint'
          ) &&
          EXPLICIT_NEGATIVE_REQUIREMENT_PATTERN
            .test(
              item.description,
            ),
      )
      .map(
        (item) => {
          const description =
            item.description
              .replace(
                /^\s*[A-Z]+-\d+\s*:\s*/i,
                '',
              )
              .trim();

          return {
            title:
              `Negative requirement: ${description}`,

            type:
              'negative' as const,

            preconditions:
              [],

            actions: [
              `Exercise the invalid or unsupported case described by: ${description}`,
            ],

            expectedOutcomes: [
              description,
            ],

            evidenceReferences: [
              item.id,
            ],
          };
        },
      );
  }

  function createBusinessBehaviorScenarios(
    behaviors:
      GroundedBusinessBehavior[],

    evidence:
      ScenarioEvidence[],
  ): GroundedScenarioCandidate[] {
    const flowEvidenceBySource =
      new Map(
        evidence
          .filter(
            (item) =>
              item.type ===
                'transition' &&
              item.id.startsWith(
                'FLOW-BUSINESS-',
              ),
          )
          .map(
            (item) => [
              item.source,
              item,
            ],
          ),
      );

    return behaviors
      .filter(
        (behavior) =>
          behavior.complete,
      )
      .flatMap(
        (behavior) => {
          const flowEvidence =
            flowEvidenceBySource
              .get(
                behavior.id,
              );

          if (!flowEvidence) {
            return [];
          }

          const actions =
            behavior.steps
              .map(
                (step) =>
                  step.action
                    .target
                    ?.trim() ||
                  step.action.type,
              )
              .filter(
                (value) =>
                  value.length >
                  0,
              );

          if (
            actions.length ===
            0
          ) {
            return [];
          }

          const observedOutcomes =
            [
              ...behavior
                .outcome
                .addedSemanticText,
            ]
              .map(
                (value) =>
                  value.trim(),
              )
              .filter(
                (value) =>
                  value.length >
                  0,
              );

          const expectedOutcomes =
            observedOutcomes.length >
              0
              ? observedOutcomes
              : [
                  `Observed business flow "${behavior.name}" reaches its recorded outcome state.`,
                ];

          const normalizedName =
            behavior.name
              .toLowerCase();

          const recovery =
            [
              'retry',
              'recover',
              'clear',
              'reset',
            ].some(
              (term) =>
                normalizedName
                  .includes(
                    term,
                  ),
            );

          return [
            {
              title:
                `Observed flow: ${behavior.name}`,

              type:
                recovery
                  ? 'recovery'
                  : 'positive',

              preconditions: [],

              actions,

              expectedOutcomes,

              evidenceReferences:
                [
                  flowEvidence.id,

                  ...(
                    flowEvidence
                      .linkedEvidenceReferences ??
                    []
                  ),
                ],
            },
          ];
        },
      );
  }

  const TRANSACTION_VERB_ALIASES:
    Readonly<
      Record<
        string,
        string
      >
    > = {
      added: 'add',
      booked: 'book',
      cancelled: 'cancel',
      canceled: 'cancel',
      completed: 'complete',
      created: 'create',
      deleted: 'delete',
      ordered: 'order',
      paid: 'pay',
      purchased: 'purchase',
      removed: 'remove',
      reserved: 'reserve',
      saved: 'save',
      submitted: 'submit',
      updated: 'update',
      uploaded: 'upload',
    };

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

  function normalizedTokens(
    value:
      string,
  ): string[] {
    return value
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        ' ',
      )
      .split(
        /\s+/,
      )
      .filter(
        Boolean,
      )
      .map(
        (token) =>
        TRANSACTION_VERB_ALIASES[
          token
        ] ??
        token,
      );
  }

  function transactionSignatures(
    scenario:
      GroundedScenarioCandidate,
  ): string[] {
    return [
      ...new Set(
        scenario.actions
          .flatMap(
            (action) =>
              normalizedTokens(
                action,
              )
                .filter(
                  (token) =>
                    TRANSACTION_VERBS.has(
                      token,
                    ),
                ),
          ),
      ),
    ].sort();
  }

  function respectsBusinessFlowBoundary(
    scenario:
      GroundedScenarioCandidate,
  ): boolean {
    const transactions =
      transactionSignatures(
        scenario,
      );

    if (
      transactions.length <=
      1
    ) {
      return true;
    }

    return scenario
      .evidenceReferences
      .some(
        (reference) =>
          reference.startsWith(
            'FLOW-BUSINESS-',
          ),
      );
  }

  function stableCandidateKey(
    scenario:
      GroundedScenarioCandidate,
  ): string {
    return [
      scenario.type,
      scenario.title
        .toLowerCase()
        .trim(),
      [...scenario.actions]
        .map(
          (value) =>
            value
              .toLowerCase()
              .trim(),
        )
        .sort()
        .join('|'),
      [...scenario.expectedOutcomes]
        .map(
          (value) =>
            value
              .toLowerCase()
              .trim(),
        )
        .sort()
        .join('|'),
      [...scenario.evidenceReferences]
        .sort()
        .join('|'),
    ].join('||');
  }

  function getCoveragePriority(
    scenario:
      GroundedScenario,

    gaps:
      ScenarioCoverageGap[],
  ): number {
    const references =
      new Set(
        scenario
          .evidenceReferences,
      );

    return gaps.reduce(
      (
        highestPriority,
        gap,
      ) => {
        const matches =
          gap
            .evidenceReferences
            .some(
              (reference) =>
                references.has(
                  reference,
                ),
            );

        if (!matches) {
          return highestPriority;
        }

        const statusWeight =
          gap.status ===
          'uncovered'
            ? 100
            : 50;

        const kindWeight = {
          flow:
            25,
          requirement:
            20,
          api_operation:
            15,
          capability:
            10,
          constraint:
            10,
        }[
          gap.kind
        ];

        return Math.max(
          highestPriority,
          statusWeight +
            kindWeight,
        );
      },
      0,
    );
  }

  function formatCoverageGap(
    gap:
      ScenarioCoverageGap,
  ): string {
    return [
      `target=${gap.targetId}`,
      `kind=${gap.kind}`,
      `status=${gap.status}`,
      `evidence=${gap.evidenceReferences.join(',')}`,
    ].join(' ');
  }

  function prioritizeCoverageBreadth(
    scenarios:
      GroundedScenario[],

    gaps:
      ScenarioCoverageGap[],
  ): GroundedScenario[] {
    if (
      scenarios.length <= 1 ||
      gaps.length === 0
    ) {
      return scenarios;
    }

    const priorityByEvidence =
      new Map<
        string,
        number
      >();

    for (const gap of gaps) {
      const statusWeight =
        gap.status ===
          'uncovered'
          ? 100
          : 50;

      const kindWeight = {
        flow:
          25,
        requirement:
          20,
        api_operation:
          15,
        capability:
          10,
        constraint:
          10,
      }[
        gap.kind
      ];

      for (
        const reference of
        gap.evidenceReferences
      ) {
        priorityByEvidence.set(
          reference,
          Math.max(
            priorityByEvidence.get(
              reference,
            ) ?? 0,
            statusWeight +
              kindWeight,
          ),
        );
      }
    }

    const remaining = [
      ...scenarios,
    ];

    const selected:
      GroundedScenario[] = [];

    const coveredEvidence =
      new Set<string>();

    while (
      remaining.length > 0
    ) {
      let bestIndex = 0;

      let bestHighestPriority = -1;

      let bestNewCoverage = -1;

      let bestCoverageWeight = -1;

      for (
        let index = 0;
        index <
          remaining.length;
        index += 1
      ) {
        const scenario =
          remaining[
            index
          ];

        if (!scenario) {
          continue;
        }

        const newlyCovered =
          scenario
            .evidenceReferences
            .filter(
              (reference) =>
                priorityByEvidence
                  .has(
                    reference,
                  ) &&
                !coveredEvidence
                  .has(
                    reference,
                  ),
            );

        const priorities =
          newlyCovered.map(
            (reference) =>
              priorityByEvidence
                .get(
                  reference,
                ) ??
              0,
          );

        const highestPriority =
          priorities.length >
            0
            ? Math.max(
                ...priorities,
              )
            : 0;

        const newCoverage =
          newlyCovered.length;

        const coverageWeight =
          priorities.reduce(
            (
              total,
              priority,
            ) =>
              total +
              priority,
            0,
          );

        if (
          highestPriority >
            bestHighestPriority ||
          (
            highestPriority ===
              bestHighestPriority &&
            newCoverage >
              bestNewCoverage
          ) ||
          (
            highestPriority ===
              bestHighestPriority &&
            newCoverage ===
              bestNewCoverage &&
            coverageWeight >
              bestCoverageWeight
          )
        ) {
          bestIndex =
            index;

          bestHighestPriority =
            highestPriority;

          bestNewCoverage =
            newCoverage;

          bestCoverageWeight =
            coverageWeight;
        }
      }

      const [
        selectedScenario,
      ] =
        remaining.splice(
          bestIndex,
          1,
        );

      if (!selectedScenario) {
        break;
      }

      selected.push(
        selectedScenario,
      );

      for (
        const reference of
        selectedScenario
          .evidenceReferences
      ) {
        if (
          priorityByEvidence
            .has(
              reference,
            )
        ) {
          coveredEvidence.add(
            reference,
          );
        }
      }
    }

    return selected;
  }

  export class GroundedScenarioGenerator {
    constructor(
      private readonly provider:
        ModelProvider,
    ) {}
  
    async generate(
      input:
        GenerateGroundedScenariosInput,
    ): Promise<
      GroundedScenario[]
    > {
      if (
        input.evidence.length ===
        0
      ) {
        return [];
      }
  
      const validEvidenceIds =
        new Set(
          input.evidence.map(
            (item) =>
              item.id,
          ),
        );

      const evidenceById =
        new Map(
          input.evidence.map(
            (item) => [
              item.id,
              item,
            ],
          ),
        );
  
      const allowedEvidenceIds =
        [
          ...validEvidenceIds,
        ]
          .sort()
          .join(', ');

      const coverageGaps =
        (input.coverageGaps ?? [])
          .filter(
            (gap) =>
              gap.status ===
                'uncovered' ||
              gap.status ===
                'partially_covered',
          )
          .map(
            (gap) => ({
              ...gap,

              evidenceReferences:
                gap
                  .evidenceReferences
                  .filter(
                    (reference) =>
                      validEvidenceIds.has(
                        reference,
                      ),
                  )
                  .sort(),
            }),
          )
          .filter(
            (gap) =>
              gap
                .evidenceReferences
                .length >
              0,
          )
          .sort(
            (
              left,
              right,
            ) => {
              if (
                left.status !==
                right.status
              ) {
                return left.status ===
                  'uncovered'
                  ? -1
                  : 1;
              }

              return left.targetId
                .localeCompare(
                  right.targetId,
                );
            },
          );
  
      const requirements =
        input.evidence
          .filter(
            (item) =>
              item.type ===
                'requirement' ||
              item.type ===
                'constraint',
          )
          .map(
            formatEvidence,
          );
  
      const capabilities =
        input.evidence
          .filter(
            (item) =>
              item.type ===
                'capability' ||
              item.type ===
                'action' ||
              item.type ===
                'api-operation',
          )
          .map(
            formatEvidence,
          );
  
      const discoveredFlows =
        input.evidence
          .filter(
            (item) =>
              item.type ===
                'state' ||
              item.type ===
                'transition',
          )
          .map(
            formatEvidence,
          );
  
      let generatedModelScenarios:
        GroundedScenarioCandidate[] =
          [];

      try {
        const result =
          await this.provider
            .generateScenarios({
              applicationSummary:
                [
                  'Generate only evidence-grounded QA scenarios.',
                  '',
                  'IMPORTANT:',
                  'Every evidenceReferences value must be copied exactly from the allowed evidence IDs.',
                  'Do not create new evidence IDs.',
                  'Do not use descriptions as references.',
                  'Do not assume authentication, validation, errors, permissions, UI behavior, recovery behavior, or application states unless evidence explicitly supports them.',
                  '',
                  'COVERAGE PRIORITY:',
                  'Prefer scenarios that reference uncovered coverage targets first, then partially covered targets.',
                  'Avoid generating another variant for already-covered behavior when a supported coverage gap exists.',
                  'Keep each scenario within one business transaction boundary.',
                  'Do not combine unrelated create/book/cancel/delete/remove/pay/checkout/complete transactions into one scenario unless one FLOW-BUSINESS evidence item explicitly describes that combined flow.',
                  ...coverageGaps.map(
                    (gap) =>
                      formatCoverageGap(
                        gap,
                      ),
                  ),
                  '',
                  `Allowed evidence IDs: ${allowedEvidenceIds}`,
                ].join('\n'),

              requirements,

              capabilities,

              discoveredFlows,
            });

        generatedModelScenarios =
          result.data.scenarios;
      } catch {
        // Model-generated scenarios are an
        // augmentation layer. Deterministic
        // requirement, business-flow, and
        // discovered-action candidates below
        // remain valid evidence-grounded input
        // when a local model emits malformed
        // structured output.
      }
  
      const groundedModelScenarios =
        generatedModelScenarios
          .map(
            (scenario) =>
              groundScenario(
                scenario,
                validEvidenceIds,
                evidenceById,
              ),
          )
          .filter(
            (
              scenario,
            ): scenario is GroundedScenarioCandidate =>
              scenario !== null,
          )
          .map(
            (scenario) =>
              enrichScenarioWithBusinessEvidence(
                scenario,
                input.businessBehaviors ??
                  [],
                input.evidence,
              ),
          )
          .filter(
            (scenario) =>
              hasRequiredEvidenceForScenarioType(
                scenario,
                input.evidence,
              ),
          )
          .filter(
            (scenario) =>
              respectsBusinessFlowBoundary(
                scenario,
              ),
          );
  
      // These are not invented by the model.
      // They come directly from discovered
      // executable browser actions.
      const deterministicActionScenarios =
        createActionNavigationScenarios(
          input.evidence,
          input.businessBehaviors ??
            [],
        );

      const deterministicBusinessScenarios =
        createBusinessBehaviorScenarios(
          input.businessBehaviors ??
            [],
          input.evidence,
        );

      const deterministicNegativeRequirementScenarios =
        createDeterministicNegativeRequirementScenarios(
          input.evidence,
        )
          .map(
            (scenario) =>
              enrichScenarioWithBusinessEvidence(
                scenario,
                input.businessBehaviors ??
                  [],
                input.evidence,
              ),
          );
  
      const allCandidates = [
        ...groundedModelScenarios,
        ...deterministicNegativeRequirementScenarios,
        ...deterministicBusinessScenarios,
        ...deterministicActionScenarios,
      ]
        .map(
          (scenario) =>
            enrichScenarioWithRequirementEvidence(
              scenario,
              input.evidence,
            ),
        )
        .map(
          (scenario) =>
            enrichScenarioWithActionEvidence(
              scenario,
              input.evidence,
            ),
        )
        .map(
          (scenario) =>
            enrichScenarioWithBusinessEvidence(
              scenario,
              input.businessBehaviors ??
                [],
              input.evidence,
            ),
        )
        .sort(
          (
            left,
            right,
          ) =>
            stableCandidateKey(
              left,
            ).localeCompare(
              stableCandidateKey(
                right,
              ),
            ),
        );
  
      const deduplicated =
        deduplicateScenariosWithReasons(
          allCandidates,
        );
  
      const uncoveredEvidenceIds =
        new Set(
          coverageGaps
            .filter(
              (gap) =>
                gap.status ===
                'uncovered',
            )
            .flatMap(
              (gap) =>
                gap
                  .evidenceReferences,
            ),
        );

      const partiallyCoveredEvidenceIds =
        new Set(
          coverageGaps
            .filter(
              (gap) =>
                gap.status ===
                'partially_covered',
            )
            .flatMap(
              (gap) =>
                gap
                  .evidenceReferences,
            ),
        );

      const ranked =
        deduplicated
          .map(
          ({
            scenario,
            deduplicationReasons,
          }) =>
            rankScenario(
              scenario,
              input.evidence,
              {
                uncoveredEvidenceIds,
                partiallyCoveredEvidenceIds,
                deduplicationReasons,
              },
            ),
        )
        .sort(
          (
            left,
            right,
          ) => {
            const coverageDifference =
              getCoveragePriority(
                right,
                coverageGaps,
              ) -
              getCoveragePriority(
                left,
                coverageGaps,
              );

            if (
              coverageDifference !==
              0
            ) {
              return coverageDifference;
            }

            const leftRequirementGrounded =
              left
                .evidenceReferences
                .some(
                  (reference) =>
                    reference.startsWith(
                      'REQ-',
                    ),
                )
                ? 1
                : 0;

            const rightRequirementGrounded =
              right
                .evidenceReferences
                .some(
                  (reference) =>
                    reference.startsWith(
                      'REQ-',
                    ),
                )
                ? 1
                : 0;

            if (
              rightRequirementGrounded !==
              leftRequirementGrounded
            ) {
              return (
                rightRequirementGrounded -
                leftRequirementGrounded
              );
            }

            if (
              right.risk !==
              left.risk
            ) {
              return (
                right.risk -
                left.risk
              );
            }
  
            if (
              right.relevance !==
              left.relevance
            ) {
              return (
                right.relevance -
                left.relevance
              );
            }

            if (
              right.confidence !==
              left.confidence
            ) {
              return (
                right.confidence -
                left.confidence
              );
            }
  
            return stableCandidateKey(
              left,
            ).localeCompare(
              stableCandidateKey(
                right,
              ),
            );
          },
        );

      return prioritizeCoverageBreadth(
        ranked,
        coverageGaps,
      );
    }
  }