# 🚀 Comandos do Servidor

## ⚡ Iniciar Servidor

### Em Produção (Recomendado - PM2)

```bash
cd /var/www/gestao-organista
./iniciar-servidor.sh
```

Ou manualmente:
```bash
pm2 start ecosystem.config.js
pm2 save
```

### Em Desenvolvimento (Nodemon)

```bash
npm run server
```

---

## 🔍 Verificar Status

```bash
# Ver processos PM2
pm2 status

# Ver informações detalhadas
pm2 info gestao-organista-api

# Ver logs
pm2 logs gestao-organista-api

# Ver últimas 50 linhas
pm2 logs gestao-organista-api --lines 50
```

---

## 🔄 Reiniciar Servidor

```bash
# Reiniciar
pm2 restart gestao-organista-api

# Parar
pm2 stop gestao-organista-api

# Iniciar
pm2 start gestao-organista-api

# Deletar e recriar
pm2 delete gestao-organista-api
pm2 start ecosystem.config.js
```

---

## 🛑 Parar Servidor

```bash
# Parar
pm2 stop gestao-organista-api

# Parar e deletar
pm2 delete gestao-organista-api

# Parar tudo
pm2 stop all
```

---

## 🔧 Resolver Porta 5000 em Uso

```bash
# Ver o que está usando a porta
sudo lsof -i :5000

# Matar processo
sudo lsof -ti:5000 | xargs kill -9

# Ou parar PM2
pm2 stop gestao-organista-api
pm2 delete gestao-organista-api
```

---

## 📊 Monitoramento

```bash
# Monitorar recursos
pm2 monit

# Ver uso de memória
pm2 list

# Ver logs em tempo real
pm2 logs gestao-organista-api --lines 0
```

---

## 🧪 Testar API

```bash
# Health check
curl http://localhost:5000/api/health

# Ou via navegador
# http://localhost:5000/api/health
```

---

## 🔐 Criar Usuário Admin

```bash
cd /var/www/gestao-organista
npm run create-admin
```

---

## 📝 Logs

```bash
# Ver logs
pm2 logs gestao-organista-api

# Ver logs de erro
pm2 logs gestao-organista-api --err

# Ver logs de output
pm2 logs gestao-organista-api --out

# Limpar logs
pm2 flush
```

---

## ⚙️ Configurar PM2 para Iniciar no Boot

```bash
# Gerar comando de startup
pm2 startup

# Execute o comando exibido (algo como):
# sudo env PATH=... pm2 startup systemd -u usuario --hp /home/usuario

# Salvar configuração atual
pm2 save
```

---

## 🚨 Problemas Comuns

### Erro: "Porta 5000 já em uso"

```bash
# Solução 1: Parar PM2
pm2 stop gestao-organista-api

# Solução 2: Matar processo
sudo lsof -ti:5000 | xargs kill -9

# Solução 3: Usar script
./iniciar-servidor.sh
```

### Erro: "Cannot find module"

```bash
# Reinstalar dependências
npm install
cd client && npm install && cd ..
```

### Erro: "Database connection failed"

```bash
# Verificar .env
cat .env

# Testar conexão MySQL
mysql -u gestao_user -p gestao_organista
```

### Servidor não inicia

```bash
# Ver logs detalhados
pm2 logs gestao-organista-api --lines 100

# Verificar variáveis de ambiente
pm2 env gestao-organista-api

# Verificar se o arquivo .env existe
ls -la .env
```

---

## ✅ Checklist de Inicialização

- [ ] Arquivo `.env` configurado
- [ ] Banco de dados criado
- [ ] Dependências instaladas (`npm install`)
- [ ] Frontend buildado (`cd client && npm run build`)
- [ ] Porta 5000 livre
- [ ] Servidor iniciado com PM2
- [ ] API respondendo (`curl http://localhost:5000/api/health`)
- [ ] Logs sem erros

---

**💡 Dica:** Use `./iniciar-servidor.sh` para iniciar automaticamente com todas as verificações!
