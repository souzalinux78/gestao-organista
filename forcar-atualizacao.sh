#!/bin/bash
# Script para FORÇAR atualização completa do sistema
# Uso: ./forcar-atualizacao.sh

set -e

echo "========================================"
echo "  FORÇAR ATUALIZAÇÃO COMPLETA"
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

# 1. Limpar TODOS os caches
echo -e "${YELLOW}🧹 Limpando TODOS os caches...${NC}"
cd client
rm -rf build
rm -rf node_modules/.cache
rm -rf .cache
rm -rf build/.cache
npm cache clean --force 2>/dev/null || true
cd ..
echo -e "${GREEN}✅ Caches limpos${NC}"

# 2. Limpar cache do Nginx
echo -e "${YELLOW}🧹 Limpando cache do Nginx...${NC}"
if sudo rm -rf /var/cache/nginx/* 2>/dev/null; then
    echo -e "${GREEN}✅ Cache do Nginx limpo${NC}"
else
    echo -e "${YELLOW}⚠️  Não foi possível limpar cache do Nginx${NC}"
fi

# 3. Rebuild completo do frontend
echo -e "${YELLOW}🔨 Fazendo rebuild completo do frontend...${NC}"
cd client
npm install
GENERATE_SOURCEMAP=false INLINE_RUNTIME_CHUNK=false npm run build
cd ..

if [ ! -d "client/build" ]; then
    echo -e "${RED}❌ Build não foi criado!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build criado com sucesso${NC}"

# 4. Recarregar Nginx
echo -e "${YELLOW}🔄 Recarregando Nginx...${NC}"
if sudo systemctl reload nginx 2>/dev/null; then
    echo -e "${GREEN}✅ Nginx recarregado${NC}"
else
    echo -e "${YELLOW}⚠️  Não foi possível recarregar Nginx${NC}"
    echo "   Execute manualmente: sudo systemctl reload nginx"
fi

# 5. Reiniciar aplicação
echo -e "${YELLOW}🔄 Reiniciando aplicação...${NC}"
if pm2 restart gestao-organista-api 2>/dev/null; then
    echo -e "${GREEN}✅ Aplicação reiniciada${NC}"
else
    echo -e "${YELLOW}⚠️  Não foi possível reiniciar aplicação${NC}"
fi

echo ""
echo -e "${GREEN}========================================"
echo "  ✅ Atualização Forçada Concluída!"
echo "========================================${NC}"
echo ""
echo -e "${YELLOW}⚠️  AÇÕES NECESSÁRIAS NO NAVEGADOR:${NC}"
echo ""
echo "1. Abra o DevTools (F12)"
echo "2. Vá em Application → Service Workers"
echo "3. Clique em 'Unregister' para cada service worker"
echo "4. Vá em Application → Clear storage"
echo "5. Clique em 'Clear site data'"
echo "6. Feche TODAS as abas do site"
echo "7. Limpe o cache do navegador (Ctrl+Shift+Delete)"
echo "8. Abra uma janela anônima e acesse o site"
echo ""
echo "OU use modo anônimo para testar imediatamente!"
echo ""
