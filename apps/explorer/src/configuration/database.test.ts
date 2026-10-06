import {
  join,
} from 'node:path';

import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  resolveDatabaseConfiguration,
} from './database.js';

describe(
  'resolveDatabaseConfiguration',
  () => {
    it(
      'defaults to durable local storage without DATABASE_URL',
      () => {
        const cwd =
          process.cwd();

        const result =
          resolveDatabaseConfiguration({
            cwd,
          });

        expect(
          result.kind,
        ).toBe(
          'local',
        );

        if (
          result.kind !==
          'local'
        ) {
          return;
        }

        expect(
          result.dataDirectory,
        ).toBe(
          join(
            cwd,
            '.toverni',
            'db',
          ),
        );

        expect(
          result.migrationsDirectory,
        ).toContain(
          'drizzle',
        );
      },
    );

    it(
      'preserves external PostgreSQL when DATABASE_URL is supplied',
      () => {
        expect(
          resolveDatabaseConfiguration({
            cwd:
              process.cwd(),

            databaseUrl:
              'postgresql://user:pass@127.0.0.1:5432/toverni',
          }),
        ).toEqual({
          kind:
            'postgres',

          databaseUrl:
            'postgresql://user:pass@127.0.0.1:5432/toverni',
        });
      },
    );

    it(
      'resolves an explicit local data directory from the current project',
      () => {
        const cwd =
          process.cwd();

        const result =
          resolveDatabaseConfiguration({
            cwd,

            dataDirectory:
              './custom-state',
          });

        expect(
          result.kind,
        ).toBe(
          'local',
        );

        if (
          result.kind !==
          'local'
        ) {
          return;
        }

        expect(
          result.dataDirectory,
        ).toBe(
          join(
            cwd,
            'custom-state',
          ),
        );
      },
    );

    it(
      'ignores a blank DATABASE_URL and remains local',
      () => {
        const result =
          resolveDatabaseConfiguration({
            cwd:
              process.cwd(),

            databaseUrl:
              '   ',
          });

        expect(
          result.kind,
        ).toBe(
          'local',
        );
      },
    );
  },
);
