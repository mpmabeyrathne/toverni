import type {
    BenchmarkMetrics,
  } from './benchmark-contracts.js';
  
  export interface BenchmarkDecision {
    decision:
      | 'continue'
      | 'rework';
  
    reasons:
      string[];
  }
  
  export function evaluateBenchmarkThresholds(
    toverni:
      BenchmarkMetrics,
  
    baseline:
      BenchmarkMetrics,
  ): BenchmarkDecision {
    const reasons:
      string[] = [];
  
    if (
      toverni
        .importantFlowCoverage <
      0.7
    ) {
      reasons.push(
        'Important-flow coverage is below 70%.',
      );
    }
  
    if (
      toverni
        .unsupportedStepsPerScenario >
      0.15
    ) {
      reasons.push(
        'Unsupported-step rate is too high.',
      );
    }
  
    if (
      toverni
        .duplicateRate >
      0.15
    ) {
      reasons.push(
        'Duplicate scenario rate is above 15%.',
      );
    }
  
    if (
      toverni
        .executabilityRate <=
      baseline
        .executabilityRate
    ) {
      reasons.push(
        'Toverni does not improve executability over the generic LLM baseline.',
      );
    }
  
    if (
      toverni
        .unsupportedStepsPerScenario >=
      baseline
        .unsupportedStepsPerScenario
    ) {
      reasons.push(
        'Toverni does not reduce unsupported steps compared with the baseline.',
      );
    }
  
    return {
      decision:
        reasons.length === 0
          ? 'continue'
          : 'rework',
  
      reasons,
    };
  }