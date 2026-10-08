@echo off
setlocal
chcp 65001 >nul
title XR Tour Editor - Local Server

set "PORT=8080"
if not "%~1"=="" set "PORT=%~1"

cd /d "%~dp0"

echo.
echo Starting XR Tour Editor...
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port %PORT%

echo.
echo Server stopped.
pause
