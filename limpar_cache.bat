@echo off
echo ===================================================
echo   LIMPEZA PROFUNDA E RESTART
echo ===================================================
echo.

echo 1. Parando processos...
taskkill /F /IM node.exe >nul 2>&1

echo 2. Limpando cache do React...
if exist "client\node_modules\.cache" (
    rmdir /s /q "client\node_modules\.cache"
    echo Cache limpo.
)

echo 3. Reiniciando em modo DEV...
echo    Isso vai forcar o React a recompilar tudo.
echo.

call npm run dev

pause
