import type {
  ActionElement,
} from '../contracts/page-observation.js';

import {
  generateFormTestData,
} from '../forms/form-test-data.js';

import type {
  KnowledgeContext,
} from '../knowledge/knowledge-contracts.js';

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
  ExplorationFormExecution,
} from './exploration-contracts.js';

const DEFAULT_BUDGET:
  ExplorationBudget = {
  maxActions: 50,

  maxActionsPerState: 10,

  maxStates: 100,

  maxDepth: 100,

  maxVisitsPerState: 20,

  maxFailures: 5,

  maxModelCalls: 20,

  maxDurationMs:
    60 * 60 * 1000,
};

const SENSITIVE_INPUT_TYPES =
  new Set([
    'password',
    'hidden',
  ]);

const SENSITIVE_FIELD_TERMS = [
  'password',
  'passcode',
  'secret',
  'api key',
  'apikey',
  'access token',
  'auth token',
  'credit card',
  'card number',
  'cvv',
  'cvc',
  'social security',
  'ssn',
  'one time password',
  'otp',
];

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

  combobox:
    5,

  listbox:
    5,

  contenteditable:
    5,
};

const GLOBAL_ACTION_REPEAT_PENALTY = 120;

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

    private readonly globalActionCounts =
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
              input.knowledge,
              input.apiOperationIds,
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

      const globalActionKey =
  this.createGlobalActionKey(
    candidate.action.type,
    candidate.label,
  );

const globalActionCount =
  this.globalActionCounts.get(
    globalActionKey,
  ) ?? 0;

