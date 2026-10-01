# Toverni Representative Benchmark Suite

This suite is local, deterministic, version-controlled, and does not require paid external services.

| Fixture | Representative interaction patterns | Deterministic data / boundary behavior |
| --- | --- | --- |
| booking | search, booking state, disabled action, cancellation | available/unavailable rooms |
| todo | form input, CRUD-like actions, destructive action | fixed initial todo |
| commerce | product/cart interactions, disabled state | fixed local products |
| auth-rbac | authentication, session state, RBAC, SPA route changes | admin/user roles, password `pass`, invalid-password rejection |
| checkout-form | checkout-like workflow, multi-step form, validation, modal/dialog | local test card `4242424242424242`, invalid card boundary |
| data-grid | search, filter, sort, dynamic table, pagination, API-driven-like refresh | fixed four-row order dataset, deterministic refresh state |
| upload-retry | file-upload-like flow, validation, error/retry, status update | `sample.txt`, invalid `invalid.csv`, deterministic first-attempt failure |

Each fixture contains:

- `fixture.json` manifest
- `requirements.md`
- `openapi.yaml`
- `human-reference.json`
- local entry HTML
- committed local test data where relevant

The fixture server binds to a fresh localhost port and is closed after each benchmark fixture. Fixture tests verify that new representative fixtures return identical entry content across fresh server starts.
