import {
    join,
    resolve,
  } from 'node:path';
  
  import {
    runExplorer,
  } from '../explorer/run-explorer.js';
  
  import {
    loadBenchmarkFixture,
  } from './benchmark-fixture-loader.js';
  
  import {
    startBenchmarkFixtureServer,
  } from './benchmark-fixture-server.js';
  
  const repositoryRoot =
    resolve(
      process.cwd(),
      '../..',
    );
  
  const fixture =
    await loadBenchmarkFixture(
      join(
        repositoryRoot,
        'fixtures',
        'benchmark',
        'booking',
        'fixture.json',
      ),
    );
  
  const fixtureServer =
    await startBenchmarkFixtureServer({
      fixtureDirectory:
        fixture.rootDirectory,
  
      port:
        19123,
    });
  
  const knowledgeInput = {
    requirementsPath:
      join(
        fixture.rootDirectory,
        fixture.manifest
          .requirementsPath,
      ),
  
    openApiPath:
      join(
        fixture.rootDirectory,
        fixture.manifest
          .openApiPath,
      ),
  };
  
  try {
    console.log(
      `Fixture running at ${fixtureServer.baseUrl}`,
    );
  
    console.log(
      '\n=== RUN 1 ===',
    );
  
    const first =
      await runExplorer({
        targetUrl:
          fixtureServer.baseUrl,
  
        headless:
          true,
  
        artifactsDirectory:
          join(
            process.cwd(),
            'artifacts',
            'history-verification',
            'run-1',
          ),
  
        knowledgeInput,
      });
  
    console.log({
      applicationId:
        first.applicationId,
  
      runId:
        first.runId,
  
      runs:
        first.flow.runs.length,
  
      states:
        first.flow.states.length,
  
      actions:
        first.flow.actions.length,
  
      transitions:
        first.flow.transitions.length,
    });
  
    console.log(
      '\n=== RUN 2 ===',
    );
  
    const second =
      await runExplorer({
        targetUrl:
          fixtureServer.baseUrl,
  
        headless:
          true,
  
        artifactsDirectory:
          join(
            process.cwd(),
            'artifacts',
            'history-verification',
            'run-2',
          ),
  
        knowledgeInput,
      });
  
    console.log({
      applicationId:
        second.applicationId,
  
      runId:
        second.runId,
  
      runs:
        second.flow.runs.length,
  
      states:
        second.flow.states.length,
  
      actions:
        second.flow.actions.length,
  
      transitions:
        second.flow.transitions.length,
    });
  
    if (
      first.applicationId !==
      second.applicationId
    ) {
      throw new Error(
        'Application ID changed between runs.',
      );
    }
  
    if (
      first.runId ===
      second.runId
    ) {
      throw new Error(
        'Run ID was reused.',
      );
    }
  
    if (
      second.flow.runs.length !==
      first.flow.runs.length + 1
    ) {
      throw new Error(
        'Second run did not accumulate application history.',
      );
    }
  
    if (
      second.flow.transitions.length <=
      first.flow.transitions.length
    ) {
      throw new Error(
        'Persisted transitions did not accumulate.',
      );
    }
  
    console.log(
      '\n✅ MULTI-RUN PERSISTENCE VERIFIED',
    );
  } finally {
    await fixtureServer.close();
  }