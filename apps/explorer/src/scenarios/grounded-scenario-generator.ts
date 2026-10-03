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
        total,
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
          return total;
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

        return (
          total +
          statusWeight +
          kindWeight
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
  
      const groundedModelScenarios =
        result.data.scenarios
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
  
      const allCandidates = [
        ...groundedModelScenarios,
        ...deterministicBusinessScenarios,
        ...deterministicActionScenarios,
      ].sort(
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

      return deduplicated
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
    }
  }