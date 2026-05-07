@echo off
chcp 65001 > nul
echo ============================================
echo   CÀI ĐẶT HỆ THỐNG POS - MÁY MỚI
echo ============================================
echo.

:: Kiểm tra Node.js
node -v > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [LỖI] Chưa cài Node.js!
  echo Tải tại: https://nodejs.org  ^(chọn LTS^)
  echo Sau khi cài xong, chạy lại file này.
  pause
  exit /b 1
)
echo [OK] Node.js:
node -v

:: Kiểm tra Git
git -v > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [LỖI] Chưa cài Git!
  echo Tải tại: https://git-scm.com
  pause
  exit /b 1
)
echo [OK] Git:
git -v

echo.
echo Cài đặt thư viện backend...
cd /d "%~dp0backend"
npm install
if %ERRORLEVEL% NEQ 0 (
  echo [LỖI] npm install thất bại!
  pause
  exit /b 1
)

echo.
echo [OK] Cài đặt hoàn tất!
echo.
echo Tạo file khởi động...

:: Tạo file khởi động server
(
echo @echo off
echo chcp 65001 ^> nul
echo title POS Server - Dang chay...
echo echo ============================================
echo echo   POS SERVER DANG CHAY
echo echo   Khong tat cua so nay!
echo echo ============================================
echo echo.
echo cd /d "%%~dp0backend"
echo node start.js
echo pause
) > "%~dp0Khoi-dong-Server.bat"

echo [OK] Đã tạo "Khoi-dong-Server.bat"
echo.
echo ============================================
echo   HOÀN TẤT! Làm theo bước sau:
echo ============================================
echo.
echo 1. Mở file "Khoi-dong-Server.bat" để chạy server
echo 2. Đợi hiện "Starting server..." là xong
echo 3. Truy cập: http://localhost:5000
echo.
echo Đăng nhập: admin@pos.com / 123456
echo.
pause
