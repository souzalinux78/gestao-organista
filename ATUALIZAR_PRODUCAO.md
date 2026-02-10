# Guia de Atualização em Produção

## 📋 Comandos para Atualizar o Sistema em Produção

### ⚠️ IMPORTANTE: Antes de Atualizar

1. **Fazer backup do banco de dados**
2. **Verificar se há mudanças no banco de dados** (migrations)
3. **Testar em ambiente de staging** (se disponível)

---

## 🔄 Processo Manual de Atualização

### 1. Conectar ao Servidor

```bash
ssh usuario@seu-servidor.com
```

### 2. Navegar até o Diretório da Aplicação

```bash
cd /var/www/gestao-organista
```

### 3. Fazer Backup do Banco de Dados

```bash
# Usar o script de backup
./backup-database.sh

# Ou manualmente
mysqldump -u gestao_user -p gestao_organista > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 4. Atualizar o Código

**Se usar Git:**
```bash
# Verificar status atual
git status

# Fazer pull das atualizações
git pull origin main
# ou
git pull origin master

# Verificar se há conflitos
git status
```

**Se usar upload manual (SCP/SFTP):**
```bash
# Do seu computador local
scp -r gestao-organista/* usuario@seu-servidor:/var/www/gestao-organista/
```

### 5. Instalar Dependências

```bash
# Instalar/atualizar dependências do backend
npm install

# Instalar/atualizar dependências do frontend
cd client
npm install
npm run build
cd ..
```

### 6. Verificar Arquivo .env

```bash
# Verificar se o .env existe e está correto
cat .env

# Se necessário, atualizar variáveis de ambiente
nano .env
```

### 7. Executar Migrações (se houver)

```bash
# Se houver scripts de migração
node server/scripts/migrate-rodizios-funcao.js

# Ou outras migrações específicas
```

### 8. Reiniciar a Aplicação

```bash
# Parar aplicação
pm2 stop gestao-organista-api

# Reiniciar aplicação
pm2 restart gestao-organista-api

# Verificar status
pm2 status

# Ver logs
pm2 logs gestao-organista-api --lines 50
```

### 9. Verificar se Está Funcionando

```bash
# Testar API
curl http://localhost:5000/api/health

# Verificar logs
pm2 logs gestao-organista-api --lines 20

# Verificar se o Nginx está servindo corretamente
sudo systemctl status nginx
```

### 10. Testar no Navegador

Acesse: `https://gestaoorganista.automatizeonline.com.br`

---

## 🚀 Script Automatizado de Atualização

Crie um script para automatizar todo o processo:

### Script: `atualizar-producao.sh`

```bash
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
    ./backup-database.sh
else
    echo -e "${RED}⚠️  Script de backup não encontrado. Fazendo backup manual...${NC}"
    DB_NAME=$(grep DB_NAME .env | cut -d '=' -f2 | tr -d ' ')
    DB_USER=$(grep DB_USER .env | cut -d '=' -f2 | tr -d ' ')
    DB_PASS=$(grep DB_PASSWORD .env | cut -d '=' -f2 | tr -d ' ')
    mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql
    echo -e "${GREEN}✅ Backup criado${NC}"
fi

# 2. Atualizar código (Git)
echo -e "${YELLOW}📥 Atualizando código do repositório...${NC}"
if [ -d ".git" ]; then
    # Salvar mudanças locais (se houver)
    git stash
    
    # Fazer pull
    git pull origin main || git pull origin master
    
    echo -e "${GREEN}✅ Código atualizado${NC}"
else
    echo -e "${RED}⚠️  Não é um repositório Git. Atualize manualmente.${NC}"
    exit 1
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
pm2 restart gestao-organista-api
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
sudo systemctl reload nginx

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
```

### Tornar o Script Executável

```bash
chmod +x atualizar-producao.sh
```

### Usar o Script

```bash
cd /var/www/gestao-organista
./atualizar-producao.sh
```

---

## 🔄 Atualização Automática com Git Hooks

### Opção 1: Webhook do Git (GitHub/GitLab)

Crie um endpoint no servidor que recebe webhooks do Git e atualiza automaticamente:

### Script: `webhook-update.sh`

```bash
#!/bin/bash
# Webhook para atualização automática
# Configure no GitHub/GitLab: Settings > Webhooks > Add webhook
# URL: https://gestaoorganista.automatizeonline.com.br/api/webhook/update

cd /var/www/gestao-organista

# Fazer pull
git pull origin main

# Instalar dependências
npm install
cd client && npm install && npm run build && cd ..

# Reiniciar PM2
pm2 restart gestao-organista-api

echo "Atualização automática concluída: $(date)"
```

### Opção 2: Cron Job para Verificar Atualizações

```bash
# Editar crontab
crontab -e

# Adicionar linha para verificar atualizações a cada hora
0 * * * * cd /var/www/gestao-organista && git fetch && git diff --quiet origin/main || /var/www/gestao-organista/atualizar-producao.sh
```

---

## 📊 Checklist de Atualização

Use este checklist antes de cada atualização:

- [ ] Backup do banco de dados feito
- [ ] Código atualizado (git pull)
- [ ] Dependências instaladas (npm install)
- [ ] Frontend buildado (npm run build)
- [ ] Migrações executadas (se houver)
- [ ] Aplicação reiniciada (pm2 restart)
- [ ] API testada (curl /api/health)
- [ ] Nginx recarregado (se necessário)
- [ ] Testado no navegador
- [ ] Logs verificados (pm2 logs)

---

## 🛠️ Comandos Úteis

### Ver Últimas Atualizações

```bash
cd /var/www/gestao-organista
git log --oneline -10
```

### Ver Diferenças Antes de Atualizar

```bash
cd /var/www/gestao-organista
git fetch
git diff HEAD origin/main
```

### Reverter para Versão Anterior

```bash
cd /var/www/gestao-organista
git log --oneline  # Ver commits
git checkout <commit-hash>  # Voltar para commit específico
npm install
cd client && npm install && npm run build && cd ..
pm2 restart gestao-organista-api
```

### Ver Status do PM2

```bash
pm2 status
pm2 info gestao-organista-api
pm2 logs gestao-organista-api --lines 100
```

### Verificar Espaço em Disco

```bash
df -h
du -sh /var/www/gestao-organista
```

### Limpar Cache do NPM (se necessário)

```bash
cd /var/www/gestao-organista
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

---

## ⚠️ Problemas Comuns e Soluções

### Erro: "Cannot find module"

```bash
# Reinstalar dependências
cd /var/www/gestao-organista
rm -rf node_modules
npm install
cd client
rm -rf node_modules
npm install
npm run build
cd ..
pm2 restart gestao-organista-api
```

### Erro: "Port 5000 already in use"

```bash
# Verificar o que está usando a porta
sudo netstat -tulpn | grep 5000

# Parar processo antigo
pm2 stop gestao-organista-api
pm2 delete gestao-organista-api

# Reiniciar
pm2 start ecosystem.config.js
```

### Erro: "Database migration failed"

```bash
# Verificar logs
pm2 logs gestao-organista-api

# Executar migração manualmente
node server/scripts/migrate-rodizios-funcao.js
```

### Aplicação não inicia após atualização

```bash
# Ver logs detalhados
pm2 logs gestao-organista-api --lines 100

# Verificar variáveis de ambiente
pm2 env gestao-organista-api

# Verificar se o banco está acessível
mysql -u gestao_user -p gestao_organista -e "SELECT 1;"
```

---

## 🔐 Segurança

### Antes de Atualizar

1. **Sempre faça backup do banco de dados**
2. **Teste em ambiente de staging primeiro** (se disponível)
3. **Verifique se há mudanças no .env** (não sobrescrever)
4. **Mantenha logs de atualizações**

### Após Atualizar

1. **Verifique se não há erros nos logs**
2. **Teste funcionalidades críticas**
3. **Monitore por algumas horas**
4. **Mantenha backup por pelo menos 7 dias**

---

## 📝 Log de Atualizações

Mantenha um log das atualizações:

```bash
# Criar arquivo de log
echo "$(date): Atualização realizada - $(git log -1 --oneline)" >> /var/www/gestao-organista/logs/updates.log
```

---

**✅ Sistema pronto para atualizações em produção!**
