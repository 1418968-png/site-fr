@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

set "HOST=127.0.0.1"
set "PORT=5500"
set "URL=http://%HOST%:%PORT%/"
set "SITE_DIR=%~dp0"

echo [Invest Navigator] Preparing local test server...
echo [Invest Navigator] Site directory: "%SITE_DIR%"
echo [Invest Navigator] URL: %URL%
echo.

if not exist "%SITE_DIR%index.html" (
  echo [ERROR] index.html was not found in "%SITE_DIR%".
  echo [ERROR] Run this script from the project root or check the site structure.
  exit /b 1
)

echo [Invest Navigator] Releasing port %PORT% if it is busy...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  if not "%%P"=="0" (
    echo [Invest Navigator] Killing process PID %%P on port %PORT%...
    taskkill /PID %%P /F >nul 2>nul
  )
)

timeout /t 1 /nobreak >nul

where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  echo [Invest Navigator] Starting server with Python Launcher...
  echo [Invest Navigator] Press Ctrl+C to stop the server.
  echo.
  cd /d "%SITE_DIR%"
  py -m http.server %PORT% --bind %HOST%
  exit /b %ERRORLEVEL%
)

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  echo [Invest Navigator] Starting server with Python...
  echo [Invest Navigator] Press Ctrl+C to stop the server.
  echo.
  cd /d "%SITE_DIR%"
  python -m http.server %PORT% --bind %HOST%
  exit /b %ERRORLEVEL%
)

echo [ERROR] Python was not found. Install Python or add it to PATH.
exit /b 1
