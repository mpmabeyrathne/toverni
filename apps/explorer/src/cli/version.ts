import {
  readFile,
} from 'node:fs/promises';

export async function getPackageVersion():
Promise<string> {
  const packageJsonUrl =
    new URL(
      '../../package.json',
      import.meta.url,
    );

  const source =
    await readFile(
      packageJsonUrl,
      'utf8',
    );

  const parsed =
    JSON.parse(
      source,
    ) as {
      version?:
        unknown;
    };

  if (
    typeof parsed.version !==
      'string' ||
    parsed.version.length ===
      0
  ) {
    throw new Error(
      'Unable to resolve Toverni package version.',
    );
  }

  return parsed.version;
}
