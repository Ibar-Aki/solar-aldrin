param(
    [Parameter(Mandatory = $true)]
    [string]$AllowedOrigins,
    [string]$BaseUrl,
    [switch]$SkipOpenAiKeyUpdate,
    [switch]$SkipDeploy
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
$appDir = Join-Path $repoRoot 'apps\v2-modern'
$runner = Join-Path $appDir 'scripts\security\automate-security-ops.ps1'

if (-not (Test-Path $runner)) {
    throw "Runner script not found: $runner"
}
if (-not (Test-Path (Join-Path $appDir 'package.json'))) {
    throw "package.json not found under: $appDir"
}

$invokeArgs = @{
    AllowedOrigins = $AllowedOrigins
}
if ($PSBoundParameters.ContainsKey('BaseUrl')) {
    $invokeArgs.BaseUrl = $BaseUrl
}
if ($SkipOpenAiKeyUpdate) {
    $invokeArgs.SkipOpenAiKeyUpdate = $true
}
if ($SkipDeploy) {
    $invokeArgs.SkipDeploy = $true
}

Push-Location $appDir
try {
    & $runner @invokeArgs
} finally {
    Pop-Location
}
