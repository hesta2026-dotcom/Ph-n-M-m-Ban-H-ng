@echo off
setlocal EnableDelayedExpansion
title May Chu POS System
color 0A
echo ============================================
echo        MAY CHU POS - DANG KHOI DONG
echo ============================================
echo.

:: ---- [1/5] Tat tien trinh cu ----
echo [1/5] Tat tien trinh cu...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000 " 2^>nul') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " 2^>nul') do taskkill /PID %%a /F >nul 2>&1
taskkill /IM ngrok.exe /F >nul 2>&1
timeout /t 1 /nobreak >nul

:: ---- Lay IP LAN (chi lay cai dau tien, bo qua 169.254) ----
set IP=192.168.1.2
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" ^| findstr /v "169.254"') do (
    if "!IP!"=="192.168.1.2" set IP=%%a
)
:: Xoa khoang trang dau
if defined IP set IP=%IP:~1%

:: ---- [2/5] Backend ----
echo [2/5] Khoi dong Backend (port 5000)...
start "Backend POS :5000" cmd /k "cd /d "d:\HESTA PHAN MEM\Ph-n-M-m-Ban-H-ng\backend" && node src/index.js"
timeout /t 3 /nobreak >nul

:: ---- [3/5] Frontend Vite ----
echo [3/5] Khoi dong Frontend Vite (port 5173)...
start "Frontend Vite :5173" cmd /k "cd /d "d:\HESTA PHAN MEM\Ph-n-M-m-Ban-H-ng\frontend" && npm run dev"
timeout /t 4 /nobreak >nul

:: ---- [4/5] ngrok Tunnel ----
echo [4/5] Khoi dong Tunnel Internet (ngrok)...
if exist "C:\Users\Admin\ngrok.exe" (
    start "ngrok Tunnel" cmd /k "D:\matbao\ngrok.exe http --domain=plausible-quarrel-comprised.ngrok-free.dev 5000"
) else (
    echo    [WARN] Khong tim thay ngrok.exe - bo qua tunnel
)
timeout /t 3 /nobreak >nul

:: ---- [5/5] Hoan tat ----
echo [5/5] Hoan tat!
echo.
echo ============================================
echo   HE THONG DANG CHAY:
echo   - Backend  : http://%IP%:5000
echo   - Frontend : http://%IP%:5173
echo   - Internet : https://plausible-quarrel-comprised.ngrok-free.dev
echo.
echo   Vercel (online) : https://ph-n-m-m-ban-h-ng.vercel.app
echo ============================================
echo.
echo Nhan phim bat ky de dong cua so nay...
pause >nul
