#!/bin/bash
# Script de atualização em produção
# Uso: ./atualizar-producao.sh

set -e  # Parar em caso de erro

echo "========================================"
echo "  Atualizando Sistema em Produção"
echo "========================================"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Diretório da aplicação
APP_DIR="/var/www/gestao-organista"
cd $APP_DIR

# 1. Backup do banco de dados
echo -e "${YELLOW}📦 Fazendo backup do banco de dados...${NC}"
if [ -f "./backup-database.sh" ]; then
    chmod +x ./backup-database.sh
    ./backup-database.sh
else
    echo -e "${YELLOW}⚠️  Script de backup não encontrado. Fazendo backup manual...${NC}"
    if [ -f ".env" ]; then
        DB_NAME=$(grep DB_NAME .env | cut -d '=' -f2 | tr -d ' ')
        DB_USER=$(grep DB_USER .env | cut -d '=' -f2 | tr -d ' ')
        DB_PASS=$(grep DB_PASSWORD .env | cut -d '=' -f2 | tr -d ' ')
        BACKUP_DIR="/var/backups/gestao-organista"
        mkdir -p $BACKUP_DIR
        mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql
        gzip $BACKUP_DIR/backup_*.sql 2>/dev/null || true
        echo -e "${GREEN}✅ Backup criado${NC}"
    else
        echo -e "${RED}❌ Arquivo .env não encontrado. Não é possível fazer backup.${NC}"
        read -p "Deseja continuar sem backup? (S/N): " continuar
        if [ "$continuar" != "S" ] && [ "$continuar" != "s" ]; then
            exit 1
        fi
    fi
fi

# 2. Atualizar código (Git)
echo -e "${YELLOW}📥 Atualizando código do repositório...${NC}"
if [ -d ".git" ]; then
    # Salvar mudanças locais (se houver)
    git stash
    
    # Verificar branch atual
    BRANCH=$(git branch --show-current)
    echo -e "${YELLOW}Branch atual: $BRANCH${NC}"
    
    # Fazer pull
    git pull origin $BRANCH || git pull origin main || git pull origin master
    
    echo -e "${GREEN}✅ Código atualizado${NC}"
else
    echo -e "${RED}⚠️  Não é um repositório Git. Atualize manualmente.${NC}"
    read -p "Deseja continuar? (S/N): " continuar
    if [ "$continuar" != "S" ] && [ "$continuar" != "s" ]; then
        exit 1
    fi
fi

# 3. Instalar dependências do backend
echo -e "${YELLOW}📦 Instalando dependências do backend...${NC}"
npm install --production
echo -e "${GREEN}✅ Dependências do backend instaladas${NC}"

# 4. Instalar dependências e build do frontend
echo -e "${YELLOW}📦 Instalando dependências do frontend...${NC}"
cd client
npm install
npm run build
cd ..
echo -e "${GREEN}✅ Frontend buildado${NC}"

# 5. Executar migrações (se houver)
echo -e "${YELLOW}🔄 Verificando migrações...${NC}"
if [ -f "server/scripts/migrate-rodizios-funcao.js" ]; then
    node server/scripts/migrate-rodizios-funcao.js || echo -e "${YELLOW}⚠️  Migração não executada ou já aplicada${NC}"
fi

# 6. Reiniciar aplicação
echo -e "${YELLOW}🔄 Reiniciando aplicação...${NC}"
pm2 restart gestao-organista-api || pm2 start ecosystem.config.js
sleep 3

# 7. Verificar status
echo -e "${YELLOW}🔍 Verificando status...${NC}"
pm2 status

# 8. Testar API
echo -e "${YELLOW}🧪 Testando API...${NC}"
sleep 2
if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API respondendo corretamente${NC}"
else
    echo -e "${RED}❌ API não está respondendo! Verifique os logs:${NC}"
    echo "pm2 logs gestao-organista-api --lines 50"
    exit 1
fi

# 9. Recarregar Nginx (se necessário)
echo -e "${YELLOW}🔄 Recarregando Nginx...${NC}"
sudo systemctl reload nginx 2>/dev/null || echo -e "${YELLOW}⚠️  Nginx não recarregado (pode não ter permissão)${NC}"

# 10. Log da atualização
echo "$(date): Atualização realizada - $(git log -1 --oneline 2>/dev/null || echo 'N/A')" >> logs/updates.log 2>/dev/null || true

echo ""
echo -e "${GREEN}========================================"
echo "  ✅ Atualização Concluída com Sucesso!"
echo "========================================${NC}"
echo ""
echo "📝 Próximos passos:"
echo "1. Acesse: https://gestaoorganista.automatizeonline.com.br"
echo "2. Verifique se tudo está funcionando"
echo "3. Monitore os logs: pm2 logs gestao-organista-api"
echo ""
