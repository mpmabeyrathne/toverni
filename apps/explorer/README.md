# @toverni/explorer

Local-first application exploration and grounded Playwright test generation.

The package installs a CLI binary named `toverni`.

## Install in a project

```bash
npm install --save-dev @toverni/explorer
npx toverni --version
npx toverni generate http://localhost:3000 --headless
```

## One-shot execution after registry publication

```bash
npx --package @toverni/explorer toverni generate http://localhost:3000 --headless
```

## Browser dependency

Toverni uses Playwright Chromium. Install it with:

```bash
npx playwright install chromium
```

## Local model reasoning

Ollama is optional. Browser-only exploration does not require it.

```bash
ollama pull llama3.2:3b
npx toverni generate http://localhost:3000 --model-reasoning --headless
```

Free v1 keeps Ollama local to the user's machine. Cloud BYOK adapters are intentionally deferred to the production-release provider work.
