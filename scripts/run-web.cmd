@echo off
cd /d "%~dp0.."
set PORT=5173
set HOST=::
"C:\Program Files\nodejs\node.exe" scripts\serve-dist.cjs
pause
