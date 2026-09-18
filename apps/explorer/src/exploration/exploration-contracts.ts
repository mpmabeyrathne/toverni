import type {
    ActionElement,
    PageObservation,
  } from '../contracts/page-observation.js';
  
  import type {
    BrowserTarget,
  } from '../browser/browser-target.js';
  
  import type {
    ApplicationStateNode,
  } from '../state/application-state.js';
  
  export interface ExplorationBudget {
    maxActions: number;
  
    maxActionsPerState: number;
  
    maxStates: number;
  }
  
  export interface ExplorationProductContext {
    priorityTerms?: string[];
  
    avoidTerms?: string[];
  }
  
  export interface ExplorationCandidate {
    id: string;
  
    stateId: string;
  
    signature: string;
  
    label: string;
  
    action: ActionElement;
  
    target:
      | BrowserTarget
      | null;
  
    score: number;
  
    reasons: string[];
  
    blocked: boolean;
  
    blockReasons: string[];
  
    previouslyVisited: boolean;
  
    graphVisitCount: number;
  }
  
  export type ExplorationStopReason =
    | 'max-actions-reached'
    | 'max-actions-per-state-reached'
    | 'max-states-reached'
    | 'no-eligible-actions';
  
  export interface ExplorationDecision {
    decidedAt: string;
  
    stateId: string;
  
    selected:
      | ExplorationCandidate
      | null;
  
    rankedCandidates:
      ExplorationCandidate[];
  
    shouldStop: boolean;
  
    stopReason:
      | ExplorationStopReason
      | null;
  }
  
  export interface PlanExplorationInput {
    state: ApplicationStateNode;
  
    observation: PageObservation;
  
    productContext?:
      ExplorationProductContext;
  }