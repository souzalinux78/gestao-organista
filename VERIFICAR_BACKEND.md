# Como Verificar se o Backend Está Rodando

## Erro 502 Bad Gateway

O erro 502 indica que o Nginx não consegue se conectar ao backend Node.js.

### Verificações:

1. **Verificar se o servidor está rodando:**
```bash
pm2 status
```

2. **Se não estiver rodando, iniciar:**
```bash
cd /var/www/gestao-organista
pm2 start ecosystem.config.js
# ou
pm2 restart gestao-organista-api
```

3. **Verificar se a porta 5001 está correta:**
```bash
netstat -tlnp | grep 5001
# ou
ss -tlnp | grep 5001
```

4. **Verificar logs do PM2:**
```bash
pm2 logs gestao-organista-api --lines 50
```

5. **Verificar configuração do Nginx:**
```bash
sudo nginx -t
sudo cat /etc/nginx/sites-available/gestaoorganista.automatizeonline.com.br | grep proxy_pass
```

6. **Testar conexão direta:**
```bash
curl http://localhost:5001/api/health
```

### Se o backend não estiver respondendo:

1. **Reiniciar o servidor:**
```bash
pm2 restart gestao-organista-api
```

2. **Verificar variáveis de ambiente:**
```bash
cd /var/www/gestao-organista
cat .env | grep PORT
```

3. **Verificar se há erros no código:**
```bash
cd /var/www/gestao-organista
node server/index.js
```

### Solução Rápida:

```bash
cd /var/www/gestao-organista
pm2 restart gestao-organista-api
pm2 logs gestao-organista-api --lines 20
```
