param(
    [string]$BaseUrl = $env:LIVE_BASE_URL,
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

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    throw 'BaseUrl is required. Set LIVE_BASE_URL or pass -BaseUrl.'
}
if ([string]::IsNullOrWhiteSpace($ApiToken)) {
    throw 'ApiToken is required. Set VITE_API_TOKEN or pass -ApiToken.'
}

$normalizedBaseUrl = $BaseUrl.TrimEnd('/')
Write-Host "=== Preflight for live cost test ==="
Write-Host "BaseUrl: $normalizedBaseUrl"

$health = Invoke-HttpRequest -Method 'GET' -Url "$normalizedBaseUrl/api/health"
Assert-StatusCode -Label 'health' -Expected 200 -Actual $health.StatusCode -Body $health.Body

$metricsBody = '{"event":"preflight_live_test"}'
$metricsUnauth = Invoke-HttpRequest -Method 'POST' -Url "$normalizedBaseUrl/api/metrics" -Body $metricsBody
Assert-StatusCode -Label 'metrics unauthenticated' -Expected 401 -Actual $metricsUnauth.StatusCode -Body $metricsUnauth.Body

$authHeaders = @{ Authorization = "Bearer $ApiToken" }
$metricsAuth = Invoke-HttpRequest -Method 'POST' -Url "$normalizedBaseUrl/api/metrics" -Headers $authHeaders -Body $metricsBody
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

    $chatAuth = Invoke-HttpRequest -Method 'POST' -Url "$normalizedBaseUrl/api/chat" -Headers $authHeaders -Body $chatBody
    Assert-StatusCode -Label 'chat authenticated' -Expected 200 -Actual $chatAuth.StatusCode -Body $chatAuth.Body
}

Write-Host "=== Preflight passed ==="
