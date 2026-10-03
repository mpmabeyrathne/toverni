import type {
    KnowledgeContext,
  } from '../knowledge/index.js';

  import type {
    GroundedBusinessBehavior,
  } from '../flows/grounded-business-behavior.js';

  import type {
    ScenarioEvidence,
  } from './scenario-contracts.js';
  
  interface ApplicationFlow {
    states:
      Array<{
        id: string;
        routePattern: string;
      }>;
  
    actions:
      Array<{
        id: string;
        label:
          string | null;
        type:
          string;

        blocked?:
          boolean;
      }>;
  
    transitions:
      Array<{
        id: string;
        fromStateId:
          string;
        toStateId:
          string;
      }>;
  }
  
  function pushUnique(
    catalog:
      ScenarioEvidence[],
  
    evidence:
      ScenarioEvidence,
  ): void {
    if (
      catalog.some(
        (item) =>
          item.id ===
          evidence.id,
      )
    ) {
      return;
    }
  
    catalog.push(
      evidence,
    );
  }
  
export function buildEvidenceCatalog(
  knowledge:
    KnowledgeContext,

  flow:
    ApplicationFlow,

  businessBehaviors:
    GroundedBusinessBehavior[] =
      [],
): ScenarioEvidence[] {
    const catalog:
      ScenarioEvidence[] = [];
  
    // --------------------------------
    // Requirements
    // --------------------------------
  
    knowledge.requirements
      ?.acceptanceCriteria
      .forEach(
        (
          criterion,
          index,
        ) => {
          pushUnique(
            catalog,
            {
              id:
                `REQ-${index + 1}`,
  
              type:
                'requirement',
  
              description:
                criterion,
  
              source:
                knowledge.requirements
                  ?.sourcePath ??
                'requirements',
            },
          );
        },
      );
  
    // --------------------------------
    // Capabilities
    // --------------------------------
  
    knowledge.requirements
      ?.capabilities
      .forEach(
        (
          capability,
          index,
        ) => {
          pushUnique(
            catalog,
            {
              id:
                `CAP-${index + 1}`,
  
              type:
                'capability',
  
              description:
                capability,
  
              source:
                knowledge.requirements
                  ?.sourcePath ??
                'requirements',
            },
          );
        },
      );
  
    // --------------------------------
    // Constraints
    // --------------------------------
  
    knowledge.requirements
      ?.constraints
      .forEach(
        (
          constraint,
          index,
        ) => {
          pushUnique(
            catalog,
            {
              id:
                `CON-${index + 1}`,
  
              type:
                'constraint',
  
              description:
                constraint,
  
              source:
                knowledge.requirements
                  ?.sourcePath ??
                'requirements',
            },
          );
        },
      );
  
    // --------------------------------
    // Application states
    // --------------------------------
  
    flow.states.forEach(
      (
        state,
        index,
      ) => {
        pushUnique(
          catalog,
          {
            id:
              `STATE-${index + 1}`,
  
            type:
              'state',
  
            description:
              `Discovered application state at route ${state.routePattern}`,
  
            source:
              state.id,
          },
        );
      },
    );
  
    // --------------------------------
    // Discovered actions
    // --------------------------------
  
    flow.actions.forEach(
      (
        action,
        index,
      ) => {
        if (
          action.blocked
        ) {
          return;
        }

        pushUnique(
          catalog,
          {
            id:
              `ACTION-${index + 1}`,
  
            type:
              'action',
  
            description:
              `${action.type}: ${action.label ?? 'unnamed action'}`,
  
            source:
              action.id,
          },
        );
      },
    );
  
    // --------------------------------
    // Transitions
    // --------------------------------
  
    flow.transitions.forEach(
      (
        transition,
        index,
      ) => {
        pushUnique(
          catalog,
          {
            id:
              `FLOW-${index + 1}`,
  
            type:
              'transition',
  
            description:
              [
                'Observed transition from',
                transition.fromStateId,
                'to',
                transition.toStateId,
              ].join(' '),
  
            source:
              transition.id,
          },
        );
      },
    );

    // --------------------------------
// Reconstructed business flows
// --------------------------------

businessBehaviors.forEach(
  (
    behavior,
    index,
  ) => {
    const actionSequence =
      behavior.steps
        .map(
          (step) => {
            const target =
              step.action.target
                ? ` ${step.action.target}`
                : '';

            return `${step.action.type}${target}`;
          },
        )
        .join(
          ' -> ',
        );

    const transitionSequence =
      behavior.transitionIds
        .join(
          ' -> ',
        );

    const stateSequence =
      behavior.stateIds
        .join(
          ' -> ',
        );

    const preconditions =
      behavior
        .preconditionTransitionIds
        .length >
      0
        ? behavior
            .preconditionTransitionIds
            .join(
              ' -> ',
            )
        : 'none';

    const requirements =
      behavior
        .requirementEvidenceIds
        .length >
      0
        ? behavior
            .requirementEvidenceIds
            .join(
              ', ',
            )
        : 'none';

    const apiOperations =
      behavior
        .apiOperationIds
        .length >
      0
        ? behavior
            .apiOperationIds
            .join(
              ', ',
            )
        : 'none';

    pushUnique(
      catalog,
      {
        id:
          `FLOW-BUSINESS-${index + 1}`,

        type:
          'transition',

        description:
          [
            `Business flow: ${behavior.name}.`,

            `Actions: ${actionSequence}.`,

            `Ordered states: ${stateSequence}.`,

            `Ordered transitions: ${transitionSequence}.`,

            `Reusable preconditions: ${preconditions}.`,

            `Linked requirements: ${requirements}.`,

            `Linked API operations: ${apiOperations}.`,

            `Outcome state: ${behavior.outcome.stateId}.`,

            `Complete: ${behavior.complete}.`,
          ].join(
            ' ',
          ),

        source:
          behavior.id,

        linkedEvidenceReferences:
          behavior
            .requirementEvidenceIds,
      },
    );
  },
);
  
    // --------------------------------
    // OpenAPI operations
    // --------------------------------
  
    knowledge.openApi
      ?.operations
      .forEach(
        (
          operation,
          index,
        ) => {
          pushUnique(
            catalog,
            {
              id:
                `API-${index + 1}`,
  
              type:
                'api-operation',
  
              description:
                [
                  operation.method,
                  operation.path,
                  `(${operation.operationId})`,
                ].join(' '),
  
              source:
                knowledge.openApi
                  ?.sourcePath ??
                'openapi',
            },
          );
        },
      );
  
    return catalog;
  }