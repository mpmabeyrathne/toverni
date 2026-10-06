# Toverni Free v1 guide

This guide describes the **current source-checkout workflow**. It intentionally does not document `npx toverni` as available yet because package publication and clean-install validation are tracked in TOV-116.

## What Toverni does

Toverni:

1. opens your target application in Chromium;
2. observes pages, forms, controls, network activity, and state transitions;
3. persists the discovered graph locally;
4. grounds scenarios in browser evidence, requirements, and OpenAPI context when supplied;
5. optionally uses Ollama for model-backed scenario generation;
6. generates Playwright specs;
7. executes generated specs when possible;
8. prints a human-readable generation summary and can save the same summary as JSON.

Toverni does **not** require a hosted Toverni backend for Free v1.

## Prerequisites

- Node.js 24
- pnpm
- a reachable target application
- Chromium for Playwright
- Ollama only if you enable model reasoning

Install project dependencies and Chromium:

```bash
pnpm install
pnpm --filter @toverni/explorer exec playwright install chromium
```

## Five-minute quick start

Start your application, then run:

```bash
pnpm --filter @toverni/explorer exec tsx src/index.ts generate http://localhost:3000 --headless
```

This is **browser-only mode**. Model reasoning defaults to off, so Ollama is not required.

The terminal summary reports:

- discovered states/flows/transitions;
- generated scenarios/tests;
- passed/failed/manual-required tests;
- coverage signals;
- skipped high-impact actions;
- output paths;
- model usage when enabled;
- warnings and suggested next steps.

## Browser-only example

```bash
pnpm --filter @toverni/explorer exec tsx src/index.ts generate http://localhost:3000 \
  --headless \
  --summary-json ./artifacts/toverni-summary.json
```

Use this when you want deterministic browser exploration without model-backed scenario generation.

## Requirements-grounded example

Example requirements file: `examples/free-v1/requirements.md`.

```bash
ollama pull llama3.2:3b

pnpm --filter @toverni/explorer exec tsx src/index.ts generate http://localhost:3000 \
  --requirements ./examples/free-v1/requirements.md \
  --model-reasoning \
  --headless
```

Model reasoning uses Ollama only after the preflight succeeds.

## Requirements + OpenAPI example

Example OpenAPI file: `examples/free-v1/openapi.yaml`.

```bash
pnpm --filter @toverni/explorer exec tsx src/index.ts generate http://localhost:3000 \
  --requirements ./examples/free-v1/requirements.md \
  --openapi ./examples/free-v1/openapi.yaml \
  --model-reasoning \
  --headless
```

Toverni can link observed network requests to OpenAPI operations and use that evidence during scenario/test generation.

## Authenticated application example

Toverni accepts a standard Playwright `storageState` JSON file.

A common Playwright setup creates it after login, for example:

```ts
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:3000/login');
await page.getByLabel('Email').fill('test@example.com');
await page.getByLabel('Password').fill(process.env.TEST_PASSWORD!);
await page.getByRole('button', { name: 'Sign in' }).click();

await page.context().storageState({
  path: 'playwright/.auth/user.json',
});

await browser.close();
```

Then run:

```bash
pnpm --filter @toverni/explorer exec tsx src/index.ts generate http://localhost:3000/dashboard \
  --storage-state ./playwright/.auth/user.json \
  --headless
```

Important behavior:

- saved cookies/local storage are reused;
- likely expired sessions produce an actionable diagnostic;
- sensitive form values and sensitive URL query parameters are redacted from normal observations;
- authenticated runs avoid dumping full observations/screenshots by default unless explicitly configured.

## Ollama setup

Default endpoint:

```text
http://127.0.0.1:11434
```

Default cheap/complex model:

```text
llama3.2:3b
```

Install the default model:

```bash
ollama pull llama3.2:3b
```

Run with model reasoning:

```bash
pnpm --filter @toverni/explorer exec tsx src/index.ts generate http://localhost:3000 \
  --model-provider ollama \
  --model-reasoning \
  --model-retry-attempts 2 \
  --ollama-base-url http://127.0.0.1:11434 \
  --cheap-model llama3.2:3b \
  --complex-model llama3.2:3b
```

Before using the model, Toverni checks:

- Ollama server reachability;
- requested model availability.

If a model is missing, Toverni prints the corresponding `ollama pull <model>` command.

## BYOK status

The provider runtime boundary is implemented, but the current public CLI intentionally accepts only:

```text
--model-provider ollama
```

Cloud BYOK providers are **not available yet**. Production-release BYOK adapters are tracked in TOV-125.

The intended future contract is:

- credentials supplied by the user;
- no mandatory Toverni-paid inference;
- provider-specific preflight;
- credentials never written to generated tests, normal logs, or persisted model-usage metadata.

Do not add fake API-key fields to current `toverni.yaml`; they are not supported yet.

## YAML configuration

Example: `examples/free-v1/toverni.yaml`.

