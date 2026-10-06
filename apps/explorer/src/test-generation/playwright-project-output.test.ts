import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';

import {
  tmpdir,
} from 'node:os';

import {
  join,
} from 'node:path';

import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  resolvePlaywrightProjectOutput,
} from './playwright-project-output.js';

const temporaryDirectories:
  string[] = [];

async function createTemporaryDirectory():
Promise<string> {
  const directory =
    await mkdtemp(
      join(
        tmpdir(),
        'toverni-playwright-output-',
      ),
    );

  temporaryDirectories.push(
    directory,
  );

  return directory;
}

afterEach(
  async () => {
    await Promise.all(
      temporaryDirectories
        .splice(
          0,
        )
        .map(
          (directory) =>
            rm(
              directory,
              {
                recursive:
                  true,

                force:
                  true,
              },
            ),
        ),
    );
  },
);

describe(
  'resolvePlaywrightProjectOutput',
  () => {
    it(
      'places generated specs under tests/toverni when a Playwright config exists',
      async () => {
        const workingDirectory =
          await createTemporaryDirectory();

        await writeFile(
          join(
            workingDirectory,
            'playwright.config.ts',
          ),
          'export default {};',
          'utf8',
        );

        const result =
          await resolvePlaywrightProjectOutput({
            workingDirectory,
          });

        expect(
          result,
        ).toEqual({
          workingDirectory,
          outputDirectory:
            join(
              workingDirectory,
              'tests',
              'toverni',
            ),
          projectDetected:
            true,
          configPath:
            join(
              workingDirectory,
              'playwright.config.ts',
            ),
          bootstrapCommand:
            null,
        });
      },
    );

    it(
      'detects Playwright from package.json even without a config file',
      async () => {
        const workingDirectory =
          await createTemporaryDirectory();

        await writeFile(
          join(
            workingDirectory,
            'package.json',
          ),
          JSON.stringify({
            devDependencies: {
              '@playwright/test':
                '^1.63.0',
            },
          }),
          'utf8',
        );

        const result =
          await resolvePlaywrightProjectOutput({
            workingDirectory,
          });

        expect(
          result.projectDetected,
        ).toBe(
          true,
        );

        expect(
          result.outputDirectory,
        ).toBe(
          join(
            workingDirectory,
            'tests',
            'toverni',
          ),
        );
      },
    );

    it(
      'lets an explicit output directory win over project defaults',
      async () => {
        const workingDirectory =
          await createTemporaryDirectory();

        await writeFile(
          join(
            workingDirectory,
            'playwright.config.js',
          ),
          'module.exports = {};',
          'utf8',
        );

        const result =
          await resolvePlaywrightProjectOutput({
            workingDirectory,

            explicitOutputDirectory:
              './custom/specs',
          });

        expect(
          result.outputDirectory,
        ).toBe(
          join(
            workingDirectory,
            'custom',
            'specs',
          ),
        );
      },
    );

    it(
      'keeps generation available without Playwright and provides a bootstrap command',
      async () => {
        const workingDirectory =
          await createTemporaryDirectory();

        const result =
          await resolvePlaywrightProjectOutput({
            workingDirectory,
          });

        expect(
          result.projectDetected,
        ).toBe(
          false,
        );

        expect(
          result.outputDirectory,
        ).toBe(
          join(
            workingDirectory,
            'artifacts',
            'generated-tests',
          ),
        );

        expect(
          result.bootstrapCommand,
        ).toBe(
          'npm init playwright@latest',
        );
      },
    );
  },
);
