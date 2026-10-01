import {
  mkdir,
  writeFile,
} from 'node:fs/promises';

import {
  join,
} from 'node:path';

import {
  testPlanIrSchema,
  type TestPlanAssertion,
  type TestPlanIr,
  type TestPlanStepOperation,
} from './test-plan-ir.js';

import {
  renderPlaywrightLocator,
} from './playwright-locator-renderer.js';

export interface RenderPlaywrightTestInput {
  plan:
    TestPlanIr;

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
  value:
    string,
): string {
  return JSON.stringify(
    value,
  );
}

function createSafeFileName(
  scenarioId:
    string,
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

function compileOperation(
  operation:
    TestPlanStepOperation,
): string {
  switch (
    operation.kind
  ) {
    case 'click':
      return `${renderPlaywrightLocator(
        operation.target,
      )}.click();`;
  }
}

function compileAssertion(
  assertion:
    TestPlanAssertion,
): string {
  const subject =
    assertion.target.kind ===
    'page'
      ? 'page'
      : renderPlaywrightLocator(
          assertion.target
            .target,
        );

  switch (
    assertion.matcher
  ) {
    case 'url':
      if (
        typeof assertion.expected !==
        'string'
      ) {
        throw new Error(
          'URL assertion requires a string expected value.',
        );
      }

      return `expect(${subject}).toHaveURL(${quote(assertion.expected)});`;

    case 'visible':
      return `expect(${subject}).toBeVisible();`;

    case 'hidden':
      return `expect(${subject}).toBeHidden();`;

    case 'enabled':
      return `expect(${subject}).toBeEnabled();`;

    case 'disabled':
      return `expect(${subject}).toBeDisabled();`;

    case 'count':
      if (
        typeof assertion.expected !==
        'number'
      ) {
        throw new Error(
          'Count assertion requires a numeric expected value.',
        );
      }

      return `expect(${subject}).toHaveCount(${assertion.expected});`;

    case 'value':
      if (
        typeof assertion.expected !==
        'string'
      ) {
        throw new Error(
          'Value assertion requires a string expected value.',
        );
      }

      return `expect(${subject}).toHaveValue(${quote(assertion.expected)});`;
  }
}

export function compilePlaywrightTest(
  input:
    RenderPlaywrightTestInput,
): string {
  const plan =
    testPlanIrSchema.parse(
      input.plan,
    );

  if (
    plan.status !==
    'ready'
  ) {
    throw new Error(
      'Cannot render a manual-required test plan.',
    );
  }

  const lines:
    string[] = [
      `import { expect, test } from '@playwright/test';`,
      '',
      'const generationMetadata = {',
      `  irVersion: ${quote(plan.metadata.irVersion)},`,
      `  generator: ${quote(plan.metadata.generator)},`,
      `  scenarioId: ${quote(plan.scenarioId)},`,
      `  evidenceReferences: ${JSON.stringify(
        plan.evidenceReferences,
        null,
        2,
      )},`,
      '} as const;',
      '',
      'void generationMetadata;',
      '',
      `test(${quote(
        plan.title,
      )}, async ({ page }) => {`,
      `  await page.goto(${quote(
        input.targetUrl,
      )});`,
      '',
    ];

  for (
    const step of
      plan.steps
  ) {
    lines.push(
      `  // Evidence: ${step.evidenceReference}`,
    );

    lines.push(
      `  // ${step.description}`,
    );

    lines.push(
      `  await ${compileOperation(
        step.operation,
      )}`,
    );

    const assertions =
      plan.assertions.filter(
        (assertion) =>
          assertion.afterActionId ===
          step.actionId,
      );

    for (
      const assertion of
        assertions
    ) {
      lines.push(
        `  // Assertion evidence: ${assertion.evidenceReferences.join(', ')}`,
      );

      lines.push(
        `  // ${assertion.description}`,
      );

      lines.push(
        `  await ${compileAssertion(
          assertion,
        )}`,
      );
    }

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
    compilePlaywrightTest(
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


export const renderPlaywrightTest =
  compilePlaywrightTest;
