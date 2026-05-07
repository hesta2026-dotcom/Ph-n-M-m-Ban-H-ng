@echo off
title Cai dat POS System - May Moi
color 0B
echo ============================================
echo     CAI DAT POS SYSTEM - LAN DAU TIEN
echo ============================================
echo.

:: Kiem tra Node.js
echo [1/5] Kiem tra Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [LOI] Chua cai Node.js!
    echo Vao https://nodejs.org va tai ban LTS
    pause
    exit
)
echo [OK] Node.js da co
node --version

:: Tao thu muc database
echo.
echo [2/5] Tao thu muc database...
mkdir "D:\HESTA PHAN MEM\database" 2>nul
echo [OK] Thu muc: D:\HESTA PHAN MEM\database\

:: Cai backend dependencies
echo.
echo [3/5] Cai Backend dependencies...
cd /d "d:\HESTA PHAN MEM\Ph-n-M-m-Ban-H-ng\backend"
call npm install
if %errorlevel% neq 0 (
    echo [LOI] npm install backend that bai!
    pause
    exit
)
echo [OK] Backend dependencies da cai xong

:: Tao database
echo.
echo [4/5] Tao database...
call npx prisma generate
call npx prisma db push
if %errorlevel% neq 0 (
    echo [LOI] Tao database that bai!
    pause
    exit
)
echo [OK] Database da san sang

:: Cai frontend dependencies
echo.
echo [5/5] Cai Frontend dependencies...
cd /d "d:\HESTA PHAN MEM\Ph-n-M-m-Ban-H-ng\frontend"
call npm install
if %errorlevel% neq 0 (
    echo [LOI] npm install frontend that bai!
    pause
    exit
)
echo [OK] Frontend dependencies da cai xong

echo.
echo ============================================
echo   CAI DAT HOAN TAT!
echo.
echo   Tiep theo:
echo   - Chay "start.bat" de mo toan bo he thong
echo   - Hoac "Khoi-dong-Server.bat" de chi chay backend
echo ============================================
echo.
pause
