@echo off
title SFA CRM - Reset Demo Data
echo.
echo === Resetting demo database ===
echo This will delete and reinitialize the database with fresh seed data.
echo.

del /Q "%~dp0src\backend\data\sfa_crm.db" 2>nul
cd /d "%~dp0src\backend"
python -c "from app.core.init_db import init_db; init_db()"

echo.
echo === Done! You can now run start.bat ===
pause
