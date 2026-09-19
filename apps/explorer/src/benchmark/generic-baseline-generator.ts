import {
    z,
  } from 'zod';
  
  import {
    Agent,
    fetch,
  } from 'undici';
  
  import type {
    BenchmarkScenario,
  } from './benchmark-contracts.js';
  
  const genericBaselineOutputSchema =
    z.object({
      scenarios:
        z.array(
          z.object({
            title:
              z.string()
                .min(1),
  
            actions:
              z.array(
                z.string(),
              )
                .min(1),
  
            expectedOutcomes:
              z.array(
                z.string(),
              )
                .min(1),
          }),
        ),
    });
  
  interface GenericBaselineOptions {
    baseUrl:
      string;
  
    model:
      string;
  }
  
  export interface GenerateGenericBaselineInput {
    targetUrl:
      string;
  
    requirements:
      string;
  
    openApi:
      string;
  
    initialPageContext:
      string;
  }
  
  export class GenericBaselineGenerator {
    private readonly dispatcher =
      new Agent({
        headersTimeout:
          600_000,
  
        bodyTimeout:
          600_000,
  
        connectTimeout:
          30_000,
      });
  
    constructor(
      private readonly options:
        GenericBaselineOptions,
    ) {}
  
    async generate(
      input:
        GenerateGenericBaselineInput,
    ): Promise<
      BenchmarkScenario[]
    > {
      const baseUrl =
        this.options
          .baseUrl
          .replace(
            /\/+$/,
            '',
          );
  
      const response =
        await fetch(
          `${baseUrl}/api/chat`,
          {
            method:
              'POST',
  
            dispatcher:
              this.dispatcher,
  
            headers: {
              'content-type':
                'application/json',
            },
  
            body:
              JSON.stringify({
                model:
                  this.options.model,
  
                stream:
                  false,
  
                messages: [
                  {
                    role:
                      'system',
  
                    content:
                      [
                        'You are a QA engineer.',
                        'Generate useful test scenarios from the supplied product information.',
                        'Return only valid JSON.',
                      ].join(' '),
                  },
  
                  {
                    role:
                      'user',
  
                    content:
                      [
                        `Target URL: ${input.targetUrl}`,
                        '',
                        'Requirements:',
                        input.requirements,
                        '',
                        'OpenAPI:',
                        input.openApi,
                        '',
                        'Initial page context:',
                        input.initialPageContext,
                      ].join('\n'),
                  },
                ],
  
                format:
                  z.toJSONSchema(
                    genericBaselineOutputSchema,
                  ),
  
                options: {
                  temperature:
                    0,
                },
              }),
          },
        );
  
      if (
        !response.ok
      ) {
        const body =
          await response.text();
  
        throw new Error(
          `Generic baseline failed with status ${response.status}: ${body}`,
        );
      }
  
      const raw =
        await response.json() as {
          message?: {
            content?: string;
          };
        };
  
      const content =
        raw.message?.content;
  
      if (
        !content
      ) {
        throw new Error(
          'Generic baseline returned no content.',
        );
      }
  
      const parsed =
        genericBaselineOutputSchema
          .parse(
            JSON.parse(
              content,
            ),
          );
  
      return parsed.scenarios.map(
        (
          scenario,
        ): BenchmarkScenario => ({
          title:
            scenario.title,
  
          actions:
            scenario.actions,
  
          expectedOutcomes:
            scenario
              .expectedOutcomes,
  
          executable:
            false,
  
          evidenceReferences: [],
  
          unsupportedSteps: [],
  
          humanEditsRequired:
            0,
        }),
      );
    }
  }