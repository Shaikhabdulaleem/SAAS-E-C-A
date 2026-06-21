@echo off
cd /d "%~dp0.."
start "NexusHQ API" cmd /k scripts\run-api.cmd
start "NexusHQ Frontend" cmd /k scripts\run-web.cmd
echo NexusHQ local servers are starting.
echo.
echo API:      http://localhost:3002/api/health
echo Frontend: http://localhost:5173
echo.
echo Keep the two opened command windows running while using the app.
