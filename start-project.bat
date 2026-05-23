@echo off
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-project.ps1"

if errorlevel 1 (
  echo.
  echo Startup failed. Press any key to close this window.
  pause >nul
)

endlocal
