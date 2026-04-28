@echo off
echo This command may require an Administrator terminal on some Windows setups.
set "SCRIPT_DIR=%~dp0"
set "RESURRECT_SCRIPT=%SCRIPT_DIR%pm2-resurrect.cmd"

schtasks /Create /SC ONLOGON /TN chezolive-PM2-Resurrect /TR "%RESURRECT_SCRIPT%" /F
schtasks /Query /TN chezolive-PM2-Resurrect /V /FO LIST


