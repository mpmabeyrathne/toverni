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

$plannerDefinition =
  Join-Path $explorerRoot ".codex\agents\playwright_test_planner.toml"

$generatorDefinition =
  Join-Path $explorerRoot ".codex\agents\playwright_test_generator.toml"

if (
  -not (Test-Path $plannerDefinition) -or
  -not (Test-Path $generatorDefinition)
) {
  Write-Host "Initializing Playwright Test Agents..."
  Push-Location $repoRoot
  try {
    pnpm --filter @toverni/explorer exec playwright init-agents --loop=codex

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

  New-Item -ItemType Directory -Force $rawDir | Out-Null
  New-Item -ItemType Directory -Force $planDir | Out-Null
  New-Item -ItemType Directory -Force (Split-Path $testsDir) | Out-Null
  New-Item -ItemType Directory -Force (Split-Path $normalizedPath) | Out-Null

  Remove-Item $planPath -Force -ErrorAction SilentlyContinue
  Remove-Item $testsDir -Recurse -Force -ErrorAction SilentlyContinue

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
      "fixtures/benchmark/$fixture/requirements.md"

    $openApiPath =
      "fixtures/benchmark/$fixture/openapi.yaml"

    $planRelative =
      "apps/explorer/specs/competitive/$fixture.md"

    $testsRelative =
      "apps/explorer/tests/competitive/$fixture"

    $prompt = @"
This is an automated competitive benchmark run.

Fixture: $fixture
Target application: $targetUrl
Seed test: apps/explorer/seed.spec.ts
Product requirements: $requirementsPath
OpenAPI context: $openApiPath

Perform exactly one Playwright Test Agents planner pass and then exactly one generator pass.

1. Invoke the playwright_test_planner agent.
2. Save its untouched plan to $planRelative.
3. After the planner finishes, invoke the playwright_test_generator agent exactly once.
4. Generate tests under $testsRelative.

Hard benchmark rules:
- Do not invoke playwright_test_healer.
- Do not manually edit, repair, simplify, or improve the generated plan.
- Do not manually edit or repair generated tests.
- Do not rerun the planner or generator.
- Do not add scenarios that are absent from the planner output.
- Do not modify the fixture application.
- Do not modify requirements.md or openapi.yaml.
- Do not invent unsupported actions or outcomes.
- Keep planner omissions and generator omissions visible.
- Do not execute or heal the generated tests; the benchmark harness will execute them once after generation.

Finish after the generator has written its files.
"@

    $prompt |
      Set-Content -Encoding UTF8 (Join-Path $rawDir "prompt.txt")

    Write-Host "Running planner + generator..."

    Push-Location $repoRoot
    try {
      codex exec --json --full-auto $prompt 2>&1 |
        Tee-Object -FilePath (Join-Path $rawDir "codex.jsonl")

      $codexExit = $LASTEXITCODE
    }
    finally {
      Pop-Location
    }

    if ($codexExit -ne 0) {
      throw "Codex exited with code $codexExit."
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
    Write-Warning "Fixture $fixture failed: $($_.Exception.Message)"

    $summary += [PSCustomObject]@{
      Fixture = $fixture
      Status = "failed"
      ExitCode = 1
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
