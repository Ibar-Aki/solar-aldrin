param(
    [string]$BaseUrl = $env:LIVE_BASE_URL,
    [string]$ApiBaseUrl = $env:LIVE_API_BASE_URL,
    [string]$ApiToken = $env:VITE_API_TOKEN,
    [string]$Prompt = 'safety check test',
    [switch]$SkipChat,
    [string]$ExpectedRequireApiToken = $env:LIVE_EXPECTED_REQUIRE_API_TOKEN,
    [string]$ExpectedPolicyVersion = $env:LIVE_EXPECTED_POLICY_VERSION,
    [string]$ExpectedResponseFormat = $env:LIVE_EXPECTED_RESPONSE_FORMAT,
    [string]$ExpectedParseRecoveryEnabled = $env:LIVE_EXPECTED_PARSE_RECOVERY_ENABLED,
    [string]$ExpectedOpenAiRetryCount = $env:LIVE_EXPECTED_OPENAI_RETRY_COUNT
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http

if ([string]::IsNullOrWhiteSpace($ExpectedPolicyVersion)) {
    $ExpectedPolicyVersion = '2026-02-11-a-b-observability-1'
}
if ([string]::IsNullOrWhiteSpace($ExpectedResponseFormat)) {
    $ExpectedResponseFormat = 'json_schema_strict'
}

$expectedParseRecoveryEnabledValue = $true
if (-not [string]::IsNullOrWhiteSpace($ExpectedParseRecoveryEnabled)) {
    $parseRecoveryToken = $ExpectedParseRecoveryEnabled.Trim().ToLowerInvariant()
    if ($parseRecoveryToken -in @('1', 'true')) {
        $expectedParseRecoveryEnabledValue = $true
    } elseif ($parseRecoveryToken -in @('0', 'false')) {
        $expectedParseRecoveryEnabledValue = $false
    } else {
        throw "ExpectedParseRecoveryEnabled must be one of: 1, 0, true, false (actual=$ExpectedParseRecoveryEnabled)"
    }
}

$expectedOpenAiRetryCountValue = 1
if (-not [string]::IsNullOrWhiteSpace($ExpectedOpenAiRetryCount)) {
    $expectedOpenAiRetryCountValue = [int]$ExpectedOpenAiRetryCount
}

function Get-EnvLikeValue {
    param(
        [string]$FilePath,
        [string]$Key
    )

    if (-not (Test-Path $FilePath)) {
        return $null
    }

    $pattern = "^\s*$([regex]::Escape($Key))\s*=\s*(.*)\s*$"
    $line = Get-Content -Path $FilePath | Where-Object { $_ -match $pattern } | Select-Object -First 1
    if (-not $line) {
        return $null
    }

    if (-not ($line -match $pattern)) {
        return $null
    }

    $value = $matches[1].Trim()
    if ($value.Length -ge 2 -and (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        )) {
        $value = $value.Substring(1, $value.Length - 2)
    }

    if ([string]::IsNullOrWhiteSpace($value)) {
        return $null
    }

    return $value
}

function Try-ParseJsonBody {
    param([string]$Body)

    if ([string]::IsNullOrWhiteSpace($Body)) {
        return $null
    }

    try {
        return $Body | ConvertFrom-Json
    } catch {
        return $null
    }
}

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

function Parse-BoolText {
    param(
        [string]$Value,
        [string]$Label
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $null
    }

    $token = $Value.Trim().ToLowerInvariant()
    if ($token -in @('1', 'true', 'yes', 'on')) {
        return $true
    }
    if ($token -in @('0', 'false', 'no', 'off')) {
        return $false
    }

    throw "$Label must be one of: 1,0,true,false,yes,no,on,off (actual=$Value)"
}

function Assert-ChatServerPolicy {
    param(
        [object]$ChatBodyJson,
        [string]$ExpectedPolicyVersionValue,
        [string]$ExpectedResponseFormatValue,
        [bool]$ExpectedParseRecoveryEnabledValue,
        [int]$ExpectedOpenAiRetryCountValue,
        [string]$RawBody
    )

    if (-not $ChatBodyJson) {
        throw "chat authenticated response is not valid JSON. body=$RawBody"
    }

    $metaProperty = $ChatBodyJson.PSObject.Properties['meta']
    $meta = if ($metaProperty) { $metaProperty.Value } else { $null }
    if (-not $meta) {
        throw "chat authenticated response missing meta. body=$RawBody"
    }

    $serverProperty = $meta.PSObject.Properties['server']
    $server = if ($serverProperty) { $serverProperty.Value } else { $null }
    if (-not $server) {
        throw "chat authenticated response missing meta.server. body=$RawBody"
    }

    $policyVersionProperty = $server.PSObject.Properties['policyVersion']
    $responseFormatProperty = $server.PSObject.Properties['responseFormat']
    $parseRecoveryProperty = $server.PSObject.Properties['parseRecoveryEnabled']
    $retryCountProperty = $server.PSObject.Properties['openaiRetryCount']

    $actualPolicyVersion = if ($policyVersionProperty) { [string]$policyVersionProperty.Value } else { '' }
    $actualResponseFormat = if ($responseFormatProperty) { [string]$responseFormatProperty.Value } else { '' }

    if (-not $parseRecoveryProperty -or $null -eq $parseRecoveryProperty.Value) {
        throw "chat authenticated response missing meta.server.parseRecoveryEnabled. body=$RawBody"
    }
    $actualParseRecoveryEnabled = [bool]$parseRecoveryProperty.Value

    if (-not $retryCountProperty -or $null -eq $retryCountProperty.Value) {
        throw "chat authenticated response missing meta.server.openaiRetryCount. body=$RawBody"
    }
    $actualOpenAiRetryCount = [int]$retryCountProperty.Value

    $mismatches = @()
    if ($actualPolicyVersion -ne $ExpectedPolicyVersionValue) {
        $mismatches += "policyVersion expected=$ExpectedPolicyVersionValue actual=$actualPolicyVersion"
    }
    if ($actualResponseFormat -ne $ExpectedResponseFormatValue) {
        $mismatches += "responseFormat expected=$ExpectedResponseFormatValue actual=$actualResponseFormat"
    }
    if ($actualParseRecoveryEnabled -ne $ExpectedParseRecoveryEnabledValue) {
        $mismatches += "parseRecoveryEnabled expected=$ExpectedParseRecoveryEnabledValue actual=$actualParseRecoveryEnabled"
    }
    if ($actualOpenAiRetryCount -ne $ExpectedOpenAiRetryCountValue) {
        $mismatches += "openaiRetryCount expected=$ExpectedOpenAiRetryCountValue actual=$actualOpenAiRetryCount"
    }

    if ($mismatches.Count -gt 0) {
        throw "chat meta.server mismatch. $($mismatches -join ', ') body=$RawBody"
    }

    Write-Host "[OK] chat meta.server: policyVersion=$actualPolicyVersion responseFormat=$actualResponseFormat parseRecoveryEnabled=$actualParseRecoveryEnabled openaiRetryCount=$actualOpenAiRetryCount"
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

    return [pscustomobject]@{
        ApiBaseUrl = $apiBaseUrl
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
    }
}

if (-not $apiRoot) {
    throw 'Failed to resolve API base URL. Set LIVE_API_BASE_URL (or ensure Pages bundle contains API base).'
}
Write-Host "ApiRoot: $apiRoot"

$health = Invoke-HttpRequest -Method 'GET' -Url "$apiRoot/api/health"
Assert-StatusCode -Label 'health' -Expected 200 -Actual $health.StatusCode -Body $health.Body

$metricsBody = '{"event":"session_start"}'
$metricsUnauth = Invoke-HttpRequest -Method 'POST' -Url "$apiRoot/api/metrics" -Body $metricsBody
$expectRequireApiToken = Parse-BoolText -Value $ExpectedRequireApiToken -Label 'ExpectedRequireApiToken'

if ($metricsUnauth.StatusCode -ne 200 -and $metricsUnauth.StatusCode -ne 401) {
    throw "metrics unauthenticated failed. expected=200|401 actual=$($metricsUnauth.StatusCode) body=$($metricsUnauth.Body)"
}

$detectedRequireApiToken = ($metricsUnauth.StatusCode -eq 401)
if ($expectRequireApiToken -ne $null -and $expectRequireApiToken -ne $detectedRequireApiToken) {
    throw "metrics unauthenticated requireApiToken mismatch. expected=$expectRequireApiToken actual=$detectedRequireApiToken body=$($metricsUnauth.Body)"
}
Write-Host "[OK] metrics unauthenticated: $($metricsUnauth.StatusCode) (requireApiToken=$detectedRequireApiToken)"

if ([string]::IsNullOrWhiteSpace($ApiToken)) {
    $devVarsPath = Join-Path (Get-Location) '.dev.vars'
    $fallbackToken = Get-EnvLikeValue -FilePath $devVarsPath -Key 'API_TOKEN'
    if ($fallbackToken) {
        $ApiToken = $fallbackToken
        Write-Host "ApiToken: loaded from .dev.vars (API_TOKEN)"
    }
}

if ($detectedRequireApiToken -or -not [string]::IsNullOrWhiteSpace($ApiToken)) {
    if ([string]::IsNullOrWhiteSpace($ApiToken)) {
        throw 'ApiToken is required in requireApiToken mode. Set VITE_API_TOKEN.'
    }
    $authHeaders = @{ Authorization = "Bearer $ApiToken" }
    $metricsAuth = Invoke-HttpRequest -Method 'POST' -Url "$apiRoot/api/metrics" -Headers $authHeaders -Body $metricsBody
    if ($metricsAuth.StatusCode -ne 200) {
        $metricsAuthJson = Try-ParseJsonBody -Body $metricsAuth.Body
        $metricsCode = $metricsAuthJson.code
        if ($metricsAuth.StatusCode -eq 401 -and $metricsCode -eq 'AUTH_INVALID') {
            throw "metrics authenticated failed. expected=200 actual=401 code=AUTH_INVALID. Hint: VITE_API_TOKEN does not match the target Worker API_TOKEN secret. body=$($metricsAuth.Body)"
        }
    }
    Assert-StatusCode -Label 'metrics authenticated' -Expected 200 -Actual $metricsAuth.StatusCode -Body $metricsAuth.Body
} else {
    Write-Host '[SKIP] metrics authenticated: ApiToken not provided (optional-auth mode)'
}

if (-not $SkipChat) {
    $chatBody = [pscustomobject]@{
        messages = @(
            [pscustomobject]@{
                role = 'user'
                content = $Prompt
            }
        )
    } | ConvertTo-Json -Depth 6 -Compress

    $chatAuthHeaders = @{}
    if (-not [string]::IsNullOrWhiteSpace($ApiToken)) {
        $chatAuthHeaders.Authorization = "Bearer $ApiToken"
    }

    $chatAuth = Invoke-HttpRequest -Method 'POST' -Url "$apiRoot/api/chat" -Headers $chatAuthHeaders -Body $chatBody
    if ($chatAuth.StatusCode -ne 200) {
        $chatAuthJson = Try-ParseJsonBody -Body $chatAuth.Body
        $chatCode = $chatAuthJson.code
        if ($chatAuth.StatusCode -eq 502 -and $chatCode -eq 'OPENAI_AUTH_ERROR') {
            throw "chat authenticated failed. expected=200 actual=502 code=OPENAI_AUTH_ERROR. Hint: OPENAI_API_KEY configured on the target Worker is invalid/expired. body=$($chatAuth.Body)"
        }
    }
    Assert-StatusCode -Label 'chat authenticated' -Expected 200 -Actual $chatAuth.StatusCode -Body $chatAuth.Body

    $chatAuthJson = Try-ParseJsonBody -Body $chatAuth.Body
    Assert-ChatServerPolicy `
        -ChatBodyJson $chatAuthJson `
        -ExpectedPolicyVersionValue $ExpectedPolicyVersion `
        -ExpectedResponseFormatValue $ExpectedResponseFormat `
        -ExpectedParseRecoveryEnabledValue $expectedParseRecoveryEnabledValue `
        -ExpectedOpenAiRetryCountValue $expectedOpenAiRetryCountValue `
        -RawBody $chatAuth.Body
}

Write-Host "=== Preflight passed ==="
