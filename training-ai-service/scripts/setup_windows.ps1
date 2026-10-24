$ErrorActionPreference = "Stop"

$serviceRoot = Split-Path -Parent $PSScriptRoot
$venvPath = Join-Path $serviceRoot ".venv"
$pythonPath = Join-Path $venvPath "Scripts\python.exe"
$constraintPath = Join-Path $serviceRoot "constraints-windows.txt"

Set-Location -LiteralPath $serviceRoot

if (-not (Test-Path -LiteralPath $pythonPath)) {
    py -3.12 -m venv $venvPath
}

& $pythonPath -m pip install --upgrade pip
& $pythonPath -m pip install --extra-index-url https://download.pytorch.org/whl/cpu `
    --constraint $constraintPath "torch==2.5.1+cpu"
& $pythonPath -m pip install --extra-index-url https://download.pytorch.org/whl/cpu `
    --constraint $constraintPath -e ".[dev]"
& $pythonPath -c "import fastapi, sentence_transformers, torch; assert torch.__version__ == '2.5.1+cpu'; print('Training AI environment ready:', torch.__version__)"

Write-Output "Run: .\.venv\Scripts\python.exe -m uvicorn app.jobora_main:app --host 127.0.0.1 --port 8002"
