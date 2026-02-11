@echo off
echo Starting InnerSpark Ecosystem...

:: Check for node_modules
if not exist "node_modules\" (
    echo node_modules not found. Installing dependencies...
    call npm install
)

:: Start Backend
start "InnerSpark Backend" cmd /k "npm start"

:: Wait a bit for server to start
timeout /t 3 /nobreak > nul

:: Open Browser
echo Opening Silicon Sanctuary...
start http://localhost:5000

echo All systems initialized. Enjoy your course.
