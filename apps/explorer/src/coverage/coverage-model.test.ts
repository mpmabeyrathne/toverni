import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  buildCoverageReport,
  buildCoverageTargets,
  resolveCoverageTestStatus,
} from './coverage-model.js';

describe(
  'coverage model',
  () => {
    it(
      'creates targets only for requirements, capabilities, constraints, business flows, and API operations',
      () => {
        const targets =
          buildCoverageTargets([
            {
              id:
                'REQ-1',

              type:
                'requirement',

              description:
                'User can create a booking.',

              source:
                'requirements.md',
            },
            {
              id:
                'ACTION-1',

              type:
                'action',

              description:
                'click: Book',

              source:
                'action-1',
            },
            {
              id:
                'FLOW-BUSINESS-1',

              type:
                'transition',

              description:
                'Business flow: Book room.',

              source:
                'business-flow-1',
            },
            {
              id:
                'API-1',

              type:
                'api-operation',

              description:
                'POST /bookings (createBooking)',

              source:
                'openapi.yaml',
            },
          ]);

        expect(
          targets.map(
            (target) =>
              target.kind,
          ),
        ).toEqual([
          'requirement',
          'flow',
          'api_operation',
        ]);
      },
    );

    it(
      'marks an unreferenced target as uncovered',
      () => {
        const report =
          buildCoverageReport({
            targets: [
              {
                id:
                  'REQ-1',

                kind:
                  'requirement',

                label:
                  'User can create a booking.',

                evidenceReferences: [
                  'REQ-1',
                ],

                supported:
                  true,

                blocked:
                  false,
              },
            ],

            scenarios: [],

            tests: [],
          });

        expect(
          report.entries[0]
            ?.status,
        ).toBe(
          'uncovered',
        );

        expect(
          report.gaps,
        ).toHaveLength(
          1,
        );
      },
    );

    it(
      'marks scenario-only coverage as partially covered',
      () => {
        const report =
          buildCoverageReport({
            targets: [
              {
                id:
                  'FLOW-BUSINESS-1',

                kind:
                  'flow',

                label:
                  'Create booking',

                evidenceReferences: [
                  'FLOW-BUSINESS-1',
                ],

                supported:
                  true,

                blocked:
                  false,
              },
            ],

            scenarios: [
              {
                id:
                  'scenario-1',

                evidenceReferences: [
                  'FLOW-BUSINESS-1',
                ],

                accepted:
                  true,
              },
            ],

            tests: [],
          });

        expect(
          report.entries[0]
            ?.status,
        ).toBe(
          'partially_covered',
        );
      },
    );

    it(
      'marks completed generated-test coverage as covered',
      () => {
        const report =
          buildCoverageReport({
            targets: [
              {
                id:
                  'REQ-1',

                kind:
                  'requirement',

                label:
                  'Booking succeeds',

                evidenceReferences: [
                  'REQ-1',
                ],

                supported:
                  true,

                blocked:
                  false,
              },
            ],

            scenarios: [
              {
                id:
                  'scenario-1',

                evidenceReferences: [
                  'REQ-1',
                ],

                accepted:
                  true,
              },
            ],

            tests: [
              {
                id:
                  'test-1',

                scenarioId:
                  'scenario-1',

                status:
                  'completed',
              },
            ],
          });

        expect(
          report.entries[0]
            ?.status,
        ).toBe(
          'covered',
        );
      },
    );

    it(
      'treats failed assertions as completed coverage',
      () => {
        expect(
          resolveCoverageTestStatus(
            'ready',
            'failed',
          ),
        ).toBe(
          'completed',
        );
      },
    );

    it(
      'marks fully blocked verification as blocked',
      () => {
        const report =
          buildCoverageReport({
            targets: [
              {
                id:
                  'REQ-1',

                kind:
                  'requirement',

                label:
                  'Booking succeeds',

                evidenceReferences: [
                  'REQ-1',
                ],

                supported:
                  true,

                blocked:
                  false,
              },
            ],

            scenarios: [
              {
                id:
                  'scenario-1',

                evidenceReferences: [
                  'REQ-1',
                ],

                accepted:
                  true,
              },
            ],

            tests: [
              {
                id:
                  'test-1',

                scenarioId:
                  'scenario-1',

                status:
                  'blocked',
              },
            ],
          });

        expect(
          report.entries[0]
            ?.status,
        ).toBe(
          'blocked',
        );
      },
    );

    it(
      'marks unsupported targets explicitly',
      () => {
        const report =
          buildCoverageReport({
            targets: [
              {
                id:
                  'CON-1',

                kind:
                  'constraint',

                label:
                  'Requires unsupported external verification.',

                evidenceReferences: [
                  'CON-1',
                ],

                supported:
                  false,

                blocked:
                  false,
              },
            ],

            scenarios: [],

            tests: [],
          });

        expect(
          report.entries[0]
            ?.status,
        ).toBe(
          'unsupported',
        );
      },
    );

    it(
      'removes rejected scenarios from coverage',
      () => {
        const report =
          buildCoverageReport({
            targets: [
              {
                id:
                  'REQ-1',

                kind:
                  'requirement',

                label:
                  'Booking succeeds',

                evidenceReferences: [
                  'REQ-1',
                ],

                supported:
                  true,

                blocked:
                  false,
              },
            ],

            scenarios: [
              {
                id:
                  'scenario-1',

                evidenceReferences: [
                  'REQ-1',
                ],

                accepted:
                  false,
              },
            ],

            tests: [
              {
                id:
                  'test-1',

                scenarioId:
                  'scenario-1',

                status:
                  'completed',
              },
            ],
          });

        expect(
          report.entries[0]
            ?.status,
        ).toBe(
          'uncovered',
        );
      },
    );

    it(
      'supports overlapping requirements',
      () => {
        const report =
          buildCoverageReport({
            targets: [
              {
                id:
                  'REQ-1',

                kind:
                  'requirement',

                label:
                  'User can book a room.',

                evidenceReferences: [
                  'FLOW-BUSINESS-1',
                ],

                supported:
                  true,

                blocked:
                  false,
              },
              {
                id:
                  'REQ-2',

                kind:
                  'requirement',

                label:
                  'Available rooms can be reserved.',

                evidenceReferences: [
                  'FLOW-BUSINESS-1',
                ],

                supported:
                  true,

                blocked:
                  false,
              },
            ],

            scenarios: [
              {
                id:
                  'scenario-1',

                evidenceReferences: [
                  'FLOW-BUSINESS-1',
                ],

                accepted:
                  true,
              },
            ],

            tests: [],
          });

        expect(
          report.entries.map(
            (entry) =>
              entry.status,
          ),
        ).toEqual([
          'partially_covered',
          'partially_covered',
        ]);
      },
    );
  },
);
