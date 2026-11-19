@echo off
REM start-pullse - launch the Pullse dev server
cd /d "%~dp0"
echo Starting Pullse dev server...
start "" http://localhost:3000
call npm run dev
