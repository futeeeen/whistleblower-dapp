@echo off
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-project.ps1"

if errorlevel 1 (
  echo.
  echo Shutdown failed. Press any key to close this window.
  pause >nul
)

endlocal
