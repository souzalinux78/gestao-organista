#!/bin/bash
# Script para restaurar o backend rapidamente
# Uso: ./restaurar-backend.sh

set -e

echo "========================================"
echo "  RESTAURAR BACKEND"
echo "========================================"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Execute este script no diretório raiz do projeto!${NC}"
    exit 1
fi

# 1. Instalar dependências faltantes
echo -e "${YELLOW}1. Verificando dependências...${NC}"
if [ ! -d "node_modules/helmet" ] || [ ! -d "node_modules/express-rate-limit" ]; then
    echo -e "${YELLOW}📦 Instalando dependências de segurança...${NC}"
    npm install helmet express-rate-limit
    echo -e "${GREEN}✅ Dependências instaladas${NC}"
else
    echo -e "${GREEN}✅ Dependências já instaladas${NC}"
fi
echo ""

# 2. Parar processo atual (se existir)
echo -e "${YELLOW}2. Parando processo atual...${NC}"
pm2 stop gestao-organista-api 2>/dev/null || echo -e "${YELLOW}⚠️  Processo não estava rodando${NC}"
echo ""

# 3. Reiniciar backend
echo -e "${YELLOW}3. Reiniciando backend...${NC}"
pm2 restart gestao-organista-api 2>/dev/null || pm2 start ecosystem.config.js
sleep 3
echo ""

# 4. Verificar status
echo -e "${YELLOW}4. Verificando status...${NC}"
pm2 status
echo ""

# 5. Testar conexão
echo -e "${YELLOW}5. Testando conexão...${NC}"
sleep 2
MAX_RETRIES=5
RETRY_COUNT=0
API_RESPONDING=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f http://localhost:5001/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend está respondendo!${NC}"
        API_RESPONDING=true
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo -e "${YELLOW}⏳ Aguardando backend iniciar... (tentativa $RETRY_COUNT/$MAX_RETRIES)${NC}"
        sleep 3
    fi
done

if [ "$API_RESPONDING" = false ]; then
    echo -e "${RED}❌ Backend não está respondendo após $MAX_RETRIES tentativas!${NC}"
    echo ""
    echo -e "${YELLOW}📋 Verifique os logs:${NC}"
    echo "pm2 logs gestao-organista-api --lines 50"
    echo ""
    echo -e "${YELLOW}📋 Tente iniciar manualmente:${NC}"
    echo "node server/index.js"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================"
echo "  ✅ Backend Restaurado com Sucesso!"
echo "========================================${NC}"
echo ""
