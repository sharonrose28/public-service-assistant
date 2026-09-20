$ErrorActionPreference = 'Stop'
$taskProjectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location -LiteralPath $taskProjectRoot
try {
    # The Node packager validates the source allowlist and rejects linked staging paths.
    & node scripts/package-aws.mjs
    if ($LASTEXITCODE -ne 0) { throw 'AWS packaging failed.' }
    $taskBuildRoot = Join-Path $taskProjectRoot '.build'
    $taskStaging = Join-Path $taskBuildRoot ('cloudshell-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $taskStaging | Out-Null
    Copy-Item -LiteralPath (Join-Path $taskBuildRoot 'aws') -Destination (Join-Path $taskStaging 'app') -Recurse
    $taskTemplate = Get-Content -LiteralPath deployment/template.yaml -Raw | ConvertFrom-Json
    $taskTemplate.Resources.AssistantFunction.Properties.CodeUri = './app/'
    [IO.File]::WriteAllText((Join-Path $taskStaging 'template.yaml'), ($taskTemplate | ConvertTo-Json -Depth 100))
    $taskDeploy = [IO.File]::ReadAllText((Join-Path $taskProjectRoot 'deployment/deploy-cloudshell.sh')).Replace("`r`n", "`n")
    [IO.File]::WriteAllText((Join-Path $taskStaging 'deploy-cloudshell.sh'), $taskDeploy)
    Copy-Item -LiteralPath (Join-Path $taskProjectRoot 'deployment/check-free-plan.py') -Destination (Join-Path $taskStaging 'check-free-plan.py')
    $taskZip = Join-Path $taskBuildRoot 'public-service-assistant-mumbai.zip'
    if (Test-Path -LiteralPath $taskZip) {
        if ((Get-Item -LiteralPath $taskZip).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'The archive must not be a link.' }
    }
    Compress-Archive -Path (Join-Path $taskStaging '*') -DestinationPath $taskZip -Force
    Write-Output "CloudShell upload archive: $taskZip"
    Write-Output 'Contains only reviewed runtime files and deployment configuration; no credentials or .env files.'
} finally { Pop-Location }
