import type {
    ModelProvider,
  } from '../models/index.js';
  
  import {
    deduplicateScenarios,
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
  
  function groundScenario(
    scenario:
      GroundedScenarioCandidate,
  
    validEvidenceIds:
      Set<string>,
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
      [
        ...new Set(
          normalizedReferences.filter(
            (
              reference,
            ): reference is string =>
              reference !== null,
          ),
        ),
      ];
  
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
  ): GroundedScenarioCandidate[] {
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
              ),
          )
          .filter(
            (
              scenario,
            ): scenario is GroundedScenarioCandidate =>
              scenario !== null,
          )
          .filter(
            (scenario) =>
              hasRequiredEvidenceForScenarioType(
                scenario,
                input.evidence,
              ),
          );
  
      // These are not invented by the model.
      // They come directly from discovered
      // executable browser actions.
      const deterministicActionScenarios =
        createActionNavigationScenarios(
          input.evidence,
        );
  
      const allCandidates = [
        ...groundedModelScenarios,
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
        deduplicateScenarios(
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
          (scenario) =>
            rankScenario(
              scenario,
              input.evidence,
              {
                uncoveredEvidenceIds,
                partiallyCoveredEvidenceIds,
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