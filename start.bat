@echo off
title Krynox Method Server
echo Installing dependencies...
cd /d "%~dp0"
call npm install
echo Starting Krynox Method server...
node server.js
pause
