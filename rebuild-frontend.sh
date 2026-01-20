#!/bin/bash
# Script para rebuild do frontend em produção
# Uso: ./rebuild-frontend.sh

set -e

echo "========================================"
echo "  Rebuild do Frontend"
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

# Verificar se o diretório client existe
if [ ! -d "client" ]; then
    echo -e "${RED}❌ Diretório client não encontrado!${NC}"
    exit 1
fi

# Limpar build anterior
echo -e "${YELLOW}🧹 Limpando build anterior...${NC}"
cd client
rm -rf build
rm -rf node_modules/.cache
echo -e "${GREEN}✅ Build anterior removido${NC}"

# Instalar dependências
echo -e "${YELLOW}📦 Instalando dependências...${NC}"
npm install
echo -e "${GREEN}✅ Dependências instaladas${NC}"

# Build do frontend
echo -e "${YELLOW}🔨 Fazendo build do frontend...${NC}"
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build concluído com sucesso!${NC}"
    
    # Verificar se o build foi criado
    if [ -d "build" ]; then
        echo -e "${GREEN}✅ Diretório build criado${NC}"
        echo ""
        echo "📊 Tamanho do build:"
        du -sh build
        echo ""
        echo "📁 Arquivos principais:"
        ls -lh build/static/js/*.js 2>/dev/null | head -3 || echo "Verificando arquivos..."
        ls -lh build/static/css/*.css 2>/dev/null | head -3 || echo "Verificando CSS..."
    else
        echo -e "${RED}❌ Diretório build não foi criado!${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Erro ao fazer build!${NC}"
    exit 1
fi

cd ..

# Recarregar Nginx
echo -e "${YELLOW}🔄 Recarregando Nginx...${NC}"
if sudo systemctl reload nginx 2>/dev/null; then
    echo -e "${GREEN}✅ Nginx recarregado${NC}"
else
    echo -e "${YELLOW}⚠️  Não foi possível recarregar Nginx (pode não ter permissão)${NC}"
    echo "   Execute manualmente: sudo systemctl reload nginx"
fi

echo ""
echo -e "${GREEN}========================================"
echo "  ✅ Frontend Rebuild Concluído!"
echo "========================================${NC}"
echo ""
echo "📝 Próximos passos:"
echo "1. Limpe o cache do navegador (Ctrl+Shift+R ou Cmd+Shift+R)"
echo "2. Acesse: https://gestaoorganista.automatizeonline.com.br"
echo "3. Verifique se o menu aparece corretamente"
echo ""
