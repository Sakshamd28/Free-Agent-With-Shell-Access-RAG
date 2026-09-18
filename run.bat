@echo off
title AI Security Agent Runner
echo ===================================================
echo        Starting AI Security Agent & Web UI
echo ===================================================

echo [1/2] Launching FastAPI Backend on http://127.0.0.1:8000...
start "AI Security Agent - Backend" cmd /k "cd backend && python app.py"

timeout /t 2 /nobreak >nul

echo [2/2] Launching React Vite Frontend on http://localhost:5173...
start "AI Security Agent - Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Application is running!
echo Frontend: http://localhost:5173
echo Backend API: http://127.0.0.1:8000/docs
echo.
pause
