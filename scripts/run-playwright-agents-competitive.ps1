$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$explorerRoot = Join-Path $repoRoot "apps\explorer"

$allFixtures = @(
  "booking",
  "todo",
  "commerce",
  "auth-rbac",
  "checkout-form",
  "data-grid",
  "upload-retry"
)

if ($env:COMPETITIVE_FIXTURE) {
  $fixtures = $env:COMPETITIVE_FIXTURE.Split(",") |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ }
} else {
  $fixtures = $allFixtures
}

$invalid = @(
  $fixtures |
    Where-Object { $_ -notin $allFixtures }
)

if ($invalid.Count -gt 0) {
  throw "Unknown fixture(s): $($invalid -join ', ')"
}

$skipExisting =
  $env:COMPETITIVE_SKIP_EXISTING -eq "true"

$resumePartial =
  $env:COMPETITIVE_RESUME -eq "true"

$plannerDefinition =
  Join-Path $explorerRoot ".codex\agents\playwright_test_planner.toml"

$generatorDefinition =
  Join-Path $explorerRoot ".codex\agents\playwright_test_generator.toml"

if (
  -not (Test-Path $plannerDefinition) -or
  -not (Test-Path $generatorDefinition)
) {
  Write-Host "Initializing Playwright Test Agents..."
  Push-Location $explorerRoot
  try {
    pnpm exec playwright init-agents --loop=codex

    if ($LASTEXITCODE -ne 0) {
      throw "playwright init-agents failed."
    }
  }
  finally {
    Pop-Location
  }
}

$summary = @()

