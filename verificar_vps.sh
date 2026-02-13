#!/bin/bash

# Script de Verificação - Execute na VPS

echo "=== 1. VERIFICANDO VERSÃO DO ARQUIVO ==="
echo ""
echo "Procurando por 'hasStrictRJMCycle' no código:"
grep -n "hasStrictRJMCycle" /var/www/gestao-organista/server/services/rodizioCicloService.js

echo ""
echo "=== 2. VERIFICANDO ÚLTIMO COMMIT ==="
cd /var/www/gestao-organista
git log -1 --oneline

echo ""
echo "=== 3. VERIFICANDO STATUS DO GIT ==="
git status

echo ""
echo "=== 4. VERIFICANDO BRANCH ==="
git branch

echo ""
echo "=== 5. DIFF COM ORIGIN ==="
git diff HEAD origin/main -- server/services/rodizioCicloService.js | head -50

echo ""
echo "=== INSTRUÇÕES ==="
echo "Se 'hasStrictRJMCycle' NÃO aparecer, o código não foi atualizado!"
echo "Execute:"
echo "  git fetch"
echo "  git pull origin main"
echo "  pm2 restart gestao-organista"
