import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import type {
    PageObservation,
  } from '../contracts/page-observation.js';
  
  import {
    DeterministicExplorationPlanner,
  } from '../exploration/deterministic-exploration-planner.js';
  
  import {
    ApplicationStateModel,
  } from '../state/application-state-model.js';
  
  import {
    createExecutableTestPlan,
  } from './executable-test-planner.js';
  
  function createObservation(
    blockedLabel: string,
  ): PageObservation {
    return {
      capturedAt:
        '2026-09-28T00:00:00.000Z',
  
      url:
        'https://example.com',
  
      title:
        'Safety fixture',
  
      semanticText: [
        blockedLabel,
        'Safe Action',
      ],
  
      ariaSnapshot:
        `- main:
    - button "${blockedLabel}" [disabled]
    - button "Safe Action"`,
  
      actions: [
        {
          type:
            'button',
  
          tagName:
            'button',
  
          name:
            blockedLabel,
  
          text:
            blockedLabel,
  
          disabled:
            true,
  
          visible:
            true,
        },
  
        {
          type:
            'button',
  
          tagName:
            'button',
  
          name:
            'Safe Action',
  
          text:
            'Safe Action',
  
          disabled:
            false,
  
          visible:
            true,
        },
      ],
  
      consoleEvents: [],
  
      networkEvents: [],
  
      supportingArtifacts: [],
    };
  }
  
  describe(
    'action safety integration',
    () => {
      it.each([
        'Book Garden Room',
        'Add Mouse to Cart',
      ])(
        'never creates a ready executable test for disabled action "%s"',
        (
          blockedLabel,
        ) => {
          const observation =
            createObservation(
              blockedLabel,
            );
  
          const stateModel =
            new ApplicationStateModel();
  
          const state =
            stateModel
              .registerObservation(
                observation,
              )
              .state;
  
          const planner =
            new DeterministicExplorationPlanner(
              stateModel,
            );
  
          const decision =
            planner.plan({
              state,
              observation,
            });
  
          const blockedCandidate =
            decision
              .rankedCandidates
              .find(
                (candidate) =>
                  candidate.label ===
                  blockedLabel,
              );
  
          expect(
            blockedCandidate,
          ).toBeDefined();
  
          expect(
            blockedCandidate
              ?.blocked,
          ).toBe(true);
  
          expect(
            blockedCandidate
              ?.blockReasons,
          ).toContain(
            'Action is disabled',
          );
  
          expect(
            decision.selected
              ?.label,
          ).not.toBe(
            blockedLabel,
          );
  
          if (
            !blockedCandidate
          ) {
            throw new Error(
              `Expected blocked candidate for "${blockedLabel}"`,
            );
          }
  
          const actionId =
            'action-db-disabled';
  
          const evidenceReference =
            'ACTION-DISABLED';
  
          const testPlan =
            createExecutableTestPlan({
              scenario: {
                id:
                  'scenario-disabled-action',
  
                title:
                  `Attempt ${blockedLabel}`,
  
                evidenceReferences: [
                  evidenceReference,
                ],
              },
  
              evidence: [
                {
                  id:
                    evidenceReference,
  
                  type:
                    'action',
  
                  source:
                    actionId,
                },
              ],
  
              actions: [
                {
                  id:
                    actionId,
  
                  label:
                    blockedCandidate
                      .label,
  
                  type:
                    'button',
  
                  target:
                    blockedCandidate
                      .target,
  
                  blocked:
                    blockedCandidate
                      .blocked,
  
                  blockReasons:
                    blockedCandidate
                      .blockReasons,
                },
              ],
            });
  
          expect(
            testPlan.status,
          ).toBe(
            'manual_required',
          );
  
          expect(
            testPlan.steps,
          ).toEqual([]);
  
          expect(
            testPlan.reason,
          ).toContain(
            'Action is disabled',
          );
        },
      );
    },
  );