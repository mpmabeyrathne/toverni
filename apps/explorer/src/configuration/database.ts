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

export interface ResolveDatabaseConfigurationInput {
  databaseUrl?:
    string | undefined;

  dataDirectory?:
    string | undefined;

  migrationsDirectory?:
    string | undefined;

  cwd:
    string;
}

function nonEmpty(
  value:
    string | undefined,
): string | undefined {
  const trimmed =
    value?.trim();

  return trimmed
    ? trimmed
    : undefined;
}

export function resolveDatabaseConfiguration(
  input:
    ResolveDatabaseConfigurationInput,
): DatabaseConfiguration {
  const databaseUrl =
    nonEmpty(
      input.databaseUrl,
    );

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

  const dataDirectory =
    resolve(
      input.cwd,
      nonEmpty(
        input.dataDirectory,
      ) ??
        '.toverni/db',
    );

  const migrationsDirectory =
    nonEmpty(
      input.migrationsDirectory,
    )
      ? resolve(
          input.cwd,
          input.migrationsDirectory!,
        )
      : fileURLToPath(
          new URL(
            '../../../../drizzle/',
            import.meta.url,
          ),
        );

  return {
    kind:
      'local',

    dataDirectory,

    migrationsDirectory,
  };
}

export function getDatabaseConfiguration():
DatabaseConfiguration {
  return resolveDatabaseConfiguration({
    databaseUrl:
      process.env
        .DATABASE_URL,

    dataDirectory:
      process.env
        .TOVERNI_DATA_DIR,

    migrationsDirectory:
      process.env
        .TOVERNI_MIGRATIONS_DIR,

    cwd:
      process.cwd(),
  });
}
