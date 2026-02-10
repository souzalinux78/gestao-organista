@echo off
REM Migração: coluna permite_alunas na tabela cultos
REM Uso: execute na raiz do projeto ou ajuste o caminho do .sql abaixo.

set DB_NAME=gestao_organista
set SQL_FILE=%~dp0migrate-cultos-permite-alunas.sql

mysql -u root -p %DB_NAME% < "%SQL_FILE%"
if %ERRORLEVEL% neq 0 (
  echo Erro ao executar migracao. Verifique usuario/senha e se o MySQL esta no PATH.
  pause
  exit /b 1
)
echo Migracao aplicada: permite_alunas em cultos.
pause
