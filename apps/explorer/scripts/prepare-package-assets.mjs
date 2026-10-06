import {
  cp,
  rm,
} from 'node:fs/promises';

import {
  dirname,
  resolve,
} from 'node:path';

import {
  fileURLToPath,
} from 'node:url';

const scriptDirectory =
  dirname(
    fileURLToPath(
      import.meta.url,
    ),
  );

const packageRoot =
  resolve(
    scriptDirectory,
    '..',
  );

const source =
  resolve(
    packageRoot,
    '..',
    '..',
    'drizzle',
  );

const destination =
  resolve(
    packageRoot,
    'drizzle',
  );

await rm(
  destination,
  {
    recursive:
      true,

    force:
      true,
  },
);

await cp(
  source,
  destination,
  {
    recursive:
      true,
  },
);
