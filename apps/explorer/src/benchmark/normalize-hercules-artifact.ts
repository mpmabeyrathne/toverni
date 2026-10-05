import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import {
  join,
  resolve,
} from 'node:path';

import {
  assessScenarioSupport,
  loadBenchmarkFixture,
} from './index.js';

import {
  extractGeneratedHerculesGherkin,
  normalizeHerculesScenarios,
  parseHerculesJUnitXml,
} from './hercules-normalizer.js';

async function readTextAutoEncoding(
  path: string,
): Promise<string> {
  const raw =
    await readFile(path);

  if (
    raw.length >= 2 &&
    raw[0] === 0xff &&
    raw[1] === 0xfe
  ) {
    return raw
      .subarray(2)
      .toString(
        'utf16le',
      );
  }

  if (
    raw.length >= 3 &&
    raw[0] === 0xef &&
    raw[1] === 0xbb &&
    raw[2] === 0xbf
  ) {
    return raw
      .subarray(3)
      .toString(
        'utf8',
      );
  }

  return raw.toString(
    'utf8',
  );
}

function parseSection(
  markdown: string,
  heading: string,
): string[] {
  const lines =
    markdown.split(
      /\r?\n/,
    );

  const start =
    lines.findIndex(
      (line) =>
        line.trim()
          .toLowerCase() ===
        '## ' +
          heading.toLowerCase(),
    );

  if (
    start < 0
  ) {
    return [];
  }

  const output:
    string[] = [];

  for (
    let index =
      start + 1;
    index <
      lines.length;
    index += 1
  ) {
    const line =
      lines[index] ?? '';

    if (
      /^##\s+/.test(line)
    ) {
      break;
    }

    const item =
      line.match(
        /^\s*-\s+(.+)$/,
      );

    if (
      item?.[1]
    ) {
      output.push(
        item[1].trim(),
      );
    }
  }

  return output;
}

async function main():
  Promise<void> {
  const fixtureId =
    process.argv[2];

  if (!fixtureId) {
    throw new Error(
      'Usage: tsx normalize-hercules-artifact.ts <fixtureId>',
    );
  }

  const explorerRoot =
    process.cwd();

  const repositoryRoot =
    resolve(
      explorerRoot,
      '..',
      '..',
    );

  const fixture =
    await loadBenchmarkFixture(
      join(
        repositoryRoot,
        'fixtures',
        'benchmark',
        fixtureId,
        'fixture.json',
      ),
    );

  const rawDirectory =
    join(
      explorerRoot,
      'artifacts',
      'competitive',
      'raw',
      'hercules',
      fixtureId,
    );

  const [
    herculesLog,
    junitXml,
    entryHtml,
  ] =
    await Promise.all([
      readTextAutoEncoding(
        join(
          rawDirectory,
          'hercules.stdout.txt',
        ),
      ),
      readTextAutoEncoding(
        join(
          rawDirectory,
          'hercules-result.xml',
        ),
      ),
      readFile(
        fixture.entryFile,
        'utf8',
      ),
    ]);

  const gherkin =
    extractGeneratedHerculesGherkin(
      herculesLog,
    );

  const runtimeStatuses =
    parseHerculesJUnitXml(
      junitXml,
    );

  if (
    runtimeStatuses.size === 0
  ) {
    throw new Error(
      'Hercules JUnit artifact contains no test cases.',
    );
  }

  const rawScenarios =
    normalizeHerculesScenarios({
      gherkin,
      runtimeStatuses,
      requirements: {
        acceptanceCriteria:
          parseSection(
            fixture.requirements,
            'Acceptance criteria',
          ),
        capabilities:
          parseSection(
            fixture.requirements,
            'Capabilities',
          ),
        constraints:
          parseSection(
            fixture.requirements,
            'Constraints',
          ),
      },
    });

  if (
    rawScenarios.length === 0
  ) {
    throw new Error(
      'Hercules generated no normalizable scenarios.',
    );
  }

  const scenarios =
    assessScenarioSupport(
      rawScenarios,
      [
        fixture.requirements,
        fixture.openApi,
        entryHtml,
      ].join('\n'),
    );

  const outputDirectory =
    join(
      explorerRoot,
      'artifacts',
      'competitive',
      'hercules',
    );

  await mkdir(
    outputDirectory,
    {
      recursive:
        true,
    },
  );

  const outputPath =
    join(
      outputDirectory,
      fixtureId +
        '.json',
    );

  await writeFile(
    outputPath,
    JSON.stringify(
      {
        fixtureId,
        scenarios,
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(
    JSON.stringify(
      {
        fixtureId,
        generatedScenarioCount:
          rawScenarios.length,
        runtimeScenarioCount:
          runtimeStatuses.size,
        normalizedScenarioCount:
          scenarios.length,
        outputPath,
      },
      null,
      2,
    ),
  );
}

await main();
