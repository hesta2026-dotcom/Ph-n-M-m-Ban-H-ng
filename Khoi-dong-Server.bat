@echo off
chcp 65001 > nul
title POS Server - Dang chay...
echo ============================================
echo   POS SERVER DANG CHAY
echo   Khong tat cua so nay!
echo ============================================
echo.
cd /d "%~dp0backend"
node start.js
pause
