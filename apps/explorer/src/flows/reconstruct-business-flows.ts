import {
    createHash,
  } from 'node:crypto';
  
  import type {
    ApplicationStateNode,
    ApplicationTransition,
  } from '../state/application-state.js';
  
  import {
    reconstructedBusinessFlowSchema,
    type BusinessFlowStep,
    type BusinessFlowTermination,
    type ReconstructedBusinessFlow,
  } from './business-flow.js';
  
  const DEFAULT_MAX_DEPTH =
    25;
  
  export interface ReconstructBusinessFlowsInput {
    states:
      ApplicationStateNode[];
  
    transitions:
      ApplicationTransition[];
  
    maxDepth?:
      number;
  }
  
  export function reconstructBusinessFlows(
    input:
      ReconstructBusinessFlowsInput,
  ): ReconstructedBusinessFlow[] {
    const maxDepth =
      input.maxDepth ??
      DEFAULT_MAX_DEPTH;
  
    if (
      !Number.isInteger(
        maxDepth,
      ) ||
      maxDepth <= 0
    ) {
      throw new Error(
        'maxDepth must be a positive integer',
      );
    }
  
    const stateById =
      new Map(
        input.states.map(
          (state) => [
            state.id,
            state,
          ],
        ),
      );
  
    // Equivalent/duplicate transitions are
    // exploration artifacts rather than
    // meaningful business-flow movement.
    const transitions =
  [
    ...input.transitions,
  ].sort(
    compareTransitions,
  );
  
    const outgoing =
      new Map<
        string,
        ApplicationTransition[]
      >();
  
    const incomingCount =
      new Map<
        string,
        number
      >();
  
    for (
      const transition of
      transitions
    ) {
      const existing =
        outgoing.get(
          transition.fromStateId,
        ) ?? [];
  
      existing.push(
        transition,
      );
  
      outgoing.set(
        transition.fromStateId,
        existing,
      );
  
      incomingCount.set(
        transition.toStateId,
        (
          incomingCount.get(
            transition.toStateId,
          ) ?? 0
        ) + 1,
      );
    }
  
    for (
      const values of
      outgoing.values()
    ) {
      values.sort(
        compareTransitions,
      );
    }
  
    const flows:
      ReconstructedBusinessFlow[] = [];
  
    const flowKeys =
      new Set<string>();
  
    const coveredTransitionIds =
      new Set<string>();
  
    const emitFlow = (
      stateIds:
        string[],
  
      pathTransitions:
        ApplicationTransition[],
  
      steps:
        BusinessFlowStep[],
  
      termination:
        BusinessFlowTermination,
    ): void => {
      if (
        pathTransitions.length ===
        0
      ) {
        return;
      }
  
      const transitionIds =
        pathTransitions.map(
          (transition) =>
            transition.id,
        );
  
      const key =
        JSON.stringify({
          stateIds,
          transitionIds,
          termination,
        });
  
      if (
        flowKeys.has(
          key,
        )
      ) {
        return;
      }
  
      flowKeys.add(
        key,
      );
  
      for (
        const transitionId of
        transitionIds
      ) {
        coveredTransitionIds.add(
          transitionId,
        );
      }
  
      const startStateId =
        stateIds[0];
  
      const endStateId =
        stateIds[
          stateIds.length - 1
        ];
  
      if (
        !startStateId ||
        !endStateId
      ) {
        return;
      }
  
      flows.push(
        reconstructedBusinessFlowSchema.parse({
          id:
            createFlowId(
              stateIds,
              transitionIds,
            ),
  
          startStateId,
  
          endStateId,
  
          stateIds,
  
          transitionIds,
  
          steps,
  
          complete:
            termination ===
            'terminal-state',
  
          termination,
        }),
      );
    };
  
    const walk = (
      currentStateId:
        string,
  
      stateIds:
        string[],
  
      pathTransitions:
        ApplicationTransition[],
  
      steps:
        BusinessFlowStep[],
    ): void => {
      const nextTransitions =
        outgoing.get(
          currentStateId,
        ) ?? [];
  
      if (
        nextTransitions.length ===
        0
      ) {
        emitFlow(
          stateIds,
          pathTransitions,
          steps,
          'terminal-state',
        );
  
        return;
      }
  
      if (
        pathTransitions.length >=
        maxDepth
      ) {
        emitFlow(
          stateIds,
          pathTransitions,
          steps,
          'max-depth',
        );
  
        return;
      }
  
      for (
        const transition of
        nextTransitions
      ) {
        const nextStateIds = [
          ...stateIds,
          transition.toStateId,
        ];
  
        const nextTransitionsPath = [
          ...pathTransitions,
          transition,
        ];
  
        const nextSteps = [
          ...steps,
          {
            transitionId:
              transition.id,
  
            fromStateId:
              transition.fromStateId,
  
            toStateId:
              transition.toStateId,
  
            action:
              transition.action,
          },
        ];
  
        if (
          !stateById.has(
            transition.toStateId,
          )
        ) {
          emitFlow(
            nextStateIds,
            nextTransitionsPath,
            nextSteps,
            'missing-state',
          );
  
          continue;
        }
  
        if (
          stateIds.includes(
            transition.toStateId,
          )
        ) {
          emitFlow(
            nextStateIds,
            nextTransitionsPath,
            nextSteps,
            'cycle',
          );
  
          continue;
        }
  
        walk(
          transition.toStateId,
          nextStateIds,
          nextTransitionsPath,
          nextSteps,
        );
      }
    };
  
    const sourceStateIds = [
      ...outgoing.keys(),
    ].sort();
  
    const rootStateIds =
      sourceStateIds.filter(
        (stateId) =>
          (
            incomingCount.get(
              stateId,
            ) ?? 0
          ) === 0,
      );
  
    // First reconstruct ordinary
    // root-to-terminal/branch paths.
    for (
      const stateId of
      rootStateIds
    ) {
      if (
        !stateById.has(
          stateId,
        )
      ) {
        continue;
      }
  
      walk(
        stateId,
        [
          stateId,
        ],
        [],
        [],
      );
    }
  
    // Pure cycles have no zero-indegree
    // root. Start one deterministic walk
    // for any component not already
    // covered above.
    for (
      const stateId of
      sourceStateIds
    ) {
      const remaining =
        (
          outgoing.get(
            stateId,
          ) ?? []
        ).some(
          (transition) =>
            !coveredTransitionIds.has(
              transition.id,
            ),
        );
  
      if (
        !remaining ||
        !stateById.has(
          stateId,
        )
      ) {
        continue;
      }
  
      walk(
        stateId,
        [
          stateId,
        ],
        [],
        [],
      );
    }
  
    return flows.sort(
      (first, second) =>
        first.startStateId.localeCompare(
          second.startStateId,
        ) ||
        first.transitionIds
          .join(':')
          .localeCompare(
            second.transitionIds
              .join(':'),
          ),
    );
  }
  
  function compareTransitions(
    first:
      ApplicationTransition,
  
    second:
      ApplicationTransition,
  ): number {
    return (
      first.occurredAt.localeCompare(
        second.occurredAt,
      ) ||
      first.id.localeCompare(
        second.id,
      )
    );
  }
  
  function createFlowId(
    stateIds:
      string[],
  
    transitionIds:
      string[],
  ): string {
    const hash =
      createHash(
        'sha256',
      )
        .update(
          JSON.stringify({
            stateIds,
            transitionIds,
          }),
        )
        .digest(
          'hex',
        )
        .slice(
          0,
          24,
        );
  
    return `flow-${hash}`;
  }