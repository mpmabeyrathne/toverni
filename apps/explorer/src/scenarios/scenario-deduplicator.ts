import type {
    GroundedScenarioCandidate,
  } from './scenario-contracts.js';
  
  function normalize(
    value: string,
  ): string {
    return value
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        ' ',
      )
      .trim();
  }
  
  function normalizeArray(
    values: string[],
  ): string {
    return values
      .map(
        normalize,
      )
      .filter(
        (value) =>
          value.length > 0,
      )
      .sort()
      .join('|');
  }
  
  function createScenarioKey(
    scenario:
      GroundedScenarioCandidate,
  ): string {
    return [
      normalize(
        scenario.title,
      ),
  
      normalize(
        scenario.type,
      ),
  
      normalizeArray(
        scenario.actions,
      ),
  
      normalizeArray(
        scenario.expectedOutcomes,
      ),
    ].join('||');
  }
  
  export function deduplicateScenarios(
    scenarios:
      GroundedScenarioCandidate[],
  ): GroundedScenarioCandidate[] {
    const seen =
      new Set<string>();
  
    const output:
      GroundedScenarioCandidate[] =
        [];
  
    for (
      const scenario of scenarios
    ) {
      const key =
        createScenarioKey(
          scenario,
        );
  
      if (
        seen.has(key)
      ) {
        continue;
      }
  
      seen.add(key);
      output.push(
        scenario,
      );
    }
  
    return output;
  }