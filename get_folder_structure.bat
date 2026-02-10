@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem Export folder structure under the directory where this BAT exists.
rem Usage:
rem   get_folder_structure.bat            (folders only)
rem   get_folder_structure.bat --files    (include files too)

chcp 65001 >nul

set "BASE=%~dp0"
if "%BASE:~-1%"=="\" set "BASE=%BASE:~0,-1%"

set "INCLUDE_FILES=0"
if /i "%~1"=="--files" set "INCLUDE_FILES=1"
if /i "%~1"=="-f" set "INCLUDE_FILES=1"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "TS=%%i"
set "OUT=%BASE%\folder_tree_%TS%.txt"

echo Target: "%BASE%"
echo Output: "%OUT%"
echo.

if "%INCLUDE_FILES%"=="1" (
  tree "%BASE%" /A /F > "%OUT%"
) else (
  tree "%BASE%" /A > "%OUT%"
)

if errorlevel 1 (
  echo Failed to export folder structure.
  exit /b 1
)

echo Done.
exit /b 0

