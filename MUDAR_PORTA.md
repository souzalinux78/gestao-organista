# Como Mudar a Porta do Servidor

## 🔧 Mudar Porta (Passo a Passo)

### 1. Escolher uma Porta Livre

Verifique quais portas estão disponíveis:

```bash
# Ver portas em uso
sudo netstat -tulpn | grep LISTEN

# Ou
sudo ss -tulpn | grep LISTEN

# Verificar se uma porta específica está livre
sudo lsof -i :5001
```

**Portas recomendadas:**
- 5001 (padrão alternativo)
- 5002
- 5003
- 3001
- 8080

### 2. Atualizar Arquivo .env

```bash
cd /var/www/gestao-organista
nano .env
```

**Alterar a linha:**
```env
PORT=5001
```

**Salvar e sair:** `Ctrl+X`, depois `Y`, depois `Enter`

### 3. Atualizar ecosystem.config.js (PM2)

```bash
nano ecosystem.config.js
```

**Alterar:**
```javascript
env: {
  NODE_ENV: 'production',
  PORT: 5001  // Sua nova porta
},
```

### 4. Atualizar Nginx

```bash
sudo nano /etc/nginx/sites-available/gestaoorganista.automatizeonline.com.br
```

**Alterar todas as ocorrências de `5000` para sua nova porta:**

```nginx
# Proxy para API (backend)
location /api {
    proxy_pass http://localhost:5001;  # Sua nova porta
    ...
}

# Health check
location /api/health {
    proxy_pass http://localhost:5001/api/health;  # Sua nova porta
    ...
}
```

**Testar configuração do Nginx:**
```bash
sudo nginx -t
```

**Recarregar Nginx:**
```bash
sudo systemctl reload nginx
```

### 5. Reiniciar Aplicação

```bash
# Parar aplicação atual
pm2 stop gestao-organista-api
pm2 delete gestao-organista-api

# Iniciar com nova porta
pm2 start ecosystem.config.js
pm2 save

# Verificar
pm2 status
```

### 6. Testar

```bash
# Testar API localmente
curl http://localhost:5001/api/health

# Testar via domínio
curl https://gestaoorganista.automatizeonline.com.br/api/health
```

---

## ⚡ Script Rápido para Mudar Porta

Crie um script para facilitar:

```bash
#!/bin/bash
# mudar-porta.sh

read -p "Qual porta deseja usar? (ex: 5001): " NOVA_PORTA

# Atualizar .env
sed -i "s/PORT=.*/PORT=$NOVA_PORTA/" .env

# Atualizar ecosystem.config.js
sed -i "s/PORT: [0-9]*/PORT: $NOVA_PORTA/" ecosystem.config.js

# Atualizar Nginx
sudo sed -i "s/localhost:500[0-9]/localhost:$NOVA_PORTA/g" /etc/nginx/sites-available/gestaoorganista.automatizeonline.com.br

# Testar Nginx
sudo nginx -t && sudo systemctl reload nginx

# Reiniciar PM2
pm2 restart gestao-organista-api

echo "✅ Porta alterada para $NOVA_PORTA"
```

---

## 📝 Checklist

- [ ] Porta escolhida e verificada (livre)
- [ ] Arquivo `.env` atualizado
- [ ] Arquivo `ecosystem.config.js` atualizado
- [ ] Nginx atualizado
- [ ] Nginx testado e recarregado
- [ ] Aplicação reiniciada com PM2
- [ ] API testada localmente
- [ ] API testada via domínio

---

## 🔍 Verificar Porta Atual

```bash
# Ver porta no .env
grep PORT .env

# Ver porta no PM2
pm2 env gestao-organista-api | grep PORT

# Ver porta em uso
sudo lsof -i :5001
```

---

## ⚠️ Importante

1. **Sempre atualize o Nginx** quando mudar a porta
2. **Teste a configuração do Nginx** antes de recarregar
3. **Reinicie o PM2** após mudar a porta
4. **Verifique se a porta está livre** antes de usar

---

**✅ Porta alterada com sucesso!**
