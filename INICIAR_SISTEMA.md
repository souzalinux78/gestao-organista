# 🚀 Como Iniciar o Sistema

## ⚡ Início Rápido (Produção)

```bash
cd /var/www/gestao-organista
./iniciar-servidor.sh
```

---

## 📋 Passo a Passo Completo

### 1. Conectar ao Servidor

```bash
ssh usuario@seu-servidor.com
```

### 2. Ir para o Diretório

```bash
cd /var/www/gestao-organista
```

### 3. Verificar Configurações

```bash
# Verificar se o .env existe
ls -la .env

# Verificar porta configurada
grep PORT .env

# Verificar se o banco está configurado
grep DB_ .env
```

### 4. Verificar se a Porta Está Livre

```bash
# Verificar porta (ex: 5001)
sudo lsof -i :5001

# Se estiver em uso, mude a porta
./mudar-porta.sh
```

### 5. Iniciar o Servidor

**Opção A: Usar Script Automatizado (Recomendado)**
```bash
chmod +x iniciar-servidor.sh
./iniciar-servidor.sh
```

**Opção B: Iniciar Manualmente com PM2**
```bash
# Iniciar
pm2 start ecosystem.config.js

# Salvar configuração
pm2 save

# Ver status
pm2 status
```

### 6. Verificar se Está Funcionando

```bash
# Ver logs
pm2 logs gestao-organista-api --lines 20

# Testar API
curl http://localhost:5001/api/health

# Ver status
pm2 status
```

### 7. Acessar no Navegador

```
https://gestaoorganista.automatizeonline.com.br
```

---

## 🔧 Comandos Úteis

### Ver Status

```bash
pm2 status
pm2 logs gestao-organista-api
```

### Reiniciar

```bash
pm2 restart gestao-organista-api
```

### Parar

```bash
pm2 stop gestao-organista-api
```

### Ver Logs em Tempo Real

```bash
pm2 logs gestao-organista-api --lines 0
```

---

## ✅ Checklist de Inicialização

- [ ] Conectado ao servidor
- [ ] No diretório `/var/www/gestao-organista`
- [ ] Arquivo `.env` configurado
- [ ] Banco de dados criado
- [ ] Porta livre (verificada)
- [ ] Servidor iniciado com PM2
- [ ] API respondendo (`curl http://localhost:5001/api/health`)
- [ ] Nginx configurado e rodando
- [ ] Acessível via domínio

---

## 🚨 Problemas Comuns

### Erro: "Porta já em uso"

```bash
# Ver o que está usando
sudo lsof -i :5001

# Mudar porta
./mudar-porta.sh
```

### Erro: "Cannot find module"

```bash
# Reinstalar dependências
npm install
cd client && npm install && npm run build && cd ..
```

### Erro: "Database connection failed"

```bash
# Verificar .env
cat .env | grep DB_

# Testar conexão MySQL
mysql -u gestao_user -p gestao_organista
```

### Servidor não inicia

```bash
# Ver logs detalhados
pm2 logs gestao-organista-api --lines 100

# Verificar variáveis de ambiente
pm2 env gestao-organista-api
```

---

## 📝 Próximos Passos Após Iniciar

1. **Criar usuário admin:**
   ```bash
   npm run create-admin
   ```

2. **Acessar o sistema:**
   - URL: `https://gestaoorganista.automatizeonline.com.br`
   - Fazer login com o usuário admin criado

3. **Configurar:**
   - Cadastrar igrejas
   - Cadastrar organistas
   - Associar organistas às igrejas
   - Cadastrar cultos
   - Gerar rodízios

---

**✅ Sistema iniciado e pronto para uso!**
