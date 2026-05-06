@echo off
title SFA CRM - Reset Demo Data
echo.
echo === Resetting demo database ===
echo This will delete and reinitialize the database with fresh seed data.
echo.

REM 0) Stop running backend on port 8000 to release sqlite file lock.
REM    Without this, del fails silently and init_db hits UNIQUE conflict on system_config.
echo [1/4] Stopping backend on :8000 if running...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo   killing PID %%P
    taskkill /F /PID %%P >nul 2>&1
)

REM Wait briefly for OS to release file handle
ping -n 2 127.0.0.1 >nul

echo [2/4] Deleting old database files...
del /Q "%~dp0src\backend\data\sfa_crm.db" 2>nul
del /Q "%~dp0src\backend\data\sfa_crm.db-wal" 2>nul
del /Q "%~dp0src\backend\data\sfa_crm.db-shm" 2>nul

if exist "%~dp0src\backend\data\sfa_crm.db" (
    echo.
    echo [ERROR] sfa_crm.db still exists - close all Python/uvicorn processes and retry.
    pause
    exit /b 1
)

echo [3/4] Re-initializing database with seed data + MEDDICC analyze...
cd /d "%~dp0src\backend"
python -c "from app.core.init_db import init_db; init_db()"
if errorlevel 1 (
    echo.
    echo [ERROR] init_db failed. See traceback above.
    pause
    exit /b 1
)

echo [4/4] Done.
echo.
echo === Reset complete. Run start.bat to launch backend + frontend. ===
pause
