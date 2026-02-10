# 🚀 Comandos Rápidos para Atualização em Produção

## ⚡ Atualização Rápida (Um Comando)

```bash
cd /var/www/gestao-organista && ./atualizar-producao.sh
```

---

## 📋 Comandos Essenciais

### 1. Atualizar Código e Reiniciar

```bash
cd /var/www/gestao-organista
git pull origin main
npm install
cd client && npm install && npm run build && cd ..
pm2 restart gestao-organista-api
```

### 2. Backup + Atualização Completa

```bash
cd /var/www/gestao-organista
./backup-database.sh
./atualizar-producao.sh
```

### 3. Ver Status

```bash
pm2 status
pm2 logs gestao-organista-api --lines 20
curl http://localhost:5000/api/health
```

### 4. Reiniciar Aplicação

```bash
pm2 restart gestao-organista-api
```

### 5. Ver Logs

```bash
pm2 logs gestao-organista-api
pm2 logs gestao-organista-api --lines 100
```

---

## 🔄 Fluxo Completo de Atualização

```bash
# 1. Conectar ao servidor
ssh usuario@seu-servidor.com

# 2. Ir para o diretório
cd /var/www/gestao-organista

# 3. Fazer backup
./backup-database.sh

# 4. Atualizar tudo
./atualizar-producao.sh

# 5. Verificar
pm2 status
pm2 logs gestao-organista-api --lines 20
```

---

## 🛠️ Comandos de Manutenção

### Verificar Última Atualização

```bash
cd /var/www/gestao-organista
git log -1 --oneline
```

### Ver Diferenças Antes de Atualizar

```bash
cd /var/www/gestao-organista
git fetch
git diff HEAD origin/main
```

### Reinstalar Dependências

```bash
cd /var/www/gestao-organista
rm -rf node_modules package-lock.json
npm install
cd client
rm -rf node_modules package-lock.json
npm install
npm run build
cd ..
pm2 restart gestao-organista-api
```

### Limpar Logs do PM2

```bash
pm2 flush
```

### Verificar Espaço em Disco

```bash
df -h
du -sh /var/www/gestao-organista
```

---

## 🚨 Comandos de Emergência

### Parar Aplicação

```bash
pm2 stop gestao-organista-api
```

### Iniciar Aplicação

```bash
pm2 start ecosystem.config.js
```

### Deletar e Recriar no PM2

```bash
pm2 delete gestao-organista-api
pm2 start ecosystem.config.js
pm2 save
```

### Verificar Porta 5000

```bash
sudo netstat -tulpn | grep 5000
```

### Matar Processo na Porta 5000

```bash
sudo lsof -ti:5000 | xargs kill -9
pm2 restart gestao-organista-api
```

---

## 📊 Monitoramento

### Ver Uso de Recursos

```bash
pm2 monit
```

### Ver Informações Detalhadas

```bash
pm2 info gestao-organista-api
```

### Ver Logs em Tempo Real

```bash
pm2 logs gestao-organista-api --lines 0
```

---

## 🔐 Backup Manual

```bash
cd /var/www/gestao-organista
mysqldump -u gestao_user -p gestao_organista > backup_$(date +%Y%m%d_%H%M%S).sql
gzip backup_*.sql
```

---

## ✅ Checklist Rápido

```bash
# 1. Backup
./backup-database.sh

# 2. Atualizar
git pull origin main

# 3. Dependências
npm install && cd client && npm install && npm run build && cd ..

# 4. Reiniciar
pm2 restart gestao-organista-api

# 5. Verificar
curl http://localhost:5000/api/health
pm2 logs gestao-organista-api --lines 20
```

---

**💡 Dica:** Crie um alias no seu `.bashrc` ou `.zshrc`:

```bash
alias atualizar-gestao='cd /var/www/gestao-organista && ./atualizar-producao.sh'
```

Depois use: `atualizar-gestao`
