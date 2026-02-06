Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$devVarsPath = Join-Path (Get-Location) '.dev.vars'
if (-not (Test-Path $devVarsPath)) {
    throw '.dev.vars not found.'
}

$line = Get-Content -Path $devVarsPath | Where-Object { $_ -like 'OPENAI_API_KEY=*' } | Select-Object -First 1
if (-not $line) {
    throw 'OPENAI_API_KEY not found in .dev.vars.'
}

$value = $line.Substring('OPENAI_API_KEY='.Length).Trim()
$value = $value.Trim('"').Trim("'")
if ([string]::IsNullOrWhiteSpace($value)) {
    throw 'OPENAI_API_KEY is empty in .dev.vars.'
}

$value | npx wrangler secret put OPENAI_API_KEY --config wrangler.worker.toml | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'Failed to update OPENAI_API_KEY.'
}

Write-Host 'set: OPENAI_API_KEY from .dev.vars'
