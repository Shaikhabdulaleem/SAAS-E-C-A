@echo off
cd /d "%~dp0.."
set DATABASE_URL=postgresql://user:password@localhost:5432/nexushq?schema=public
set JWT_ACCESS_SECRET=local-dev-access-secret-change-me
set JWT_REFRESH_SECRET=local-dev-refresh-secret-change-me
set ENCRYPTION_KEY=local-dev-encryption-key-change-me
set CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173
set NODE_ENV=development
set PORT=3002
set HOST=::
"C:\Program Files\nodejs\node.exe" apps\api\dist\src\main.js
pause
