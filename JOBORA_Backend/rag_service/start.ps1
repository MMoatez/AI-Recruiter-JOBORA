Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$python = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $python)) {
  throw "RAG environment is missing. Run npm run rag:setup first."
}

& $python (Join-Path $PSScriptRoot "app.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
