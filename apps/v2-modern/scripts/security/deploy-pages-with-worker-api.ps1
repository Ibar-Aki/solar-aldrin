param(
    [Parameter(Mandatory = $true)]
    [string]$ApiBaseUrl,
    [Parameter(Mandatory = $true)]
    [string]$ApiToken,
    [string]$ProjectName = 'voice-ky-v2'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($ApiBaseUrl.Contains('<') -or $ApiBaseUrl.Contains('>')) {
    throw 'ApiBaseUrl contains placeholder text.'
}
if ($ApiToken.Contains('<') -or $ApiToken.Contains('>')) {
    throw 'ApiToken contains placeholder text.'
}

$uri = $null
if (-not [System.Uri]::TryCreate($ApiBaseUrl, [System.UriKind]::Absolute, [ref]$uri)) {
    throw "ApiBaseUrl is invalid: $ApiBaseUrl"
}
if ($uri.Scheme -ne 'https') {
    throw "ApiBaseUrl must use https: $ApiBaseUrl"
}

$env:VITE_API_BASE_URL = $ApiBaseUrl.TrimEnd('/')
$env:VITE_API_TOKEN = $ApiToken

npm run build
if ($LASTEXITCODE -ne 0) {
    throw 'npm run build failed.'
}

npx wrangler pages deploy dist --project-name $ProjectName --commit-dirty=true
if ($LASTEXITCODE -ne 0) {
    throw 'wrangler pages deploy failed.'
}

Write-Host "Deployed Pages project: $ProjectName"
Write-Host "VITE_API_BASE_URL: $env:VITE_API_BASE_URL"
