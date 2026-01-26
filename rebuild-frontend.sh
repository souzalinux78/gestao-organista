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

# Limpar build anterior e caches
echo -e "${YELLOW}🧹 Limpando build anterior e caches...${NC}"
cd client
rm -rf build
rm -rf node_modules/.cache
rm -rf .cache
rm -rf build/.cache
# Limpar cache do npm também
npm cache clean --force 2>/dev/null || true
echo -e "${GREEN}✅ Build anterior e caches removidos${NC}"

# Instalar dependências
echo -e "${YELLOW}📦 Instalando dependências...${NC}"
npm install
echo -e "${GREEN}✅ Dependências instaladas${NC}"

# Build do frontend com variável de ambiente para evitar cache
echo -e "${YELLOW}🔨 Fazendo build do frontend (sem cache)...${NC}"
GENERATE_SOURCEMAP=false INLINE_RUNTIME_CHUNK=false npm run build

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

# Limpar cache do Nginx
echo -e "${YELLOW}🧹 Limpando cache do Nginx...${NC}"
if sudo rm -rf /var/cache/nginx/* 2>/dev/null; then
    echo -e "${GREEN}✅ Cache do Nginx limpo${NC}"
else
    echo -e "${YELLOW}⚠️  Não foi possível limpar cache do Nginx${NC}"
fi

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
echo "📝 Próximos passos IMPORTANTES:"
echo "1. Limpe o cache do navegador completamente:"
echo "   - Chrome/Edge: Ctrl+Shift+Delete → Limpar dados de navegação"
echo "   - Firefox: Ctrl+Shift+Delete → Limpar cache"
echo "   - Ou use modo anônimo para testar"
echo "2. Desregistre o Service Worker (se instalado como PWA):"
echo "   - Chrome: DevTools (F12) → Application → Service Workers → Unregister"
echo "3. Recarregue a página com Ctrl+Shift+R (hard refresh)"
echo "4. Acesse: https://gestaoorganista.automatizeonline.com.br"
echo ""
echo "⚠️  Se ainda não atualizar:"
echo "   - Feche todas as abas do site"
echo "   - Limpe o cache do navegador completamente"
echo "   - Desinstale o PWA se estiver instalado"
echo "   - Acesse novamente"
echo ""
