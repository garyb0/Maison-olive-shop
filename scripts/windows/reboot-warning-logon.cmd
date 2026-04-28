@echo off
cd /d "%~dp0..\.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-pending-reboot.ps1" -ShowPopup -AlwaysLog
