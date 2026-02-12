$ErrorActionPreference = 'Stop'

# Find the apps/v2-modern directory
$StartPath = Get-Location
$TargetDir = "apps/v2-modern"

if (-not (Test-Path $TargetDir)) {
    Write-Error "Error: Could not find '$TargetDir'. Please run this script from the project root."
    exit 1
}

Push-Location $TargetDir

try {
    Write-Host "Running Pre-flight Check in $TargetDir..."
    
    # Check if npm is installed
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Error "Error: 'npm' is not found in PATH."
        exit 1
    }

    # Run the preflight script defined in package.json
    npm run test:cost:preflight
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Pre-flight Check Passed! ✅" -ForegroundColor Green
    } else {
        Write-Error "Pre-flight Check Failed! ❌"
        exit $LASTEXITCODE
    }
} finally {
    Pop-Location
}
