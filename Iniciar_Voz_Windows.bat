@echo off
chcp 65001 >nul
title Video a Español - Voz Windows
cd /d "%~dp0"

echo Iniciando la voz española local de Windows...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor_voz_windows.ps1"

if errorlevel 1 (
  echo.
  echo No se pudo iniciar la voz. Lee README.md o toma una captura de este error.
  pause
)
