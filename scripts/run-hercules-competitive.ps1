$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$explorerRoot = Join-Path $repoRoot "apps\explorer"

$allFixtures = @("booking","todo","commerce","auth-rbac","checkout-form","data-grid","upload-retry")

if ($env:COMPETITIVE_FIXTURE) {
  $fixtures = $env:COMPETITIVE_FIXTURE.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
} else {
  $fixtures = $allFixtures
}

$invalid = @($fixtures | Where-Object { $_ -notin $allFixtures })
if ($invalid.Count -gt 0) { throw "Unknown fixture(s): $($invalid -join ', ')" }

$skipExisting = $env:COMPETITIVE_SKIP_EXISTING -eq "true"

if ($env:HERCULES_EXE) {
  $herculesExe = $env:HERCULES_EXE
} else {
  $herculesExe = Join-Path $repoRoot ".venv-hercules\Scripts\testzeus-hercules.exe"
}

if ($env:HERCULES_LLM_CONFIG) {
  $configPath = $env:HERCULES_LLM_CONFIG
} else {
  $configPath = Join-Path $explorerRoot "config\hercules-benchmark-agents.json"
}

if (-not (Test-Path $herculesExe)) { throw "Hercules executable not found: $herculesExe" }
if (-not (Test-Path $configPath)) { throw "Hercules LLM config not found: $configPath" }
if (-not $env:BEDROCK_API_KEY) { throw "BEDROCK_API_KEY is required. Do not commit or write the key to benchmark files." }

$env:OPENAI_API_KEY = $env:BEDROCK_API_KEY
$env:MODEL_API_KEY = $env:BEDROCK_API_KEY
if (-not $env:LLM_REQUEST_TIMEOUT) { $env:LLM_REQUEST_TIMEOUT = "180" }
if (-not $env:LLM_MAX_RETRIES) { $env:LLM_MAX_RETRIES = "0" }

Write-Host "Checking Bedrock Mantle credentials..."

$preflightHeaders = @{
  Authorization = "Bearer $env:BEDROCK_API_KEY"
  "Content-Type" = "application/json"
}

$preflightBody = @{
  model = "openai.gpt-oss-20b"
  messages = @(
    @{
      role = "user"
      content = "Reply only with OK"
    }
  )
  max_tokens = 16
  temperature = 0
} | ConvertTo-Json -Depth 10

try {
  $null = Invoke-RestMethod -Uri "https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions" -Method Post -Headers $preflightHeaders -Body $preflightBody
  Write-Host "Bedrock Mantle credentials OK."
}
catch {
  $detail = $_.ErrorDetails.Message

  if (-not $detail) {
    $detail = $_.Exception.Message
  }

  throw "Bedrock Mantle preflight failed. Re-set BEDROCK_API_KEY in this PowerShell session and retry. AWS response: $detail"
}

$summary = @()

