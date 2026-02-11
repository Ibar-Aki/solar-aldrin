param(
    [Parameter(Mandatory = $true)]
    [string]$ApiBaseUrl,
    # NOTE: ブラウザ向けにトークンをバンドルへ埋め込む運用は漏えい前提になるため非推奨。
    # 実費テスト/スモーク等で必要な場合は、テスト実行環境の VITE_API_TOKEN を使用すること。
    [string]$ApiToken,
    [string]$ProjectName = 'voice-ky-v2'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($ApiBaseUrl.Contains('<') -or $ApiBaseUrl.Contains('>')) {
    throw 'ApiBaseUrl contains placeholder text.'
}
if (-not [string]::IsNullOrWhiteSpace($ApiToken)) {
    if ($ApiToken.Contains('<') -or $ApiToken.Contains('>')) {
        throw 'ApiToken contains placeholder text.'
    }
    Write-Host "NOTE: ApiToken was provided, but VITE_API_TOKEN will NOT be embedded into the frontend bundle."
    Write-Host "      Set the token at runtime (HomePage: APIトークン設定) or use VITE_API_TOKEN only for test scripts."
}

$uri = $null
if (-not [System.Uri]::TryCreate($ApiBaseUrl, [System.UriKind]::Absolute, [ref]$uri)) {
    throw "ApiBaseUrl is invalid: $ApiBaseUrl"
}
if ($uri.Scheme -ne 'https') {
    throw "ApiBaseUrl must use https: $ApiBaseUrl"
}

$env:VITE_API_BASE_URL = $ApiBaseUrl.TrimEnd('/')
# 既存シェルに残っている値でバンドル埋め込みが再発しないよう、ビルド直前に明示解除する。
if (Test-Path Env:VITE_API_TOKEN) {
    Write-Host "INFO: Clearing existing VITE_API_TOKEN before build to avoid token embedding."
}
Remove-Item Env:VITE_API_TOKEN -ErrorAction SilentlyContinue

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
