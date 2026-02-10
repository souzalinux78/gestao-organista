@echo off
setlocal enabledelayedexpansion

title Gestao de Organista - Iniciando

cd /d "%~dp0"

echo.
echo ========================================
echo   Gestao de Organista - Iniciando
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado. Instale em https://nodejs.org
    pause
    exit /b 1
)

if not exist ".env" (
    echo [AVISO] Arquivo .env nao encontrado.
    echo Copie env.production.example para .env - veja COMO_CRIAR_ENV.md
    echo.
    pause
)

if not exist "node_modules" (
    echo Instalando dependencias do backend...
    npm install
    if errorlevel 1 (
        echo [ERRO] Falha ao instalar dependencias.
        pause
        exit /b 1
    )
)

if not exist "client\node_modules" (
    echo Instalando dependencias do frontend...
    pushd client
    npm install
    set "NPM_ERR=!errorlevel!"
    popd
    if not "!NPM_ERR!"=="0" (
        echo [ERRO] Falha ao instalar dependencias do client.
        pause
        exit /b 1
    )
)

echo.
echo Iniciando backend e frontend (npm run dev)...
echo Backend: http://localhost:5001
echo Frontend: http://localhost:3000
echo Pressione Ctrl+C para encerrar.
echo ========================================
echo.

npm run dev
pause
