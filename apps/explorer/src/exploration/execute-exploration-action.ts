import type {
    BrowserSession,
    BrowserTarget,
  } from '../browser/index.js';
  
  export interface ExplorationActionToExecute {
    type: string;
    label: string;
    target: BrowserTarget | null;
  }
  
  export type ExplorationActionExecutionResult =
    | {
        status: 'executed';
      }
    | {
        status: 'unsupported';
        reason: string;
      };
  
  export async function executeExplorationAction(
    session: BrowserSession,
    action: ExplorationActionToExecute,
  ): Promise<ExplorationActionExecutionResult> {
    if (!action.target) {
      return {
        status: 'unsupported',
        reason: `Action "${action.label}" has no browser target.`,
      };
    }
  
    switch (action.type) {
      case 'button':
      case 'link': {
        await session.click(action.target);
  
        return {
          status: 'executed',
        };
      }
  
      default:
        return {
          status: 'unsupported',
          reason:
            `Exploration action type "${action.type}" ` +
            'is not executable yet.',
        };
    }
  }