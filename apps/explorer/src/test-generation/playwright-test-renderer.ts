import {
    mkdir,
    writeFile,
  } from 'node:fs/promises';
  
  import {
    join,
  } from 'node:path';
  
  import type {
    ExecutableTestPlan,
  } from './executable-test-contracts.js';
  
  export interface RenderPlaywrightTestInput {
    plan:
      ExecutableTestPlan;
  
    targetUrl:
      string;
  }
  
  export interface WrittenPlaywrightTest {
    filePath:
      string;
  
    source:
      string;
  }
  
  function quote(
    value: string,
  ): string {
    return JSON.stringify(
      value,
    );
  }
  
  function createSafeFileName(
    scenarioId: string,
  ): string {
    return scenarioId
      .toLowerCase()
      .replace(
        /[^a-z0-9-_]+/g,
        '-',
      )
      .replace(
        /^-+|-+$/g,
        '',
      );
  }
  
  export function renderPlaywrightTest(
    input:
      RenderPlaywrightTestInput,
  ): string {
    if (
      input.plan.status !==
      'ready'
    ) {
      throw new Error(
        'Cannot render a manual-required test plan.',
      );
    }
  
    const lines: string[] = [
      `import { test } from '@playwright/test';`,
      '',
      'const scenario = {',
      `  id: ${quote(
        input.plan.scenarioId,
      )},`,
      `  evidenceReferences: ${JSON.stringify(
        input.plan.evidenceReferences,
        null,
        2,
      )},`,
      '} as const;',
      '',
      'void scenario;',
      '',
      `test(${quote(
        input.plan.title,
      )}, async ({ page }) => {`,
      `  await page.goto(${quote(
        input.targetUrl,
      )});`,
      '',
    ];
  
    for (
      const step of
        input.plan.steps
    ) {
      lines.push(
        `  // Evidence: ${step.evidenceReference}`,
      );
  
      lines.push(
        `  // ${step.description}`,
      );
  
      lines.push(
        `  await ${step.playwright}`,
      );
  
      lines.push('');
    }
  
    lines.push('});');
    lines.push('');
  
    return lines.join(
      '\n',
    );
  }
  
  export async function writePlaywrightTest(
    input:
      RenderPlaywrightTestInput,
  
    outputDirectory:
      string,
  ): Promise<
    WrittenPlaywrightTest
  > {
    const source =
      renderPlaywrightTest(
        input,
      );
  
    await mkdir(
      outputDirectory,
      {
        recursive:
          true,
      },
    );
  
    const fileName =
      `${createSafeFileName(
        input.plan.scenarioId,
      )}.spec.ts`;
  
    const filePath =
      join(
        outputDirectory,
        fileName,
      );
  
    await writeFile(
      filePath,
      source,
      'utf8',
    );
  
    return {
      filePath,
      source,
    };
  }