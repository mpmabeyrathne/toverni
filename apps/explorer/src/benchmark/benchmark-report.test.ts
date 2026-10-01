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

                  assertionScenarioCount:
                    4,

                  meaningfulAssertionCoverage:
                    0.8,
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

                  assertionScenarioCount:
                    0,

                  meaningfulAssertionCoverage:
                    0,
                },

                toverniCoverage: {
                  entries: [
                    {
                      target: {
                        id:
                          'BOOK-1',

                        kind:
                          'flow',

                        label:
                          'Book room',

                        evidenceReferences: [
                          'BOOK-1',
                        ],

                        supported:
                          true,

                        blocked:
                          false,
                      },

                      status:
                        'covered',

                      scenarioIds: [
                        'scenario-1',
                      ],

                      testIds: [
                        'test-1',
                      ],

                      reasons: [
                        'Covered by executable scenario.',
                      ],
                    },
                  ],

                  totals: {
                    total:
                      1,

                    covered:
                      1,

                    partiallyCovered:
                      0,

                    blocked:
                      0,

                    unsupported:
                      0,

                    uncovered:
                      0,
                  },

                  gaps:
                    [],
                },

                baselineCoverage: {
                  entries: [
                    {
                      target: {
                        id:
                          'BOOK-1',

                        kind:
                          'flow',

                        label:
                          'Book room',

                        evidenceReferences: [
                          'BOOK-1',
                        ],

                        supported:
                          true,

                        blocked:
                          false,
                      },

                      status:
                        'partially_covered',

                      scenarioIds: [
                        'baseline-scenario-1',
                      ],

                      testIds:
                        [],

                      reasons: [
                        'Scenario exists without completed executable coverage.',
                      ],
                    },
                  ],

                  totals: {
                    total:
                      1,

                    covered:
                      0,

                    partiallyCovered:
                      1,

                    blocked:
                      0,

                    unsupported:
                      0,

                    uncovered:
                      0,
                  },

                  gaps: [
                    {
                      target: {
                        id:
                          'BOOK-1',

                        kind:
                          'flow',

                        label:
                          'Book room',

                        evidenceReferences: [
                          'BOOK-1',
                        ],

                        supported:
                          true,

                        blocked:
                          false,
                      },

                      status:
                        'partially_covered',

                      scenarioIds: [
                        'baseline-scenario-1',
                      ],

                      testIds:
                        [],

                      reasons: [
                        'Scenario exists without completed executable coverage.',
                      ],
                    },
                  ],
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

          expect(
            markdown,
          ).toContain(
            'Meaningful assertion coverage',
          );

          expect(
            markdown,
          ).toContain(
            'Reference flow coverage',
          );

          expect(
            markdown,
          ).toContain(
            '| Book room | covered | partially_covered |',
          );
        },
      );
    },
  );