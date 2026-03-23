@echo off
echo This command may require an Administrator terminal on some Windows setups.
schtasks /Create /SC ONLOGON /TN MaisonOlive-PM2-Resurrect /TR "C:\Cline\maison-olive-shop\scripts\windows\pm2-resurrect.cmd" /F
schtasks /Query /TN MaisonOlive-PM2-Resurrect /V /FO LIST
