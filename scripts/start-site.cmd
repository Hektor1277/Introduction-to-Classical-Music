@echo off
setlocal

set "ROOT=%~dp0.."
cd /d "%ROOT%"

echo [site] Building indexes and starting Astro dev server...
start "Introduction to Classical Music - Site" cmd /k "cd /d ""%ROOT%"" && npm run dev"

echo [site] Waiting for server startup...
timeout /t 5 /nobreak >nul

start "" http://127.0.0.1:4321
echo [site] Browser opened at http://127.0.0.1:4321
