#!/bin/bash
# Script para criar o banco de dados
# Uso: ./criar-banco.sh

set -e

echo "========================================"
echo "  Criando Banco de Dados"
echo "========================================"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verificar se o arquivo SQL existe
if [ ! -f "database.sql" ]; then
    echo -e "${RED}❌ Arquivo database.sql não encontrado!${NC}"
    exit 1
fi

# Solicitar credenciais MySQL
echo -e "${YELLOW}📝 Informe as credenciais do MySQL:${NC}"
read -p "Usuário MySQL (padrão: root): " DB_USER
DB_USER=${DB_USER:-root}
read -sp "Senha MySQL: " DB_PASS
echo ""

# Verificar conexão
echo -e "${YELLOW}🔍 Verificando conexão com MySQL...${NC}"
if mysql -u "$DB_USER" -p"$DB_PASS" -e "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Conexão estabelecida${NC}"
else
    echo -e "${RED}❌ Erro ao conectar ao MySQL. Verifique usuário e senha.${NC}"
    exit 1
fi

# Criar banco de dados
echo -e "${YELLOW}📦 Criando banco de dados...${NC}"
mysql -u "$DB_USER" -p"$DB_PASS" << EOF
CREATE DATABASE IF NOT EXISTS \`gestao_organista\` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Banco de dados criado${NC}"
else
    echo -e "${RED}❌ Erro ao criar banco de dados${NC}"
    exit 1
fi

# Executar script SQL
echo -e "${YELLOW}📋 Criando tabelas...${NC}"
mysql -u "$DB_USER" -p"$DB_PASS" gestao_organista < database.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Tabelas criadas com sucesso${NC}"
else
    echo -e "${RED}❌ Erro ao criar tabelas${NC}"
    exit 1
fi

# Verificar tabelas criadas
echo -e "${YELLOW}🔍 Verificando tabelas...${NC}"
TABLES=$(mysql -u "$DB_USER" -p"$DB_PASS" gestao_organista -e "SHOW TABLES;" | wc -l)
TABLES=$((TABLES - 1))  # Subtrair linha de cabeçalho

echo -e "${GREEN}✅ $TABLES tabelas criadas${NC}"

# Listar tabelas
echo ""
echo -e "${YELLOW}📊 Tabelas criadas:${NC}"
mysql -u "$DB_USER" -p"$DB_PASS" gestao_organista -e "SHOW TABLES;"

echo ""
echo -e "${GREEN}========================================"
echo "  ✅ Banco de Dados Criado com Sucesso!"
echo "========================================${NC}"
echo ""
echo "📝 Próximos passos:"
echo "1. Configure o arquivo .env com as credenciais do MySQL"
echo "2. Execute: npm run server"
echo "3. Crie um usuário admin: npm run create-admin"
echo ""
