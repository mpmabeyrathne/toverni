import type {
  BrowserSession,
  BrowserTarget,
} from '../browser/index.js';

import type {
  ActionElement,
} from '../contracts/page-observation.js';

import type {
  ExplorationFormExecution,
} from './exploration-contracts.js';

export interface ExplorationActionToExecute {
  type:
    ActionElement['type'];

  label:
    string;

  target:
    | BrowserTarget
    | null;

  formExecution?:
    | ExplorationFormExecution
    | null;
}

export type ExplorationActionExecutionResult =
  | {
      status:
        'executed';
    }
  | {
      status:
        'unsupported';

      reason:
        string;
    };

export async function executeExplorationAction(
  session:
    BrowserSession,

  action:
    ExplorationActionToExecute,
): Promise<ExplorationActionExecutionResult> {
  if (!action.target) {
    return {
      status:
        'unsupported',

      reason:
        `Action "${action.label}" has no browser target.`,
    };
  }

  switch (action.type) {
    // --------------------------------
    // Click actions
    // --------------------------------

    case 'button':
    case 'link': {
      await session.click(
        action.target,
      );

      return {
        status:
          'executed',
      };
    }

    // --------------------------------
    // Text-like form controls
    // --------------------------------

    case 'input':
    case 'textarea':
    case 'contenteditable': {
      if (
        action.formExecution
          ?.kind !==
        'fill'
      ) {
        return {
          status:
            'unsupported',

          reason:
            `Action "${action.label}" has no grounded fill value.`,
        };
      }

      await session.fill(
        action.target,
        action.formExecution
          .value,
      );

      return {
        status:
          'executed',
      };
    }

    // --------------------------------
    // Native select
    // --------------------------------

    case 'select': {
      if (
        action.formExecution
          ?.kind !==
        'select'
      ) {
        return {
          status:
            'unsupported',

          reason:
            `Action "${action.label}" has no grounded select value.`,
        };
      }

      await session.select(
        action.target,
        action.formExecution
          .value,
      );

      return {
        status:
          'executed',
      };
    }

    // --------------------------------
    // ARIA combobox
    // --------------------------------

    case 'combobox': {
      if (
        action.formExecution
          ?.kind ===
        'fill'
      ) {
        await session.fill(
          action.target,
          action.formExecution
            .value,
        );

        return {
          status:
            'executed',
        };
      }

      if (
        action.formExecution
          ?.kind ===
        'choose-option'
      ) {
        await session.click(
          action.target,
        );

        await session.click({
          by:
            'role',

          role:
            'option',

          name:
            action.formExecution
              .value,

          exact:
            true,
        });

        return {
          status:
            'executed',
        };
      }

      return {
        status:
          'unsupported',

        reason:
          `Combobox "${action.label}" has no grounded execution value.`,
      };
    }

    // --------------------------------
    // ARIA listbox
    // --------------------------------

    case 'listbox': {
      if (
        action.formExecution
          ?.kind !==
        'choose-option'
      ) {
        return {
          status:
            'unsupported',

          reason:
            `Listbox "${action.label}" has no grounded option.`,
        };
      }

      await session.click({
        by:
          'role',

        role:
          'option',

        name:
          action.formExecution
            .value,

        exact:
          true,
      });

      return {
        status:
          'executed',
      };
    }

    // --------------------------------
    // Checkbox / radio
    // --------------------------------

    case 'checkbox':
    case 'radio': {
      if (
        action.formExecution
          ?.kind !==
        'set-checked'
      ) {
        return {
          status:
            'unsupported',

          reason:
            `Action "${action.label}" has no grounded boolean value.`,
        };
      }

      if (
        action.formExecution
          .currentValue !==
        action.formExecution
          .value
      ) {
        await session.click(
          action.target,
        );
      }

      return {
        status:
          'executed',
      };
    }

    // --------------------------------
    // Unsupported
    // --------------------------------

    default:
      return {
        status:
          'unsupported',

        reason:
          `Exploration action type "${action.type}" ` +
          'is not executable yet.',
      };
  }
}