@echo off
rem Double-click to launch PrepFella. From a terminal use "run prep" (see start.ps1 for options).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
if errorlevel 1 pause
