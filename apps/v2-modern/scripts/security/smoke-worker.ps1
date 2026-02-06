param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,
    [Parameter(Mandatory = $true)]
    [string]$ApiToken
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
        $statusCode = [int]$response.StatusCode
        $responseBody = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()

        return [pscustomobject]@{
            StatusCode = $statusCode
            Body = $responseBody
        }
    } finally {
        $client.Dispose()
    }
}

function Assert-Status {
    param(
        [string]$Name,
        [pscustomobject]$Result,
        [int]$Expected
    )
    if ($Result.StatusCode -ne $Expected) {
        throw "$Name failed. expected=$Expected actual=$($Result.StatusCode) body=$($Result.Body)"
    }
    Write-Host ("OK {0} => {1}" -f $Name, $Result.StatusCode)
}

$normalizedBaseUrl = $BaseUrl.TrimEnd('/')
$metricsUrl = "$normalizedBaseUrl/api/metrics"
$healthUrl = "$normalizedBaseUrl/api/health"
$metricsBody = '{"event":"session_start"}'

$health = Invoke-HttpRequest -Method 'GET' -Url $healthUrl
Assert-Status -Name 'health' -Result $health -Expected 200

$noAuth = Invoke-HttpRequest -Method 'POST' -Url $metricsUrl -Body $metricsBody
Assert-Status -Name 'metrics_no_auth' -Result $noAuth -Expected 401

$withAuth = Invoke-HttpRequest -Method 'POST' -Url $metricsUrl -Headers @{ Authorization = "Bearer $ApiToken" } -Body $metricsBody
Assert-Status -Name 'metrics_with_auth' -Result $withAuth -Expected 200

$badOrigin = Invoke-HttpRequest -Method 'POST' -Url $metricsUrl -Headers @{
    Authorization = "Bearer $ApiToken"
    Origin = 'https://evil.example.com'
} -Body $metricsBody
Assert-Status -Name 'metrics_bad_origin' -Result $badOrigin -Expected 403

Write-Host 'Worker smoke test completed.'
