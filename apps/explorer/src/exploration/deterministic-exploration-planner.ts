import type {
    ActionElement,
  } from '../contracts/page-observation.js';
  
  import type {
    ApplicationStateModel,
  } from '../state/application-state-model.js';
  
  import {
    createActionSignature,
    createBrowserTarget,
    getActionLabel,
  } from './action-candidate.js';
  
  import type {
    ExplorationBudget,
    ExplorationCandidate,
    ExplorationDecision,
    ExplorationProductContext,
    PlanExplorationInput,
  } from './exploration-contracts.js';
  
  const DEFAULT_BUDGET:
    ExplorationBudget = {
      maxActions: 50,
  
      maxActionsPerState: 10,
  
      maxStates: 100,
    };
  
  const DESTRUCTIVE_TERMS = [
    'delete',
    'remove',
    'destroy',
    'logout',
    'log out',
    'sign out',
    'purchase',
    'pay now',
    'place order',
    'confirm order',
    'cancel subscription',
  ];
  
  const ACTION_TYPE_SCORES:
    Partial<
      Record<
        ActionElement['type'],
        number
      >
    > = {
      link: 40,
  
      button: 35,
  
      checkbox: 10,
  
      radio: 10,
  
      input: 5,
  
      select: 5,
  
      textarea: 5,
  
      form: 0,
  
      menu: 0,
  
      dialog: 0,
    };
  
  export class DeterministicExplorationPlanner {
    private readonly budget:
      ExplorationBudget;
  
    private readonly visitedActions =
      new Map<
        string,
        Set<string>
      >();
  
    private readonly stateActionCounts =
      new Map<
        string,
        number
      >();
  
    private totalActionsTaken = 0;
  
    private readonly decisionHistory:
      ExplorationDecision[] = [];
  
    constructor(
      private readonly stateModel:
        ApplicationStateModel,
  
      budget:
        Partial<ExplorationBudget> = {},
    ) {
      this.budget = {
        ...DEFAULT_BUDGET,
        ...budget,
      };
    }
  
    plan(
      input: PlanExplorationInput,
    ): ExplorationDecision {
      const budgetStop =
        this.checkBudget(
          input.state.id,
        );
  
      if (budgetStop) {
        return this.recordDecision({
          decidedAt:
            new Date().toISOString(),
  
          stateId:
            input.state.id,
  
          selected: null,
  
          rankedCandidates: [],
  
          shouldStop: true,
  
          stopReason:
            budgetStop,
        });
      }
  
      const candidates =
        input.observation.actions
          .map(
            (action, index) =>
              this.createCandidate(
                input.state.id,
                action,
                index,
                input.productContext,
              ),
          )
          .sort(
            (first, second) =>
              second.score -
              first.score,
          );
  
      const selected =
        candidates.find(
          (candidate) =>
            !candidate.blocked,
        ) ?? null;
  
      if (!selected) {
        return this.recordDecision({
          decidedAt:
            new Date().toISOString(),
  
          stateId:
            input.state.id,
  
          selected: null,
  
          rankedCandidates:
            candidates,
  
          shouldStop: true,
  
          stopReason:
            'no-eligible-actions',
        });
      }
  
      return this.recordDecision({
        decidedAt:
          new Date().toISOString(),
  
        stateId:
          input.state.id,
  
        selected,
  
        rankedCandidates:
          candidates,
  
        shouldStop: false,
  
        stopReason: null,
      });
    }
  
    recordActionExecution(
      candidate:
        ExplorationCandidate,
    ): void {
      let visited =
        this.visitedActions.get(
          candidate.stateId,
        );
  
      if (!visited) {
        visited =
          new Set<string>();
  
        this.visitedActions.set(
          candidate.stateId,
          visited,
        );
      }
  
      if (
        !visited.has(
          candidate.signature,
        )
      ) {
        visited.add(
          candidate.signature,
        );
  
        this.totalActionsTaken += 1;
  
        const stateCount =
          this.stateActionCounts.get(
            candidate.stateId,
          ) ?? 0;
  
        this.stateActionCounts.set(
          candidate.stateId,
          stateCount + 1,
        );
      }
    }
  
    getDecisionHistory():
      ExplorationDecision[] {
      return [
        ...this.decisionHistory,
      ];
    }
  
    getTotalActionsTaken():
      number {
      return this.totalActionsTaken;
    }
  
    private createCandidate(
      stateId: string,
  
      action: ActionElement,
  
      index: number,
  
      productContext:
        | ExplorationProductContext
        | undefined,
    ): ExplorationCandidate {
      const signature =
        createActionSignature(
          action,
        );
  
      const label =
        getActionLabel(
          action,
        );
  
      const target =
        createBrowserTarget(
          action,
        );
  
      const previouslyVisited =
        this.hasVisitedAction(
          stateId,
          signature,
        );
  
      const graphVisitCount =
        this.getGraphVisitCount(
          stateId,
          label,
        );
  
      const reasons:
        string[] = [];
  
      const blockReasons:
        string[] = [];
  
      let score = 0;
  
      if (action.visible) {
        score += 10;
  
        reasons.push(
          'Action is visible',
        );
      } else {
        blockReasons.push(
          'Action is not visible',
        );
      }
  
      if (action.disabled) {
        blockReasons.push(
          'Action is disabled',
        );
      }
  
      if (!target) {
        blockReasons.push(
          'No executable browser target could be derived',
        );
      }
  
      if (
        this.requiresInputValue(
          action,
        )
      ) {
        blockReasons.push(
          'Action requires input data before it can be executed',
        );
      }
  
      if (
        this.containsDestructiveTerm(
          label,
        )
      ) {
        blockReasons.push(
          'Action appears destructive or unsafe for autonomous exploration',
        );
      }
  
      if (previouslyVisited) {
        score -= 100;
  
        blockReasons.push(
          'Action has already been visited in this state',
        );
      } else {
        score += 100;
  
        reasons.push(
          'Action has not been visited in this state',
        );
      }
  
      if (
        graphVisitCount > 0
      ) {
        score -=
          graphVisitCount * 60;
  
        blockReasons.push(
          'Action already exists in the discovered flow graph',
        );
      } else {
        score += 30;
  
        reasons.push(
          'Action has no known transition in the flow graph',
        );
      }
  
      const typeScore =
        ACTION_TYPE_SCORES[
          action.type
        ] ?? 0;
  
      score += typeScore;
  
      if (typeScore > 0) {
        reasons.push(
          `Action type ${action.type} has exploration value`,
        );
      }
  
      const contextResult =
        this.scoreProductContext(
          label,
          productContext,
        );
  
      score +=
        contextResult.score;
  
      reasons.push(
        ...contextResult.reasons,
      );
  
      return {
        id:
          `${stateId}:${index}:${signature}`,
  
        stateId,
  
        signature,
  
        label,
  
        action,
  
        target,
  
        score,
  
        reasons,
  
        blocked:
          blockReasons.length >
          0,
  
        blockReasons,
  
        previouslyVisited,
  
        graphVisitCount,
      };
    }
  
    private checkBudget(
      stateId: string,
    ):
      | ExplorationDecision['stopReason']
      | null {
      if (
        this.totalActionsTaken >=
        this.budget.maxActions
      ) {
        return 'max-actions-reached';
      }
  
      const stateActions =
        this.stateActionCounts.get(
          stateId,
        ) ?? 0;
  
      if (
        stateActions >=
        this.budget
          .maxActionsPerState
      ) {
        return 'max-actions-per-state-reached';
      }
  
      if (
        this.stateModel
          .getStateCount() >=
        this.budget.maxStates
      ) {
        return 'max-states-reached';
      }
  
      return null;
    }
  
    private hasVisitedAction(
      stateId: string,
      signature: string,
    ): boolean {
      return (
        this.visitedActions
          .get(stateId)
          ?.has(signature) ??
        false
      );
    }
  
    private getGraphVisitCount(
      stateId: string,
      label: string,
    ): number {
      const normalizedLabel =
        this.normalize(
          label,
        );
  
      return this.stateModel
        .getTransitions()
        .filter(
          (transition) =>
            transition.fromStateId ===
              stateId &&
            this.normalize(
              transition.action
                .target ?? '',
            ) ===
              normalizedLabel,
        ).length;
    }
  
    private requiresInputValue(
      action: ActionElement,
    ): boolean {
      return (
        action.type ===
          'input' ||
        action.type ===
          'textarea' ||
        action.type ===
          'select'
      );
    }
  
    private containsDestructiveTerm(
      value: string,
    ): boolean {
      const normalized =
        this.normalize(value);
  
      return DESTRUCTIVE_TERMS.some(
        (term) =>
          normalized.includes(
            term,
          ),
      );
    }
  
    private scoreProductContext(
      label: string,
  
      context:
        | ExplorationProductContext
        | undefined,
    ): {
      score: number;
  
      reasons: string[];
    } {
      if (!context) {
        return {
          score: 0,
          reasons: [],
        };
      }
  
      const normalized =
        this.normalize(label);
  
      let score = 0;
  
      const reasons:
        string[] = [];
  
      for (
        const term of
        context.priorityTerms ?? []
      ) {
        if (
          normalized.includes(
            this.normalize(term),
          )
        ) {
          score += 25;
  
          reasons.push(
            `Matches priority product context: ${term}`,
          );
        }
      }
  
      for (
        const term of
        context.avoidTerms ?? []
      ) {
        if (
          normalized.includes(
            this.normalize(term),
          )
        ) {
          score -= 40;
  
          reasons.push(
            `Matches lower-priority product context: ${term}`,
          );
        }
      }
  
      return {
        score,
        reasons,
      };
    }
  
    private recordDecision(
      decision:
        ExplorationDecision,
    ): ExplorationDecision {
      this.decisionHistory.push(
        decision,
      );
  
      return decision;
    }
  
    private normalize(
      value: string,
    ): string {
      return value
        .toLowerCase()
        .replace(
          /\s+/g,
          ' ',
        )
        .trim();
    }
  }