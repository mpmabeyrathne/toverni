import {
    createServer,
    type Server,
  } from 'node:http';
  
  import {
    readFile,
  } from 'node:fs/promises';
  
  import {
    extname,
    join,
    normalize,
  } from 'node:path';
  
  export interface BenchmarkFixtureServer {
    baseUrl:
      string;
  
    close():
      Promise<void>;
  }
  
  interface StartBenchmarkFixtureServerInput {
    fixtureDirectory:
      string;
  
    port?:
      number;
  }
  
  function contentType(
    path:
      string,
  ): string {
    switch (
      extname(path)
    ) {
      case '.html':
        return 'text/html; charset=utf-8';
  
      case '.js':
        return 'text/javascript; charset=utf-8';
  
      case '.css':
        return 'text/css; charset=utf-8';
  
      case '.json':
        return 'application/json; charset=utf-8';
  
      default:
        return 'text/plain; charset=utf-8';
    }
  }
  
  export async function startBenchmarkFixtureServer(
    input:
      StartBenchmarkFixtureServerInput,
  ): Promise<
    BenchmarkFixtureServer
  > {
    const server =
      createServer(
        async (
          request,
          response,
        ) => {
          try {
            const url =
              new URL(
                request.url ?? '/',
                'http://localhost',
              );
  
            const requestedPath =
              url.pathname === '/'
                ? 'index.html'
                : url.pathname
                    .replace(
                      /^\/+/,
                      '',
                    );
  
            const safePath =
              normalize(
                requestedPath,
              );
  
            if (
              safePath.startsWith(
                '..',
              )
            ) {
              response.statusCode =
                400;
  
              response.end(
                'Invalid path',
              );
  
              return;
            }
  
            const filePath =
              join(
                input.fixtureDirectory,
                safePath,
              );
  
            const body =
              await readFile(
                filePath,
              );
  
            response.statusCode =
              200;
  
            response.setHeader(
              'content-type',
              contentType(
                filePath,
              ),
            );
  
            response.end(
              body,
            );
          } catch {
            response.statusCode =
              404;
  
            response.end(
              'Not found',
            );
          }
        },
      );
  
    await new Promise<void>(
      (
        resolve,
        reject,
      ) => {
        server.once(
          'error',
          reject,
        );
  
        server.listen(
          input.port ?? 0,
          '127.0.0.1',
          () => {
            server.off(
              'error',
              reject,
            );
  
            resolve();
          },
        );
      },
    );
  
    const address =
      server.address();
  
    if (
      !address ||
      typeof address ===
        'string'
    ) {
      await closeServer(
        server,
      );
  
      throw new Error(
        'Unable to determine benchmark server address.',
      );
    }
  
    return {
      baseUrl:
        `http://127.0.0.1:${address.port}`,
  
      close:
        () =>
          closeServer(
            server,
          ),
    };
  }
  
  function closeServer(
    server:
      Server,
  ): Promise<void> {
    return new Promise(
      (
        resolve,
        reject,
      ) => {
        server.close(
          (error) => {
            if (
              error
            ) {
              reject(
                error,
              );
  
              return;
            }
  
            resolve();
          },
        );
      },
    );
  }