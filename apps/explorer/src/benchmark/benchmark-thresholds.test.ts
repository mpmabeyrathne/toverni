import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import {
    evaluateBenchmarkThresholds,
  } from './benchmark-thresholds.js';
  
  describe(
    'evaluateBenchmarkThresholds',
    () => {
      it(
        'continues when Toverni clears the product gate',
        () => {
          const result =
            evaluateBenchmarkThresholds(
              {
                scenarioCount:
                  10,
  
                relevantScenarioCount:
                  9,
  
                executableScenarioCount:
                  8,
  
                duplicateScenarioCount:
                  1,
  
                unsupportedStepCount:
                  1,
  
                coveredImportantFlowCount:
                  8,
  
                totalImportantFlowCount:
                  10,
  
                totalHumanEdits:
                  2,
  
                relevanceRate:
                  0.9,
  
                executabilityRate:
                  0.8,
  
                duplicateRate:
                  0.1,
  
                importantFlowCoverage:
                  0.8,
  
                unsupportedStepsPerScenario:
                  0.1,
  
                humanEditsPerScenario:
                  0.2,
              },
  
              {
                scenarioCount:
                  10,
  
                relevantScenarioCount:
                  6,
  
                executableScenarioCount:
                  4,
  
                duplicateScenarioCount:
                  2,
  
                unsupportedStepCount:
                  4,
  
                coveredImportantFlowCount:
                  6,
  
                totalImportantFlowCount:
                  10,
  
                totalHumanEdits:
                  5,
  
                relevanceRate:
                  0.6,
  
                executabilityRate:
                  0.4,
  
                duplicateRate:
                  0.2,
  
                importantFlowCoverage:
                  0.6,
  
                unsupportedStepsPerScenario:
                  0.4,
  
                humanEditsPerScenario:
                  0.5,
              },
            );
  
          expect(
            result.decision,
          ).toBe(
            'continue',
          );
        },
      );
    },
  );