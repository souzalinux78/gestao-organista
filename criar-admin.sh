#!/bin/bash
# Script para criar usuário admin
# Uso: ./criar-admin.sh

echo "========================================"
echo "  Criando Usuário Admin"
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

# Verificar se o arquivo .env existe
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Arquivo .env não encontrado!${NC}"
    echo "Configure o arquivo .env antes de criar o admin."
    exit 1
fi

# Executar script de criação
echo -e "${YELLOW}🚀 Criando usuário admin...${NC}"
echo ""

if npm run create-admin; then
    echo ""
    echo -e "${GREEN}========================================"
    echo "  ✅ Admin Criado com Sucesso!"
    echo "========================================${NC}"
    echo ""
    echo "📝 Credenciais:"
    echo "  Email: admin@gestao.com"
    echo "  Senha: admin123"
    echo ""
    echo "⚠️  IMPORTANTE: Altere a senha após o primeiro login!"
    echo ""
    echo "🌐 Acesse: https://gestaoorganista.automatizeonline.com.br"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Erro ao criar admin!${NC}"
    echo "Verifique os logs acima para mais detalhes."
    exit 1
fi
