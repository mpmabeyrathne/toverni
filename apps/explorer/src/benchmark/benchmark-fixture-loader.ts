import {
    readFile,
  } from 'node:fs/promises';
  
  import {
    dirname,
    resolve,
  } from 'node:path';
  
  import {
    benchmarkFixtureManifestSchema,
    benchmarkHumanReferenceSchema,
    type BenchmarkFixtureManifest,
    type BenchmarkHumanReference,
  } from './benchmark-contracts.js';
  
  export interface LoadedBenchmarkFixture {
    manifest:
      BenchmarkFixtureManifest;
  
    rootDirectory:
      string;
  
    requirements:
      string;
  
    openApi:
      string;
  
    humanReference:
      BenchmarkHumanReference;
  
    entryFile:
      string;
  }
  
  async function readText(
    path:
      string,
  ): Promise<string> {
    return readFile(
      path,
      'utf8',
    );
  }
  
  export async function loadBenchmarkFixture(
    fixtureManifestPath:
      string,
  ): Promise<
    LoadedBenchmarkFixture
  > {
    const absoluteManifestPath =
      resolve(
        fixtureManifestPath,
      );
  
    const rootDirectory =
      dirname(
        absoluteManifestPath,
      );
  
    const manifestRaw =
      await readText(
        absoluteManifestPath,
      );
  
    const manifest =
      benchmarkFixtureManifestSchema
        .parse(
          JSON.parse(
            manifestRaw,
          ),
        );
  
    const requirementsPath =
      resolve(
        rootDirectory,
        manifest.requirementsPath,
      );
  
    const openApiPath =
      resolve(
        rootDirectory,
        manifest.openApiPath,
      );
  
    const humanReferencePath =
      resolve(
        rootDirectory,
        manifest
          .humanReferencePath,
      );
  
    const [
      requirements,
      openApi,
      humanReferenceRaw,
    ] =
      await Promise.all([
        readText(
          requirementsPath,
        ),
  
        readText(
          openApiPath,
        ),
  
        readText(
          humanReferencePath,
        ),
      ]);
  
    const humanReference =
      benchmarkHumanReferenceSchema
        .parse(
          JSON.parse(
            humanReferenceRaw,
          ),
        );
  
    return {
      manifest,
  
      rootDirectory,
  
      requirements,
  
      openApi,
  
      humanReference,
  
      entryFile:
        resolve(
          rootDirectory,
          manifest.entryPath,
        ),
    };
  }