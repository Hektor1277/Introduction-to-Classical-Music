@echo off
setlocal

set "ROOT=%~dp0.."
cd /d "%ROOT%"

echo [owner] Building runtime and starting owner tool...
start "Introduction to Classical Music - Owner" cmd /k "cd /d ""%ROOT%"" && npm run owner"

echo [owner] Waiting for server startup...
timeout /t 5 /nobreak >nul

start "" http://127.0.0.1:4322
echo [owner] Browser opened at http://127.0.0.1:4322
