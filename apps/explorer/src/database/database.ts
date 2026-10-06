import {
  mkdir,
} from 'node:fs/promises';

import {
  PGlite,
} from '@electric-sql/pglite';

import {
  drizzle as drizzleNodePostgres,
} from 'drizzle-orm/node-postgres';

import {
  drizzle as drizzlePglite,
} from 'drizzle-orm/pglite';

import {
  migrate,
} from 'drizzle-orm/pglite/migrator';

import {
  Pool,
} from 'pg';

import type {
  DatabaseConfiguration,
} from '../configuration/database.js';

import * as schema from './schema.js';

function createPostgresDatabase(
  databaseUrl:
    string,
) {
  const pool =
    new Pool({
      connectionString:
        databaseUrl,
    });

  const db =
    drizzleNodePostgres(
      pool,
      {
        schema,
      },
    );

  return {
    kind:
      'postgres' as const,

    db,

    async close():
    Promise<void> {
      await pool.end();
    },
  };
}

async function createLocalDatabase(
  dataDirectory:
    string,

  migrationsDirectory:
    string,
) {
  await mkdir(
    dataDirectory,
    {
      recursive:
        true,
    },
  );

  const client =
    new PGlite(
      dataDirectory,
    );

  const localDb =
    drizzlePglite(
      client,
      {
        schema,
      },
    );

  await migrate(
    localDb,
    {
      migrationsFolder:
        migrationsDirectory,
    },
  );

  return {
    kind:
      'local' as const,

    db:
      localDb as unknown as
        Database,

    dataDirectory,

    async close():
    Promise<void> {
      await client.close();
    },
  };
}

export async function createDatabase(
  configuration:
    DatabaseConfiguration,
) {
  if (
    configuration.kind ===
    'postgres'
  ) {
    return createPostgresDatabase(
      configuration.databaseUrl,
    );
  }

  return createLocalDatabase(
    configuration.dataDirectory,
    configuration.migrationsDirectory,
  );
}

type PostgresDatabase =
  ReturnType<
    typeof createPostgresDatabase
  >['db'];

export type Database =
  PostgresDatabase;
