#!/bin/bash
# Script para rebuild/restart do BACKEND em produção
# Uso: ./rebuild-backend.sh
#
# O que ele faz:
# - (opcional) instala dependências do backend
# - reinicia o PM2 do backend (gestao-organista-api)
# - valida se a API subiu (health check)
#
# IMPORTANTE: este script NÃO mexe no .env.

set -e

echo "========================================"
echo "  Rebuild do Backend (API)"
echo "========================================"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verificar se está no diretório correto
if [ ! -d "server" ]; then
  echo -e "${RED}❌ Execute este script no diretório raiz do projeto (/var/www/gestao-organista)${NC}"
  exit 1
fi

# Instalar dependências do backend (se existir package.json na raiz)
if [ -f "package.json" ]; then
  echo -e "${YELLOW}📦 Instalando dependências do backend (npm install)...${NC}"
  npm install
  echo -e "${GREEN}✅ Dependências do backend instaladas${NC}"
else
  echo -e "${YELLOW}⚠️  package.json não encontrado na raiz. Pulando npm install do backend.${NC}"
fi

echo -e "${YELLOW}🔄 Reiniciando PM2 (gestao-organista-api)...${NC}"
pm2 restart gestao-organista-api
echo -e "${GREEN}✅ PM2 reiniciado${NC}"

echo -e "${YELLOW}🩺 Validando health check...${NC}"
if curl -fsS "http://localhost:5001/api/health" >/dev/null; then
  echo -e "${GREEN}✅ API respondeu no /api/health${NC}"
else
  echo -e "${RED}❌ API não respondeu no /api/health. Veja logs:${NC}"
  echo "   pm2 logs gestao-organista-api --lines 120"
  exit 1
fi

echo ""
echo -e "${GREEN}========================================"
echo "  ✅ Backend Rebuild Concluído!"
echo "========================================${NC}"
echo ""
echo "🧭 Qual script usar neste projeto?"
echo " - ✅ Mudou backend (server/*), rotas /api, auth, DB, serviços: use ./rebuild-backend.sh"
echo " - ✅ Mudou apenas frontend (client/*): use ./rebuild-frontend.sh"
echo " - ✅ Mudou ambos: use ./deploy.sh"
echo ""
