#!/bin/bash
# Deploy completo (frontend + backend) em produção
# Uso: ./deploy.sh
#
# Este script existe para evitar o problema clássico:
# - frontend atualizado ✅
# - backend (PM2) rodando código antigo ❌
#
# IMPORTANTE: este script NÃO mexe no .env.

set -e

echo "========================================"
echo "  Deploy Completo (Frontend + Backend)"
echo "========================================"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verificar se está no diretório correto
if [ ! -d "client" ] || [ ! -d "server" ]; then
  echo -e "${RED}❌ Execute este script no diretório raiz do projeto (/var/www/gestao-organista)${NC}"
  exit 1
fi

echo -e "${YELLOW}🔨 1/3 Rebuild do Frontend...${NC}"
./rebuild-frontend.sh

echo -e "${YELLOW}🔄 2/3 Rebuild/Restart do Backend...${NC}"
./rebuild-backend.sh

echo -e "${YELLOW}🩺 3/3 Checagens rápidas...${NC}"
echo " - Health:"
curl -i "http://localhost:5001/api/health" | head -n 12 || true
echo ""

echo -e "${GREEN}========================================"
echo "  ✅ Deploy Completo Finalizado!"
echo "========================================${NC}"
echo ""
echo "🧭 Qual script usar neste projeto?"
echo " - ✅ Mudou APENAS frontend (client/*): ./rebuild-frontend.sh"
echo " - ✅ Mudou APENAS backend (server/*): ./rebuild-backend.sh"
echo " - ✅ Mudou ambos (ou quer garantir tudo): ./deploy.sh"
echo ""
