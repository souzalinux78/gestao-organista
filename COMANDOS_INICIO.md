# 🚀 Comandos para Iniciar o Sistema

## ⚡ Comando Único (Mais Fácil)

```bash
cd /var/www/gestao-organista && ./iniciar-servidor.sh
```

---

## 📋 Comandos Passo a Passo

### 1. Ir para o Diretório
```bash
cd /var/www/gestao-organista
```

### 2. Verificar Configuração
```bash
# Ver se .env existe
ls -la .env

# Ver porta configurada
grep PORT .env
```

### 3. Iniciar com PM2
```bash
pm2 start ecosystem.config.js
pm2 save
```

### 4. Verificar Status
```bash
pm2 status
pm2 logs gestao-organista-api --lines 20
```

### 5. Testar API
```bash
# Obter porta do .env
PORTA=$(grep "^PORT=" .env | cut -d '=' -f2)
curl http://localhost:$PORTA/api/health
```

---

## 🔄 Reiniciar Sistema

```bash
pm2 restart gestao-organista-api
```

---

## 🛑 Parar Sistema

```bash
pm2 stop gestao-organista-api
```

---

## 📊 Ver Logs

```bash
# Últimas 50 linhas
pm2 logs gestao-organista-api --lines 50

# Tempo real
pm2 logs gestao-organista-api --lines 0
```

---

## ✅ Verificar se Está Funcionando

```bash
# 1. Ver status PM2
pm2 status

# 2. Testar API local
PORTA=$(grep "^PORT=" .env | cut -d '=' -f2)
curl http://localhost:$PORTA/api/health

# 3. Testar via domínio
curl https://gestaoorganista.automatizeonline.com.br/api/health
```

---

## 🆘 Se Não Iniciar

```bash
# Ver logs de erro
pm2 logs gestao-organista-api --err --lines 100

# Verificar porta
PORTA=$(grep "^PORT=" .env | cut -d '=' -f2)
sudo lsof -i :$PORTA

# Verificar .env
cat .env
```

---

**💡 Dica:** Use `./iniciar-servidor.sh` para iniciar automaticamente com todas as verificações!
