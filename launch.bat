@echo off
title TransMove - Local Server Launcher
color 0A

echo ==============================================================================
echo                      TRANSMOVE MARKETPLACE PLATFORM
echo ==============================================================================
echo.
echo Starting TransMove Local Server at http://localhost:8080...
echo.

start http://localhost:8080
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"

pause
