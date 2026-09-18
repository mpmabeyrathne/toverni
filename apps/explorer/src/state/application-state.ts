import { z } from 'zod';

import {
  consoleEventSchema,
  networkEventSchema,
  pageObservationSchema,
} from '../contracts/page-observation.js';

export const transitionActionSchema =
  z.object({
    type: z.enum([
      'navigate',
      'click',
      'fill',
      'select',
      'submit',
      'back',
      'forward',
      'reload',
    ]),

    target:
      z.string().optional(),

    value:
      z.string().optional(),
  });

export const transitionEvidenceSchema =
  z.object({
    networkEvents:
      z.array(
        networkEventSchema,
      ),

    consoleEvents:
      z.array(
        consoleEventSchema,
      ),
  });

export const applicationStateNodeSchema =
  z.object({
    id: z.string(),

    fingerprint: z.string(),

    routePattern: z.string(),

    url: z.string(),

    title: z.string(),

    firstSeenAt: z.string(),

    lastSeenAt: z.string(),

    visits:
      z.number().int().positive(),

    observation:
      pageObservationSchema,
  });

export const applicationTransitionSchema =
  z.object({
    id: z.string(),

    fromStateId: z.string(),

    toStateId: z.string(),

    action:
      transitionActionSchema,

    occurredAt: z.string(),

    equivalentState:
      z.boolean(),

    explorationBlocked:
      z.boolean(),

    beforeObservation:
      pageObservationSchema,

    afterObservation:
      pageObservationSchema,

    evidence:
      transitionEvidenceSchema,
  });

export type TransitionAction =
  z.infer<
    typeof transitionActionSchema
  >;

export type TransitionEvidence =
  z.infer<
    typeof transitionEvidenceSchema
  >;

export type ApplicationStateNode =
  z.infer<
    typeof applicationStateNodeSchema
  >;

export type ApplicationTransition =
  z.infer<
    typeof applicationTransitionSchema
  >;