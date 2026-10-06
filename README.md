# Toverni

Toverni explores a web application in Chromium, builds an evidence-backed model of its behavior, and generates Playwright tests you can review and run in your own project.

Free v1 is local-first:

- Playwright + Chromium for browser exploration
- embedded PGlite for local persistence
- Ollama for optional model-backed scenario generation
- no mandatory Toverni-hosted service
- destructive/high-impact actions blocked by default
- authenticated apps supported through Playwright storage state

## Run it in 5 minutes

> **Current repository workflow:** npm/npx packaging is tracked separately in TOV-116 and is not released yet.

Requirements:

- Node.js 24
- pnpm
- Chromium installed for Playwright
- a web app you can reach locally or over HTTP(S)

From a cloned Toverni repository:

```bash
pnpm install
pnpm --filter @toverni/explorer exec playwright install chromium
pnpm --filter @toverni/explorer exec tsx src/index.ts generate http://localhost:3000 --headless
```

That browser-only command does not require Ollama.

To enable model-backed grounded scenario generation:

```bash
ollama pull llama3.2:3b
pnpm --filter @toverni/explorer exec tsx src/index.ts generate http://localhost:3000 \
  --headless \
  --model-reasoning
```

Generated Playwright specs are written into an existing Playwright project under `tests/toverni` when possible. If Toverni cannot detect a Playwright project, it writes under `artifacts/generated-tests` and tells you how to bootstrap Playwright.

## Common examples

Browser only:

```bash
pnpm --filter @toverni/explorer exec tsx src/index.ts generate http://localhost:3000 --headless
```

Requirements grounded:

```bash
pnpm --filter @toverni/explorer exec tsx src/index.ts generate http://localhost:3000 \
  --requirements ./examples/free-v1/requirements.md \
  --model-reasoning \
  --headless
```

Requirements + OpenAPI:

```bash
pnpm --filter @toverni/explorer exec tsx src/index.ts generate http://localhost:3000 \
  --requirements ./examples/free-v1/requirements.md \
  --openapi ./examples/free-v1/openapi.yaml \
  --model-reasoning \
  --headless
```

Authenticated app:

```bash
pnpm --filter @toverni/explorer exec tsx src/index.ts generate http://localhost:3000/dashboard \
  --storage-state ./playwright/.auth/user.json \
  --headless
```

Machine-readable summary:

```bash
pnpm --filter @toverni/explorer exec tsx src/index.ts generate http://localhost:3000 \
  --headless \
  --summary-json ./artifacts/toverni-summary.json
```

## Safety

Recognized high-impact actions such as delete, payment/purchase, invitations/messages, subscription cancellation, money/ownership transfer, and destructive admin operations are blocked by default.

Only use this override in an isolated environment where those actions are intentionally safe:

```bash
--allow-destructive-actions
```

## Ollama and BYOK

Free v1 currently supports `ollama` as the runtime model provider. Model reasoning is optional and is off unless enabled.

The provider boundary is already separated from exploration logic so BYOK cloud adapters can be added later without redesigning the explorer. **Cloud BYOK is not enabled in the current CLI yet**; production-release work is tracked in TOV-125.

## Full guide

See [Free v1 quick start, examples, and troubleshooting](./docs/free-v1.md).