```yaml
target: http://localhost:3000
requirements: ./requirements.md
openapi: ./openapi.yaml
output: ./tests/toverni
summaryJson: ./artifacts/toverni-summary.json
headless: true

safety:
  allowDestructiveActions: false

model:
  provider: ollama
  reasoningEnabled: true
  retryAttempts: 2
  ollamaBaseUrl: http://127.0.0.1:11434
  cheapModel: llama3.2:3b
  complexModel: llama3.2:3b

exploration:
  maxActions: 50
  maxModelCalls: 20

timeouts:
  navigationMs: 30000
  actionMs: 15000
  modelCallMs: 600000
  testMs: 60000
```

Run it from the example directory so relative paths resolve as shown:

```bash
cd examples/free-v1
pnpm --dir ../.. --filter @toverni/explorer exec tsx src/index.ts generate --config ./toverni.yaml
```

Alternatively, run from the repository root and provide the full config path:

```bash
pnpm --filter @toverni/explorer exec tsx src/index.ts generate --config ./examples/free-v1/toverni.yaml
```

CLI flags override YAML values.

## Safety behavior

High-impact actions are blocked by default, including recognized forms of:

- destructive deletion/removal;
- purchase/payment/refund transactions;
- invitations and external messages;
- subscription cancellation;
- funds/ownership transfer;
- destructive admin actions such as disabling users or revoking access.

The terminal/JSON summary reports high-impact actions skipped by policy.

Explicit override:

```bash
--allow-destructive-actions
```

Use the override only against an isolated test environment with disposable data. The default is the safe mode.

## Generated output

When Toverni detects an existing Playwright project, generated files go to:

```text
tests/toverni/
```

Example:

```text
tests/
└── toverni/
    └── checkout-as-returning-customer-a1b2c3d4.spec.ts
```

When no Playwright project is detected, Toverni uses:

```text
artifacts/generated-tests/
```

and reports that Playwright needs to be bootstrapped.

Generated specs import `@playwright/test` and do not require the Toverni runtime when executed in a normal Playwright project.

## Machine-readable summary

Use:

```bash
--summary-json ./artifacts/toverni-summary.json
```

The JSON summary contains the same canonical information used by the terminal summary: discovery counts, tests, safety, coverage, output files, model usage, warnings, and next steps.

## Current CLI options

```text
-c, --config <path>              YAML config file
    --requirements <path>        Requirements/document input
    --openapi <path>             OpenAPI YAML/JSON input
-o, --output <path>              Generated Playwright output directory
    --summary-json <path>        Save machine-readable generation summary
    --headless                   Run Chromium headless
    --headed                     Show Chromium
    --resume <run-id>            Resume a prior exploration run
    --storage-state <path>       Playwright storageState for authenticated exploration

    --allow-destructive-actions  Explicitly permit high-impact exploration actions
    --deny-destructive-actions   Keep high-impact actions blocked (default)

    --model-provider <name>      Currently only: ollama
    --model-reasoning            Enable model-backed scenario generation
    --no-model-reasoning         Disable model reasoning
    --model-retry-attempts <n>   Retry attempts per model call
    --ollama-base-url <url>      Ollama endpoint
    --cheap-model <name>         Cheap/fast model
    --complex-model <name>       Complex model

    --max-actions <n>
    --max-model-calls <n>
    --navigation-timeout-ms <n>
    --action-timeout-ms <n>
    --model-timeout-ms <n>
    --test-timeout-ms <n>
```

## Troubleshooting

### Chromium/browser executable is missing

Install Chromium:

```bash
pnpm --filter @toverni/explorer exec playwright install chromium
```

### Ollama is not reachable

Confirm Ollama is running:

```bash
ollama list
```

Then verify the configured endpoint, normally `http://127.0.0.1:11434`.

If you do not need model reasoning, omit `--model-reasoning`.

### Required Ollama model is not installed

Install the model named in the diagnostic:

```bash
ollama pull llama3.2:3b
```

### Model calls are slow on CPU

Use browser-only mode by omitting `--model-reasoning`, reduce `--max-model-calls`, or choose a smaller local model.

### Authenticated run lands on login/sign-in

The saved session is likely expired or invalid. Re-run your Playwright login/bootstrap setup to regenerate the storage-state file.

### A destructive/high-impact action was skipped

This is expected safe-default behavior. Check the terminal/JSON summary for the classification reason.

Only in a disposable test environment, rerun with:

```bash
--allow-destructive-actions
```

### Generated tests require manual completion

The summary will identify manual-required scenarios. Add stronger requirements/API evidence or provide application-specific setup for interactions Toverni cannot safely execute.

### No Playwright project was detected

Toverni writes generated specs under `artifacts/generated-tests` and reports bootstrap guidance. Create a Playwright project, then rerun if you want drop-in output under `tests/toverni`.

### Exploration stopped because of a budget

Increase the relevant explicit limit, for example:

```bash
--max-actions 100
--max-model-calls 30
```

Do this intentionally; budgets protect runtime and model usage.

## Current limitations

- npm/npx package publication is not complete yet (TOV-116).
- current model provider is Ollama only;
- cloud BYOK adapters are deferred to production-release work (TOV-125);
- model reasoning is optional and local-model quality/performance depends on the model and hardware;
- some application-specific flows remain manual-required when there is insufficient safe executable evidence.

## Release packaging note

After TOV-116 completes, this guide should replace source-checkout invocation with the validated package command. Until that clean-install smoke test passes, source commands above are the supported documented workflow.
