@echo off
REM FlowSecure - start backend + frontend together (Windows)
REM Run this from the repo root: start.bat

set ROOT=%~dp0

if not exist "%ROOT%backend\venv\Scripts\activate.bat" (
    echo ERROR: venv not found. Run setup.bat first.
    pause & exit /b 1
)

echo [FlowSecure] Starting servers...
echo.

start "FlowSecure Backend" cmd /k "cd /d "%ROOT%backend" && call venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"
echo [Backend]  http://localhost:8000
echo [API docs] http://localhost:8000/docs

timeout /t 2 /nobreak >/dev/null

start "FlowSecure Frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev -- --port 5173"
echo [Frontend] http://localhost:5173
echo.
echo Both servers running in separate windows. Close them to stop.
pause
