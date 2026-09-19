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
  
  export interface GenerateGroundedScenariosInput {
    evidence:
      ScenarioEvidence[];
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
  
    // Exact match first.
    if (
      validEvidenceIds.has(
        trimmed,
      )
    ) {
      return trimmed;
    }
  
    // Safe local repair:
    // If the model returned something like
    // "REQ-1 - booking requirement",
    // extract the actual known evidence ID.
    for (
      const evidenceId of
        validEvidenceIds
    ) {
      if (
        trimmed.includes(
          evidenceId,
        )
      ) {
        return evidenceId;
      }
    }
  
    return null;
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
        ].join(', ');
  
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
                `Allowed evidence IDs: ${allowedEvidenceIds}`,
              ].join('\n'),
  
            requirements,
  
            capabilities,
  
            discoveredFlows,
          });
  
          const groundedCandidates =
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
  
      const deduplicated =
        deduplicateScenarios(
          groundedCandidates,
        );
  
      return deduplicated
        .map(
          (scenario) =>
            rankScenario(
              scenario,
              input.evidence,
            ),
        )
        .sort(
          (
            left,
            right,
          ) => {
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
  
            return (
              right.confidence -
              left.confidence
            );
          },
        );
    }
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
  
    const allowedTypes =
      (() => {
        switch (
          scenario.type
        ) {
          case 'positive':
            return [
              'requirement',
              'capability',
              'action',
              'transition',
              'api-operation',
            ] as const;
  
          case 'navigation':
            return [
              'state',
              'action',
              'transition',
              'capability',
            ] as const;
  
          case 'negative':
          case 'boundary':
            return [
              'requirement',
              'constraint',
              'api-operation',
            ] as const;
  
          case 'recovery':
            return [
              'requirement',
              'constraint',
              'transition',
            ] as const;
        }
      })();
  
    return referencedEvidence.some(
      (item) =>
        allowedTypes.includes(
          item.type as never,
        ),
    );
  }