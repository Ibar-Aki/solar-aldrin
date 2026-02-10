@echo off
setlocal enabledelayedexpansion

rem Get folder structure (directories only) for the current directory.
rem Outputs to console and writes to a timestamped log file next to this script.

set "ROOT=%~dp0"
pushd "%ROOT%" >nul

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "TS=%%I"
set "OUT=folder_tree_%TS%.txt"

echo [INFO] Root: "%CD%"
echo [INFO] Output: "%OUT%"
echo.

rem "tree" prints to stdout; redirect to file, then type it so user sees it too.
tree /A > "%OUT%"
type "%OUT%"

popd >nul
endlocal
