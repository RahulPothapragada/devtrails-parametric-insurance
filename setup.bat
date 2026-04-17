@echo off
REM FlowSecure - one-time setup (Windows)
REM Run this from the repo root: setup.bat

set ROOT=%~dp0

echo [FlowSecure] Setting up...
echo.

REM Check Python
python --version >/dev/null 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Install Python 3.10+ from https://python.org
    echo        Make sure to check "Add Python to PATH" during install.
    pause & exit /b 1
)

REM Check Node
node --version >/dev/null 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Install Node.js 18+ from https://nodejs.org
    pause & exit /b 1
)

REM Backend
echo [Backend] Installing Python dependencies...
cd /d "%ROOT%backend"
python -m venv venv
if errorlevel 1 ( echo ERROR: Failed to create venv & pause & exit /b 1 )
call venv\Scripts\activate.bat
pip install -r requirements.txt -q
if errorlevel 1 ( echo ERROR: pip install failed & pause & exit /b 1 )

if not exist "%ROOT%backend\.env" (
    if exist "%ROOT%backend\.env.example" (
        copy "%ROOT%backend\.env.example" "%ROOT%backend\.env" >/dev/null
        echo [Backend] Created .env from .env.example
    )
)
echo [Backend] Ready

REM Frontend
echo.
echo [Frontend] Installing Node dependencies...
cd /d "%ROOT%frontend"
call npm install --silent
if errorlevel 1 ( echo ERROR: npm install failed & pause & exit /b 1 )

if not exist "%ROOT%frontend\.env" (
    if exist "%ROOT%frontend\.env.example" (
        copy "%ROOT%frontend\.env.example" "%ROOT%frontend\.env" >/dev/null
        echo [Frontend] Created .env from .env.example
    )
)
echo [Frontend] Ready

echo.
echo [FlowSecure] Setup complete. Run start.bat to launch.
pause
