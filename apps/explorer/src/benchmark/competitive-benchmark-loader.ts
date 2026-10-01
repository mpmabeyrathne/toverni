import {
  readFile,
} from 'node:fs/promises';

import {
  z,
} from 'zod';

import {
  benchmarkScenarioSchema,
} from './benchmark-contracts.js';

import type {
  CompetitiveToolFixtureOutput,
  CompetitiveToolMetadata,
} from './competitive-benchmark-contracts.js';

const competitiveToolMetadataSchema =
  z.object({
    id:
      z.string().min(1),

    name:
      z.string().min(1),

    category:
      z.enum([
        'toverni',
        'generic_llm',
        'ai_agent',
        'framework_agent',
      ]),

    version:
      z.string().min(1),

    source:
      z.string().min(1),

    inputProtocol:
      z.string().min(1),

    executionBudget:
      z.string().min(1),

    notes:
      z.array(
        z.string(),
      ),
  });

const competitiveToolFixtureOutputSchema =
  z.object({
    fixtureId:
      z.string().min(1),

    scenarios:
      z.array(
        benchmarkScenarioSchema,
      ),
  });

export async function loadCompetitiveToolMetadata(
  path:
    string,
): Promise<
  CompetitiveToolMetadata[]
> {
  const raw =
    await readFile(
      path,
      'utf8',
    );

  return z
    .array(
      competitiveToolMetadataSchema,
    )
    .parse(
      JSON.parse(
        raw,
      ),
    );
}

export async function loadCompetitiveToolFixtureOutput(
  path:
    string,
): Promise<
  CompetitiveToolFixtureOutput
> {
  const raw =
    await readFile(
      path,
      'utf8',
    );

  return competitiveToolFixtureOutputSchema
    .parse(
      JSON.parse(
        raw,
      ),
    );
}
