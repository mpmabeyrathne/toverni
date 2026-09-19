import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import {
    createBenchmarkReport,
    renderBenchmarkMarkdown,
  } from './benchmark-report.js';
  
  describe(
    'benchmark report',
    () => {
      it(
        'renders application comparison',
        () => {
          const report =
            createBenchmarkReport([
              {
                fixtureId:
                  'booking',
  
                title:
                  'Booking',
  
                toverni: {
                  scenarioCount:
                    5,
  
                  relevantScenarioCount:
                    5,
  
                  executableScenarioCount:
                    4,
  
                  duplicateScenarioCount:
                    0,
  
                  unsupportedStepCount:
                    0,
  
                  coveredImportantFlowCount:
                    4,
  
                  totalImportantFlowCount:
                    4,
  
                  totalHumanEdits:
                    0,
  
                  relevanceRate:
                    1,
  
                  executabilityRate:
                    0.8,
  
                  duplicateRate:
                    0,
  
                  importantFlowCoverage:
                    1,
  
                  unsupportedStepsPerScenario:
                    0,
  
                  humanEditsPerScenario:
                    0,
                },
  
                baseline: {
                  scenarioCount:
                    5,
  
                  relevantScenarioCount:
                    4,
  
                  executableScenarioCount:
                    2,
  
                  duplicateScenarioCount:
                    1,
  
                  unsupportedStepCount:
                    2,
  
                  coveredImportantFlowCount:
                    3,
  
                  totalImportantFlowCount:
                    4,
  
                  totalHumanEdits:
                    3,
  
                  relevanceRate:
                    0.8,
  
                  executabilityRate:
                    0.4,
  
                  duplicateRate:
                    0.2,
  
                  importantFlowCoverage:
                    0.75,
  
                  unsupportedStepsPerScenario:
                    0.4,
  
                  humanEditsPerScenario:
                    0.6,
                },
  
                decision: {
                  decision:
                    'continue',
  
                  reasons: [],
                },
              },
            ]);
  
          const markdown =
            renderBenchmarkMarkdown(
              report,
            );
  
          expect(
            report.overallDecision,
          ).toBe(
            'continue',
          );
  
          expect(
            markdown,
          ).toContain(
            'Toverni P0 Benchmark Report',
          );
  
          expect(
            markdown,
          ).toContain(
            '80.0%',
          );
        },
      );
    },
  );