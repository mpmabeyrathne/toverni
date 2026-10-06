import {
  access,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';

import {
  tmpdir,
} from 'node:os';

import {
  dirname,
  join,
  resolve,
} from 'node:path';

import {
  fileURLToPath,
  pathToFileURL,
} from 'node:url';

import {
  execFileSync,
  execSync,
} from 'node:child_process';

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

const npmCommand =
  process.platform ===
    'win32'
    ? 'npm.cmd'
    : 'npm';

function quoteWindowsArgument(
  value,
) {
  const text =
    String(
      value,
    );

  if (
    !/[\s"&|<>^]/.test(
      text,
    )
  ) {
    return text;
  }

  return `"${text.replaceAll(
    '"',
    '""',
  )}"`;
}

function runNpm(
  args,
  options = {},
) {
  if (
    process.platform ===
      'win32'
  ) {
    const commandLine =
      [
        npmCommand,
        ...args.map(
          quoteWindowsArgument,
        ),
      ].join(
        ' ',
      );

    return execSync(
      commandLine,
      {
        ...options,

        shell:
          process.env.ComSpec ??
          'cmd.exe',
      },
    );
  }

  return execFileSync(
    npmCommand,
    args,
    options,
  );
}

async function exists(
  path,
) {
  try {
    await access(
      path,
    );

    return true;
  } catch {
    return false;
  }
}

async function collectFiles(
  directory,
  prefix = '',
) {
  const entries =
    await readdir(
      directory,
      {
        withFileTypes:
          true,
      },
    );

  const result = [];

  for (
    const entry of
      entries
  ) {
    const relative =
      prefix
        ? `${prefix}/${entry.name}`
        : entry.name;

    const absolute =
      join(
        directory,
        entry.name,
      );

    if (
      entry.isDirectory()
    ) {
      result.push(
        ...await collectFiles(
          absolute,
          relative,
        ),
      );
    } else {
      result.push(
        relative,
      );
    }
  }

  return result;
}

const temporaryRoot =
  await mkdtemp(
    join(
      tmpdir(),
      'toverni-package-smoke-',
    ),
  );

try {
  const tarballDirectory =
    join(
      temporaryRoot,
      'tarball',
    );

  const installDirectory =
    join(
      temporaryRoot,
      'install',
    );

  await import(
    'node:fs/promises'
  ).then(
    ({
      mkdir,
    }) =>
      Promise.all([
        mkdir(
          tarballDirectory,
          {
            recursive:
              true,
          },
        ),

        mkdir(
          installDirectory,
          {
            recursive:
              true,
          },
        ),
      ]),
  );

  runNpm(
    [
      'pack',
      '--silent',
      '--pack-destination',
      tarballDirectory,
    ],
    {
      cwd:
        packageRoot,

      stdio:
        'inherit',
    },
  );

  const tarballs =
    (
      await readdir(
        tarballDirectory,
      )
    )
      .filter(
        (name) =>
          name.endsWith(
            '.tgz',
          ),
      );

  if (
    tarballs.length !==
      1
  ) {
    throw new Error(
      `Expected one packed tarball, found ${tarballs.length}.`,
    );
  }

  const tarballPath =
    join(
      tarballDirectory,
      tarballs[0],
    );

  await writeFile(
    join(
      installDirectory,
      'package.json',
    ),
    JSON.stringify(
      {
        name:
          'toverni-package-smoke',

        private:
          true,

        version:
          '0.0.0',
      },
      null,
      2,
    ),
    'utf8',
  );

  runNpm(
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
      tarballPath,
    ],
    {
      cwd:
        installDirectory,

      stdio:
        'inherit',
    },
  );

  const installedPackage =
    join(
      installDirectory,
      'node_modules',
      '@toverni',
      'explorer',
    );

  for (
    const required of [
      'package.json',
      'README.md',
      'dist/index.js',
      'drizzle/meta/_journal.json',
    ]
  ) {
    if (
      !await exists(
        join(
          installedPackage,
          ...required.split(
            '/',
          ),
        ),
      )
    ) {
      throw new Error(
        `Packaged asset is missing: ${required}`,
      );
    }
  }

  for (
    const forbidden of [
      'src',
      'scripts',
    ]
  ) {
    if (
      await exists(
        join(
          installedPackage,
          forbidden,
        ),
      )
    ) {
      throw new Error(
        `Dev-only directory was published: ${forbidden}`,
      );
    }
  }

  const databaseModule =
    await import(
      pathToFileURL(
        join(
          installedPackage,
          'dist',
          'configuration',
          'database.js',
        ),
      ).href
    );

  const databaseConfiguration =
    databaseModule
      .resolveDatabaseConfiguration({
        cwd:
          installDirectory,
      });

  if (
    databaseConfiguration.kind !==
      'local' ||
    databaseConfiguration
      .migrationsDirectory !==
      join(
        installedPackage,
        'drizzle',
      )
  ) {
    throw new Error(
      `Installed package did not resolve bundled migrations: ${JSON.stringify(databaseConfiguration)}`,
    );
  }

  const packageFiles =
    await collectFiles(
      installedPackage,
    );

  const forbiddenFiles =
    packageFiles.filter(
      (path) =>
        /(?:^|\/)benchmark(?:\/|$)/i
          .test(
            path,
          ) ||
        /\.test\.[cm]?js$/i
          .test(
            path,
          ) ||
        /\.smoke\.[cm]?js$/i
          .test(
            path,
          ),
    );

  if (
    forbiddenFiles.length >
      0
  ) {
    throw new Error(
      `Dev-only files were published: ${forbiddenFiles.join(', ')}`,
    );
  }

  const packageJson =
    JSON.parse(
      await readFile(
        join(
          installedPackage,
          'package.json',
        ),
        'utf8',
      ),
    );

  if (
    packageJson.bin
      ?.toverni !==
    'dist/index.js'
  ) {
    throw new Error(
      'Installed package does not expose the expected "toverni" binary.',
    );
  }

  const version =
    execFileSync(
      npmCommand,
      [
        'exec',
        '--',
        'toverni',
        '--version',
      ],
      {
        cwd:
          installDirectory,

        encoding:
          'utf8',
      },
    )
      .trim();

  if (
    version !==
    packageJson.version
  ) {
    throw new Error(
      `Installed CLI version mismatch: expected ${packageJson.version}, received ${version}.`,
    );
  }

  const help =
    execFileSync(
      npmCommand,
      [
        'exec',
        '--',
        'toverni',
        '--help',
      ],
      {
        cwd:
          installDirectory,

        encoding:
          'utf8',
      },
    );

  if (
    !help.includes(
      'Toverni — grounded Playwright test generation',
    )
  ) {
    throw new Error(
      'Installed CLI help did not execute correctly.',
    );
  }

  console.log(
    `Package smoke passed for @toverni/explorer@${version}.`,
  );
} finally {
  await rm(
    temporaryRoot,
    {
      recursive:
        true,

      force:
        true,
    },
  );
}
