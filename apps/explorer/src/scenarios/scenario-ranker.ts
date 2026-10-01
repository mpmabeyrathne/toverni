import type {
    GroundedScenario,
    GroundedScenarioCandidate,
    ScenarioEvidence,
  } from './scenario-contracts.js';
  
  const TYPE_RISK_SCORE = {
    positive: 50,
    negative: 75,
    boundary: 80,
    navigation: 45,
    recovery: 85,
  } as const;

  export interface ScenarioRankingContext {
    uncoveredEvidenceIds?:
      Set<string>;

    partiallyCoveredEvidenceIds?:
      Set<string>;

    deduplicationReasons?:
      string[];
  }
  
  export function rankScenario(
    scenario:
      GroundedScenarioCandidate,
  
    evidence:
      ScenarioEvidence[],

    context:
      ScenarioRankingContext =
        {},
  ): GroundedScenario {
    const evidenceMap =
      new Map(
        evidence.map(
          (item) => [
            item.id,
            item,
          ],
        ),
      );
  
    const matchedEvidence =
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
  
    const evidenceCoverage =
      scenario
        .evidenceReferences
        .length === 0
        ? 0
        : matchedEvidence.length /
          scenario
            .evidenceReferences
            .length;
  
    const requirementEvidence =
      matchedEvidence.filter(
        (item) =>
          item.type ===
            'requirement' ||
          item.type ===
            'constraint',
      ).length;
  
    const discoveredEvidence =
      matchedEvidence.filter(
        (item) =>
          item.type ===
            'state' ||
          item.type ===
            'action' ||
          item.type ===
            'transition',
      ).length;
  
    const relevance =
      Math.min(
        100,
        50 +
          requirementEvidence *
            15 +
          discoveredEvidence *
            10,
      );
  
    const confidence =
      Math.min(
        1,
        evidenceCoverage,
      );

    const referencesUncovered =
      scenario
        .evidenceReferences
        .filter(
          (reference) =>
            context
              .uncoveredEvidenceIds
              ?.has(
                reference,
              ) ??
            false,
        );

    const referencesPartial =
      scenario
        .evidenceReferences
        .filter(
          (reference) =>
            context
              .partiallyCoveredEvidenceIds
              ?.has(
                reference,
              ) ??
            false,
        );

    const rankingReasons = [
      `scenario type ${scenario.type} has base risk ${TYPE_RISK_SCORE[scenario.type]}`,
      `matched ${matchedEvidence.length}/${scenario.evidenceReferences.length} evidence references`,
      ...(requirementEvidence > 0
        ? [
            `references ${requirementEvidence} requirement or constraint evidence item(s)`,
          ]
        : []),
      ...(discoveredEvidence > 0
        ? [
            `references ${discoveredEvidence} observed state/action/transition evidence item(s)`,
          ]
        : []),
      ...(referencesUncovered.length > 0
        ? [
            `closes uncovered coverage evidence: ${referencesUncovered.join(', ')}`,
          ]
        : []),
      ...(referencesPartial.length > 0
        ? [
            `advances partially covered evidence: ${referencesPartial.join(', ')}`,
          ]
        : []),
      ...(
        context
          .deduplicationReasons ??
        []
      ),
    ];
  
    return {
      ...scenario,
  
      relevance,
  
      risk:
        TYPE_RISK_SCORE[
          scenario.type
        ],
  
      confidence,

      rankingReasons,
    };
  }