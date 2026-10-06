import type {
  BenchmarkScenario,
} from './benchmark-contracts.js';

export type HerculesRuntimeStatus =
  | 'not_run'
  | 'passed'
  | 'failed'
  | 'runtime_error';

export interface HerculesScenario {
  title: string;
  actions: string[];
  expectedOutcomes: string[];
  assertionCount: number;
}

interface RequirementEvidenceInput {
  acceptanceCriteria: string[];
  capabilities: string[];
  constraints: string[];
}

interface NormalizeHerculesInput {
  gherkin: string;
  runtimeStatuses: Map<string, HerculesRuntimeStatus>;
  requirements: RequirementEvidenceInput;
}

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'to',
  'of',
  'in',
  'on',
  'for',
  'and',
  'or',
  'with',
  'from',
  'is',
  'are',
  'be',
  'can',
  'should',
  'then',
  'customer',
  'scenario',
  'current',
  'existing',
  'visible',
  'displayed',
  'shows',
  'show',
]);

function normalizeToken(
  token: string,
): string {
  const lower = token
    .toLowerCase()
    .replace(
      /[^a-z0-9]/g,
      '',
    );

  if (
    lower.endsWith('ies') &&
    lower.length > 4
  ) {
    return lower.slice(0, -3) + 'y';
  }

  if (
    lower.endsWith('ing') &&
    lower.length > 5
  ) {
    return lower.slice(0, -3);
  }

  if (
    lower.endsWith('ed') &&
    lower.length > 4
  ) {
    return lower.slice(0, -2);
  }

  if (
    lower.endsWith('s') &&
    !lower.endsWith('ss') &&
    lower.length > 3
  ) {
    return lower.slice(0, -1);
  }

  return lower;
}

function tokens(
  value: string,
): Set<string> {
  return new Set(
    value
      .split(/\s+/)
      .map(normalizeToken)
      .filter(
        (token) =>
          token.length >= 3 &&
          !STOP_WORDS.has(token),
      ),
  );
}

function normalizeTitle(
  value: string,
): string {
  return [
    ...tokens(
      value.replace(
        /^scenario(?:\s+outline)?:\s*/i,
        '',
      ),
    ),
  ]
    .join(' ')
    .trim();
}

function stripCodeFence(
  value: string,
): string {
  return value
    .replace(
      /^\s*\u0060\u0060\u0060(?:gherkin)?\s*/i,
      '',
    )
    .replace(
      /\s*\u0060\u0060\u0060\s*$/,
      '',
    )
    .trim();
}

export function extractGeneratedHerculesGherkin(
  raw: string,
): string {
  const lines = raw.split(/\r?\n/);

  const candidates:
    string[] = [];

  for (
    let index = 0;
    index < lines.length;
    index += 1
  ) {
    if (
      !/^={20,}$/.test(
        (lines[index] ?? '').trim(),
      )
    ) {
      continue;
    }

    let end = -1;

    for (
      let candidateIndex = index + 1;
      candidateIndex < lines.length;
      candidateIndex += 1
    ) {
      if (
        /^={20,}$/.test(
          (
            lines[candidateIndex] ??
            ''
          ).trim(),
        )
      ) {
        end = candidateIndex;
        break;
      }
    }

    if (
      end <= index
    ) {
      continue;
    }

    const candidate =
      stripCodeFence(
        lines
          .slice(index + 1, end)
          .join('\n'),
      );

    if (
      /\bFeature\s*:/i.test(candidate) &&
      /\bScenario(?:\s+Outline)?\s*:/i.test(candidate)
    ) {
      candidates.push(candidate);
    }

    index = end;
  }

  if (
    candidates.length >
    0
  ) {
    return candidates[
      candidates.length - 1
    ] as string;
  }

  const fencedMatches =
    [
      ...raw.matchAll(
        /\u0060\u0060\u0060(?:gherkin)?\s*([\s\S]*?\bFeature\s*:[\s\S]*?\bScenario(?:\s+Outline)?\s*:[\s\S]*?)\u0060\u0060\u0060/gi,
      ),
    ];

  const lastFenced =
    fencedMatches[
      fencedMatches.length - 1
    ]?.[1];

  if (
    lastFenced
  ) {
    return lastFenced.trim();
  }

  throw new Error(
    'Hercules output does not contain a generated Gherkin feature.',
  );
}

