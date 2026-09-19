import type {
    BrowserTarget,
  } from '../browser/index.js';
  
  import type {
    ExecutableTestPlan,
  } from './executable-test-contracts.js';
  
  import {
    renderPlaywrightLocator,
  } from './playwright-locator-renderer.js';
  
  interface StoredScenario {
    id: string;
    title: string;
    evidenceReferences:
      string[];
  }
  
  interface StoredAction {
    id: string;
    label: string;
    type: string;
    target:
      BrowserTarget | null;
  }
  
  interface EvidenceItem {
    id: string;
    type: string;
    source: string;
  }
  
  export interface CreateExecutablePlanInput {
    scenario:
      StoredScenario;
  
    evidence:
      EvidenceItem[];
  
    actions:
      StoredAction[];
  }
  
  function actionCommand(
    action:
      StoredAction,
  ): string | null {
    if (
      action.target === null
    ) {
      return null;
    }
  
    const locator =
      renderPlaywrightLocator(
        action.target,
      );
  
    switch (
      action.type
    ) {
      case 'button':
      case 'link':
        return `${locator}.click();`;
  
      default:
        return null;
    }
  }
  
  export function createExecutableTestPlan(
    input:
      CreateExecutablePlanInput,
  ): ExecutableTestPlan {
    const evidenceMap =
      new Map(
        input.evidence.map(
          (item) => [
            item.id,
            item,
          ],
        ),
      );
  
    const actionsMap =
      new Map(
        input.actions.map(
          (action) => [
            action.id,
            action,
          ],
        ),
      );
  
    const executableSteps:
      ExecutableTestPlan['steps'] =
        [];
  
    const seenCommands =
      new Set<string>();
  
    for (
      const evidenceReference of
        input.scenario
          .evidenceReferences
    ) {
      const evidence =
        evidenceMap.get(
          evidenceReference,
        );
  
      if (
        !evidence ||
        evidence.type !==
          'action'
      ) {
        continue;
      }
  
      const action =
        actionsMap.get(
          evidence.source,
        );
  
      if (
        !action
      ) {
        continue;
      }
  
      const playwright =
        actionCommand(
          action,
        );
  
      if (
        playwright === null
      ) {
        continue;
      }
  
      if (
        seenCommands.has(
          playwright,
        )
      ) {
        continue;
      }
  
      seenCommands.add(
        playwright,
      );
  
      executableSteps.push({
        actionId:
          action.id,
  
        description:
          action.label,
  
        playwright,
  
        evidenceReference,
      });
    }
  
    if (
      executableSteps.length ===
      0
    ) {
      return {
        scenarioId:
          input.scenario.id,
  
        title:
          input.scenario.title,
  
        status:
          'manual_required',
  
        reason:
          'No executable discovered browser actions support this scenario.',
  
        steps: [],
  
        evidenceReferences:
          input.scenario
            .evidenceReferences,
      };
    }
  
    return {
      scenarioId:
        input.scenario.id,
  
      title:
        input.scenario.title,
  
      status:
        'ready',
  
      reason:
        null,
  
      steps:
        executableSteps,
  
      evidenceReferences:
        input.scenario
          .evidenceReferences,
    };
  }