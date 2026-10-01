import {
  z,
} from 'zod';

export const testPlanTargetSchema =
  z.discriminatedUnion(
    'by',
    [
      z.object({
        by:
          z.literal(
            'role',
          ),

        role:
          z.string()
            .min(1),

        name:
          z.string()
            .optional(),

        exact:
          z.boolean()
            .optional(),
      }),

      z.object({
        by:
          z.literal(
            'label',
          ),

        label:
          z.string()
            .min(1),

        exact:
          z.boolean()
            .optional(),
      }),

      z.object({
        by:
          z.literal(
            'text',
          ),

        text:
          z.string()
            .min(1),

        exact:
          z.boolean()
            .optional(),
      }),

      z.object({
        by:
          z.literal(
            'testId',
          ),

        value:
          z.string()
            .min(1),
      }),

      z.object({
        by:
          z.literal(
            'css',
          ),

        selector:
          z.string()
            .min(1),
      }),
    ],
  );

export const testPlanStepOperationSchema =
  z.discriminatedUnion(
    'kind',
    [
      z.object({
        kind:
          z.literal(
            'click',
          ),

        target:
          testPlanTargetSchema,
      }),
    ],
  );

export const testPlanAssertionMatcherSchema =
  z.enum([
    'url',
    'visible',
    'hidden',
    'enabled',
    'disabled',
    'count',
    'value',
  ]);

export const testPlanAssertionTargetSchema =
  z.discriminatedUnion(
    'kind',
    [
      z.object({
        kind:
          z.literal(
            'page',
          ),
      }),

      z.object({
        kind:
          z.literal(
            'locator',
          ),

        target:
          testPlanTargetSchema,
      }),
    ],
  );

export const testPlanStepSchema =
  z.object({
    actionId:
      z.string()
        .min(1),

    description:
      z.string()
        .min(1),

    operation:
      testPlanStepOperationSchema,

    evidenceReference:
      z.string()
        .min(1),
  });

export const testPlanAssertionSchema =
  z.object({
    afterActionId:
      z.string()
        .min(1),

    kind:
      z.enum([
        'url',
        'text',
        'visibility',
        'enabled',
        'disabled',
        'count',
        'value',
      ]),

    description:
      z.string()
        .min(1),

    target:
      testPlanAssertionTargetSchema,

    matcher:
      testPlanAssertionMatcherSchema,

    expected:
      z.union([
        z.string(),
        z.number(),
      ])
        .optional(),

    evidenceReferences:
      z.array(
        z.string(),
      )
        .min(1),
  });

export const testPlanMetadataSchema =
  z.object({
    irVersion:
      z.literal(
        '1',
      ),

    generator:
      z.literal(
        'toverni',
      ),
  });

export const testPlanIrSchema =
  z.object({
    scenarioId:
      z.string()
        .min(1),

    title:
      z.string()
        .min(1),

    status:
      z.enum([
        'ready',
        'manual_required',
      ]),

    reason:
      z.string()
        .nullable(),

    steps:
      z.array(
        testPlanStepSchema,
      ),

    assertions:
      z.array(
        testPlanAssertionSchema,
      ),

    evidenceReferences:
      z.array(
        z.string(),
      ),

    metadata:
      testPlanMetadataSchema,
  });

export type TestPlanTarget =
  z.infer<
    typeof testPlanTargetSchema
  >;

export type TestPlanStepOperation =
  z.infer<
    typeof testPlanStepOperationSchema
  >;

export type TestPlanAssertionMatcher =
  z.infer<
    typeof testPlanAssertionMatcherSchema
  >;

export type TestPlanAssertionTarget =
  z.infer<
    typeof testPlanAssertionTargetSchema
  >;

export type TestPlanStep =
  z.infer<
    typeof testPlanStepSchema
  >;

export type TestPlanAssertion =
  z.infer<
    typeof testPlanAssertionSchema
  >;

export type TestPlanIr =
  z.infer<
    typeof testPlanIrSchema
  >;
