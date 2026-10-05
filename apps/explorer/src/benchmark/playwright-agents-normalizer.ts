import {
  basename,
} from 'node:path';

import type {
  BenchmarkScenario,
} from './benchmark-contracts.js';

export interface PlannerScenario {
  title: string;
  filePath:
    | string
    | null;
  actions: string[];
  expectedOutcomes: string[];
}

export interface GeneratedPlaywrightTest {
  title: string;
  filePath: string;
  assertionCount: number;
}

export type PlaywrightRuntimeStatus =
  | 'not_run'
  | 'passed'
  | 'failed'
  | 'runtime_error';

interface PlaywrightJsonResult {
  status?:
    string;
}

interface PlaywrightJsonTest {
  results?:
    PlaywrightJsonResult[];
}

interface PlaywrightJsonSpec {
  title?:
    string;
  file?:
    string;
  tests?:
    PlaywrightJsonTest[];
}

interface PlaywrightJsonSuite {
  suites?:
    PlaywrightJsonSuite[];
  specs?:
    PlaywrightJsonSpec[];
}

interface PlaywrightJsonReport {
  suites?:
    PlaywrightJsonSuite[];
}

interface RequirementEvidenceInput {
  acceptanceCriteria:
    string[];
  capabilities:
    string[];
  constraints:
    string[];
}

interface NormalizePlaywrightAgentsInput {
  plannerMarkdown:
    string;

  generatedTests:
    GeneratedPlaywrightTest[];

  runtimeStatuses:
    Map<
      string,
      PlaywrightRuntimeStatus
    >;

  requirements:
    RequirementEvidenceInput;
}

