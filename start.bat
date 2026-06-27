@echo off
echo ==========================================
echo   Construction Transport Management System
echo ==========================================
echo.

:: Add Node.js to PATH
set PATH=%PATH%;C:\Program Files\nodejs

:: Check if Node is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo Node.js found!
echo.

:: Install dependencies if needed
if not exist "node_modules\express" (
    echo Installing dependencies...
    call npm install
    echo.
)

echo Starting CTMS Server...
echo.
echo Application will be available at: http://localhost:3000
echo.
echo Default Credentials:
echo   Admin:      admin@ctms.com / admin123
echo   Supervisor: supervisor@ctms.com / supervisor123
echo.
echo Press Ctrl+C to stop the server
echo.

start "" "http://localhost:3000"

node server.js
pause
