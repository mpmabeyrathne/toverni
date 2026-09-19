import type {
    KnowledgeContext,
  } from '../knowledge/index.js';
  
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