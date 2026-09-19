import type {
    BenchmarkMetrics,
    BenchmarkReferenceFlow,
    BenchmarkScenario,
  } from './benchmark-contracts.js';
  
  function normalize(
    value: string,
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
  
  function scenarioText(
    scenario:
      BenchmarkScenario,
  ): string {
    return normalize(
      [
        scenario.title,
        ...scenario.actions,
        ...scenario.expectedOutcomes,
      ].join(' '),
    );
  }
  
  function matchesFlow(
    scenario:
      BenchmarkScenario,
  
    flow:
      BenchmarkReferenceFlow,
  ): boolean {
    const text =
      scenarioText(
        scenario,
      );
  
    const keywords =
      flow.keywords
        .map(
          normalize,
        )
        .filter(
          Boolean,
        );
  
    if (
      keywords.length === 0
    ) {
      return false;
    }
  
    return keywords.every(
      (keyword) =>
        text.includes(
          keyword,
        ),
    );
  }
  
  function isRelevantScenario(
    scenario:
      BenchmarkScenario,
  
    referenceFlows:
      BenchmarkReferenceFlow[],
  ): boolean {
    return referenceFlows.some(
      (flow) =>
        matchesFlow(
          scenario,
          flow,
        ),
    );
  }
  
  function isFlowCovered(
    flow:
      BenchmarkReferenceFlow,
  
    scenarios:
      BenchmarkScenario[],
  ): boolean {
    return scenarios.some(
      (scenario) =>
        matchesFlow(
          scenario,
          flow,
        ),
    );
  }
  
  function duplicateKey(
    scenario:
      BenchmarkScenario,
  ): string {
    return normalize(
      [
        scenario.title,
  
        ...scenario.actions
          .map(
            normalize,
          )
          .sort(),
  
        ...scenario
          .expectedOutcomes
          .map(
            normalize,
          )
          .sort(),
      ].join('|'),
    );
  }
  
  function countDuplicates(
    scenarios:
      BenchmarkScenario[],
  ): number {
    const seen =
      new Set<string>();
  
    let duplicates =
      0;
  
    for (
      const scenario of scenarios
    ) {
      const key =
        duplicateKey(
          scenario,
        );
  
      if (
        seen.has(
          key,
        )
      ) {
        duplicates += 1;
  
        continue;
      }
  
      seen.add(
        key,
      );
    }
  
    return duplicates;
  }
  
  function calculateHumanEdits(
    scenario:
      BenchmarkScenario,
  ): number {
    const explicitlyRecorded =
      scenario.humanEditsRequired;
  
    if (
      explicitlyRecorded >
      0
    ) {
      return explicitlyRecorded;
    }
  
    let requiredEdits =
      scenario
        .unsupportedSteps
        .length;
  
    /*
     * A non-executable scenario requires at least
     * one human intervention before it can become
     * a runnable test.
     */
    if (
      !scenario.executable
    ) {
      requiredEdits += 1;
    }
  
    return requiredEdits;
  }
  
  function safeDivide(
    numerator:
      number,
  
    denominator:
      number,
  ): number {
    return denominator === 0
      ? 0
      : numerator /
        denominator;
  }
  
  export function calculateBenchmarkMetrics(
    scenarios:
      BenchmarkScenario[],
  
    referenceFlows:
      BenchmarkReferenceFlow[],
  ): BenchmarkMetrics {
    const scenarioCount =
      scenarios.length;
  
    const relevantScenarioCount =
      scenarios.filter(
        (scenario) =>
          isRelevantScenario(
            scenario,
            referenceFlows,
          ),
      ).length;
  
    const executableScenarioCount =
      scenarios.filter(
        (scenario) =>
          scenario.executable,
      ).length;
  
    const duplicateScenarioCount =
      countDuplicates(
        scenarios,
      );
  
    const unsupportedStepCount =
      scenarios.reduce(
        (
          total,
          scenario,
        ) =>
          total +
          scenario
            .unsupportedSteps
            .length,
        0,
      );
  
    const importantFlows =
      referenceFlows.filter(
        (flow) =>
          flow.important,
      );
  
    const coveredImportantFlowCount =
      importantFlows.filter(
        (flow) =>
          isFlowCovered(
            flow,
            scenarios,
          ),
      ).length;
  
    const totalHumanEdits =
      scenarios.reduce(
        (
          total,
          scenario,
        ) =>
          total +
          calculateHumanEdits(
            scenario,
          ),
        0,
      );
  
    return {
      scenarioCount,
  
      relevantScenarioCount,
  
      executableScenarioCount,
  
      duplicateScenarioCount,
  
      unsupportedStepCount,
  
      coveredImportantFlowCount,
  
      totalImportantFlowCount:
        importantFlows.length,
  
      totalHumanEdits,
  
      relevanceRate:
        safeDivide(
          relevantScenarioCount,
          scenarioCount,
        ),
  
      executabilityRate:
        safeDivide(
          executableScenarioCount,
          scenarioCount,
        ),
  
      duplicateRate:
        safeDivide(
          duplicateScenarioCount,
          scenarioCount,
        ),
  
      importantFlowCoverage:
        safeDivide(
          coveredImportantFlowCount,
          importantFlows.length,
        ),
  
      unsupportedStepsPerScenario:
        safeDivide(
          unsupportedStepCount,
          scenarioCount,
        ),
  
      humanEditsPerScenario:
        safeDivide(
          totalHumanEdits,
          scenarioCount,
        ),
    };
  }