import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  extractGeneratedHerculesGherkin,
  normalizeHerculesScenarios,
  parseHerculesFinalRuntimeStatus,
  parseHerculesGherkin,
  parseHerculesJUnitXml,
} from './hercules-normalizer.js';

describe(
  'hercules-normalizer',
  () => {
    const gherkin =
      [
        'Feature: Room booking',
        '',
        '  Scenario: Book an available room',
        '    Given I open "http://127.0.0.1:4567"',
        '    When I click Book Ocean Room',
        '    Then a successful booking confirmation is displayed',
        '    And Cancel Booking is available',
      ].join('\n');

    it(
      'extracts the generated feature from Hercules guided-mode output',
      () => {
        const raw =
          [
            'Generating feature...',
            '',
            '==================================================',
            gherkin,
            '==================================================',
            '',
            'Running generated test...',
          ].join('\n');

        expect(
          extractGeneratedHerculesGherkin(
            raw,
          ),
        ).toContain(
          'Scenario: Book an available room',
        );
      },
    );

    it(
      'parses Gherkin actions and assertions',
      () => {
        const scenarios =
          parseHerculesGherkin(
            gherkin,
          );

        expect(
          scenarios,
        ).toEqual([
          {
            title:
              'Book an available room',
            actions: [
              'I open "http://127.0.0.1:4567"',
              'I click Book Ocean Room',
            ],
            expectedOutcomes: [
              'a successful booking confirmation is displayed',
              'Cancel Booking is available',
            ],
            assertionCount:
              2,
          },
        ]);
      },
    );

    it(
      'uses the final Hercules is_passed signal when available',
      () => {
        const raw =
          "[2026-10-06] INFO Final message: {'role': 'assistant', 'content': {'is_passed': False}, 'terminate': 'yes'}";

        expect(
          parseHerculesFinalRuntimeStatus(
            raw,
          ),
        ).toBe(
          'failed',
        );
      },
    );

    it(
      'parses a wrapped Hercules final status from PowerShell output',
      () => {
        const raw =
          [
            "[2026-10-06] INFO Final message: {'role': 'assistant', 'content': {'plan': 'step 1",
            "failed', 'next_step': '', 'terminate': 'yes', 'final_response': 'Unable to proceed',",
            "'is_assert': False, 'assert_summary': '', 'is_passed': False,",
            "'target_helper': 'Not_Applicable'}, 'terminate': 'yes'}",
          ].join(
            '\n',
          );

        expect(
          parseHerculesFinalRuntimeStatus(
            raw,
          ),
        ).toBe(
          'failed',
        );
      },
    );

    it(
      'maps JUnit test cases to benchmark runtime statuses',
      () => {
        const statuses =
          parseHerculesJUnitXml(
            [
              '<testsuites><testsuite>',
              '<testcase name="Book an available room" classname="Room booking"><system-out>ok</system-out></testcase>',
              '<testcase name="Cancel booking" classname="Room booking"><failure message="failed" /></testcase>',
              '</testsuite></testsuites>',
            ].join(''),
          );

        expect(
          [
            ...statuses.values(),
          ],
        ).toEqual([
          'passed',
          'failed',
        ]);
      },
    );

    it(
      'normalizes a guided scenario with requirement evidence and runtime result',
      () => {
        const statuses =
          parseHerculesJUnitXml(
            '<testsuites><testsuite><testcase name="Scenario: Book an available room" /></testsuite></testsuites>',
          );

        const scenarios =
          normalizeHerculesScenarios({
            gherkin,
            runtimeStatuses:
              statuses,
            requirements: {
              acceptanceCriteria: [
                'A customer can book an available room.',
              ],
              capabilities: [
                'Book an available room.',
              ],
              constraints: [
                'The same room cannot be booked twice for the same date.',
              ],
            },
          });

        expect(
          scenarios,
        ).toHaveLength(
          1,
        );

        expect(
          scenarios[0],
        ).toMatchObject({
          executable:
            true,
          runtimeStatus:
            'passed',
          humanEditsRequired:
            0,
          assertionCount:
            2,
        });

        expect(
          scenarios[0]
            ?.evidenceReferences,
        ).toContain(
          'REQ-1',
        );
      },
    );
  },
);
