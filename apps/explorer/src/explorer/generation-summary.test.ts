import {
  mkdtemp,
  readFile,
  rm,
} from 'node:fs/promises';

import {
  tmpdir,
} from 'node:os';

import {
  join,
} from 'node:path';

import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  buildGenerationSummary,
  renderGenerationSummary,
  writeGenerationSummaryJson,
} from './generation-summary.js';

const temporaryDirectories:
  string[] = [];

const coverage = {
  entries: [
    {
      target: {
        id:
          'REQ-1',

        kind:
          'requirement' as const,

        label:
          'User can view dashboard',

        evidenceReferences: [
          'REQ-1',
        ],

        supported:
          true,

        blocked:
          false,
      },

      status:
        'covered' as const,

      scenarioIds: [
        'scenario-1',
      ],

      testIds: [
        'test-1',
      ],

      reasons: [],
    },

    {
      target: {
        id:
          'FLOW-BUSINESS-1',

        kind:
          'flow' as const,

        label:
          'Checkout flow',

        evidenceReferences: [
          'FLOW-BUSINESS-1',
        ],

        supported:
          true,

        blocked:
          false,
      },

      status:
        'uncovered' as const,

      scenarioIds: [],

      testIds: [],

      reasons: [
        'No generated test.',
      ],
    },
  ],

  totals: {
    total:
      2,

    covered:
      1,

    partiallyCovered:
      0,

    blocked:
      0,

    unsupported:
      0,

    uncovered:
      1,
  },

  gaps: [],
};

afterEach(
  async () => {
    await Promise.all(
      temporaryDirectories
        .splice(
          0,
        )
        .map(
          (directory) =>
            rm(
              directory,
              {
                recursive:
                  true,

                force:
                  true,
              },
            ),
        ),
    );
  },
);

describe(
  'generation summary',
  () => {
    it(
      'summarizes partial runs with actionable warnings and safety diagnostics',
      () => {
        const summary =
          buildGenerationSummary({
            runId:
              'run-1',

            targetUrl:
              'https://example.com',

            discoveredFlows:
              2,

            outputDirectory:
              '/project/tests/toverni',

            stopReason:
              'max-actions-reached',

            coverage: {
              ...coverage,

              gaps:
                coverage.entries
                  .filter(
                    (entry) =>
                      entry.status !==
                      'covered',
                  ),
            },

            flow: {
              states: [
                {},
                {},
              ],

              transitions: [
                {},
              ],

              generatedScenarios: [
                {},
                {},
              ],

              generatedTests: [
                {
                  generationStatus:
                    'ready',

                  executionStatus:
                    'passed',

                  sourceFilePath:
                    '/project/tests/toverni/dashboard.spec.ts',
                },

                {
                  generationStatus:
                    'manual_required',

                  executionStatus:
                    'not_run',

                  reason:
                    'Unsupported setup',
                },
              ],

              actions: [
                {
                  label:
                    'Pay Now',

                  blocked:
                    true,

                  blockReasons: [
                    'Action appears destructive or unsafe for autonomous exploration (financial: financial transaction)',
                  ],
                },
              ],

              modelUsage: [
                {
                  provider:
                    'ollama',

                  model:
                    'llama3.2:3b',

                  totalTokens:
                    120,

                  estimatedCostUsd:
                    0,

                  durationMs:
                    500,
                },
              ],
            },
          });

        expect(
          summary.status,
        ).toBe(
          'partial',
        );

        expect(
          summary.safety
            .highImpactSkipped[0]
            ?.label,
        ).toBe(
          'Pay Now',
        );

        expect(
          summary.coverage
            .requirementCovered,
        ).toBe(
          1,
        );

        expect(
          summary.coverage
            .flowTotal,
        ).toBe(
          1,
        );

        expect(
          renderGenerationSummary(
            summary,
          ),
        ).toContain(
          'Next steps:',
        );
      },
    );

    it(
      'writes the same summary as machine-readable JSON',
      async () => {
        const directory =
          await mkdtemp(
            join(
              tmpdir(),
              'toverni-summary-',
            ),
          );

        temporaryDirectories.push(
          directory,
        );

        const summary =
          buildGenerationSummary({
            runId:
              'run-2',

            targetUrl:
              'https://example.com',

            discoveredFlows:
              1,

            outputDirectory:
              '/tests/toverni',

            coverage: {
              ...coverage,

              entries: [
                coverage.entries[0]!,
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

              gaps: [],
            },

            flow: {
              states: [
                {},
              ],

              transitions: [],

              actions: [],

              generatedScenarios: [
                {},
              ],

              generatedTests: [
                {
                  generationStatus:
                    'ready',

                  executionStatus:
                    'passed',

                  sourceFilePath:
                    '/tests/toverni/dashboard.spec.ts',
                },
              ],

              modelUsage: [],
            },
          });

        const path =
          join(
            directory,
            'summary.json',
          );

        await writeGenerationSummaryJson(
          summary,
          path,
        );

        const stored =
          JSON.parse(
            await readFile(
              path,
              'utf8',
            ),
          );

        expect(
          stored.runId,
        ).toBe(
          'run-2',
        );

        expect(
          stored.status,
        ).toBe(
          'completed',
        );
      },
    );
  },
);
