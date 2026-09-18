import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import type {
    PageObservation,
  } from '../contracts/page-observation.js';
  
  import {
    ApplicationStateModel,
  } from '../state/application-state-model.js';
  
  import {
    DeterministicExplorationPlanner,
  } from './deterministic-exploration-planner.js';
  
  function createObservation():
    PageObservation {
    return {
      capturedAt:
        '2026-09-19T00:00:00.000Z',
  
      url:
        'https://example.com/projects',
  
      title:
        'Projects',
  
      semanticText: [
        'Projects',
        'Create Project',
        'Learn More',
        'Delete Project',
      ],
  
      ariaSnapshot: `
  - heading "Projects" [level=1]
  - button "Create Project"
  - link "Learn More"
  - button "Delete Project"
  `,
  
      actions: [
        {
          type: 'button',
          tagName: 'button',
          name:
            'Create Project',
          text:
            'Create Project',
          disabled: false,
          visible: true,
        },
  
        {
          type: 'link',
          tagName: 'a',
          name:
            'Learn More',
          text:
            'Learn More',
          href:
            'https://example.com/help',
          disabled: false,
          visible: true,
        },
  
        {
          type: 'button',
          tagName: 'button',
          name:
            'Delete Project',
          text:
            'Delete Project',
          disabled: false,
          visible: true,
        },
  
        {
          type: 'input',
          tagName: 'input',
          name:
            'Search',
          inputType:
            'text',
          disabled: false,
          visible: true,
        },
      ],
  
      consoleEvents: [],
  
      networkEvents: [],
  
      supportingArtifacts: [],
    };
  }
  
  function setup() {
    const stateModel =
      new ApplicationStateModel();
  
    const observation =
      createObservation();
  
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
  
    return {
      stateModel,
      observation,
      state,
      planner,
    };
  }
  
  describe(
    'DeterministicExplorationPlanner',
    () => {
      it(
        'prefers a useful unexplored action',
        () => {
          const {
            observation,
            state,
            planner,
          } = setup();
  
          const decision =
            planner.plan({
              state,
              observation,
            });
  
          expect(
            decision.shouldStop,
          ).toBe(false);
  
          expect(
            decision.selected,
          ).not.toBeNull();
  
          expect(
            decision.selected
              ?.blocked,
          ).toBe(false);
  
          expect(
            [
              'Create Project',
              'Learn More',
            ],
          ).toContain(
            decision.selected
              ?.label,
          );
        },
      );
  
      it(
        'blocks destructive actions',
        () => {
          const {
            observation,
            state,
            planner,
          } = setup();
  
          const decision =
            planner.plan({
              state,
              observation,
            });
  
          const deleteCandidate =
            decision
              .rankedCandidates
              .find(
                (candidate) =>
                  candidate.label ===
                  'Delete Project',
              );
  
          expect(
            deleteCandidate
              ?.blocked,
          ).toBe(true);
  
          expect(
            deleteCandidate
              ?.blockReasons
              .some(
                (reason) =>
                  reason.includes(
                    'destructive',
                  ),
              ),
          ).toBe(true);
        },
      );
  
      it(
        'does not select the same action twice',
        () => {
          const {
            observation,
            state,
            planner,
          } = setup();
  
          const first =
            planner.plan({
              state,
              observation,
            });
  
          expect(
            first.selected,
          ).not.toBeNull();
  
          if (!first.selected) {
            throw new Error(
              'Expected selected action',
            );
          }
  
          planner.recordActionExecution(
            first.selected,
          );
  
          const second =
            planner.plan({
              state,
              observation,
            });
  
          expect(
            second.selected?.signature,
          ).not.toBe(
            first.selected.signature,
          );
        },
      );
  
      it(
        'uses product context when ranking',
        () => {
          const {
            observation,
            state,
            planner,
          } = setup();
  
          const decision =
            planner.plan({
              state,
  
              observation,
  
              productContext: {
                priorityTerms: [
                  'learn',
                ],
              },
            });
  
          expect(
            decision.selected
              ?.label,
          ).toBe(
            'Learn More',
          );
        },
      );
  
      it(
        'stops when the action budget is reached',
        () => {
          const stateModel =
            new ApplicationStateModel();
  
          const observation =
            createObservation();
  
          const state =
            stateModel
              .registerObservation(
                observation,
              )
              .state;
  
          const planner =
            new DeterministicExplorationPlanner(
              stateModel,
              {
                maxActions: 1,
              },
            );
  
          const first =
            planner.plan({
              state,
              observation,
            });
  
          if (!first.selected) {
            throw new Error(
              'Expected first action',
            );
          }
  
          planner.recordActionExecution(
            first.selected,
          );
  
          const second =
            planner.plan({
              state,
              observation,
            });
  
          expect(
            second.shouldStop,
          ).toBe(true);
  
          expect(
            second.stopReason,
          ).toBe(
            'max-actions-reached',
          );
        },
      );
  
      it(
        'records why actions were selected',
        () => {
          const {
            observation,
            state,
            planner,
          } = setup();
  
          const decision =
            planner.plan({
              state,
              observation,
            });
  
          expect(
            decision.selected
              ?.reasons.length,
          ).toBeGreaterThan(0);
  
          expect(
            planner
              .getDecisionHistory()
              .length,
          ).toBe(1);
        },
      );
    },
  );