import {
  access,
  readFile,
} from 'node:fs/promises';

import {
  join,
  resolve,
} from 'node:path';

const PLAYWRIGHT_CONFIG_FILES =
  [
    'playwright.config.ts',
    'playwright.config.js',
    'playwright.config.mts',
    'playwright.config.mjs',
    'playwright.config.cts',
    'playwright.config.cjs',
  ] as const;

const PLAYWRIGHT_PACKAGES =
  [
    '@playwright/test',
    'playwright',
  ] as const;

export interface ResolvePlaywrightProjectOutputInput {
  workingDirectory:
    string;

  explicitOutputDirectory?:
    string;
}

export interface PlaywrightProjectOutput {
  workingDirectory:
    string;

  outputDirectory:
    string;

  projectDetected:
    boolean;

  configPath:
    string | null;

  bootstrapCommand:
    string | null;
}

async function fileExists(
  path:
    string,
): Promise<boolean> {
  try {
    await access(
      path,
    );

    return true;
  } catch {
    return false;
  }
}

async function findPlaywrightConfig(
  workingDirectory:
    string,
): Promise<string | null> {
  for (
    const fileName of
      PLAYWRIGHT_CONFIG_FILES
  ) {
    const candidate =
      join(
        workingDirectory,
        fileName,
      );

    if (
      await fileExists(
        candidate,
      )
    ) {
      return candidate;
    }
  }

  return null;
}

async function packageUsesPlaywright(
  workingDirectory:
    string,
): Promise<boolean> {
  const packageJsonPath =
    join(
      workingDirectory,
      'package.json',
    );

  if (
    !await fileExists(
      packageJsonPath,
    )
  ) {
    return false;
  }

  try {
    const parsed =
      JSON.parse(
        await readFile(
          packageJsonPath,
          'utf8',
        ),
      ) as {
        dependencies?:
          Record<
            string,
            string
          >;

        devDependencies?:
          Record<
            string,
            string
          >;
      };

    return PLAYWRIGHT_PACKAGES
      .some(
        (packageName) =>
          packageName in
            (
              parsed
                .dependencies ??
              {}
            ) ||
          packageName in
            (
              parsed
                .devDependencies ??
              {}
            ),
      );
  } catch {
    return false;
  }
}

export async function resolvePlaywrightProjectOutput(
  input:
    ResolvePlaywrightProjectOutputInput,
): Promise<
  PlaywrightProjectOutput
> {
  const workingDirectory =
    resolve(
      input.workingDirectory,
    );

  const configPath =
    await findPlaywrightConfig(
      workingDirectory,
    );

  const projectDetected =
    configPath !==
      null ||
    await packageUsesPlaywright(
      workingDirectory,
    );

  const outputDirectory =
    input.explicitOutputDirectory
      ? resolve(
          workingDirectory,
          input.explicitOutputDirectory,
        )
      : projectDetected
        ? join(
            workingDirectory,
            'tests',
            'toverni',
          )
        : join(
            workingDirectory,
            'artifacts',
            'generated-tests',
          );

  return {
    workingDirectory,
    outputDirectory,
    projectDetected,
    configPath,

    bootstrapCommand:
      projectDetected
        ? null
        : 'npm init playwright@latest',
  };
}
