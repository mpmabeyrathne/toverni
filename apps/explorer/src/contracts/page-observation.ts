import { z } from 'zod';

export const actionElementSchema = z.object({
  type: z.enum([
    'link',
    'button',
    'input',
    'select',
    'textarea',
    'form',
    'menu',
    'dialog',
    'checkbox',
    'radio',
  ]),

  tagName: z.string(),

  role: z.string().optional(),

  name: z.string().optional(),

  text: z.string().optional(),

  href: z.string().optional(),

  inputType: z.string().optional(),

  testId: z.string().optional(),

  disabled: z.boolean(),

  visible: z.boolean(),
});

export const consoleEventSchema = z.object({
  type: z.enum([
    'warning',
    'error',
  ]),

  text: z.string(),

  timestamp: z.string(),
});

export const networkEventSchema = z.object({
  id: z.string(),

  method: z.string(),

  url: z.string(),

  resourceType: z.string(),

  status: z.number().optional(),

  ok: z.boolean().optional(),

  failed: z.boolean(),

  failureText: z.string().optional(),
});

export const supportingArtifactSchema =
  z.object({
    type: z.enum([
      'screenshot',
      'trace',
    ]),

    path: z.string(),
  });

export const pageObservationSchema =
  z.object({
    capturedAt: z.string(),

    url: z.string(),

    title: z.string(),

    semanticText: z.array(
      z.string(),
    ),

    ariaSnapshot: z.string(),

    actions: z.array(
      actionElementSchema,
    ),

    consoleEvents: z.array(
      consoleEventSchema,
    ),

    networkEvents: z.array(
      networkEventSchema,
    ),

    supportingArtifacts:
      z.array(
        supportingArtifactSchema,
      ),
  });

export type ActionElement =
  z.infer<
    typeof actionElementSchema
  >;

export type ConsoleEvent =
  z.infer<
    typeof consoleEventSchema
  >;

export type NetworkEvent =
  z.infer<
    typeof networkEventSchema
  >;

export type SupportingArtifact =
  z.infer<
    typeof supportingArtifactSchema
  >;

export type PageObservation =
  z.infer<
    typeof pageObservationSchema
  >;