export function parseHerculesFinalRuntimeStatus(
  raw: string,
): HerculesRuntimeStatus | null {
  /*
   * PowerShell can wrap Hercules stdout across physical lines, so the
   * serialized "Final message" object is not guaranteed to stay on one line.
   * Hercules may also emit the same is_passed value in planner debug output
   * immediately before the final message. Taking the last is_passed marker
   * preserves the final run result without depending on line boundaries.
   */
  const statusMatches =
    [
      ...raw.matchAll(
        /['"]is_passed['"]\s*:\s*(True|False|true|false)/g,
      ),
    ];

  const last =
    statusMatches[
      statusMatches.length - 1
    ]?.[1];

  if (
    last?.toLowerCase() ===
    'true'
  ) {
    return 'passed';
  }

  if (
    last?.toLowerCase() ===
    'false'
  ) {
    return 'failed';
  }

  return null;
}

export function parseHerculesGherkin(
  gherkin: string,
): HerculesScenario[] {
  const scenarios:
    HerculesScenario[] = [];

  let current:
    HerculesScenario | null =
      null;

  let assertionMode = false;

  const finishCurrent =
    (): void => {
      if (!current) {
        return;
      }

      scenarios.push(current);
      current = null;
      assertionMode = false;
    };

  for (
    const rawLine of
      stripCodeFence(gherkin)
        .split(/\r?\n/)
  ) {
    const scenario =
      rawLine.match(
        /^\s*Scenario(?:\s+Outline)?\s*:\s*(.+?)\s*$/i,
      );

    if (
      scenario?.[1]
    ) {
      finishCurrent();

      current = {
        title:
          scenario[1].trim(),
        actions: [],
        expectedOutcomes: [],
        assertionCount: 0,
      };

      continue;
    }

    if (!current) {
      continue;
    }

    const step =
      rawLine.match(
        /^\s*(Given|When|Then|And|But|\*)\s+(.+?)\s*$/i,
      );

    if (
      !step?.[1] ||
      !step[2]
    ) {
      continue;
    }

    const keyword =
      step[1].toLowerCase();

    const value =
      step[2].trim();

    if (
      keyword === 'then'
    ) {
      assertionMode = true;
      current
        .expectedOutcomes
        .push(value);
      current.assertionCount += 1;
      continue;
    }

    if (
      assertionMode &&
      (
        keyword === 'and' ||
        keyword === 'but' ||
        keyword === '*'
      )
    ) {
      current
        .expectedOutcomes
        .push(value);
      current.assertionCount += 1;
      continue;
    }

    current.actions.push(value);
  }

  finishCurrent();

  return scenarios;
}

function decodeXml(
  value: string,
): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function parseHerculesJUnitXml(
  xml: string,
): Map<
  string,
  HerculesRuntimeStatus
> {
  const statuses =
    new Map<
      string,
      HerculesRuntimeStatus
    >();

  const testcasePattern =
    /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/gi;

  let match:
    RegExpExecArray | null;

  while (
    (
      match =
        testcasePattern.exec(xml)
    ) !== null
  ) {
    const attributes =
      match[1] ?? '';

    const body =
      match[2] ?? '';

    const name =
      attributes.match(
        /\bname=(["'])(.*?)\1/i,
      )?.[2];

    if (!name) {
      continue;
    }

    let status:
      HerculesRuntimeStatus =
        'passed';

    if (
      /<error\b/i.test(body)
    ) {
      status = 'runtime_error';
    } else if (
      /<failure\b/i.test(body)
    ) {
      status = 'failed';
    } else if (
      /<skipped\b/i.test(body)
    ) {
      status = 'not_run';
    }

    statuses.set(
      normalizeTitle(
        decodeXml(name),
      ),
      status,
    );
  }

  return statuses;
}

function evidenceReferences(
  scenario:
    HerculesScenario,
  requirements:
    RequirementEvidenceInput,
): string[] {
  const scenarioTokens =
    tokens(
      [
        scenario.title,
        ...scenario.actions,
        ...scenario
          .expectedOutcomes,
      ].join(' '),
    );

  const references:
    string[] = [];

  const collect =
    (
      prefix:
        'REQ' |
        'CAP' |
        'CON',
      values:
        string[],
    ): void => {
      values.forEach(
        (
          value,
          index,
        ) => {
          const evidenceTokens =
            tokens(value);

          const overlap =
            [
              ...evidenceTokens,
            ].filter(
              (token) =>
                scenarioTokens
                  .has(token),
            ).length;

          if (
            overlap >= 2 ||
            (
              evidenceTokens.size === 1 &&
              overlap === 1
            )
          ) {
            references.push(
              prefix +
                '-' +
                String(
                  index + 1,
                ),
            );
          }
        },
      );
    };

  collect(
    'REQ',
    requirements
      .acceptanceCriteria,
  );

  collect(
    'CAP',
    requirements
      .capabilities,
  );

  collect(
    'CON',
    requirements
      .constraints,
  );

  return [
    ...new Set(references),
  ];
}

export function normalizeHerculesScenarios(
  input:
    NormalizeHerculesInput,
): BenchmarkScenario[] {
  const parsed =
    parseHerculesGherkin(
      input.gherkin,
    );

  const singleRuntimeStatus =
    input.runtimeStatuses.size === 1
      ? [
          ...input
            .runtimeStatuses
            .values(),
        ][0]
      : undefined;

  return parsed.map(
    (scenario) => {
      const matched =
        input.runtimeStatuses
          .get(
            normalizeTitle(
              scenario.title,
            ),
          );

      const runtimeStatus =
        matched ??
        (
          parsed.length === 1
            ? singleRuntimeStatus
            : undefined
        ) ??
        'not_run';

      const executable =
        runtimeStatus !==
        'not_run';

      return {
        title:
          scenario.title,
        actions:
          scenario.actions,
        expectedOutcomes:
          scenario
            .expectedOutcomes,
        executable,
        runtimeStatus,
        evidenceReferences:
          evidenceReferences(
            scenario,
            input.requirements,
          ),
        unsupportedSteps: [],
        humanEditsRequired:
          runtimeStatus === 'passed'
            ? 0
            : 1,
        assertionCount:
          scenario
            .assertionCount,
      };
    },
  );
}
