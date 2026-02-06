param(
    [string]$BaseUrl = $env:LIVE_BASE_URL,
    [string]$ApiBaseUrl = $env:LIVE_API_BASE_URL,
    [string]$ApiToken = $env:VITE_API_TOKEN,
    [string]$Prompt = 'safety check test',
    [switch]$SkipChat
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http

function Invoke-HttpRequest {
    param(
        [string]$Method,
        [string]$Url,
        [hashtable]$Headers = @{},
        [string]$Body = ''
    )

    $client = [System.Net.Http.HttpClient]::new()
    try {
        $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), $Url)
        foreach ($key in $Headers.Keys) {
            [void]$request.Headers.TryAddWithoutValidation($key, [string]$Headers[$key])
        }
        if ($Method -eq 'POST') {
            $request.Content = [System.Net.Http.StringContent]::new($Body, [System.Text.Encoding]::UTF8, 'application/json')
        }
        $response = $client.SendAsync($request).GetAwaiter().GetResult()
        return [pscustomobject]@{
            StatusCode = [int]$response.StatusCode
            Body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        }
    } finally {
        $client.Dispose()
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
    Write-Host ("[OK] {0}: {1}" -f $Label, $Actual)
}

function Resolve-DefaultPagesUrl {
    $tomlPath = Join-Path (Get-Location) 'wrangler.toml'
    if (-not (Test-Path $tomlPath)) {
        return $null
    }

    $toml = Get-Content -Path $tomlPath -Raw
    $match = [regex]::Match($toml, '(?m)^\s*name\s*=\s*\"([^\"]+)\"\s*$')
    if (-not $match.Success) {
        return $null
    }

    $name = $match.Groups[1].Value.Trim()
    if ([string]::IsNullOrWhiteSpace($name)) {
        return $null
    }

    return "https://$name.pages.dev"
}

function Normalize-ApiRoot {
    param([string]$Value)

    $trimmed = $Value.TrimEnd('/')
    if ($trimmed.EndsWith('/api')) {
        return $trimmed.Substring(0, $trimmed.Length - 4)
    }
    return $trimmed
}

function Get-FirstAssetJsUrl {
    param([string]$PagesUrl)

    $html = Invoke-WebRequest -Uri $PagesUrl -UseBasicParsing
    $content = [string]$html.Content

    $matches = [regex]::Matches($content, 'src=\"([^\"]+assets/[^\"]+\.js)\"')
    if ($matches.Count -eq 0) {
        return $null
    }

    $src = $matches[0].Groups[1].Value
    if ($src.StartsWith('http')) {
        return $src
    }

    return ($PagesUrl.TrimEnd('/') + $src)
}

function Resolve-ApiSettingsFromBundle {
    param([string]$PagesUrl)

    $assetUrl = Get-FirstAssetJsUrl -PagesUrl $PagesUrl
    if ([string]::IsNullOrWhiteSpace($assetUrl)) {
        throw "Failed to resolve assets js from PagesUrl: $PagesUrl"
    }

    $js = (Invoke-WebRequest -Uri $assetUrl -UseBasicParsing).Content

    $apiCandidates = @([regex]::Matches($js, 'https://[^\"''\s]+/api\b') | ForEach-Object { $_.Value } | Select-Object -Unique)
    $apiBaseUrl = $null
    if ($apiCandidates.Count -gt 0) {
        $apiBaseUrl = ($apiCandidates | Where-Object { $_ -match 'workers\.dev/api' } | Select-Object -First 1)
        if (-not $apiBaseUrl) {
            $apiBaseUrl = ($apiCandidates | Select-Object -First 1)
        }
    }

    $token = $null
    $authMatch = [regex]::Match($js, 'Authorization:`Bearer\s+\$\{([A-Za-z0-9_$]+)\}`')
    if ($authMatch.Success) {
        $varName = $authMatch.Groups[1].Value
        $escapedVarName = [regex]::Escape($varName)
        $tokenMatch = [regex]::Match($js, "\b$escapedVarName\s*=\s*""([a-f0-9]{64})""")
        if ($tokenMatch.Success) {
            $token = $tokenMatch.Groups[1].Value
        }
    }

    return [pscustomobject]@{
        ApiBaseUrl = $apiBaseUrl
        ApiToken = $token
        AssetUrl = $assetUrl
    }
}

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    $BaseUrl = Resolve-DefaultPagesUrl
}
if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    throw 'BaseUrl is required. Set LIVE_BASE_URL or pass -BaseUrl.'
}

$normalizedBaseUrl = $BaseUrl.TrimEnd('/')
Write-Host "=== Preflight for live cost test ==="
Write-Host "BaseUrl: $normalizedBaseUrl"

$apiRoot = $null
if (-not [string]::IsNullOrWhiteSpace($ApiBaseUrl)) {
    $apiRoot = Normalize-ApiRoot -Value $ApiBaseUrl
} else {
    # If BaseUrl is Pages, resolve Worker API settings from the deployed bundle.
    try {
        $probe = Invoke-HttpRequest -Method 'POST' -Url "$normalizedBaseUrl/api/metrics" -Body '{"event":"session_start"}'
        if ($probe.StatusCode -ne 405) {
            $apiRoot = $normalizedBaseUrl
        }
    } catch {
        # ignore probe errors and fall back to bundle parsing
    }

    if (-not $apiRoot) {
        $resolved = Resolve-ApiSettingsFromBundle -PagesUrl $normalizedBaseUrl
        if ($resolved.ApiBaseUrl) {
            $apiRoot = Normalize-ApiRoot -Value $resolved.ApiBaseUrl
        }
        if (-not $ApiToken -and $resolved.ApiToken) {
            $ApiToken = $resolved.ApiToken
        }
    }
}

if (-not $apiRoot) {
    throw 'Failed to resolve API base URL. Set LIVE_API_BASE_URL (or ensure Pages bundle contains API base).'
}
if ([string]::IsNullOrWhiteSpace($ApiToken)) {
    throw 'ApiToken is required. Set VITE_API_TOKEN (or ensure Pages bundle contains API token).'
}

Write-Host "ApiRoot: $apiRoot"

$health = Invoke-HttpRequest -Method 'GET' -Url "$apiRoot/api/health"
Assert-StatusCode -Label 'health' -Expected 200 -Actual $health.StatusCode -Body $health.Body

$metricsBody = '{"event":"session_start"}'
$metricsUnauth = Invoke-HttpRequest -Method 'POST' -Url "$apiRoot/api/metrics" -Body $metricsBody
Assert-StatusCode -Label 'metrics unauthenticated' -Expected 401 -Actual $metricsUnauth.StatusCode -Body $metricsUnauth.Body

$authHeaders = @{ Authorization = "Bearer $ApiToken" }
$metricsAuth = Invoke-HttpRequest -Method 'POST' -Url "$apiRoot/api/metrics" -Headers $authHeaders -Body $metricsBody
Assert-StatusCode -Label 'metrics authenticated' -Expected 200 -Actual $metricsAuth.StatusCode -Body $metricsAuth.Body

if (-not $SkipChat) {
    $chatBody = [pscustomobject]@{
        messages = @(
            [pscustomobject]@{
                role = 'user'
                content = $Prompt
            }
        )
    } | ConvertTo-Json -Depth 6 -Compress

    $chatAuth = Invoke-HttpRequest -Method 'POST' -Url "$apiRoot/api/chat" -Headers $authHeaders -Body $chatBody
    Assert-StatusCode -Label 'chat authenticated' -Expected 200 -Actual $chatAuth.StatusCode -Body $chatAuth.Body
}

Write-Host "=== Preflight passed ==="
