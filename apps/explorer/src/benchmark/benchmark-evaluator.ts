import type {
    BenchmarkReferenceFlow,
    BenchmarkScenario,
  } from './benchmark-contracts.js';
  
  import {
    calculateBenchmarkMetrics,
  } from './benchmark-metrics.js';
  
  import {
    evaluateBenchmarkThresholds,
    type BenchmarkDecision,
  } from './benchmark-thresholds.js';
  
  export interface BenchmarkApplicationEvaluation {
    fixtureId:
      string;
  
    title:
      string;
  
    toverni:
      ReturnType<
        typeof calculateBenchmarkMetrics
      >;
  
    baseline:
      ReturnType<
        typeof calculateBenchmarkMetrics
      >;
  
    decision:
      BenchmarkDecision;
  }
  
  export interface EvaluateBenchmarkApplicationInput {
    fixtureId:
      string;
  
    title:
      string;
  
    referenceFlows:
      BenchmarkReferenceFlow[];
  
    toverniScenarios:
      BenchmarkScenario[];
  
    baselineScenarios:
      BenchmarkScenario[];
  }
  
  export function evaluateBenchmarkApplication(
    input:
      EvaluateBenchmarkApplicationInput,
  ): BenchmarkApplicationEvaluation {
    const toverni =
      calculateBenchmarkMetrics(
        input.toverniScenarios,
        input.referenceFlows,
      );
  
    const baseline =
      calculateBenchmarkMetrics(
        input.baselineScenarios,
        input.referenceFlows,
      );
  
    const decision =
      evaluateBenchmarkThresholds(
        toverni,
        baseline,
      );
  
    return {
      fixtureId:
        input.fixtureId,
  
      title:
        input.title,
  
      toverni,
  
      baseline,
  
      decision,
    };
  }