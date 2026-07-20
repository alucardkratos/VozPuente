@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Video a Español - Piper Neural
cd /d "%~dp0"

set "APP_DIR=%LOCALAPPDATA%\DobladorEspanolLocal"
set "VENV_DIR=%APP_DIR%\piper-venv"
set "VOICE_DIR=%APP_DIR%\piper-voices"
set "VOICE_NAME=es_MX-claude-high"

if not exist "%APP_DIR%" mkdir "%APP_DIR%"
if not exist "%VOICE_DIR%" mkdir "%VOICE_DIR%"

py -3 --version >nul 2>&1
if not errorlevel 1 (
  set "PY_CMD=py -3"
  goto :python_ready
)

python --version >nul 2>&1
if not errorlevel 1 (
  set "PY_CMD=python"
  goto :python_ready
)

echo ====================================================
echo  FALTA PYTHON
echo ====================================================
echo Instala Python 3 de 64 bits desde https://www.python.org/downloads/
echo Durante la instalación marca: Add Python to PATH.
echo Después vuelve a ejecutar este archivo.
pause
exit /b 1

:python_ready
if not exist "%VENV_DIR%\Scripts\python.exe" (
  echo Creando un entorno privado para Piper...
  %PY_CMD% -m venv "%VENV_DIR%"
  if errorlevel 1 goto :failed
)

"%VENV_DIR%\Scripts\python.exe" -c "import piper" >nul 2>&1
if errorlevel 1 (
  echo.
  echo Instalando Piper TTS. Esto solo ocurre la primera vez...
  "%VENV_DIR%\Scripts\python.exe" -m pip install --upgrade pip
  "%VENV_DIR%\Scripts\python.exe" -m pip install "piper-tts[http]"
  if errorlevel 1 goto :failed
)

if not exist "%VOICE_DIR%\%VOICE_NAME%.onnx" (
  echo.
  echo Descargando la voz neural mexicana %VOICE_NAME%...
  echo Puede tardar varios minutos la primera vez.
  "%VENV_DIR%\Scripts\python.exe" -m piper.download_voices --data-dir "%VOICE_DIR%" %VOICE_NAME%
  if errorlevel 1 goto :failed
)

cls
echo ====================================================
echo  VIDEO A ESPAÑOL - PIPER NEURAL ACTIVO
echo ====================================================
echo Voz: %VOICE_NAME%
echo Servidor local: http://127.0.0.1:5000
echo Deja esta ventana abierta mientras exportas.
echo Para detener: cierra la ventana o presiona Ctrl+C.
echo.

"%VENV_DIR%\Scripts\python.exe" -m piper.http_server -m %VOICE_NAME% --data-dir "%VOICE_DIR%" --host 127.0.0.1 --port 5000
if errorlevel 1 goto :failed
exit /b 0

:failed
echo.
echo ====================================================
echo No se pudo instalar o iniciar Piper.
echo Revisa el mensaje de error que aparece arriba.
echo ====================================================
pause
exit /b 1
