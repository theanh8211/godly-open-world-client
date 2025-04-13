@echo off
title Deploy Fly.io - Godly Open World Server

REM Di chuyển đến thư mục dự án server
cd /d "C:\Users\HLC\Desktop\Project\game\godly-open-world_v1\server"

echo ================================================
echo  🚀 BẮT ĐẦU TRIỂN KHAI SERVER LÊN FLY.IO
echo ================================================
echo.

REM Deploy ứng dụng với log chi tiết
fly deploy --verbose --no-cache

echo.
echo ================================================
echo  ✅ TRIỂN KHAI HOÀN TẤT HOẶC CÓ LỖI XẢY RA
echo  🔍 Kiểm tra log phía trên để biết chi tiết
echo ================================================

pause
