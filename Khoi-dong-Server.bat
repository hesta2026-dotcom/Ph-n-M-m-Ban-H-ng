@echo off
title May Chu POS System
color 0A
echo ============================================
echo        MAY CHU POS - DANG KHOI DONG
echo ============================================
echo.

:: Tat process cu
echo [1/4] Tat tien trinh cu...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000 " 2^>nul') do taskkill /PID %%a /F >nul 2>&1
taskkill /IM ngrok.exe /F >nul 2>&1

:: Lay IP may tinh
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" ^| findstr /v "169.254"') do set IP=%%a
set IP=%IP:~1%

echo [2/4] Khoi dong Backend (port 5000)...
start "Backend POS" cmd /k "cd /d "d:\HESTA PHAN MEM\Ph-n-M-m-Ban-H-ng\backend" && node src/index.js"

timeout /t 3 /nobreak >nul

echo [3/4] Khoi dong Tunnel Internet (ngrok)...
start "ngrok Tunnel" cmd /k ""d:\HESTA PHAN MEM\tools\ngrok.exe" http --domain=plausible-quarrel-comprised.ngrok-free.dev 5000"

timeout /t 3 /nobreak >nul

echo [4/4] Hoan tat!
echo.
echo ============================================
echo   BACKEND DANG CHAY:
echo   - Local LAN : http://%IP%:5000
echo   - Internet  : https://plausible-quarrel-comprised.ngrok-free.dev
echo.
echo   VERCEL FRONTEND:
echo   - https://ph-n-m-m-ban-h-ng.vercel.app
echo.
echo   May trong cua hang ket noi:
echo   - Mo start.bat de chay ca frontend local
echo   - Hoac truy cap: http://%IP%:5173
echo ============================================
echo.
echo Nhan phim bat ky de dong cua so nay...
pause >nul
