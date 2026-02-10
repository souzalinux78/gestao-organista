#!/bin/bash
# Script de diagnóstico rápido do backend
# Uso: ./diagnostico-backend.sh

echo "========================================"
echo "  DIAGNÓSTICO DO BACKEND"
echo "========================================"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Verificar se PM2 está rodando
echo -e "${YELLOW}1. Verificando PM2...${NC}"
if command -v pm2 &> /dev/null; then
    pm2 status
    echo ""
else
    echo -e "${RED}❌ PM2 não está instalado${NC}"
fi

# 2. Verificar se o processo está rodando
echo -e "${YELLOW}2. Verificando processo na porta 5001...${NC}"
if netstat -tlnp 2>/dev/null | grep 5001 || ss -tlnp 2>/dev/null | grep 5001; then
    echo -e "${GREEN}✅ Porta 5001 está em uso${NC}"
else
    echo -e "${RED}❌ Porta 5001 não está em uso - Backend não está rodando!${NC}"
fi
echo ""

# 3. Testar conexão direta
echo -e "${YELLOW}3. Testando conexão direta...${NC}"
if curl -f http://localhost:5001/api/health 2>/dev/null; then
    echo -e "${GREEN}✅ Backend está respondendo${NC}"
else
    echo -e "${RED}❌ Backend não está respondendo${NC}"
fi
echo ""

# 4. Verificar logs do PM2
echo -e "${YELLOW}4. Últimas linhas dos logs do PM2:${NC}"
if pm2 logs gestao-organista-api --lines 10 --nostream 2>/dev/null; then
    echo ""
else
    echo -e "${RED}❌ Não foi possível ler logs do PM2${NC}"
fi

# 5. Verificar dependências
echo -e "${YELLOW}5. Verificando dependências...${NC}"
cd /var/www/gestao-organista 2>/dev/null || cd .
if [ -f "package.json" ]; then
    if [ -d "node_modules/helmet" ] && [ -d "node_modules/express-rate-limit" ]; then
        echo -e "${GREEN}✅ Dependências instaladas${NC}"
    else
        echo -e "${RED}❌ Dependências faltando! Execute: npm install${NC}"
    fi
else
    echo -e "${RED}❌ package.json não encontrado${NC}"
fi
echo ""

# 6. Verificar variáveis de ambiente
echo -e "${YELLOW}6. Verificando .env...${NC}"
if [ -f ".env" ]; then
    if grep -q "PORT" .env; then
        PORT=$(grep PORT .env | cut -d '=' -f2 | tr -d ' ')
        echo -e "${GREEN}✅ PORT configurado: $PORT${NC}"
    else
        echo -e "${YELLOW}⚠️  PORT não encontrado no .env${NC}"
    fi
else
    echo -e "${RED}❌ Arquivo .env não encontrado${NC}"
fi
echo ""

# 7. Solução rápida
echo -e "${YELLOW}========================================"
echo "  SOLUÇÃO RÁPIDA"
echo "========================================${NC}"
echo ""
echo "Para reiniciar o backend:"
echo "  cd /var/www/gestao-organista"
echo "  pm2 restart gestao-organista-api"
echo ""
echo "Para ver logs em tempo real:"
echo "  pm2 logs gestao-organista-api"
echo ""
echo "Para instalar dependências faltantes:"
echo "  npm install"
echo ""
