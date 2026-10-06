# Public Beta Release Gate

TOV-124 is the final local validation gate before a maintainer may choose to publish a public beta.

**This workflow never publishes anything.** It does not call `npm publish`, create a Git tag, or create a GitHub release.

## What it validates

The gate exercises representative deterministic applications covering:

- CRUD
- authentication/session reuse
- RBAC
- search/filter/sort
- multi-step forms
- validation
- file upload
- dialogs/modals
- pagination
- SPA routing
- async/API-driven state
- recovery/error states

It also validates:

- local Ollama reachability and required model availability;
- requirements/OpenAPI grounding;
- generated Playwright executability;
- generated-test runtime pass rate;
- meaningful assertions;
- important-flow coverage;
- duplicate and unsupported-action rates;
- destructive/high-impact actions remain blocked under safe defaults.

## Failure taxonomy

Failures are classified into:

- locator failure
- state abstraction/dedup failure
- auth/session failure
- bad test data
- flow reconstruction failure
- missing/weak assertion
- unsupported control
- timeout/flakiness
- unsafe action classification
- unclassified

Recurring categories should become focused regression tests before the public beta is considered ready.

## Prerequisites

Run the ordinary validation first:

```powershell
pnpm --filter @toverni/explorer test
pnpm --filter @toverni/explorer typecheck
pnpm --filter @toverni/explorer build
pnpm --filter @toverni/explorer package:smoke
```

Ollama must be running locally with the configured cheap and complex models installed.

For the default configuration:

```powershell
ollama pull llama3.2:3b
```

## Run the gate

```powershell
pnpm --filter @toverni/explorer release:gate
```

The command writes:

```text
artifacts/release-gate/public-beta-release-gate.json
artifacts/release-gate/public-beta-release-gate.md
```

A failing gate exits non-zero.

## Current machine-evaluable thresholds

The existing Toverni minimum quality thresholds remain mandatory:

- important-flow coverage >= 80%
- executable/runnable rate >= 80%
- requirement grounding >= 90%
- meaningful assertion coverage >= 80%
- unsupported/invented action rate <= 5%
- duplicate scenario rate <= 10%

The public beta gate additionally requires:

- generated-test runtime pass rate >= 80%;
- at least one generated test actually executed;
- zero high-impact actions executed while safe defaults are active;
- local Ollama preflight passes.

## Release decision

A passing report means the codebase cleared the local public-beta gate. It is **not** an automatic publication approval.

The maintainer should review:

1. the Markdown report;
2. classified failures;
3. known limitations;
4. npm package smoke output;
5. the intended beta version/release notes.

Only then should the maintainer manually perform npm/GitHub publication steps.

## Known beta constraints

- Ollama is the only enabled model provider in the beta candidate.
- BYOK cloud providers remain tracked separately under TOV-125.
- Model performance depends on the user's hardware and selected local model.
- Some application-specific controls may remain manual-required when safe executable evidence is insufficient.
- Free v1 does not require a Toverni-hosted SaaS/verification service.
