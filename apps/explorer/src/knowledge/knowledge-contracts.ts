import { z } from 'zod';

export const requirementContextSchema =
  z.object({
    sourcePath: z.string(),

    acceptanceCriteria:
      z.array(z.string()),

    userRoles:
      z.array(z.string()),

    capabilities:
      z.array(z.string()),

    constraints:
      z.array(z.string()),

    domainTerms:
      z.array(z.string()),

    rawText: z.string(),
  });

export const apiParameterSchema =
  z.object({
    name: z.string(),

    location: z.enum([
      'path',
      'query',
      'header',
      'cookie',
    ]),

    required:
      z.boolean(),

    schema:
      z.unknown().optional(),
  });

export const apiResponseSchema =
  z.object({
    status: z.string(),

    description:
      z.string(),

    contentTypes:
      z.array(z.string()),
  });

export const apiOperationSchema =
  z.object({
    operationId:
      z.string(),

    method:
      z.string(),

    path:
      z.string(),

    summary:
      z.string().optional(),

    parameters:
      z.array(
        apiParameterSchema,
      ),

    requestBody:
      z.unknown().optional(),

    responses:
      z.array(
        apiResponseSchema,
      ),

    security:
      z.array(
        z.string(),
      ),

    tags:
      z.array(
        z.string(),
      ),
  });

export const openApiContextSchema =
  z.object({
    sourcePath:
      z.string(),

    title:
      z.string(),

    version:
      z.string(),

    servers:
      z.array(
        z.string(),
      ),

    operations:
      z.array(
        apiOperationSchema,
      ),

    schemas:
      z.record(
        z.string(),
        z.unknown(),
      ),
  });

export const apiOperationLinkSchema =
  z.object({
    networkEventId:
      z.string(),

    method:
      z.string(),

    url:
      z.string(),

    operationId:
      z.string(),

    operationPath:
      z.string(),

    confidence:
      z.literal('exact'),

    reason:
      z.string(),
  });

export const knowledgeContextSchema =
  z.object({
    requirements:
      requirementContextSchema
        .nullable(),

    openApi:
      openApiContextSchema
        .nullable(),
  });

export type RequirementContext =
  z.infer<
    typeof requirementContextSchema
  >;

export type ApiOperation =
  z.infer<
    typeof apiOperationSchema
  >;

export type OpenApiContext =
  z.infer<
    typeof openApiContextSchema
  >;

export type ApiOperationLink =
  z.infer<
    typeof apiOperationLinkSchema
  >;

export type KnowledgeContext =
  z.infer<
    typeof knowledgeContextSchema
  >;