const STOP_WORDS =
  new Set([
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
  token:
    string,
): string {
  const lower =
    token
      .toLowerCase()
      .replace(
        /[^a-z0-9]/g,
        '',
      );

  if (
    lower.endsWith(
      'ies',
    ) &&
    lower.length >
      4
  ) {
    return `${lower.slice(
      0,
      -3,
    )}y`;
  }

  if (
    lower.endsWith(
      'ing',
    ) &&
    lower.length >
      5
  ) {
    return lower.slice(
      0,
      -3,
    );
  }

  if (
    lower.endsWith(
      'ed',
    ) &&
    lower.length >
      4
  ) {
    return lower.slice(
      0,
      -2,
    );
  }

  if (
    lower.endsWith(
      's',
    ) &&
    !lower.endsWith(
      'ss',
    ) &&
    lower.length >
      3
  ) {
    return lower.slice(
      0,
      -1,
    );
  }

  return lower;
}

function tokens(
  value:
    string,
): Set<string> {
  return new Set(
    value
      .split(
        /\s+/,
      )
      .map(
        normalizeToken,
      )
      .filter(
        (token) =>
          token.length >=
            3 &&
          !STOP_WORDS.has(
            token,
          ),
      ),
  );
}

function normalizeTitle(
  value:
    string,
): string {
  return [
    ...tokens(
      value,
    ),
  ]
    .join(' ')
    .trim();
}

function isInteractionStep(
  value:
    string,
): boolean {
  return /\b(?:click|enter|fill|type|select|choose|upload|search|leave|clear|navigate|open|submit|retry|cancel|book|attempt|reload|press|check|toggle)\b/i
    .test(
      value,
    );
}

export function parsePlaywrightPlannerMarkdown(
  markdown:
    string,
): PlannerScenario[] {
  const scenarios:
    PlannerScenario[] = [];

  let current:
    PlannerScenario | null =
      null;

  const finishCurrent =
    (): void => {
      if (!current) {
        return;
      }

      scenarios.push(
        current,
      );

      current = null;
    };

  for (
    const rawLine of
      markdown.split(
        /\r?\n/,
      )
  ) {
    const heading =
      rawLine.match(
        /^####\s+\d+(?:\.\d+)*\.\s+(.+)$/,
      );

    if (heading) {
      finishCurrent();

      current = {
        title:
          heading[1]
            ?.trim() ??
          '',

        filePath:
          null,

        actions: [],

        expectedOutcomes: [],
      };

      continue;
    }

    if (!current) {
      continue;
    }

    const file =
      rawLine.match(
        /^\*\*File:\*\*\s+`?(.+?)`?\s*$/,
      );

    if (file) {
      current.filePath =
        file[1]
          ?.trim() ??
        null;

      continue;
    }

    const step =
      rawLine.match(
        /^\s*\d+\.\s+(.+)$/,
      );

    if (
      step &&
      step[1] &&
      isInteractionStep(
        step[1],
      )
    ) {
      current.actions.push(
        step[1].trim(),
      );

      continue;
    }

    const outcome =
      rawLine.match(
        /^\s*-\s+expect:\s+(.+)$/i,
      );

    if (
      outcome &&
      outcome[1]
    ) {
      current
        .expectedOutcomes
        .push(
          outcome[1]
            .trim(),
        );
    }
  }

  finishCurrent();

  return scenarios.filter(
    (scenario) =>
      scenario.title
        .length >
      0,
  );
}

export function extractGeneratedPlaywrightTests(
  filePath:
    string,

  source:
    string,
): GeneratedPlaywrightTest[] {
  const tests:
    GeneratedPlaywrightTest[] =
      [];

  const titlePattern =
    /\btest\s*\(\s*(['"`])([\s\S]*?)\1\s*,/g;

  const assertionCount =
    (
      source.match(
        /\bexpect\s*\(/g,
      ) ??
      []
    ).length;

  let match:
    RegExpExecArray | null;

  while (
    (
      match =
        titlePattern.exec(
          source,
        )
    ) !==
    null
  ) {
    const title =
      match[2]
        ?.trim();

    if (!title) {
      continue;
    }

    tests.push({
      title,

      filePath,

      assertionCount,
    });
  }

  return tests;
}

function collectJsonSpecs(
  suites:
    PlaywrightJsonSuite[],

  output:
    PlaywrightJsonSpec[],
): void {
  for (
    const suite of
      suites
  ) {
    output.push(
      ...(
        suite.specs ??
        []
      ),
    );

    collectJsonSpecs(
      suite.suites ??
        [],
      output,
    );
  }
}

function mapPlaywrightStatus(
  spec:
    PlaywrightJsonSpec,
): PlaywrightRuntimeStatus {
  const statuses =
    (
      spec.tests ??
      []
    )
      .flatMap(
        (test) =>
          test.results ??
          [],
      )
      .map(
        (result) =>
          result.status ??
          '',
      );

  if (
    statuses.some(
      (status) =>
        status ===
          'failed' ||
        status ===
          'timedOut' ||
        status ===
          'interrupted',
    )
  ) {
    return 'failed';
  }

  if (
    statuses.some(
      (status) =>
        status ===
        'passed',
    )
  ) {
    return 'passed';
  }

  if (
    statuses.length >
    0
  ) {
    return 'runtime_error';
  }

  return 'not_run';
}

function extractFirstJsonObject(
  raw:
    string,
): string {
  const start =
    raw.indexOf(
      '{',
    );

  if (
    start <
    0
  ) {
    throw new Error(
      'Playwright reporter output does not contain a JSON object.',
    );
  }

  let depth =
    0;

  let inString =
    false;

  let escaped =
    false;

  for (
    let index =
      start;
    index <
      raw.length;
    index += 1
  ) {
    const character =
      raw[index];

    if (
      inString
    ) {
      if (
        escaped
      ) {
        escaped =
          false;

        continue;
      }

      if (
        character ===
        '\\'
      ) {
        escaped =
          true;

        continue;
      }

      if (
        character ===
        '"'
      ) {
        inString =
          false;
      }

      continue;
    }

    if (
      character ===
      '"'
    ) {
      inString =
        true;

      continue;
    }

    if (
      character ===
      '{'
    ) {
      depth +=
        1;

      continue;
    }

    if (
      character !==
      '}'
    ) {
      continue;
    }

    depth -=
      1;

    if (
      depth ===
      0
    ) {
      return raw.slice(
        start,
        index + 1,
      );
    }
  }

  throw new Error(
    'Playwright reporter output contains an incomplete JSON object.',
  );
}

export function parsePlaywrightJsonReport(
  raw:
    string,
): Map<
  string,
  PlaywrightRuntimeStatus
> {
  const report =
    JSON.parse(
      extractFirstJsonObject(
        raw,
      ),
    ) as
      PlaywrightJsonReport;

  const specs:
    PlaywrightJsonSpec[] =
      [];

  collectJsonSpecs(
    report.suites ??
      [],
    specs,
  );

  const statuses =
    new Map<
      string,
      PlaywrightRuntimeStatus
    >();

  for (
    const spec of
      specs
  ) {
    if (!spec.title) {
      continue;
    }

    statuses.set(
      normalizeTitle(
        spec.title,
      ),
      mapPlaywrightStatus(
        spec,
      ),
    );
  }

  return statuses;
}

function evidenceReferences(
  scenario:
    PlannerScenario,

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
            tokens(
              value,
            );

          const overlap =
            [
              ...evidenceTokens,
            ].filter(
              (token) =>
                scenarioTokens
                  .has(
                    token,
                  ),
            ).length;

          if (
            overlap >=
              2 ||
            (
              evidenceTokens.size ===
                1 &&
              overlap ===
                1
            )
          ) {
            references.push(
              `${prefix}-${index + 1}`,
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
    ...new Set(
      references,
    ),
  ];
}

function generatedTestForScenario(
  scenario:
    PlannerScenario,

  generatedTests:
    GeneratedPlaywrightTest[],
): GeneratedPlaywrightTest | null {
  const normalizedTitle =
    normalizeTitle(
      scenario.title,
    );

  const byTitle =
    generatedTests.find(
      (test) =>
        normalizeTitle(
          test.title,
        ) ===
        normalizedTitle,
    );

  if (byTitle) {
    return byTitle;
  }

  if (
    scenario.filePath
  ) {
    const expectedFile =
      basename(
        scenario.filePath,
      );

    const byFile =
      generatedTests.find(
        (test) =>
          basename(
            test.filePath,
          ) ===
          expectedFile,
      );

    if (byFile) {
      return byFile;
    }
  }

  return null;
}

export function normalizePlaywrightAgentsScenarios(
  input:
    NormalizePlaywrightAgentsInput,
): BenchmarkScenario[] {
  const plannerScenarios =
    parsePlaywrightPlannerMarkdown(
      input.plannerMarkdown,
    );

  return plannerScenarios.map(
    (scenario) => {
      const generatedTest =
        generatedTestForScenario(
          scenario,
          input.generatedTests,
        );

      const executable =
        generatedTest !==
        null;

      const runtimeStatus =
        generatedTest
          ? input.runtimeStatuses
              .get(
                normalizeTitle(
                  generatedTest.title,
                ),
              ) ??
            'not_run'
          : 'not_run';

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
          executable &&
          runtimeStatus ===
            'passed'
            ? 0
            : 1,

        assertionCount:
          generatedTest
            ?.assertionCount ??
          0,
      };
    },
  );
}
