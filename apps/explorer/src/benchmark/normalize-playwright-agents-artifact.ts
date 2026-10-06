import {
  readFile,
  readdir,
  writeFile,
  mkdir,
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
  extractGeneratedPlaywrightTests,
  normalizePlaywrightAgentsScenarios,
  parsePlaywrightJsonReport,
} from './playwright-agents-normalizer.js';

async function readTextAutoEncoding(
  path:
    string,
): Promise<string> {
  const raw =
    await readFile(
      path,
    );

  if (
    raw.length >=
      2 &&
    raw[0] ===
      0xff &&
    raw[1] ===
      0xfe
  ) {
    return raw
      .subarray(
        2,
      )
      .toString(
        'utf16le',
      );
  }

  if (
    raw.length >=
      3 &&
    raw[0] ===
      0xef &&
    raw[1] ===
      0xbb &&
    raw[2] ===
      0xbf
  ) {
    return raw
      .subarray(
        3,
      )
      .toString(
        'utf8',
      );
  }

  return raw.toString(
    'utf8',
  );
}

function parseSection(
  markdown:
    string,

  heading:
    string,
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
    start <
    0
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
      lines[index] ??
      '';

    if (
      /^##\s+/.test(
        line,
      )
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

async function collectSpecFiles(
  directory:
    string,
): Promise<string[]> {
  const output:
    string[] = [];

  async function visit(
    current:
      string,
  ): Promise<void> {
    let entries;

    try {
      entries =
        await readdir(
          current,
          {
            withFileTypes:
              true,
          },
        );
    } catch {
      return;
    }

    for (
      const entry of
        entries
    ) {
      const path =
        join(
          current,
          entry.name,
        );

      if (
        entry.isDirectory()
      ) {
        await visit(
          path,
        );

        continue;
      }

      if (
        entry.isFile() &&
        entry.name.endsWith(
          '.spec.ts',
        )
      ) {
        output.push(
          path,
        );
      }
    }
  }

  await visit(
    directory,
  );

  return output.sort();
}

async function main():
  Promise<void> {
  const fixtureId =
    process.argv[2];

  if (!fixtureId) {
    throw new Error(
      'Usage: tsx normalize-playwright-agents-artifact.ts <fixtureId>',
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

  const planPath =
    join(
      explorerRoot,
      'specs',
      'competitive',
      fixtureId +
        '.md',
    );

  const testsDirectory =
    join(
      explorerRoot,
      'tests',
      'competitive',
      fixtureId,
    );

  const reportPath =
    join(
      explorerRoot,
      'artifacts',
      'competitive',
      'raw',
      'playwright_agents',
      fixtureId,
      'playwright-report.json',
    );

  const [
    plannerMarkdown,
    runtimeRaw,
    entryHtml,
  ] =
    await Promise.all([
      readFile(
        planPath,
        'utf8',
      ),

      readTextAutoEncoding(
        reportPath,
      ),

      readFile(
        fixture.entryFile,
        'utf8',
      ),
    ]);

  const specFiles =
    await collectSpecFiles(
      testsDirectory,
    );

  const generatedTests =
    (
      await Promise.all(
        specFiles.map(
          async (
            path,
          ) =>
            extractGeneratedPlaywrightTests(
              path,
              await readFile(
                path,
                'utf8',
              ),
            ),
        ),
      )
    ).flat();

  const runtimeStatuses =
    parsePlaywrightJsonReport(
      runtimeRaw,
    );

  const rawScenarios =
    normalizePlaywrightAgentsScenarios({
      plannerMarkdown,
      generatedTests,
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

  const scenarios =
    assessScenarioSupport(
      rawScenarios,
      [
        fixture.requirements,
        fixture.openApi,
        entryHtml,
      ].join(
        '\n',
      ),
    );

  const outputDirectory =
    join(
      explorerRoot,
      'artifacts',
      'competitive',
      'playwright_agents',
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
        plannerScenarioCount:
          rawScenarios.length,
        generatedTestCount:
          generatedTests.length,
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
