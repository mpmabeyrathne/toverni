import {
    spawn,
  } from 'node:child_process';
  
  import {
    createRequire,
  } from 'node:module';
  
  import {
    relative,
  } from 'node:path';
  
  import type {
    ExecutableTestRunResult,
  } from './executable-test-contracts.js';
  
  export interface RunPlaywrightTestInput {
    filePath:
      string;
  
    workingDirectory:
      string;

    timeoutMs?:
      number;
  }
  
  const require =
    createRequire(
      import.meta.url,
    );
  
  function normalizePath(
    value: string,
  ): string {
    return value.replaceAll(
      '\\',
      '/',
    );
  }
  
  export async function runPlaywrightTest(
    input:
      RunPlaywrightTestInput,
  ): Promise<
    ExecutableTestRunResult
  > {
    const startedAt =
      Date.now();
  
    const relativeFilePath =
      normalizePath(
        relative(
          input.workingDirectory,
          input.filePath,
        ),
      );
  
    const playwrightCli =
      require.resolve(
        '@playwright/test/cli',
      );
  
    return new Promise(
      (
        resolve,
        reject,
      ) => {
        const child =
          spawn(
            process.execPath,
            [
              playwrightCli,
  
              'test',
  
              relativeFilePath,
  
              '--workers=1',
  
              '--reporter=line',
            ],
            {
              cwd:
                input
                  .workingDirectory,
  
              env:
                process.env,
  
              shell:
                false,
  
              stdio: [
                'ignore',
                'pipe',
                'pipe',
              ],
            },
          );
  
        let stdout = '';
        let stderr = '';

        let timedOut =
          false;

        const timeoutMs =
          input.timeoutMs ??
          60_000;

        const timeoutHandle =
          setTimeout(
            () => {
              timedOut =
                true;

              child.kill();
            },
            timeoutMs,
          );
  
        child.stdout.on(
          'data',
          (
            chunk:
              Buffer,
          ) => {
            stdout +=
              chunk.toString(
                'utf8',
              );
          },
        );
  
        child.stderr.on(
          'data',
          (
            chunk:
              Buffer,
          ) => {
            stderr +=
              chunk.toString(
                'utf8',
              );
          },
        );
  
        child.on(
          'error',
          (
            error,
          ) => {
            clearTimeout(
              timeoutHandle,
            );

            reject(
              new Error(
                `Failed to start Playwright process: ${error.message}`,
                {
                  cause:
                    error,
                },
              ),
            );
          },
        );
  
        child.on(
          'close',
          (
            code,
          ) => {
            clearTimeout(
              timeoutHandle,
            );

            const exitCode =
              code ?? 1;
  
            resolve({
              status:
                exitCode === 0
                  ? 'passed'
                  : 'failed',
  
              exitCode,
  
              durationMs:
                Date.now() -
                startedAt,
  
              stdout,
  
              stderr,
  
              error:
                timedOut
                  ? `Playwright test timed out after ${timeoutMs}ms.`
                  : exitCode === 0
                    ? null
                    : [
                      stderr,
                      stdout,
                    ]
                      .filter(
                        Boolean,
                      )
                      .join(
                        '\n',
                      ) ||
                    'Playwright test failed.',
            });
          },
        );
      },
    );
  }