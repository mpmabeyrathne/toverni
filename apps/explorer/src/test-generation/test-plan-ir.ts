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

      z.object({
        kind:
          z.literal(
            'fill',
          ),

        target:
          testPlanTargetSchema,

        value:
          z.string(),
      }),

      z.object({
        kind:
          z.literal(
            'select',
          ),

        target:
          testPlanTargetSchema,

        value:
          z.string(),
      }),

      z.object({
        kind:
          z.literal(
            'set-checked',
          ),

        target:
          testPlanTargetSchema,

        checked:
          z.boolean(),
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
  })
    .superRefine(
      (
        assertion,
        context,
      ) => {
        if (
          assertion.matcher ===
          'url'
        ) {
          if (
            assertion.target.kind !==
              'page' ||
            typeof assertion.expected !==
              'string'
          ) {
            context.addIssue({
              code:
                'custom',

              message:
                'URL assertions require a page target and string expected value.',
            });
          }

          return;
        }

        if (
          assertion.target.kind !==
          'locator'
        ) {
          context.addIssue({
            code:
              'custom',

            message:
              'Non-URL assertions require a locator target.',
          });
        }

        if (
          assertion.matcher ===
            'count' &&
          typeof assertion.expected !==
            'number'
        ) {
          context.addIssue({
            code:
              'custom',

            message:
              'Count assertions require a numeric expected value.',
          });
        }

        if (
          assertion.matcher ===
            'value' &&
          typeof assertion.expected !==
            'string'
        ) {
          context.addIssue({
            code:
              'custom',

            message:
              'Value assertions require a string expected value.',
          });
        }
      },
    );

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