this.globalActionCounts.set(
  globalActionKey,
  globalActionCount + 1,
);
    }
  }

  restoreExecutionHistory(
    executions:
      Array<{
        stateId: string;
        signature: string;
        actionType:
          ActionElement['type'];
        label: string;
      }>,
  ): void {
    for (
      const execution of
        executions
    ) {
      let visited =
        this.visitedActions.get(
          execution.stateId,
        );

      if (!visited) {
        visited =
          new Set<string>();

        this.visitedActions.set(
          execution.stateId,
          visited,
        );
      }

      if (
        visited.has(
          execution.signature,
        )
      ) {
        continue;
      }

      visited.add(
        execution.signature,
      );

      this.totalActionsTaken +=
        1;

      this.stateActionCounts.set(
        execution.stateId,
        (
          this.stateActionCounts.get(
            execution.stateId,
          ) ?? 0
        ) + 1,
      );

      const globalKey =
        this.createGlobalActionKey(
          execution.actionType,
          execution.label,
        );

      this.globalActionCounts.set(
        globalKey,
        (
          this.globalActionCounts.get(
            globalKey,
          ) ?? 0
        ) + 1,
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
    stateId:
      string,

    action:
      ActionElement,

    index:
      number,

    productContext:
      | ExplorationProductContext
      | undefined,

    knowledge:
      | KnowledgeContext
      | undefined,

    apiOperationIds:
      | string[]
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

    const sensitiveFormAction =
      this.isSensitiveFormAction(
        action,
        label,
      );

    const formExecution =
      sensitiveFormAction
        ? null
        : this.createFormExecution(
          action,
          knowledge,
          apiOperationIds,
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

      const globalActionVisitCount =
  this.getGlobalActionVisitCount(
    action.type,
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
      sensitiveFormAction
    ) {
      blockReasons.push(
        'Sensitive form field is not eligible for autonomous test-data execution',
      );
    }

    if (
      this.requiresFormExecution(
        action,
      )
    ) {
      if (!formExecution) {
        blockReasons.push(
          'Action requires grounded form data before it can be executed',
        );
      } else {
        reasons.push(
          'Grounded deterministic form data is available',
        );
      }
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
      globalActionVisitCount >
      0
    ) {
      score -=
        globalActionVisitCount *
        GLOBAL_ACTION_REPEAT_PENALTY;
    
      reasons.push(
        [
          'Action has already been executed',
          `${globalActionVisitCount}`,
          'time(s) across discovered states',
        ].join(' '),
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

      formExecution,

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

  private getGlobalActionVisitCount(
    type:
      ActionElement['type'],
  
    label:
      string,
  ): number {
    const key =
      this.createGlobalActionKey(
        type,
        label,
      );
  
    return (
      this.globalActionCounts.get(
        key,
      ) ?? 0
    );
  }
  
  private createGlobalActionKey(
    type:
      ActionElement['type'],
  
    label:
      string,
  ): string {
    return [
      type,
      this.normalize(
        label,
      ),
    ].join(':');
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

  private requiresFormExecution(
    action:
      ActionElement,
  ): boolean {
    return (
      action.type ===
      'input' ||
      action.type ===
      'textarea' ||
      action.type ===
      'select' ||
      action.type ===
      'combobox' ||
      action.type ===
      'listbox' ||
      action.type ===
      'contenteditable' ||
      action.type ===
      'checkbox' ||
      action.type ===
      'radio'
    );
  }

  private createDeterministicUpload(
    action:
      ActionElement,
  ):
    | ExplorationFormExecution
    | null {
    const inputType =
      action.formField
        ?.inputType ??
      action.inputType;

    if (
      action.type !==
        'input' ||
      inputType
        ?.toLowerCase() !==
        'file'
    ) {
      return null;
    }

    const accept =
      action.formField
        ?.accept
        ?.split(',')
        .map(
          (value) =>
            value.trim(),
        )
        .find(
          (value) =>
            value.length >
            0,
        );

    let extension =
      'txt';

    let mimeType =
      'text/plain';

    if (
      accept?.startsWith(
        '.',
      )
    ) {
      extension =
        accept
          .slice(1)
          .replace(
            /[^a-z0-9]+/gi,
            '',
          ) ||
        'txt';

      const mimeByExtension:
        Record<
          string,
          string
        > = {
          txt:
            'text/plain',

          csv:
            'text/csv',

          json:
            'application/json',

          pdf:
            'application/pdf',

          png:
            'image/png',

          jpg:
            'image/jpeg',

          jpeg:
            'image/jpeg',
        };

      mimeType =
        mimeByExtension[
          extension
            .toLowerCase()
        ] ??
        'application/octet-stream';
    } else if (
      accept?.includes(
        '/',
      )
    ) {
      mimeType =
        accept;

      const subtype =
        accept
          .split('/')[1]
          ?.split('+')[0]
          ?.replace(
            /[^a-z0-9]+/gi,
            '',
          );

      if (subtype) {
        extension =
          subtype ===
            'plain'
            ? 'txt'
            : subtype;
      }
    }

    return {
      kind:
        'upload-file',

      file: {
        name:
          `toverni-test.${extension}`,

        mimeType,

        content:
          'Toverni deterministic upload fixture',
      },

      evidence: [
        {
          source:
            accept
              ? 'ui'
              : 'fallback',

          detail:
            accept
              ? `File input accept constraint: ${accept}`
              : 'Deterministic file payload for unconstrained file input',
        },
      ],
    };
  }

  private createFormExecution(
    action:
      ActionElement,

    knowledge:
      | KnowledgeContext
      | undefined,

    apiOperationIds:
      | string[]
      | undefined,
  ):
    | ExplorationFormExecution
    | null {
    if (
      !this.requiresFormExecution(
        action,
      )
    ) {
      return null;
    }

    const uploadExecution =
      this.createDeterministicUpload(
        action,
      );

    if (uploadExecution) {
      return uploadExecution;
    }

    const resolutionContext =
      apiOperationIds &&
        apiOperationIds.length >
        0
        ? {
          apiOperationIds,
        }
        : undefined;

    const generated =
      generateFormTestData(
        action,
        knowledge,
        resolutionContext,
      );

    const validValue =
      generated.values.find(
        (value) =>
          value.kind ===
          'valid',
      );

    if (!validValue) {
      return null;
    }

    switch (action.type) {
      case 'input':
      case 'textarea':
      case 'contenteditable': {
        if (
          typeof validValue.value !==
          'string'
        ) {
          return null;
        }

        return {
          kind:
            'fill',

          value:
            validValue.value,

          evidence:
            validValue.evidence,
        };
      }

      case 'select': {
        if (
          typeof validValue.value !==
          'string'
        ) {
          return null;
        }

        return {
          kind:
            'select',

          value:
            validValue.value,

          evidence:
            validValue.evidence,
        };
      }

      case 'combobox': {
        if (
          typeof validValue.value !==
          'string'
        ) {
          return null;
        }

        if (
          action.formField
            ?.options?.length
        ) {
          return {
            kind:
              'choose-option',

            value:
              validValue.value,

            evidence:
              validValue.evidence,
          };
        }

        if (
          action.formField
            ?.editable
        ) {
          return {
            kind:
              'fill',

            value:
              validValue.value,

            evidence:
              validValue.evidence,
          };
        }

        return null;
      }

      case 'listbox': {
        if (
          typeof validValue.value !==
          'string'
        ) {
          return null;
        }

        return {
          kind:
            'choose-option',

          value:
            validValue.value,

          evidence:
            validValue.evidence,
        };
      }

      case 'checkbox':
      case 'radio': {
        if (
          typeof validValue
            .value !==
          'boolean' ||
          action.formField
            ?.checked ===
          undefined
        ) {
          return null;
        }

        return {
          kind:
            'set-checked',

          value:
            validValue.value,

          currentValue:
            action.formField
              .checked,

          evidence:
            validValue.evidence,
        };
      }

      default:
        return null;
    }
  }

  private isSensitiveFormAction(
    action:
      ActionElement,

    label:
      string,
  ): boolean {
    if (
      !this.requiresFormExecution(
        action,
      )
    ) {
      return false;
    }

    const inputType =
      action.formField
        ?.inputType ??
      action.inputType;

    if (
      inputType &&
      SENSITIVE_INPUT_TYPES.has(
        inputType.toLowerCase(),
      )
    ) {
      return true;
    }

    const searchableText =
      [
        label,
        action.name,
        action.formField
          ?.htmlName,
        action.formField
          ?.placeholder,
      ]
        .filter(
          (
            value,
          ): value is string =>
            typeof value ===
            'string',
        )
        .join(' ');

    const normalized =
      this.normalize(
        searchableText,
      );

    return SENSITIVE_FIELD_TERMS.some(
      (term) =>
        normalized.includes(
          term,
        ),
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