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
  
  export function rankScenario(
    scenario:
      GroundedScenarioCandidate,
  
    evidence:
      ScenarioEvidence[],
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
  
    return {
      ...scenario,
  
      relevance,
  
      risk:
        TYPE_RISK_SCORE[
          scenario.type
        ],
  
      confidence,
    };
  }