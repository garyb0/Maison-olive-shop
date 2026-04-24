@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "SCRIPT=%SCRIPT_DIR%check-pending-reboot.ps1"
set "LOGON_SCRIPT=%SCRIPT_DIR%reboot-warning-logon.cmd"
set "TASK_NAME=MaisonOlive-Reboot-Warning"
set "LOGON_TASK_NAME=MaisonOlive-Reboot-Warning-Logon"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "STARTUP_SCRIPT=%STARTUP_DIR%\chez-olive-reboot-warning.cmd"

if not exist "%SCRIPT%" (
  echo Script introuvable: %SCRIPT%
  exit /b 1
)

schtasks /Create /TN "%TASK_NAME%" /SC HOURLY /MO 2 /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"%SCRIPT%\" -ShowPopup -AlwaysLog" /F
schtasks /Create /TN "%LOGON_TASK_NAME%" /SC ONLOGON /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"%SCRIPT%\" -ShowPopup -AlwaysLog" /F
if errorlevel 1 (
  echo Impossible de creer la tache ONLOGON. Installation fallback dans Startup utilisateur.
  if not exist "%STARTUP_DIR%" mkdir "%STARTUP_DIR%"
  copy /Y "%LOGON_SCRIPT%" "%STARTUP_SCRIPT%" >nul
  echo Startup fallback installe: %STARTUP_SCRIPT%
)
schtasks /Query /TN "%TASK_NAME%" /V /FO LIST
schtasks /Query /TN "%LOGON_TASK_NAME%" /V /FO LIST 2>nul

exit /b 0
