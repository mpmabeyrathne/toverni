import {
    z,
  } from 'zod';
  
  export const executableTestStatusSchema =
    z.enum([
      'ready',
      'manual_required',
    ]);
  
  export const executableStepSchema =
    z.object({
      actionId:
        z.string(),
  
      description:
        z.string(),
  
      playwright:
        z.string(),
  
      evidenceReference:
        z.string(),
    });
  
  export const executableTestPlanSchema =
    z.object({
      scenarioId:
        z.string(),
  
      title:
        z.string(),
  
      status:
        executableTestStatusSchema,
  
      reason:
        z.string()
          .nullable(),
  
      steps:
        z.array(
          executableStepSchema,
        ),
  
      evidenceReferences:
        z.array(
          z.string(),
        ),
    });
  
  export type ExecutableTestStatus =
    z.infer<
      typeof executableTestStatusSchema
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