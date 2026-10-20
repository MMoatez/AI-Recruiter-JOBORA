param([switch]$Force)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$python = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $python)) {
  throw "RAG environment is missing. Run npm run rag:setup first."
}

$arguments = @((Join-Path $PSScriptRoot "manage.py"), "index")
if ($Force) { $arguments += "--force" }
& $python @arguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
