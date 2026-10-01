import {
  z,
} from 'zod';

import {
  testPlanAssertionSchema,
  testPlanIrSchema,
  testPlanStepSchema,
} from './test-plan-ir.js';

export const executableTestStatusSchema =
  z.enum([
    'ready',
    'manual_required',
  ]);

export const executableAssertionKindSchema =
  z.enum([
    'url',
    'text',
    'visibility',
    'enabled',
    'disabled',
    'count',
    'value',
  ]);

export const executableAssertionSchema =
  testPlanAssertionSchema;

export const executableStepSchema =
  testPlanStepSchema;

export const executableTestPlanSchema =
  testPlanIrSchema;

export type ExecutableTestStatus =
  z.infer<
    typeof executableTestStatusSchema
  >;

export type ExecutableAssertionKind =
  z.infer<
    typeof executableAssertionKindSchema
  >;

export type ExecutableAssertion =
  z.infer<
    typeof executableAssertionSchema
  >;

export type ExecutableStep =
  z.infer<
    typeof executableStepSchema
  >;

export type ExecutableTestPlan =
  z.infer<
    typeof executableTestPlanSchema
  >;

export const executableTestRunStatusSchema =
  z.enum([
    'passed',
    'failed',
  ]);

export const executableTestRunResultSchema =
  z.object({
    status:
      executableTestRunStatusSchema,

    exitCode:
      z.number(),

    durationMs:
      z.number()
        .nonnegative(),

    stdout:
      z.string(),

    stderr:
      z.string(),

    error:
      z.string()
        .nullable(),
  });

export type ExecutableTestRunStatus =
  z.infer<
    typeof executableTestRunStatusSchema
  >;

export type ExecutableTestRunResult =
  z.infer<
    typeof executableTestRunResultSchema
  >;
