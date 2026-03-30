@echo off
echo Starting Maison Olive development server and keep-alive...
cd /d "C:\Cline\maison-olive-shop"

echo 1. Starting Next.js dev server...
start "Next.js Dev Server" cmd /k "npm run dev"

timeout /t 5 /nobreak >nul

echo 2. Starting keep-alive script...
start "Keep-Alive" cmd /k "node keep-alive.js"

echo 3. Both processes started in separate windows.
echo.
echo To stop them, close the two windows or press Ctrl+C in each.
pause