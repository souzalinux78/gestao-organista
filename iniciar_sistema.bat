@echo off
title GESTAO DE ORGANISTA - Startup
color 0A

echo ===================================================
echo   REINICIANDO SISTEMA COMPLETO (BACKEND + FRONTEND)
echo ===================================================
echo.

echo [1/3] Parando processos antigos do Node.js...
taskkill /F /IM node.exe >nul 2>&1
echo       Processos limpos.
echo.

echo [2/3] Verificando dependencias...
if not exist "node_modules" (
    echo       Instalando dependencias...
    call npm install
)
if not exist "client\node_modules" (
    echo       Instalando dependencias do cliente...
    cd client
    call npm install
    cd ..
)
echo.

echo [3/3] INICIANDO SISTEMA...
echo       Aguarde: Backend (5001) e Frontend (3000) iniciando...
echo.

call npm run dev

pause
