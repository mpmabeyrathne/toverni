import {
  resolve,
} from 'node:path';

import {
  fileURLToPath,
} from 'node:url';

import {
  config,
} from 'dotenv';

import {
  z,
} from 'zod';

const rootEnvPath =
  fileURLToPath(
    new URL(
      '../../../../.env',
      import.meta.url,
    ),
  );

config({
  path:
    rootEnvPath,

  override:
    true,
});

const databaseUrlSchema =
  z.string()
    .min(
      1,
      'DATABASE_URL cannot be empty',
    )
    .refine(
      (value) =>
        value.startsWith(
          'postgresql://',
        ) ||
        value.startsWith(
          'postgres://',
        ),
      {
        message:
          'DATABASE_URL must be a PostgreSQL connection string',
      },
    );

export type DatabaseConfiguration =
  | {
      kind:
        'postgres';

      databaseUrl:
        string;
    }
  | {
      kind:
        'local';

      dataDirectory:
        string;

      migrationsDirectory:
        string;
    };

function resolveLocalDataDirectory():
string {
  const configured =
    process.env
      .TOVERNI_DATA_DIR
      ?.trim();

  return configured
    ? resolve(
        process.cwd(),
        configured,
      )
    : resolve(
        process.cwd(),
        '.toverni',
        'db',
      );
}

function resolveMigrationsDirectory():
string {
  const configured =
    process.env
      .TOVERNI_MIGRATIONS_DIR
      ?.trim();

  if (
    configured
  ) {
    return resolve(
      process.cwd(),
      configured,
    );
  }

  return fileURLToPath(
    new URL(
      '../../../../drizzle/',
      import.meta.url,
    ),
  );
}

export function getDatabaseConfiguration():
DatabaseConfiguration {
  const databaseUrl =
    process.env
      .DATABASE_URL
      ?.trim();

  if (
    databaseUrl
  ) {
    return {
      kind:
        'postgres',

      databaseUrl:
        databaseUrlSchema.parse(
          databaseUrl,
        ),
    };
  }

  return {
    kind:
      'local',

    dataDirectory:
      resolveLocalDataDirectory(),

    migrationsDirectory:
      resolveMigrationsDirectory(),
  };
}
