#!/bin/bash
# Script para mudar a porta do servidor
# Uso: ./mudar-porta.sh

set -e

echo "========================================"
echo "  Mudar Porta do Servidor"
echo "========================================"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Solicitar nova porta
read -p "Qual porta deseja usar? (ex: 5001): " NOVA_PORTA

if [ -z "$NOVA_PORTA" ]; then
    echo -e "${RED}❌ Porta não informada!${NC}"
    exit 1
fi

# Verificar se a porta é um número
if ! [[ "$NOVA_PORTA" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}❌ Porta inválida! Deve ser um número.${NC}"
    exit 1
fi

# Verificar se a porta está em uso
echo -e "${YELLOW}🔍 Verificando se a porta $NOVA_PORTA está livre...${NC}"
if lsof -Pi :$NOVA_PORTA -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${RED}❌ Porta $NOVA_PORTA já está em uso!${NC}"
    echo "Processos usando a porta:"
    sudo lsof -i :$NOVA_PORTA
    exit 1
else
    echo -e "${GREEN}✅ Porta $NOVA_PORTA está livre${NC}"
fi

# Obter porta atual
PORTA_ATUAL=$(grep "^PORT=" .env 2>/dev/null | cut -d '=' -f2 || echo "5000")
echo -e "${YELLOW}📋 Porta atual: $PORTA_ATUAL${NC}"
echo -e "${YELLOW}📋 Nova porta: $NOVA_PORTA${NC}"

read -p "Deseja continuar? (S/N): " confirmar
if [ "$confirmar" != "S" ] && [ "$confirmar" != "s" ]; then
    echo "Operação cancelada."
    exit 0
fi

# Atualizar .env
echo -e "${YELLOW}📝 Atualizando .env...${NC}"
if [ -f .env ]; then
    sed -i "s/^PORT=.*/PORT=$NOVA_PORTA/" .env
    echo -e "${GREEN}✅ .env atualizado${NC}"
else
    echo -e "${RED}❌ Arquivo .env não encontrado!${NC}"
    exit 1
fi

# Atualizar ecosystem.config.js
echo -e "${YELLOW}📝 Atualizando ecosystem.config.js...${NC}"
if [ -f ecosystem.config.js ]; then
    sed -i "s/PORT: [0-9]*/PORT: $NOVA_PORTA/" ecosystem.config.js
    echo -e "${GREEN}✅ ecosystem.config.js atualizado${NC}"
else
    echo -e "${YELLOW}⚠️  Arquivo ecosystem.config.js não encontrado${NC}"
fi

# Atualizar Nginx
echo -e "${YELLOW}📝 Atualizando Nginx...${NC}"
NGINX_CONFIG="/etc/nginx/sites-available/gestaoorganista.automatizeonline.com.br"
if [ -f "$NGINX_CONFIG" ]; then
    sudo sed -i "s/localhost:$PORTA_ATUAL/localhost:$NOVA_PORTA/g" "$NGINX_CONFIG"
    sudo sed -i "s/localhost:500[0-9]/localhost:$NOVA_PORTA/g" "$NGINX_CONFIG"
    echo -e "${GREEN}✅ Nginx atualizado${NC}"
    
    # Testar configuração do Nginx
    echo -e "${YELLOW}🧪 Testando configuração do Nginx...${NC}"
    if sudo nginx -t; then
        echo -e "${GREEN}✅ Configuração do Nginx válida${NC}"
        sudo systemctl reload nginx
        echo -e "${GREEN}✅ Nginx recarregado${NC}"
    else
        echo -e "${RED}❌ Erro na configuração do Nginx!${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Arquivo de configuração do Nginx não encontrado${NC}"
    echo "   Atualize manualmente: $NGINX_CONFIG"
fi

# Reiniciar PM2
echo -e "${YELLOW}🔄 Reiniciando aplicação...${NC}"
if pm2 list | grep -q "gestao-organista-api"; then
    pm2 restart gestao-organista-api
    sleep 2
    echo -e "${GREEN}✅ Aplicação reiniciada${NC}"
else
    echo -e "${YELLOW}⚠️  Aplicação não está rodando no PM2${NC}"
    echo "   Inicie manualmente: pm2 start ecosystem.config.js"
fi

# Testar API
echo -e "${YELLOW}🧪 Testando API...${NC}"
sleep 2
if curl -f http://localhost:$NOVA_PORTA/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API respondendo na porta $NOVA_PORTA${NC}"
else
    echo -e "${RED}❌ API não está respondendo! Verifique os logs:${NC}"
    echo "pm2 logs gestao-organista-api --lines 50"
fi

echo ""
echo -e "${GREEN}========================================"
echo "  ✅ Porta Alterada para $NOVA_PORTA!"
echo "========================================${NC}"
echo ""
echo "📝 Resumo:"
echo "  - Porta antiga: $PORTA_ATUAL"
echo "  - Porta nova: $NOVA_PORTA"
echo ""
echo "🔍 Verificar:"
echo "  - pm2 status"
echo "  - curl http://localhost:$NOVA_PORTA/api/health"
echo "  - curl https://gestaoorganista.automatizeonline.com.br/api/health"
echo ""
