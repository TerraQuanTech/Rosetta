@echo off
REM Install CLI wrapper for Rosetta on Windows

setlocal enabledelayedexpansion

REM Check if running as admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Error: This script must be run as Administrator
    echo Please right-click Command Prompt and select "Run as administrator"
    exit /b 1
)

REM Find Rosetta app
if exist "C:\Program Files\Rosetta\Rosetta.exe" (
    set "ROSETTA_PATH=C:\Program Files\Rosetta\Rosetta.exe"
) else if exist "%LocalAppData%\Programs\Rosetta\Rosetta.exe" (
    set "ROSETTA_PATH=%LocalAppData%\Programs\Rosetta\Rosetta.exe"
) else (
    echo Error: Rosetta app not found in standard locations
    echo Searched: C:\Program Files\Rosetta
    echo         %LocalAppData%\Programs\Rosetta
    exit /b 1
)

REM Create wrapper script
set "WRAPPER_PATH=%SystemRoot%\System32\rosetta.bat"

(
    echo @echo off
    echo %%~d0
    echo cd "%%~dp0"
    echo "!ROSETTA_PATH!" %%*
) > "!WRAPPER_PATH!"

if %errorLevel% equ 0 (
    echo ✓ Installed rosetta.bat to %WRAPPER_PATH%
    echo.
    echo You can now use: rosetta stats, rosetta missing, rosetta complete
) else (
    echo Error: Failed to create wrapper script
    exit /b 1
)
