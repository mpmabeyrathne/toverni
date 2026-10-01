import type {
  ScenarioEvidence,
} from '../scenarios/index.js';

import type {
  GroundedBusinessBehavior,
} from '../flows/index.js';

export type CoverageStatus =
  | 'covered'
  | 'partially_covered'
  | 'blocked'
  | 'unsupported'
  | 'uncovered';

export type CoverageTargetKind =
  | 'requirement'
  | 'capability'
  | 'constraint'
  | 'flow'
  | 'api_operation';

export interface CoverageTarget {
  id: string;

  kind:
    CoverageTargetKind;

  label: string;

  evidenceReferences:
    string[];

  supported:
    boolean;

  blocked:
    boolean;

  blockedReason?:
    string;
}

export interface CoverageScenario {
  id: string;

  evidenceReferences:
    string[];

  accepted:
    boolean;
}

export type CoverageTestStatus =
  | 'completed'
  | 'pending'
  | 'blocked';

export interface CoverageTest {
  id: string;

  scenarioId:
    string;

  status:
    CoverageTestStatus;
}

export interface CoverageEntry {
  target:
    CoverageTarget;

  status:
    CoverageStatus;

  scenarioIds:
    string[];

  testIds:
    string[];

  reasons:
    string[];
}

export interface CoverageReport {
  entries:
    CoverageEntry[];

  totals: {
    total:
      number;

    covered:
      number;

    partiallyCovered:
      number;

    blocked:
      number;

    unsupported:
      number;

    uncovered:
      number;
  };

  gaps:
    CoverageEntry[];
}

export interface BuildCoverageReportInput {
  targets:
    CoverageTarget[];

  scenarios:
    CoverageScenario[];

  tests:
    CoverageTest[];
}

export function buildCoverageTargets(
  evidence:
    ScenarioEvidence[],

  businessBehaviors:
    GroundedBusinessBehavior[] =
      [],
): CoverageTarget[] {
  return evidence.flatMap(
    (
      item,
    ): CoverageTarget[] => {
      const kind =
        getCoverageTargetKind(
          item,
        );

      if (!kind) {
        return [];
      }

      const linkedBusinessFlows =
        businessBehaviors.flatMap(
          (
            behavior,
            index,
          ) =>
            behavior
              .requirementEvidenceIds
              .includes(
                item.id,
              )
              ? [
                  `FLOW-BUSINESS-${index + 1}`,
                ]
              : [],
        );

      return [
        {
          id:
            item.id,

          kind,

          label:
            item.description,

          evidenceReferences: [
            item.id,
            ...linkedBusinessFlows,
          ],

          supported:
            true,

          blocked:
            false,
        },
      ];
    },
  );
}

export function buildCoverageReport(
  input:
    BuildCoverageReportInput,
): CoverageReport {
  const entries =
    input.targets.map(
      (
        target,
      ): CoverageEntry => {
        const linkedScenarios =
          input.scenarios.filter(
            (scenario) =>
              scenario.accepted &&
              referencesTarget(
                scenario
                  .evidenceReferences,
                target
                  .evidenceReferences,
              ),
          );

        const linkedScenarioIds =
          new Set(
            linkedScenarios.map(
              (scenario) =>
                scenario.id,
            ),
          );

        const linkedTests =
          input.tests.filter(
            (test) =>
              linkedScenarioIds.has(
                test.scenarioId,
              ),
          );

        const {
          status,
          reasons,
        } =
          determineCoverageStatus(
            target,
            linkedScenarios,
            linkedTests,
          );

        return {
          target,
          status,

          scenarioIds:
            linkedScenarios.map(
              (scenario) =>
                scenario.id,
            ),

          testIds:
            linkedTests.map(
              (test) =>
                test.id,
            ),

          reasons,
        };
      },
    );

  const count =
    (
      status:
        CoverageStatus,
    ): number =>
      entries.filter(
        (entry) =>
          entry.status ===
          status,
      ).length;

  return {
    entries,

    totals: {
      total:
        entries.length,

      covered:
        count(
          'covered',
        ),

      partiallyCovered:
        count(
          'partially_covered',
        ),

      blocked:
        count(
          'blocked',
        ),

      unsupported:
        count(
          'unsupported',
        ),

      uncovered:
        count(
          'uncovered',
        ),
    },

    gaps:
      entries.filter(
        (entry) =>
          entry.status !==
          'covered',
      ),
  };
}

export function resolveCoverageTestStatus(
  generationStatus:
    string,

  executionStatus:
    string,
): CoverageTestStatus {
  if (
    generationStatus ===
      'ready' &&
    (
      executionStatus ===
        'passed' ||
      executionStatus ===
        'failed'
    )
  ) {
    return 'completed';
  }

  if (
    generationStatus ===
      'ready' &&
    executionStatus ===
      'not_run'
  ) {
    return 'pending';
  }

  return 'blocked';
}

function getCoverageTargetKind(
  evidence:
    ScenarioEvidence,
): CoverageTargetKind | null {
  switch (
    evidence.type
  ) {
    case 'requirement':
      return 'requirement';

    case 'capability':
      return 'capability';

    case 'constraint':
      return 'constraint';

    case 'api-operation':
      return 'api_operation';

    case 'transition':
      return evidence.id
        .startsWith(
          'FLOW-BUSINESS-',
        )
        ? 'flow'
        : null;

    default:
      return null;
  }
}

function referencesTarget(
  scenarioReferences:
    string[],

  targetReferences:
    string[],
): boolean {
  const targetReferenceSet =
    new Set(
      targetReferences,
    );

  return scenarioReferences.some(
    (reference) =>
      targetReferenceSet.has(
        reference,
      ),
  );
}

function determineCoverageStatus(
  target:
    CoverageTarget,

  scenarios:
    CoverageScenario[],

  tests:
    CoverageTest[],
): {
  status:
    CoverageStatus;

  reasons:
    string[];
} {
  if (!target.supported) {
    return {
      status:
        'unsupported',

      reasons: [
        'The current verification model does not support this coverage target.',
      ],
    };
  }

  if (target.blocked) {
    return {
      status:
        'blocked',

      reasons: [
        target.blockedReason ??
          'The coverage target is explicitly blocked.',
      ],
    };
  }

  if (
    scenarios.length ===
    0
  ) {
    return {
      status:
        'uncovered',

      reasons: [
        'No accepted generated scenario references this coverage target.',
      ],
    };
  }

  if (
    tests.some(
      (test) =>
        test.status ===
        'completed',
    )
  ) {
    return {
      status:
        'covered',

      reasons: [
        'At least one evidence-linked generated test completed execution.',
      ],
    };
  }

  if (
    tests.length >
      0 &&
    tests.every(
      (test) =>
        test.status ===
        'blocked',
    )
  ) {
    return {
      status:
        'blocked',

      reasons: [
        'Evidence-linked scenarios exist, but all linked tests are blocked from successful execution.',
      ],
    };
  }

  return {
    status:
      'partially_covered',

    reasons: [
      'An evidence-linked scenario exists, but no linked generated test has completed execution yet.',
    ],
  };
}
