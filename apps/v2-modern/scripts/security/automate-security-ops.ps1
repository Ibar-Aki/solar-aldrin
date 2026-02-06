param(
    [Parameter(Mandatory = $true)]
    [string]$AllowedOrigins,
    [string]$BaseUrl,
    [switch]$SkipOpenAiKeyUpdate,
    [switch]$SkipDeploy
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$WranglerTomlPath = Join-Path (Get-Location) 'wrangler.toml'
if (-not (Test-Path $WranglerTomlPath)) {
    throw "wrangler.toml not found in current directory."
}
$WranglerToml = Get-Content -Path $WranglerTomlPath -Raw
$ProjectName = [regex]::Match($WranglerToml, '(?m)^\s*name\s*=\s*"([^"]+)"\s*$').Groups[1].Value
if ([string]::IsNullOrWhiteSpace($ProjectName)) {
    throw 'Failed to resolve Pages project name from wrangler.toml.'
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "== $Title ==" -ForegroundColor Cyan
}

function Invoke-CheckedCommand {
    param(
        [string]$Command,
        [string[]]$Arguments,
        [string]$ErrorMessage
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw $ErrorMessage
    }
}

function Set-WranglerSecret {
    param(
        [string]$Name,
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "Secret '$Name' must not be empty."
    }

    $Value | npx wrangler pages secret put $Name --project-name $ProjectName | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed: wrangler pages secret put $Name --project-name $ProjectName"
    }
    Write-Host "  - Secret updated: $Name"
}

function New-HexToken {
    param([int]$BytesLength = 32)
    $bytes = New-Object byte[] $BytesLength
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($bytes)
    } finally {
        $rng.Dispose()
    }
    return ([System.BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}

function Invoke-CurlRequest {
    param(
        [string]$Method,
        [string]$Url,
        [hashtable]$Headers = @{},
        [string]$Body = ''
    )

    $tmpFile = [System.IO.Path]::GetTempFileName()
    try {
        $args = @('-sS', '-o', $tmpFile, '-w', '%{http_code}', '-X', $Method)
        foreach ($key in $Headers.Keys) {
            $args += @('-H', "${key}: $($Headers[$key])")
        }
        if ($Method -eq 'POST') {
            $args += @('-H', 'Content-Type: application/json', '-d', $Body)
        }
        $args += $Url

        $statusText = & curl.exe @args
        if ($LASTEXITCODE -ne 0) {
            throw "curl request failed: $Url"
        }

        $statusCode = 0
        if (-not [int]::TryParse($statusText, [ref]$statusCode)) {
            throw "Failed to parse HTTP status: $statusText"
        }

        $responseBody = Get-Content -Path $tmpFile -Raw
        return [pscustomobject]@{
            StatusCode = $statusCode
            Body = $responseBody
        }
    } finally {
        Remove-Item -Path $tmpFile -Force -ErrorAction SilentlyContinue
    }
}

function Assert-StatusCode {
    param(
        [string]$Label,
        [int]$Expected,
        [int]$Actual,
        [string]$Body
    )

    if ($Expected -ne $Actual) {
        throw "$Label failed. expected=$Expected actual=$Actual body=$Body"
    }
    Write-Host ("  - {0}: OK ({1})" -f $Label, $Actual)
}

function Assert-NotPlaceholder {
    param(
        [string]$Name,
        [string]$Value,
        [switch]$AllowEmpty
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        if ($AllowEmpty) {
            return
        }
        throw "$Name is required."
    }

    if ($Value.Contains('<') -or $Value.Contains('>')) {
        throw "$Name contains placeholder text. Replace <...> with actual values."
    }
}

function Assert-HttpUrl {
    param(
        [string]$Name,
        [string]$Value,
        [switch]$AllowEmpty
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        if ($AllowEmpty) {
            return
        }
        throw "$Name is required."
    }

    $uri = $null
    if (-not [System.Uri]::TryCreate($Value, [System.UriKind]::Absolute, [ref]$uri)) {
        throw "$Name must be a valid absolute URL: $Value"
    }
    if ($uri.Scheme -ne 'https' -and $uri.Scheme -ne 'http') {
        throw "$Name must start with https:// or http://: $Value"
    }
}

Assert-NotPlaceholder -Name 'AllowedOrigins' -Value $AllowedOrigins
Assert-NotPlaceholder -Name 'BaseUrl' -Value $BaseUrl -AllowEmpty
Assert-HttpUrl -Name 'BaseUrl' -Value $BaseUrl -AllowEmpty

$originList = @(
    $AllowedOrigins.Split(',') |
    ForEach-Object { $_.Trim() } |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
)
if ($originList.Count -eq 0) {
    throw 'AllowedOrigins must include at least one origin.'
}
foreach ($origin in $originList) {
    Assert-HttpUrl -Name "AllowedOrigins origin" -Value $origin
}
$AllowedOrigins = $originList -join ','

Write-Section "Prerequisites"
Invoke-CheckedCommand -Command 'npm' -Arguments @('--version') -ErrorMessage 'npm is not available.'
Invoke-CheckedCommand -Command 'npx' -Arguments @('--version') -ErrorMessage 'npx is not available.'
Invoke-CheckedCommand -Command 'npx' -Arguments @('wrangler', '--version') -ErrorMessage 'wrangler is not available.'

Write-Host "Checking wrangler login..."
npx wrangler whoami *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Not logged in to wrangler. Run: npx wrangler login"
}
Write-Host "  - wrangler login: OK"
Write-Host "  - pages project: $ProjectName"

