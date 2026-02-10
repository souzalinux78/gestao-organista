# Resolver Erro: Porta 5000 já em uso

## 🔍 Problema

O erro `EADDRINUSE: address already in use :::5000` significa que a porta 5000 já está sendo usada por outro processo (provavelmente o PM2).

## ✅ Soluções

### Opção 1: Verificar e Parar o PM2 (Recomendado para Produção)

```bash
# Verificar se o PM2 está rodando
pm2 status

# Se houver um processo rodando, pare-o
pm2 stop gestao-organista-api

# Ou delete e recrie
pm2 delete gestao-organista-api
pm2 start ecosystem.config.js
pm2 save
```

### Opção 2: Encontrar e Matar o Processo na Porta 5000

```bash
# Ver qual processo está usando a porta 5000
sudo lsof -i :5000

# Ou
sudo netstat -tulpn | grep 5000

# Matar o processo (substitua PID pelo número do processo)
sudo kill -9 <PID>

# Ou matar diretamente
sudo lsof -ti:5000 | xargs kill -9
```

### Opção 3: Usar PM2 em Produção (Recomendado)

Em produção, você deve usar PM2, não nodemon:

```bash
# Parar nodemon (Ctrl+C se estiver rodando)

# Iniciar com PM2
pm2 start ecosystem.config.js

# Ver status
pm2 status

# Ver logs
pm2 logs gestao-organista-api
```

### Opção 4: Mudar a Porta (Temporário)

Se quiser usar nodemon para desenvolvimento, mude a porta no `.env`:

```bash
# Editar .env
nano .env

# Mudar PORT para outra porta (ex: 5001)
PORT=5001
```

---

## 🚀 Comandos Rápidos

### Verificar o que está rodando

```bash
# Ver processos do PM2
pm2 list

# Ver processos na porta 5000
sudo lsof -i :5000

# Ver todos os processos Node
ps aux | grep node
```

### Limpar e Reiniciar

```bash
# Parar tudo do PM2
pm2 stop all
pm2 delete all

# Matar processos na porta 5000
sudo lsof -ti:5000 | xargs kill -9

# Iniciar novamente com PM2
cd /var/www/gestao-organista
pm2 start ecosystem.config.js
pm2 save
```

---

## 📝 Checklist

- [ ] Verificar se PM2 está rodando: `pm2 status`
- [ ] Parar processo antigo: `pm2 stop gestao-organista-api`
- [ ] Verificar porta 5000: `sudo lsof -i :5000`
- [ ] Iniciar com PM2: `pm2 start ecosystem.config.js`
- [ ] Verificar logs: `pm2 logs gestao-organista-api`

---

**💡 Dica:** Em produção, sempre use PM2, não nodemon!
