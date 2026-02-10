#!/bin/bash
# Script de backup do banco de dados
# Uso: ./backup-database.sh

# Configurações (ajuste conforme necessário)
BACKUP_DIR="/var/backups/gestao-organista"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="gestao_organista"
DB_USER="root"

# Carregar senha do .env ou solicitar
if [ -f .env ]; then
    DB_PASS=$(grep DB_PASSWORD .env | cut -d '=' -f2 | tr -d ' ')
else
    echo "Arquivo .env não encontrado. Informe a senha do MySQL:"
    read -s DB_PASS
fi

# Criar diretório de backup se não existir
mkdir -p $BACKUP_DIR

# Nome do arquivo de backup
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.sql"

echo "Iniciando backup do banco de dados $DB_NAME..."

# Fazer backup
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_FILE

# Verificar se o backup foi criado com sucesso
if [ $? -eq 0 ]; then
    echo "Backup criado com sucesso: $BACKUP_FILE"
    
    # Compactar backup
    gzip $BACKUP_FILE
    echo "Backup compactado: $BACKUP_FILE.gz"
    
    # Manter apenas últimos 7 dias
    find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
    echo "Backups antigos removidos (mantidos apenas últimos 7 dias)"
    
    # Mostrar tamanho do backup
    du -h $BACKUP_FILE.gz
    
    echo "✅ Backup concluído com sucesso!"
else
    echo "❌ Erro ao criar backup!"
    exit 1
fi