foreach ($fixture in $fixtures) {
  $normalizedPath =
    Join-Path $explorerRoot "artifacts\competitive\playwright_agents\$fixture.json"

  if ($skipExisting -and (Test-Path $normalizedPath)) {
    Write-Host ""
    Write-Host "=== Playwright Agents: $fixture (skipped existing) ==="

    $summary += [PSCustomObject]@{
      Fixture = $fixture
      Status = "skipped"
      ExitCode = 0
    }

    continue
  }

  $portProbe =
    [System.Net.Sockets.TcpListener]::new(
      [System.Net.IPAddress]::Loopback,
      0
    )

  $portProbe.Start()

  try {
    $port =
      ([System.Net.IPEndPoint]$portProbe.LocalEndpoint).Port
  }
  finally {
    $portProbe.Stop()
  }

  $targetUrl = "http://127.0.0.1:$port"

  $rawDir =
    Join-Path $explorerRoot "artifacts\competitive\raw\playwright_agents\$fixture"

  $planDir =
    Join-Path $explorerRoot "specs\competitive"

  $planPath =
    Join-Path $planDir "$fixture.md"

  $testsDir =
    Join-Path $explorerRoot "tests\competitive\$fixture"

  $resumePlanner =
    $resumePartial -and (Test-Path $planPath)

  if (-not $resumePlanner) {
    Remove-Item $rawDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $planPath -Force -ErrorAction SilentlyContinue
  }

  Remove-Item $testsDir -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item $normalizedPath -Force -ErrorAction SilentlyContinue

  New-Item -ItemType Directory -Force $rawDir | Out-Null
  New-Item -ItemType Directory -Force $planDir | Out-Null
  New-Item -ItemType Directory -Force (Split-Path $testsDir) | Out-Null
  New-Item -ItemType Directory -Force (Split-Path $normalizedPath) | Out-Null

  $seedPath =
    Join-Path $explorerRoot "seed.spec.ts"

  @"
import { test, expect } from '@playwright/test';

test.describe('Competitive seed: $fixture', () => {
  test('seed', async ({ page }) => {
    await page.goto('$targetUrl');
    await expect(page.locator('body')).toBeVisible();
  });
});
"@ | Set-Content -Encoding UTF8 $seedPath

  $serverStdout =
    Join-Path $rawDir "fixture-server.stdout.txt"

  $serverStderr =
    Join-Path $rawDir "fixture-server.stderr.txt"

  Write-Host ""
  Write-Host "=== Playwright Agents: $fixture ==="
  Write-Host "Starting fixture at $targetUrl"

  $serverProcess = Start-Process `
    -FilePath "python" `
    -ArgumentList @(
      "-m",
      "http.server",
      "$port",
      "--bind",
      "127.0.0.1",
      "--directory",
      (Join-Path $repoRoot "fixtures\benchmark\$fixture")
    ) `
    -RedirectStandardOutput $serverStdout `
    -RedirectStandardError $serverStderr `
    -PassThru `
    -WindowStyle Hidden

  try {
    Start-Sleep -Seconds 1

    try {
      $response = Invoke-WebRequest `
        -Uri $targetUrl `
        -UseBasicParsing `
        -TimeoutSec 5

      if ($response.StatusCode -ne 200) {
        throw "Fixture returned HTTP $($response.StatusCode)."
      }
    }
    catch {
      throw "Fixture server did not become ready at $targetUrl. $($_.Exception.Message)"
    }

    $requirementsPath =
      "../../fixtures/benchmark/$fixture/requirements.md"

    $openApiPath =
      "../../fixtures/benchmark/$fixture/openapi.yaml"

    $planRelative =
      "specs/competitive/$fixture.md"

    $testsRelative =
      "tests/competitive/$fixture"

    $plannerPrompt = @"
You are performing exactly one Playwright Test planner pass for a competitive benchmark.

Fixture: $fixture
Target application: $targetUrl
Seed test: seed.spec.ts
Product requirements: $requirementsPath
OpenAPI context: $openApiPath
Required output: $planRelative

Use the Playwright Test MCP tools directly.

Protocol:
1. Read the supplied requirements and OpenAPI context.
2. Invoke planner_setup_page exactly once using seed.spec.ts.
3. Explore the running application only with the available browser_* Playwright MCP tools.
4. Create a comprehensive plan grounded only in the supplied requirements and observed application behavior.
5. Invoke planner_save_plan exactly once and save the untouched plan to $planRelative.
6. Stop after the plan is saved.

Hard benchmark rules:
- Do not generate tests.
- Do not invoke any healer behavior.
- Do not modify the fixture application.
- Do not modify requirements.md or openapi.yaml.
- Do not invent unsupported actions or outcomes.
- Do not manually simplify or improve the saved plan after planner_save_plan.
"@

    $plannerPrompt |
      Set-Content -Encoding UTF8 (Join-Path $rawDir "planner-prompt.txt")

    if ($resumePlanner) {
      Write-Host "Reusing completed planner output: $planPath"
    }
    else {
      Write-Host "Running planner..."

      Push-Location $explorerRoot
    try {
      codex exec --json --sandbox workspace-write $plannerPrompt 2>&1 |
        Tee-Object -FilePath (Join-Path $rawDir "planner-codex.jsonl")

      $plannerExit = $LASTEXITCODE
    }
    finally {
      Pop-Location
    }

    $plannerLog = Join-Path $rawDir "planner-codex.jsonl"

    if (
      (Test-Path $plannerLog) -and
      (Select-String -Path $plannerLog -SimpleMatch "hit your usage limit" -Quiet)
    ) {
      throw "CODEX_USAGE_LIMIT: planner usage limit reached."
    }

    if ($plannerExit -ne 0) {
      throw "Planner Codex run exited with code $plannerExit."
    }

    if (
      Select-String -Path $plannerLog -SimpleMatch "MCP tool call requires approval" -Quiet
    ) {
      throw "Planner was blocked by an MCP approval gate."
    }


      if (-not (Test-Path $planPath)) {
        throw "Planner output missing: $planPath"
      }
    }

    if (-not (Test-Path $planPath)) {
      throw "Planner output missing: $planPath"
    }

    $generatorPrompt = @"
You are performing exactly one Playwright Test generator pass for a competitive benchmark.

Fixture: $fixture
Target application: $targetUrl
Seed test: seed.spec.ts
Test plan: $planRelative
Required output directory: $testsRelative

Use the Playwright Test MCP tools directly.

Protocol:
1. Read the saved test plan at $planRelative.
2. For each scenario in that plan, invoke generator_setup_page for the scenario.
3. Execute the scenario steps with the available browser_* Playwright MCP tools.
4. Invoke generator_read_log.
5. Invoke generator_write_test to save the generated test under $testsRelative.
6. Preserve the scenario title from the plan.
7. Stop after all generated tests are written.

Hard benchmark rules:
- Do not invoke healer behavior.
- Do not manually repair generated tests.
- Do not add scenarios absent from the saved plan.
- Do not modify the fixture application.
- Do not modify requirements.md or openapi.yaml.
- Do not rerun the planner.
- Do not execute the generated test suite; the benchmark harness will execute it once afterward.
"@

    $generatorPrompt |
      Set-Content -Encoding UTF8 (Join-Path $rawDir "generator-prompt.txt")

    Write-Host "Running generator..."

    Push-Location $explorerRoot
    try {
      codex exec --json --sandbox workspace-write $generatorPrompt 2>&1 |
        Tee-Object -FilePath (Join-Path $rawDir "generator-codex.jsonl")

      $generatorExit = $LASTEXITCODE
    }
    finally {
      Pop-Location
    }

    $generatorLog = Join-Path $rawDir "generator-codex.jsonl"

    if (
      (Test-Path $generatorLog) -and
      (Select-String -Path $generatorLog -SimpleMatch "hit your usage limit" -Quiet)
    ) {
      throw "CODEX_USAGE_LIMIT: generator usage limit reached."
    }

    if ($generatorExit -ne 0) {
      throw "Generator Codex run exited with code $generatorExit."
    }

    if (
      Select-String -Path $generatorLog -SimpleMatch "MCP tool call requires approval" -Quiet
    ) {
      throw "Generator was blocked by an MCP approval gate."
    }


    if (-not (Test-Path $planPath)) {
      throw "Planner output missing: $planPath"
    }

    $testFiles = @(
      Get-ChildItem $testsDir -Recurse -Filter "*.spec.ts" -ErrorAction SilentlyContinue
    )

    if ($testFiles.Count -eq 0) {
      throw "Generator produced no .spec.ts files."
    }

    Copy-Item $planPath `
      (Join-Path $rawDir "$fixture.md") `
      -Force

    Copy-Item $testsDir `
      (Join-Path $rawDir "tests") `
      -Recurse `
      -Force

    $reportPath =
      Join-Path $rawDir "playwright-report.json"

    $playwrightStderr =
      Join-Path $rawDir "playwright.stderr.txt"

    Write-Host "Executing generated tests once..."

    Push-Location $repoRoot
    try {
      pnpm --filter @toverni/explorer exec playwright test "tests/competitive/$fixture" --reporter=json `
        1> $reportPath `
        2> $playwrightStderr

      $playwrightExit = $LASTEXITCODE
    }
    finally {
      Pop-Location
    }

    Write-Host "Normalizing benchmark artifact..."

    Push-Location $repoRoot
    try {
      pnpm --filter @toverni/explorer exec tsx `
        src/benchmark/normalize-playwright-agents-artifact.ts `
        $fixture

      $normalizeExit = $LASTEXITCODE
    }
    finally {
      Pop-Location
    }

    if ($normalizeExit -ne 0) {
      throw "Normalization failed with code $normalizeExit."
    }

    $summary += [PSCustomObject]@{
      Fixture = $fixture
      Status = if ($playwrightExit -eq 0) { "completed" } else { "completed-with-test-failures" }
      ExitCode = $playwrightExit
    }
  }
  catch {
    $failureMessage =
      $_.Exception.Message

    Write-Warning "Fixture $fixture failed: $failureMessage"

    $summary += [PSCustomObject]@{
      Fixture = $fixture
      Status = "failed"
      ExitCode = 1
    }

    if (
      $failureMessage -like "CODEX_USAGE_LIMIT:*"
    ) {
      Write-Warning "Codex usage limit reached. Stopping the batch immediately so remaining fixtures are not attempted."
      break
    }
  }
  finally {
    if ($serverProcess -and -not $serverProcess.HasExited) {
      Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
      $serverProcess.WaitForExit()
    }
  }
}

Write-Host ""
Write-Host "=== Playwright Agents Competitive Automation Complete ==="
$summary | Format-Table -AutoSize

if (
  @(
    $summary |
      Where-Object { $_.Status -eq "failed" }
  ).Count -gt 0
) {
  exit 1
}