Write-Section "Apply Security Settings"
$apiToken = New-HexToken
Set-WranglerSecret -Name 'API_TOKEN' -Value $apiToken
Set-WranglerSecret -Name 'REQUIRE_API_TOKEN' -Value '1'
Set-WranglerSecret -Name 'REQUIRE_RATE_LIMIT_KV' -Value '1'
Set-WranglerSecret -Name 'STRICT_CORS' -Value '1'
Set-WranglerSecret -Name 'ALLOWED_ORIGINS' -Value $AllowedOrigins

if (-not $SkipOpenAiKeyUpdate) {
    $openAiApiKey = Read-Host "Paste OPENAI_API_KEY to rotate (press Enter to keep current)"
    if (-not [string]::IsNullOrWhiteSpace($openAiApiKey)) {
        Set-WranglerSecret -Name 'OPENAI_API_KEY' -Value $openAiApiKey
    } else {
        Write-Host "  - OPENAI_API_KEY unchanged"
    }
}

Write-Host ""
Write-Host "Generated API_TOKEN (store securely):" -ForegroundColor Yellow
Write-Host $apiToken -ForegroundColor Yellow

Write-Section "Local Validation"
Invoke-CheckedCommand -Command 'npm' -Arguments @('run', 'security:local') -ErrorMessage 'Local validation failed.'

if (-not $SkipDeploy) {
    Write-Section "Deploy"
    Invoke-CheckedCommand -Command 'npm' -Arguments @('run', 'deploy:pages') -ErrorMessage 'Pages deploy failed.'
}

if (-not [string]::IsNullOrWhiteSpace($BaseUrl)) {
    Write-Section "Post-Deploy Smoke Tests"
    $normalizedBaseUrl = $BaseUrl.TrimEnd('/')
    $metricsBody = '{"event":"session_start"}'

    $health = Invoke-CurlRequest -Method 'GET' -Url "$normalizedBaseUrl/api/health"
    Assert-StatusCode -Label 'health check' -Expected 200 -Actual $health.StatusCode -Body $health.Body

    $unauthMetrics = Invoke-CurlRequest -Method 'POST' -Url "$normalizedBaseUrl/api/metrics" -Body $metricsBody
    Assert-StatusCode -Label 'metrics unauthenticated' -Expected 401 -Actual $unauthMetrics.StatusCode -Body $unauthMetrics.Body

    $authHeaders = @{ Authorization = "Bearer $apiToken" }
    $authMetrics = Invoke-CurlRequest -Method 'POST' -Url "$normalizedBaseUrl/api/metrics" -Headers $authHeaders -Body $metricsBody
    Assert-StatusCode -Label 'metrics authenticated' -Expected 200 -Actual $authMetrics.StatusCode -Body $authMetrics.Body

    $forbiddenHeaders = @{
        Authorization = "Bearer $apiToken"
        Origin = 'https://evil.example.com'
    }
    $forbiddenMetrics = Invoke-CurlRequest -Method 'POST' -Url "$normalizedBaseUrl/api/metrics" -Headers $forbiddenHeaders -Body $metricsBody
    Assert-StatusCode -Label 'metrics forbidden origin' -Expected 403 -Actual $forbiddenMetrics.StatusCode -Body $forbiddenMetrics.Body
}

Write-Section "Done"
Write-Host "Security operations have been completed."
Write-Host "If needed, update frontend VITE_API_TOKEN with the same value."
