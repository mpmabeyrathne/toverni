# Competitive Benchmark Protocol

TOV-113 compares the frozen seven-fixture benchmark across:

1. Toverni
2. Generic LLM baseline
3. Playwright Test Agents
4. TestZeus Hercules

The comparison uses the same Toverni metric calculator and the same human reference flows.

## Required run order

1. Run the normal benchmark with the generic baseline enabled.
2. Preserve the generated `artifacts/benchmark/benchmark-report.json`.
3. Run each external tool against every local fixture using the frozen fixture URL, requirements, and reference-flow request.
4. Normalize each external output to the JSON schema below.
5. Run `pnpm benchmark:competitive`.
6. Preserve raw tool outputs, normalized artifacts, tool versions, model/provider configuration, and final reports.

## Normalized artifact paths

```text
apps/explorer/artifacts/competitive/playwright_agents/booking.json
apps/explorer/artifacts/competitive/playwright_agents/todo.json
apps/explorer/artifacts/competitive/playwright_agents/commerce.json
apps/explorer/artifacts/competitive/playwright_agents/auth-rbac.json
apps/explorer/artifacts/competitive/playwright_agents/checkout-form.json
apps/explorer/artifacts/competitive/playwright_agents/data-grid.json
apps/explorer/artifacts/competitive/playwright_agents/upload-retry.json

apps/explorer/artifacts/competitive/hercules/booking.json
...same seven fixture IDs...
```

## Normalized artifact schema

```json
{
  "fixtureId": "booking",
  "scenarios": [
    {
      "title": "Book available room",
      "actions": [
        "Click Book Ocean Room"
      ],
      "expectedOutcomes": [
        "Ocean Room booked is displayed"
      ],
      "executable": true,
      "runtimeStatus": "passed",
      "evidenceReferences": [
        "REQ-2"
      ],
      "unsupportedSteps": [],
      "humanEditsRequired": 0,
      "assertionCount": 1
    }
  ]
}
```

## Scoring rules

- Do not manually repair generated output before initial scoring.
- A generated test can be runnable while its runtime status is failed.
- Runtime pass rate is scored separately from executable/runnable rate.
- Requirement grounding requires an explicit `REQ-` evidence reference in the normalized artifact.
- Unsupported/invented actions must be recorded in `unsupportedSteps`.
- Human edits must count actual modifications required to make the generated output usable.
- Tool/version and model/provider settings must be recorded for every run.
- Missing competitor artifacts cause the competitive runner to fail.
- A skipped/empty generic LLM baseline causes the competitive runner to fail.

## Toverni minimum gates

- Important-flow coverage >= 80%
- Executable/runnable rate >= 80%
- Requirement grounding >= 90%
- Meaningful assertion coverage >= 80%
- Unsupported/invented action rate <= 5%
- Duplicate scenario rate <= 10%
- Runtime pass rate reported separately
- Human edits and coverage efficiency reported

Competitor performance never relaxes these minimum gates.

## Interpretation

The report compares metrics by normalized outputs. It does not claim the tools have identical internal architecture, planning behavior, browser control, or model budgets. No overall superiority claim should be made solely from this benchmark.
