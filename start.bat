@echo off
title SFA CRM - Starting...

echo [1/2] Starting Backend (port 8000)...
start "SFA-CRM-Backend" cmd /k "cd /d %~dp0src\backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/2] Starting Frontend (port 3000)...
start "SFA-CRM-Frontend" cmd /k "cd /d %~dp0src\frontend && npm run dev"

timeout /t 5 /nobreak >nul
start http://localhost:3000

echo.
echo Both services started. Browser opening...
echo Close the two cmd windows to stop.