foreach ($fixture in $fixtures) {
  $normalizedPath = Join-Path $explorerRoot "artifacts\competitive\hercules\$fixture.json"

  if ($skipExisting -and (Test-Path $normalizedPath)) {
    Write-Host ""
    Write-Host "=== Hercules: $fixture (skipped existing) ==="
    $summary += [PSCustomObject]@{ Fixture=$fixture; Status="skipped"; ExitCode=0; Scenarios=0; Passed=0; Failed=0 }
    continue
  }

  $portProbe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  $portProbe.Start()
  try { $port = ([System.Net.IPEndPoint]$portProbe.LocalEndpoint).Port } finally { $portProbe.Stop() }

  $targetUrl = "http://127.0.0.1:$port"
  $rawDir = Join-Path $explorerRoot "artifacts\competitive\raw\hercules\$fixture"
  Remove-Item $rawDir -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item $normalizedPath -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force $rawDir | Out-Null
  New-Item -ItemType Directory -Force (Split-Path $normalizedPath) | Out-Null

  $fixtureRoot = Join-Path $repoRoot "fixtures\benchmark\$fixture"
  $requirements = Get-Content (Join-Path $fixtureRoot "requirements.md") -Raw
  $openApi = Get-Content (Join-Path $fixtureRoot "openapi.yaml") -Raw

  $promptLines = @(
    "You are performing exactly one TestZeus Hercules guided generation and execution pass for a competitive benchmark.",
    "",
    "Fixture: $fixture",
    "Target application: $targetUrl",
    "",
    "Create the single most important deterministic browser scenario that is grounded in the frozen requirements and supported by the target application.",
    "",
    "Protocol:",
    "- The scenario must explicitly open $targetUrl so execution can navigate from about:blank.",
    "- Prefer an important end-to-end user flow from the requirements.",
    "- Use only behavior stated in the frozen requirements/OpenAPI context.",
    "- Do not invent hidden controls, data, APIs, actions, or outcomes.",
    "- Do not combine unrelated flows merely to increase coverage.",
    "- Do not perform manual healing, rewriting, or a second generation pass.",
    "- A runtime assertion failure is a valid benchmark result and must not be repaired.",
    "",
    "Frozen requirements:",
    $requirements,
    "",
    "Frozen OpenAPI context:",
    $openApi
  )
  $prompt = $promptLines -join [Environment]::NewLine

  $promptPath = Join-Path $rawDir "hercules-prompt.txt"
  $prompt | Set-Content -Encoding UTF8 $promptPath
  $serverStdout = Join-Path $rawDir "fixture-server.stdout.txt"
  $serverStderr = Join-Path $rawDir "fixture-server.stderr.txt"
  $logPath = Join-Path $rawDir "hercules.stdout.txt"

  Write-Host ""
  Write-Host "=== Hercules: $fixture ==="
  Write-Host "Starting fixture at $targetUrl"

  $serverArgs = @{
    FilePath = "python"
    ArgumentList = @("-m","http.server","$port","--bind","127.0.0.1","--directory",$fixtureRoot)
    RedirectStandardOutput = $serverStdout
    RedirectStandardError = $serverStderr
    PassThru = $true
    WindowStyle = "Hidden"
  }
  $serverProcess = Start-Process @serverArgs

  try {
    Start-Sleep -Seconds 1
    try {
      $response = Invoke-WebRequest -Uri $targetUrl -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -ne 200) { throw "Fixture returned HTTP $($response.StatusCode)." }
    } catch {
      throw "Fixture server did not become ready at $targetUrl. $($_.Exception.Message)"
    }

    Write-Host "Running one Hercules guided pass..."
    Push-Location $repoRoot
    try {
      # Windows PowerShell 5 converts native-process stderr lines into
      # ErrorRecord objects. Hercules writes harmless Python warnings to
      # stderr, so the script-level ErrorActionPreference=Stop would abort
      # before the native process can finish. Let the process complete, then
      # fail closed using its exit code and explicit provider-error checks.
      $previousErrorActionPreference = $ErrorActionPreference
      $ErrorActionPreference = "Continue"

      try {
        & $herculesExe --test $prompt --output-path $rawDir --project-base $rawDir --agents-llm-config-file $configPath --agents-llm-config-file-ref-key litellm 2>&1 |
          Tee-Object -FilePath $logPath

        $herculesExit = $LASTEXITCODE
      }
      finally {
        $ErrorActionPreference = $previousErrorActionPreference
      }
    }
    finally {
      Pop-Location
    }

    $providerFailure = (Test-Path $logPath) -and (Select-String -Path $logPath -Pattern @("rate_limit_error","RateLimitError","Missing credentials","authentication_error","AuthenticationError","invalid_api_key","APIConnectionError","APITimeoutError","AccessDenied","Too many tokens per day") -Quiet)
    if ($providerFailure) { throw "Hercules provider/infra failure detected. Raw log preserved at $logPath." }
    if ($herculesExit -ne 0) { throw "Hercules exited with code $herculesExit." }

    $junitCandidates = @(Get-ChildItem -Path $rawDir -Recurse -Filter "*.feature_result.xml" -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending)
    if ($junitCandidates.Count -eq 0) { throw "Hercules produced no feature_result.xml artifact." }
    Copy-Item $junitCandidates[0].FullName (Join-Path $rawDir "hercules-result.xml") -Force

    $htmlCandidates = @(Get-ChildItem -Path $rawDir -Recurse -Filter "*.feature_result.html" -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending)
    if ($htmlCandidates.Count -gt 0) { Copy-Item $htmlCandidates[0].FullName (Join-Path $rawDir "hercules-result.html") -Force }

    Write-Host "Normalizing benchmark artifact..."
    Push-Location $explorerRoot
    try {
      pnpm exec tsx src/benchmark/normalize-hercules-artifact.ts $fixture
      $normalizeExit = $LASTEXITCODE
    } finally { Pop-Location }
    if ($normalizeExit -ne 0) { throw "Hercules normalization failed with code $normalizeExit." }

    $artifact = Get-Content $normalizedPath -Raw | ConvertFrom-Json
    $passed = @($artifact.scenarios | Where-Object { $_.runtimeStatus -eq "passed" }).Count
    $failed = @($artifact.scenarios | Where-Object { $_.runtimeStatus -in @("failed","runtime_error") }).Count
    $status = if ($failed -gt 0) { "completed-with-test-failures" } else { "completed" }
    $summary += [PSCustomObject]@{ Fixture=$fixture; Status=$status; ExitCode=0; Scenarios=$artifact.scenarios.Count; Passed=$passed; Failed=$failed }
  } catch {
    $failureMessage = $_.Exception.Message
    Write-Warning "Fixture $fixture failed: $failureMessage"
    $summary += [PSCustomObject]@{ Fixture=$fixture; Status="failed"; ExitCode=1; Scenarios=0; Passed=0; Failed=0 }
  } finally {
    if ($serverProcess -and -not $serverProcess.HasExited) {
      Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
      $serverProcess.WaitForExit()
    }
  }
}

Write-Host ""
Write-Host "=== Hercules Competitive Automation Complete ==="
$summary | Format-Table -AutoSize

if (@($summary | Where-Object { $_.Status -eq "failed" }).Count -gt 0) { exit 1 }
