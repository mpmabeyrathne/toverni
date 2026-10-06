import {
  mkdtemp,
  rm,
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
  resolveDatabaseConfiguration,
} from '../configuration/database.js';

import {
  createDatabase,
} from './database.js';

import {
  ExplorationRepository,
} from './exploration-repository.js';

const temporaryDirectories:
  string[] = [];

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
  'embedded local persistence',
  () => {
    it(
      'survives close/reopen and supports run resume',
      async () => {
        const root =
          await mkdtemp(
            join(
              tmpdir(),
              'toverni-pglite-',
            ),
          );

        temporaryDirectories.push(
          root,
        );

        const configuration =
          resolveDatabaseConfiguration({
            cwd:
              root,
          });

        expect(
          configuration.kind,
        ).toBe(
          'local',
        );

        const first =
          await createDatabase(
            configuration,
          );

        const firstRepository =
          new ExplorationRepository(
            first.db,
          );

        const application =
          await firstRepository
            .ensureApplication({
              name:
                'Example',

              baseUrl:
                'http://example.test',
            });

        const run =
          await firstRepository
            .startRun({
              applicationId:
                application.id,

              entryUrl:
                'http://example.test',
            });

        await firstRepository
          .completeRun(
            run.id,
            'failed',
          );

        await first.close();

        const second =
          await createDatabase(
            configuration,
          );

        const secondRepository =
          new ExplorationRepository(
            second.db,
          );

        const persisted =
          await secondRepository
            .getRun(
              run.id,
            );

        expect(
          persisted,
        ).toMatchObject({
          id:
            run.id,

          applicationId:
            application.id,

          entryUrl:
            'http://example.test',

          status:
            'failed',
        });

        const resumed =
          await secondRepository
            .resumeRun(
              run.id,
            );

        expect(
          resumed.status,
        ).toBe(
          'running',
        );

        expect(
          resumed.completedAt,
        ).toBeNull();

        await second.close();
      },
      30_000,
    );
  },
);
