import {
  buildCoverageReport,
  type CoverageReport,
  type CoverageScenario,
  type CoverageTarget,
  type CoverageTest,
} from '../coverage/index.js';

import type {
  BenchmarkReferenceFlow,
  BenchmarkScenario,
} from './benchmark-contracts.js';

export function buildBenchmarkFlowCoverageReport(
  referenceFlows:
    BenchmarkReferenceFlow[],

  scenarios:
    BenchmarkScenario[],
): CoverageReport {
  const targets:
    CoverageTarget[] =
    referenceFlows.map(
      (flow) => ({
        id:
          flow.id,

        kind:
          'flow',

        label:
          flow.title,

        evidenceReferences: [
          flow.id,
        ],

        supported:
          true,

        blocked:
          false,
      }),
    );

  const coverageScenarios:
    CoverageScenario[] =
    scenarios.map(
      (
        scenario,
        index,
      ) => ({
        id:
          `benchmark-scenario-${index + 1}`,

        evidenceReferences:
          referenceFlows
            .filter(
              (flow) =>
                matchesFlow(
                  scenario,
                  flow,
                ),
            )
            .map(
              (flow) =>
                flow.id,
            ),

        accepted:
          true,
      }),
    );

  const coverageTests:
    CoverageTest[] =
    scenarios.flatMap(
      (
        scenario,
        index,
      ): CoverageTest[] => {
        const scenarioId =
          `benchmark-scenario-${index + 1}`;

        if (
          scenario.executable
        ) {
          return [
            {
              id:
                `benchmark-test-${index + 1}`,

              scenarioId,

              status:
                'completed',
            },
          ];
        }

        if (
          scenario
            .unsupportedSteps
            .length >
          0
        ) {
          return [
            {
              id:
                `benchmark-test-${index + 1}`,

              scenarioId,

              status:
                'blocked',
            },
          ];
        }

        return [];
      },
    );

  return buildCoverageReport({
    targets,
    scenarios:
      coverageScenarios,
    tests:
      coverageTests,
  });
}

function matchesFlow(
  scenario:
    BenchmarkScenario,

  flow:
    BenchmarkReferenceFlow,
): boolean {
  const text =
    normalize(
      [
        scenario.title,
        ...scenario.actions,
        ...scenario
          .expectedOutcomes,
      ].join(
        ' ',
      ),
    );

  const keywords =
    flow.keywords
      .map(
        normalize,
      )
      .filter(
        Boolean,
      );

  return (
    keywords.length >
      0 &&
    keywords.every(
      (keyword) =>
        text.includes(
          keyword,
        ),
    )
  );
}

function normalize(
  value:
    string,
): string {
  const aliases:
    Record<
      string,
      string
    > = {
    unsupported:
      'invalid',

    reject:
      'invalid',

    rejected:
      'invalid',

    rejecting:
      'invalid',
  };

  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      ' ',
    )
    .split(
      /\s+/,
    )
    .filter(
      Boolean,
    )
    .map(
      (token) =>
        aliases[token] ??
        token,
    )
    .join(
      ' ',
    )
    .trim();
}
