@echo off
setlocal

set "PROJECT_DIR=%~dp0..\.."
set "SCRIPT=%PROJECT_DIR%\scripts\windows\cloudflare-ddns.ps1"

schtasks /Create /TN "chezolive-Cloudflare-DDNS" /SC MINUTE /MO 10 /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"%SCRIPT%\"" /F

echo.
echo Tache planifiee installee: chezolive-Cloudflare-DDNS
echo Elle mettra Cloudflare a jour toutes les 10 minutes.
echo.
pause
