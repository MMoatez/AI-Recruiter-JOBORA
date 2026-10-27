$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "JOBORA_Backend"
$frontend = Join-Path $root "JOBORA_Frontend"
$ai = Join-Path $root "training-ai-service"
$backendEnv = Join-Path $backend ".env"
$aiEnv = Join-Path $ai ".env"

function Get-EnvValue([string]$Path, [string]$Name) {
  if (-not (Test-Path -LiteralPath $Path)) { return "" }
  $line = Get-Content -LiteralPath $Path | Where-Object { $_ -match "^\s*$([regex]::Escape($Name))=" } | Select-Object -Last 1
  if (-not $line) { return "" }
  return ($line -split "=", 2)[1].Trim().Trim('"').Trim("'")
}

function Set-EnvValue([string]$Path, [string]$Name, [string]$Value) {
  $lines = if (Test-Path -LiteralPath $Path) { @(Get-Content -LiteralPath $Path) } else { @() }
  $pattern = "^\s*$([regex]::Escape($Name))="
  $found = $false
  for ($index = 0; $index -lt $lines.Count; $index++) {
    if ($lines[$index] -match $pattern) {
      $lines[$index] = "$Name=$Value"
      $found = $true
    }
  }
  if (-not $found) { $lines += "$Name=$Value" }
  Set-Content -LiteralPath $Path -Value $lines -Encoding utf8
}

function New-MatchingToken {
  $bytes = New-Object byte[] 32
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
  return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

if (-not (Test-Path -LiteralPath $backendEnv)) {
  Copy-Item (Join-Path $backend ".env.example") $backendEnv
  Write-Host "Created JOBORA_Backend\.env from the example. Set a strong JWT_SECRET in that file, then run this command again."
  exit 1
}

if (-not (Get-EnvValue $backendEnv "JWT_SECRET") -or (Get-EnvValue $backendEnv "JWT_SECRET") -like "replace_*") {
  throw "Set a non-placeholder JWT_SECRET in JOBORA_Backend\.env before starting Jobora."
}

$token = Get-EnvValue $backendEnv "CV_MATCHING_INTERNAL_TOKEN"
if (-not $token) { $token = Get-EnvValue $backendEnv "TRAINING_AI_INTERNAL_TOKEN" }
if (-not $token -or $token -like "replace-with-*") {
  $token = New-MatchingToken
}
Set-EnvValue $backendEnv "CV_MATCHING_INTERNAL_TOKEN" $token
if (-not (Get-EnvValue $backendEnv "SQLITE_PATH")) { Set-EnvValue $backendEnv "SQLITE_PATH" "data/jobora.sqlite" }

if (-not (Test-Path -LiteralPath $aiEnv)) {
  Copy-Item (Join-Path $ai ".env.example") $aiEnv
}
Set-EnvValue $aiEnv "CV_MATCHING_INTERNAL_TOKEN" $token
Set-EnvValue $aiEnv "TRAINING_AI_INTERNAL_TOKEN" $token

if (-not (Test-Path (Join-Path $backend "node_modules\.bin\nest.cmd"))) {
  throw "Backend packages are missing. Run 'npm install' from JOBORA_Backend first."
}
if (-not (Test-Path (Join-Path $frontend "node_modules\.bin\vite.cmd"))) {
  throw "Frontend packages are missing. Run 'npm install' from JOBORA_Frontend first."
}

$python = Join-Path $ai ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $python)) {
  Write-Host "Setting up the internal Python AI environment (first run can take several minutes)..."
  & (Join-Path $ai "scripts\setup_windows.ps1")
  if ($LASTEXITCODE -ne 0) { throw "Training AI environment setup failed." }
}

$aiCommand = "Set-Location -LiteralPath '$ai'; & '.\.venv\Scripts\python.exe' -m uvicorn app.jobora_main:app --host 127.0.0.1 --port 8002"
$backendCommand = "Set-Location -LiteralPath '$backend'; npm run start:dev"
$frontendCommand = "Set-Location -LiteralPath '$frontend'; npm run dev"

$aiProcess = Start-Process powershell.exe -PassThru -ArgumentList @("-NoExit", "-Command", $aiCommand)
$backendProcess = Start-Process powershell.exe -PassThru -ArgumentList @("-NoExit", "-Command", $backendCommand)
$frontendProcess = Start-Process powershell.exe -PassThru -ArgumentList @("-NoExit", "-Command", $frontendCommand)

Write-Host "Matching stack started in separate PowerShell windows."
Write-Host "Internal AI PID: $($aiProcess.Id) | NestJS PID: $($backendProcess.Id) | Frontend PID: $($frontendProcess.Id)"
Write-Host "Frontend: http://localhost:8443"
Write-Host "Backend API: http://localhost:3000/api"
Write-Host "Internal matching AI: http://127.0.0.1:8002/internal/health"
Write-Host "SQLite database: $backend\data\jobora.sqlite"
Write-Host "No RAG, Gemini, or Groq credential is needed for CV matching."
