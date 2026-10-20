Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$serviceDirectory = $PSScriptRoot
$venvDirectory = Join-Path $serviceDirectory ".venv"
$python = Join-Path $venvDirectory "Scripts\python.exe"

if (-not (Test-Path -LiteralPath $python)) {
  python -m venv $venvDirectory
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

& $python -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $python -m pip install -r (Join-Path $serviceDirectory "requirements.txt")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $python (Join-Path $serviceDirectory "manage.py") index
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Output "JOBORA local RAG setup completed."
