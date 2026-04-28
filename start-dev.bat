@echo off
echo Starting Chez Olive development server and keep-alive...
cd /d "%~dp0"

echo 1. Starting Next.js dev server...
start "Next.js Dev Server" cmd /k "npm run dev"

timeout /t 5 /nobreak >nul

echo 2. Starting keep-alive script...
start "Keep-Alive" cmd /k "node keep-alive.js"

echo 3. Both processes started in separate windows.
echo.
echo To stop them, close the two windows or press Ctrl+C in each.
pause
