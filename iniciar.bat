@echo off
TITLE GESTOR DO SISTEMA
color 0A
echo ==========================================
echo   INICIANDO O SISTEMA (V3.2 FINAL)
echo ==========================================
echo.

:: 1. Inicia o Servidor (Backend)
echo [1/2] Iniciando o Servidor (Backend)...
start "SERVIDOR BACKEND" cmd /k "cd server && node index.js"

:: Aguarda 5 segundos para o banco conectar
timeout /t 5 >nul

:: 2. Inicia o Site (Frontend)
echo [2/2] Iniciando o Site (Frontend)...
echo Entrando na pasta 'client'...

:: AQUI ESTAVA O SEGREDO: Entrar na pasta client
cd client
npm start

pause