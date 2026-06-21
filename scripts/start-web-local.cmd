@echo off
cd /d "%~dp0.."
node scripts\local-static-server.cjs 5173 dist
