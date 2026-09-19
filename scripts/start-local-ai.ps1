#Requires -Version 7.4
param(
    [ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9./:@_-]+$')]
    [string]$Model = 'qwen3:1.7b',
    [switch]$PullModel
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $projectRoot '.build/local-ai'
$ollamaExe = Join-Path $runtimeRoot 'ollama/ollama.exe'
$pythonExe = Join-Path $projectRoot 'agents/.venv/Scripts/python.exe'
$agentServer = Join-Path $projectRoot 'agents/server.py'
if (-not (Test-Path -LiteralPath $ollamaExe)) { throw 'Install the official portable Ollama release in .build/local-ai/ollama first. See agents/README.md.' }
if (-not (Test-Path -LiteralPath $pythonExe)) { throw 'Create agents/.venv and install agents/requirements.txt first.' }
if ($Model -match 'cloud') { throw 'Choose an installed local model, not an Ollama cloud model.' }

foreach ($directory in @('models','profile','temp')) {
    New-Item -ItemType Directory -Force (Join-Path $runtimeRoot $directory) | Out-Null
}

# These overrides apply only to the new child processes, not the Windows account.
# Ollama's local identity, model weights and temporary files stay inside the workspace.
$ollamaEnvironment = @{
    OLLAMA_HOST = '127.0.0.1:11434'
    OLLAMA_MODELS = (Join-Path $runtimeRoot 'models')
    OLLAMA_NO_CLOUD = '1'
    OLLAMA_DEBUG = '0'
    OLLAMA_DEBUG_LOG_REQUESTS = 'false'
    OLLAMA_NUM_PARALLEL = '1'
    OLLAMA_MAX_LOADED_MODELS = '1'
    OLLAMA_CONTEXT_LENGTH = '8192'
    OLLAMA_KEEP_ALIVE = '10m'
    USERPROFILE = (Join-Path $runtimeRoot 'profile')
    TEMP = (Join-Path $runtimeRoot 'temp')
    TMP = (Join-Path $runtimeRoot 'temp')
}

function Read-LocalJson([string]$Url) {
    try { Invoke-RestMethod -Uri $Url -TimeoutSec 3 -NoProxy } catch { $null }
}

$ollamaProcess = $null
if (-not (Read-LocalJson 'http://127.0.0.1:11434/api/version')) {
    $ollamaProcess = Start-Process -FilePath $ollamaExe -ArgumentList 'serve' -WorkingDirectory $runtimeRoot -Environment $ollamaEnvironment -WindowStyle Hidden -PassThru
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if (Read-LocalJson 'http://127.0.0.1:11434/api/version') { break }
        if ($ollamaProcess.HasExited) { throw 'Ollama stopped during startup.' }
        Start-Sleep -Milliseconds 250
    }
}
if (-not (Read-LocalJson 'http://127.0.0.1:11434/api/version')) { throw 'Ollama did not become ready on port 11434.' }

$tags = Read-LocalJson 'http://127.0.0.1:11434/api/tags'
if ($tags.models.name -notcontains $Model) {
    if (-not $PullModel) { throw "Model $Model is not installed. Run this script with -PullModel to download it explicitly." }
    Write-Host "Downloading local model $Model from the official Ollama registry..."
    # Pull has no citizen input; it only installs the explicitly named local model.
    $body = @{ model = $Model; stream = $false } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:11434/api/pull' -ContentType 'application/json' -Body $body -TimeoutSec 1800 -NoProxy | Out-Null
}

# Load weights before the first citizen request so cold startup does not consume
# the assistant's 45-second inference budget. This request contains no prompt.
Write-Host "Loading local model $Model..."
$warmup = @{ model = $Model; stream = $false; keep_alive = '10m' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:11434/api/generate' -ContentType 'application/json' -Body $warmup -TimeoutSec 120 -NoProxy | Out-Null

$existingAgent = Read-LocalJson 'http://127.0.0.1:8001/health'
if ($existingAgent -and $existingAgent.model -ne $Model) { throw "The sidecar on port 8001 uses $($existingAgent.model). Stop that sidecar before choosing another model." }
$agentProcess = $null
if (-not $existingAgent) {
    $agentEnvironment = @{
        OLLAMA_HOST = 'http://127.0.0.1:11434'
        OLLAMA_MODEL = $Model
        STRANDS_PORT = '8001'
        STRANDS_TIMEOUT_SECONDS = '45'
        PYTHONDONTWRITEBYTECODE = '1'
        TEMP = (Join-Path $runtimeRoot 'temp')
        TMP = (Join-Path $runtimeRoot 'temp')
    }
    $agentProcess = Start-Process -FilePath $pythonExe -ArgumentList @('-B', ('"' + $agentServer + '"')) -WorkingDirectory $projectRoot -Environment $agentEnvironment -WindowStyle Hidden -PassThru
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if (Read-LocalJson 'http://127.0.0.1:8001/health') { break }
        if ($agentProcess.HasExited) { throw 'The Strands sidecar stopped. Check its Python dependencies.' }
        Start-Sleep -Milliseconds 250
    }
}
$agentHealth = Read-LocalJson 'http://127.0.0.1:8001/health'
if (-not $agentHealth) { throw 'Strands did not become ready on port 8001.' }

$previousState = $null
$stateFile = Join-Path $runtimeRoot 'processes.json'
if (Test-Path -LiteralPath $stateFile) { $previousState = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json }
$state = [ordered]@{
    ollamaPid = $(if ($ollamaProcess) { $ollamaProcess.Id } else { $previousState.ollamaPid })
    strandsPid = $agentHealth.processId
    model = $Model
    ollamaUrl = 'http://127.0.0.1:11434'
    strandsUrl = 'http://127.0.0.1:8001'
}
$state | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding utf8
$state | ConvertTo-Json
