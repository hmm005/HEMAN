@echo off
:: Driving for Dollars - Auto-Start Script
:: This script starts the D4D app and restarts it if it crashes

title Driving for Dollars - Server
color 0A

echo ========================================
echo   Driving for Dollars - Starting Up
echo ========================================
echo.

cd /d "%USERPROFILE%\HEMAN\driving-for-dollars"

:loop
echo [%date% %time%] Starting server...
node src/index.js
echo.
echo [%date% %time%] Server stopped. Restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto loop
