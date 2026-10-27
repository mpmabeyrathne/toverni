import type {
  ActionElement,
  PageObservation,
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
  type FunctionalExplorationTree,
  type FunctionalBranchKind,
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

interface HighImpactActionRule {
  category:
    'destructive'
    | 'financial'
    | 'communication'
    | 'subscription'
    | 'transfer'
    | 'admin';

  pattern:
    RegExp;

  description:
    string;
}

const HIGH_IMPACT_ACTION_RULES:
  HighImpactActionRule[] = [
    {
      category:
        'destructive',

      pattern:
        /\b(?:delete|destroy|erase|purge)\b/i,

      description:
        'destructive data mutation',
    },

    {
      category:
        'destructive',

      pattern:
        /\bremove\s+(?:user|member|account|project|workspace|organization|record|item)\b/i,

      description:
        'destructive removal',
    },

    {
      category:
        'financial',

      pattern:
        /\b(?:purchase|buy\s+now|pay\s+now|place\s+order|confirm\s+order|submit\s+payment|complete\s+purchase|charge\s+card|issue\s+refund)\b/i,

      description:
        'financial transaction',
    },

    {
      category:
        'communication',

      pattern:
        /\b(?:invite\s+(?:user|member|guest|team|collaborator)|send\s+(?:invite|invitation|email|message|notification))\b/i,

      description:
        'external communication or invitation',
    },

    {
      category:
        'subscription',

      pattern:
        /\b(?:cancel\s+subscription|unsubscribe|terminate\s+(?:subscription|plan))\b/i,

      description:
        'subscription cancellation',
    },

    {
      category:
        'transfer',

      pattern:
        /\b(?:transfer\s+(?:funds|money|ownership)|wire\s+(?:funds|money)|withdraw\s+(?:funds|money))\b/i,

      description:
        'asset or ownership transfer',
    },

    {
      category:
        'admin',

      pattern:
        /\b(?:suspend|ban|deactivate|disable)\s+(?:user|member|account)\b|\brevoke\s+(?:access|role|permission)\b|\breset\s+(?:database|workspace|organization)\b/i,

      description:
        'destructive administrative operation',
    },
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

    private readonly allowDestructiveActions:
      boolean = false,
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

    const validationProbeLabels =
      this.requirementValidationProbeLabels(
        input,
      );

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
              input.observation,
              validationProbeLabels,
            ),
        )
        .sort(
          (first, second) =>
            second.score -
            first.score,
        );

    // An inspectable functional tree complements (but does not replace)
    // the observed state graph. Preserve existing candidate selection.
    const branchOrder: FunctionalBranchKind[] = [
      'validation', 'form-setup', 'submission', 'navigation', 'other',
    ];
    const functionalTree: FunctionalExplorationTree = {
      stateId: input.state.id,
      branches: branchOrder.map((kind) => {
        const members = candidates.filter((candidate) => {
          const label = candidate.label;
          const type = candidate.action.type;
          if (kind === 'validation') {
            return validationProbeLabels.has(this.normalize(label));
          }
          if (kind === 'form-setup') {
            if (validationProbeLabels.has(this.normalize(label))) return false;
            return ['input', 'textarea', 'select', 'checkbox', 'radio',
              'combobox', 'contenteditable'].includes(type);
          }
          if (kind === 'submission') {
            return type === 'button' &&
              /\b(?:login|log\s*in|sign\s*in|submit|save|continue|register|search)\b/i.test(label);
          }
          if (kind === 'navigation') {
            return type === 'link';
          }
          return kind === 'other' &&
            !validationProbeLabels.has(this.normalize(label)) &&
            !['input', 'textarea', 'select', 'checkbox', 'radio', 'combobox', 'contenteditable', 'link'].includes(type) &&
            !(type === 'button' && /\b(?:login|log\s*in|sign\s*in|submit|save|continue|register|search)\b/i.test(label));
        });
        return { kind, candidateIds: members.map((item) => item.id),
          eligibleCandidateIds: members.filter((item) => !item.blocked).map((item) => item.id) };
      }),
    };

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

        functionalTree,

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

      functionalTree,

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

    observation:
      PageObservation,

    validationProbeLabels:
      Set<string>,
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
      this.createFormExecution(
        action,
        knowledge,
        apiOperationIds,
        observation,
      );

    const requirementGroundedReadControl =
      this.isRequirementGroundedReadControl(
        label,
        knowledge,
      );

    const sensitiveFormGrounded =
      !sensitiveFormAction ||
      this.hasExplicitSensitiveValueEvidence(
        formExecution,
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
      action.href &&
      productContext
        ?.targetOrigin
    ) {
      try {
        const actionOrigin =
          new URL(
            action.href,
            observation.url,
          ).origin;

        if (
          actionOrigin !==
          productContext
            .targetOrigin
        ) {
          blockReasons.push(
            `External navigation is outside the autonomous exploration origin (${actionOrigin})`,
          );
        } else {
          const actionUrl =
            new URL(
              action.href,
              observation.url,
            );

          const currentUrl =
            new URL(
              observation.url,
            );

          if (
            actionUrl.href ===
            currentUrl.href
          ) {
            blockReasons.push(
              'Navigation target is already the current page',
            );
          } else if (
            actionUrl.origin ===
              currentUrl.origin &&
            actionUrl.pathname ===
              currentUrl.pathname &&
            actionUrl.search ===
              currentUrl.search &&
            actionUrl.hash !==
              currentUrl.hash
          ) {
            score -=
              40;

            reasons.push(
              'Same-document fragment navigation is deprioritized behind route exploration',
            );
          } else {
            score +=
              40;

            reasons.push(
              'Same-origin route navigation expands application coverage',
            );
          }

          reasons.push(
            'Navigation remains inside the autonomous exploration origin',
          );
        }
      } catch {
        blockReasons.push(
          'Navigation target could not be resolved safely',
        );
      }
    }

    if (
      sensitiveFormAction &&
      !sensitiveFormGrounded
    ) {
      blockReasons.push(
        'Sensitive form field requires an explicit trusted test value before autonomous execution',
      );
    } else if (
      sensitiveFormAction &&
      sensitiveFormGrounded
    ) {
      reasons.push(
        'Sensitive form value is explicitly grounded by trusted product evidence',
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

    const highImpactClassification =
      this.classifyHighImpactAction(
        label,
      );

    if (
      highImpactClassification
    ) {
      const explanation =
        [
          highImpactClassification
            .category,
          highImpactClassification
            .description,
        ].join(
          ': ',
        );

      if (
        this.allowDestructiveActions
      ) {
        reasons.push(
          `High-impact action is explicitly allowed for this isolated exploration run (${explanation})`,
        );
      } else {
        blockReasons.push(
          `Action appears destructive or unsafe for autonomous exploration (${explanation})`,
        );
      }
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

    if (
      formExecution &&
      this.isUnfilledFormSetup(
        action,
      ) &&
      !requirementGroundedReadControl
    ) {
      score += 50;

      reasons.push(
        'Unfilled grounded form setup is prioritized before submit or transaction actions',
      );
    }

    if (
      requirementGroundedReadControl
    ) {
      const refreshLike =
        /\b(?:refresh|reload|sync)\b/i
          .test(
            label,
          );

      score +=
        refreshLike
          ? 10
          : 60;

      reasons.push(
        refreshLike
          ? 'Refresh-like data mutation is deferred until other grounded query controls are explored'
          : 'Requirement-grounded read/query control is prioritized before generic form setup',
      );
    }

    if (
      validationProbeLabels.has(
        this.normalize(
          label,
        ),
      )
    ) {
      score += 80;

      reasons.push(
        'Requirement-grounded empty-field validation is probed before valid form setup',
      );
    }

    // The entry page's primary function should be explored before
    // generic header/footer navigation. Do not make blocked inputs
    // eligible: sensitive fields still require explicit trusted values.
    const pagePath = new URL(observation.url).pathname.toLowerCase();
    const authenticationPage = /\/(?:login|sign-in|signin)\/?$/.test(pagePath);
    const authenticationSubmit = authenticationPage &&
      action.type === 'button' &&
      /^(?:log\s*in|sign\s*in|login)$/i.test(label.trim());

    const hasFormSubmit = observation.actions.some((item) =>
      item.visible && !item.disabled && item.type === 'button' &&
      /\b(?:log\s*in|sign\s*in|submit|save|continue|register|search)\b/i.test(
        item.name ?? item.text ?? ''
      )
    );
    const unfilledGroundedField = Boolean(formExecution) &&
      this.isUnfilledFormSetup(action) &&
      (action.type === 'input' || action.type === 'textarea' || action.type === 'select');

    if (authenticationSubmit) {
      score += 130;
      reasons.push('Primary authentication action is prioritized over site navigation');
    } else if (authenticationPage && unfilledGroundedField) {
      // Fill safe, evidence-backed login fields before submitting.
      // Blocked sensitive fields remain blocked regardless of score.
      score += 180;
      reasons.push('Grounded authentication form setup is prioritized before login submission and navigation');
    }
    else if (hasFormSubmit && unfilledGroundedField && validationProbeLabels.size === 0) {
      score += 105;
      reasons.push('Grounded form setup is prioritized before generic navigation');
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

  private isRequirementGroundedReadControl(
    label:
      string,

    knowledge:
      | KnowledgeContext
      | undefined,
  ): boolean {
    const requirements =
      knowledge?.requirements;

    if (!requirements) {
      return false;
    }

    const requirementText = [
      ...requirements
        .acceptanceCriteria,
      ...requirements
        .capabilities,
      ...requirements
        .constraints,
      requirements.rawText,
    ].join(
      ' ',
    );

    const checks = [
      {
        label:
          /\bsearch\b/i,

        requirement:
          /\bsearch\b/i,
      },
      {
        label:
          /\bfilter\b/i,

        requirement:
          /\bfilter(?:ing|s|ed)?\b/i,
      },
      {
        label:
          /\bsort\b/i,

        requirement:
          /\bsort(?:ing|s|ed)?\b/i,
      },
      {
        label:
          /\brefresh\b/i,

        requirement:
          /\brefresh(?:es|ed|ing)?\b/i,
      },
      {
        label:
          /\b(?:next|previous)\s+page\b|\bpage\b/i,

        requirement:
          /\b(?:page|pagination|paginate|paginates|paginated|paginating)\b/i,
      },
    ];

    return checks.some(
      (check) =>
        check.label.test(
          label,
        ) &&
        check.requirement.test(
          requirementText,
        ),
    );
  }

  private requirementValidationProbeLabels(
    input:
      PlanExplorationInput,
  ): Set<string> {
    const requirements =
      input.knowledge
        ?.requirements;

    if (!requirements) {
      return new Set();
    }

    const requirementTexts = [
      ...requirements
        .acceptanceCriteria,
      ...requirements
        .constraints,
    ];

    const emptyVisibleFields =
      input.observation.actions
        .filter(
          (action) =>
            action.visible &&
            this.requiresFormExecution(
              action,
            ) &&
            typeof action.formField
              ?.value ===
              'string' &&
            action.formField
              .value
              .trim()
              .length ===
              0,
        );

    if (
      emptyVisibleFields.length ===
      0
    ) {
      return new Set();
    }

    const progressionActions =
      input.observation.actions
        .filter(
          (action) =>
            action.visible &&
            !action.disabled &&
            (
              action.type ===
                'button' ||
              action.type ===
                'link'
            ) &&
            /\b(?:continue|next|proceed|advance|submit)\b/i
              .test(
                getActionLabel(
                  action,
                ),
              ),
        );

    const labels =
      new Set<string>();

    for (
      const field of
        emptyVisibleFields
    ) {
      const fieldText =
        [
          field.name,
          field.formField
            ?.htmlName,
          field.formField
            ?.placeholder,
        ]
          .filter(
            (
              value,
            ): value is string =>
              typeof value ===
              'string',
          )
          .join(
            ' ',
          );

      const fieldTerms =
        [
          ...new Set(
            this.normalize(
              fieldText,
            )
              .replace(
                /[^a-z0-9]+/g,
                ' ',
              )
              .split(
                /\s+/,
              )
              .filter(
                (term) =>
                  term.length >=
                    3 &&
                  ![
                    'field',
                    'input',
                    'text',
                  ].includes(
                    term,
                  ),
              ),
          ),
        ];

      if (
        fieldTerms.length ===
        0
      ) {
        continue;
      }

      const groundedRequirement =
        requirementTexts.find(
          (requirement) => {
            const normalized =
              this.normalize(
                requirement,
              );

            const terms =
              new Set(
                normalized
                  .replace(
                    /[^a-z0-9]+/g,
                    ' ',
                  )
                  .split(
                    /\s+/,
                  )
                  .filter(
                    Boolean,
                  ),
              );

            const referencesField =
              fieldTerms.every(
                (term) =>
                  terms.has(
                    term,
                  ),
              );

            const marksRequired =
              /\b(?:requires?|required|mandatory|must\s+(?:provide|enter|supply|include))\b/i
                .test(
                  requirement,
                );

            const blocksProgression =
              /\b(?:before\s+(?:continuing|proceeding|advancing|submitting)|cannot\s+(?:continue|proceed|advance|submit)|can't\s+(?:continue|proceed|advance|submit))\b/i
                .test(
                  requirement,
                );

            return (
              referencesField &&
              marksRequired &&
              blocksProgression
            );
          },
        );

      if (!groundedRequirement) {
        continue;
      }

      for (
        const action of
          progressionActions
      ) {
        labels.add(
          this.normalize(
            getActionLabel(
              action,
            ),
          ),
        );
      }
    }

    return labels;
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

    observation:
      PageObservation,
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

    const requirementGroundedInvalidValue =
      generated.values.find(
        (value) =>
          value.kind ===
            'invalid' &&
          value.evidence.some(
            (item) =>
              item.source ===
                'requirements' &&
              /\bother\s+than\b.*\b(?:rejected|invalid|not\s+allowed|forbidden)\b/i
                .test(
                  item.detail,
                ),
          ),
      );

    const currentValue =
      action.formField
        ?.value;

    let selectedValue =
      requirementGroundedInvalidValue &&
      typeof currentValue ===
        'string' &&
      currentValue.trim()
        .length ===
        0
        ? requirementGroundedInvalidValue
        : validValue;

    const observedSearchValue =
      this.observedSearchValue(
        action,
        observation,
        knowledge,
      );

    if (
      observedSearchValue
    ) {
      selectedValue = {
        kind:
          'valid',

        value:
          observedSearchValue,

        evidence: [
          {
            source:
              'ui',

            detail:
              'Derived deterministic search value from an observed data row',
          },
        ],
      };
    }

    const observedFilterValue =
      this.observedFilterValue(
        action,
        observation,
        knowledge,
      );

    if (
      observedFilterValue
    ) {
      selectedValue = {
        kind:
          'valid',

        value:
          observedFilterValue,

        evidence: [
          {
            source:
              'ui',

            detail:
              'Derived deterministic filter value from observed data and enabled options',
          },
        ],
      };
    }

    switch (action.type) {
      case 'input':
      case 'textarea':
      case 'contenteditable': {
        if (
          typeof selectedValue.value !==
          'string'
        ) {
          return null;
        }

        return {
          kind:
            'fill',

          value:
            selectedValue.value,

          evidence:
            selectedValue.evidence,
        };
      }

      case 'select': {
        if (
          typeof selectedValue.value !==
          'string'
        ) {
          return null;
        }

        return {
          kind:
            'select',

          value:
            selectedValue.value,

          evidence:
            selectedValue.evidence,
        };
      }

      case 'combobox': {
        if (
          typeof selectedValue.value !==
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
              selectedValue.value,

            evidence:
              selectedValue.evidence,
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
              selectedValue.value,

            evidence:
              selectedValue.evidence,
          };
        }

        return null;
      }

      case 'listbox': {
        if (
          typeof selectedValue.value !==
          'string'
        ) {
          return null;
        }

        return {
          kind:
            'choose-option',

          value:
            selectedValue.value,

          evidence:
            selectedValue.evidence,
        };
      }

      case 'checkbox':
      case 'radio': {
        if (
          typeof selectedValue
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
            selectedValue.value,

          currentValue:
            action.formField
              .checked,

          evidence:
            selectedValue.evidence,
        };
      }

      default:
        return null;
    }
  }

  private observedDataRows(
    observation:
      PageObservation,
  ): string[][] {
    return observation
      .semanticText
      .filter(
        (value) =>
          value.includes(
            '\t',
          ),
      )
      .map(
        (value) =>
          value
            .split(
              '\t',
            )
            .map(
              (part) =>
                part.trim(),
            )
            .filter(
              Boolean,
            ),
      )
      .filter(
        (parts) =>
          parts.length >=
          2,
      );
  }

  private observedSearchValue(
    action:
      ActionElement,

    observation:
      PageObservation,

    knowledge:
      | KnowledgeContext
      | undefined,
  ): string | null {
    const label =
      getActionLabel(
        action,
      );

    if (
      !/\bsearch\b/i.test(
        label,
      ) ||
      !knowledge
        ?.requirements ||
      !/\bsearch\b/i.test(
        knowledge.requirements
          .rawText,
      )
    ) {
      return null;
    }

    const currentValue =
      action.formField
        ?.value;

    if (
      typeof currentValue ===
        'string' &&
      currentValue.trim()
        .length >
        0
    ) {
      return null;
    }

    const actionChrome =
      this.normalize(
        observation.actions
          .map(
            (candidate) =>
              getActionLabel(
                candidate,
              ),
          )
          .join(
            ' ',
          ),
      );

    for (
      const row of
        this.observedDataRows(
          observation,
        )
    ) {
      const candidate =
        row[0]?.trim();

      if (
        !candidate ||
        candidate.length >
          80
      ) {
        continue;
      }

      const normalized =
        this.normalize(
          candidate,
        );

      if (
        normalized.length <
          2 ||
        actionChrome.includes(
          normalized,
        )
      ) {
        continue;
      }

      return candidate;
    }

    return null;
  }

  private observedFilterValue(
    action:
      ActionElement,

    observation:
      PageObservation,

    knowledge:
      | KnowledgeContext
      | undefined,
  ): string | null {
    const label =
      getActionLabel(
        action,
      );

    if (
      !/\bfilter\b/i.test(
        label,
      ) ||
      !knowledge
        ?.requirements ||
      !/\bfilter(?:ing|s|ed)?\b/i.test(
        knowledge.requirements
          .rawText,
      )
    ) {
      return null;
    }

    const options =
      action.formField
        ?.options
        ?.filter(
          (option) =>
            !option.disabled &&
            !option.selected &&
            option.value !==
              '',
        ) ??
      [];

    if (
      options.length ===
      0
    ) {
      return null;
    }

    const dataText =
      this.normalize(
        this.observedDataRows(
          observation,
        )
          .flat()
          .join(
            ' ',
          ),
      );

    const matching =
      options.find(
        (option) =>
          dataText.includes(
            this.normalize(
              option.label,
            ),
          ) ||
          dataText.includes(
            this.normalize(
              option.value,
            ),
          ),
      );

    return matching
      ?.value ??
      null;
  }

  private hasExplicitSensitiveValueEvidence(
    execution:
      ExplorationFormExecution | null,
  ): boolean {
    return (
      execution
        ?.evidence
        .some(
          (item) =>
            (
              item.source ===
                'openapi' &&
              /\b(?:example|default)\b/i
                .test(
                  item.detail,
                )
            ) ||
            (
              item.source ===
                'requirements' &&
              /\bother\s+than\b.*\b(?:rejected|invalid|not\s+allowed|forbidden)\b/i
                .test(
                  item.detail,
                )
            ),
        ) ??
      false
    );
  }

  private isUnfilledFormSetup(
    action:
      ActionElement,
  ): boolean {
    if (
      !this.requiresFormExecution(
        action,
      )
    ) {
      return false;
    }

    const value =
      action.formField
        ?.value;

    if (
      typeof value ===
      'string'
    ) {
      return (
        value.trim()
          .length ===
        0
      );
    }

    return (
      action.type ===
        'checkbox' ||
      action.type ===
        'radio'
    )
      ? false
      : true;
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

  private classifyHighImpactAction(
    value:
      string,
  ): {
    category:
      HighImpactActionRule['category'];

    description:
      string;
  } | null {
    for (
      const rule of
        HIGH_IMPACT_ACTION_RULES
    ) {
      if (
        rule.pattern.test(
          value,
        )
      ) {
        return {
          category:
            rule.category,

          description:
            rule.description,
        };
      }
    }

    return null;
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