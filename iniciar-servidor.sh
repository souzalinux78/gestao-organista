#!/bin/bash
# Script para iniciar o servidor corretamente
# Uso: ./iniciar-servidor.sh

set -e

echo "========================================"
echo "  Iniciando Servidor"
echo "========================================"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Obter porta do .env ou usar padrão
PORTA=$(grep "^PORT=" .env 2>/dev/null | cut -d '=' -f2 || echo "5001")
echo -e "${YELLOW}🔍 Verificando porta $PORTA...${NC}"
if lsof -Pi :$PORTA -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${YELLOW}⚠️  Porta 5000 já está em uso${NC}"
    
    # Verificar se é PM2
    if pm2 list | grep -q "gestao-organista-api"; then
        echo -e "${YELLOW}📋 Processo PM2 encontrado. Parando...${NC}"
        pm2 stop gestao-organista-api
        pm2 delete gestao-organista-api
        sleep 2
    else
        # Matar processo na porta
        echo -e "${YELLOW}🔪 Matando processo na porta $PORTA...${NC}"
        sudo lsof -ti:$PORTA | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
else
    echo -e "${GREEN}✅ Porta $PORTA livre${NC}"
fi

# Verificar se o arquivo .env existe
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Arquivo .env não encontrado!${NC}"
    echo "Crie o arquivo .env antes de iniciar o servidor."
    exit 1
fi

# Verificar se o PM2 está instalado
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2 não encontrado. Instalando...${NC}"
    sudo npm install -g pm2
fi

# Iniciar com PM2
echo -e "${YELLOW}🚀 Iniciando servidor com PM2...${NC}"
pm2 start ecosystem.config.js

# Salvar configuração do PM2
pm2 save

# Configurar PM2 para iniciar no boot (se ainda não configurado)
if ! pm2 startup | grep -q "already"; then
    echo -e "${YELLOW}⚙️  Configurando PM2 para iniciar no boot...${NC}"
    echo "Execute o comando exibido acima para configurar o startup."
fi

# Aguardar alguns segundos
sleep 3

# Verificar status
echo -e "${YELLOW}🔍 Verificando status...${NC}"
pm2 status

# Obter porta para teste
PORTA_TESTE=$(grep "^PORT=" .env 2>/dev/null | cut -d '=' -f2 || echo "5001")

# Testar API
echo -e "${YELLOW}🧪 Testando API na porta $PORTA_TESTE...${NC}"
sleep 2
if curl -f http://localhost:$PORTA_TESTE/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Servidor iniciado com sucesso!${NC}"
    echo ""
    echo "📝 Comandos úteis:"
    echo "  - Ver logs: pm2 logs gestao-organista-api"
    echo "  - Ver status: pm2 status"
    echo "  - Parar: pm2 stop gestao-organista-api"
    echo "  - Reiniciar: pm2 restart gestao-organista-api"
    echo "  - Porta: $PORTA_TESTE"
else
    echo -e "${RED}❌ API não está respondendo. Verifique os logs:${NC}"
    echo "pm2 logs gestao-organista-api --lines 50"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================"
echo "  ✅ Servidor Iniciado!"
echo "========================================${NC}"
