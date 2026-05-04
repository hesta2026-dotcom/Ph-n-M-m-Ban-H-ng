@echo off
echo Dang khoi dong POS System...

:: Kill neu port cu con chay
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000 " 2^>nul') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " 2^>nul') do taskkill /PID %%a /F >nul 2>&1

:: Mo Backend
start "Backend :5000" cmd /k "cd /d C:\Users\Hesta\pos-system\backend && npm run dev"

:: Doi 3 giay roi mo Frontend
timeout /t 3 /nobreak >nul
start "Frontend :5173" cmd /k "cd /d C:\Users\Hesta\pos-system\frontend && npm run dev"

:: Doi 5 giay roi mo trinh duyet
timeout /t 5 /nobreak >nul
start http://localhost:5173

echo POS System da khoi dong!
