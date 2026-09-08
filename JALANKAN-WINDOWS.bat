@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terinstall.
  echo Install Node.js terlebih dahulu, kemudian jalankan file ini lagi.
  pause
  exit /b 1
)

echo =============================================
echo       POS APOTEK - MENJALANKAN APLIKASI
echo =============================================
echo.

echo [1/2] Memasang dependency...
npm install
if errorlevel 1 (
  echo.
  echo Gagal menjalankan npm install.
  pause
  exit /b 1
)

echo.
echo [2/2] Menjalankan server...
npm run dev
pause
