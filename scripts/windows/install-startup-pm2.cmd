@echo off
setlocal

set "SOURCE=C:\Cline\maison-olive-shop\scripts\windows\pm2-resurrect.cmd"
set "TARGET_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "TARGET=%TARGET_DIR%\maison-olive-pm2-resurrect.cmd"

if not exist "%SOURCE%" (
  echo Source script introuvable: %SOURCE%
  exit /b 1
)

if not exist "%TARGET_DIR%" (
  mkdir "%TARGET_DIR%"
)

copy /Y "%SOURCE%" "%TARGET%" >nul

echo Startup script installed:
echo %TARGET%

exit /b 0
