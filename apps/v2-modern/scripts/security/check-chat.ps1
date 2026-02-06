param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,
    [Parameter(Mandatory = $true)]
    [string]$ApiToken,
    [string]$Prompt = 'safety check test'
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

$normalizedBaseUrl = $BaseUrl.TrimEnd('/')
$chatUrl = "$normalizedBaseUrl/api/chat"
$payload = [pscustomobject]@{
    messages = @(
        [pscustomobject]@{
            role = 'user'
            content = $Prompt
        }
    )
} | ConvertTo-Json -Depth 6 -Compress

$result = Invoke-HttpRequest -Method 'POST' -Url $chatUrl -Headers @{ Authorization = "Bearer $ApiToken" } -Body $payload
Write-Host ("status={0}" -f $result.StatusCode)
Write-Host $result.Body

if ($result.StatusCode -ne 200) {
    throw "Chat check failed with status=$($result.StatusCode)."
}
