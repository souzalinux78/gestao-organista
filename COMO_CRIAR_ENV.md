# Como Criar o Arquivo .env

## 📝 Passo a Passo

### 1. Localizar o Diretório do Projeto

Navegue até a raiz do projeto:
```bash
cd gestao-organista
```

### 2. Criar o Arquivo .env

**No Windows:**
```powershell
# Copiar o arquivo de exemplo
Copy-Item .env.example .env

# Ou criar manualmente
New-Item -Path .env -ItemType File
```

**No Linux/Mac:**
```bash
# Copiar o arquivo de exemplo
cp .env.example .env

# Ou criar manualmente
touch .env
```

### 3. Editar o Arquivo .env

Abra o arquivo `.env` em um editor de texto e configure os valores:

**Para Desenvolvimento Local (MySQL local):**
```env
# Porta do servidor
PORT=5000

# Configurações do MySQL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=FLoc25GD!
DB_NAME=gestao_organista

# URL do frontend (para CORS)
CLIENT_URL=http://localhost:3000

# JWT Secret (gere uma chave forte)
JWT_SECRET=sua-chave-secreta-jwt-aqui-gere-uma-aleatoria-longa

# Session Secret (gere uma chave forte)
SESSION_SECRET=sua-chave-secreta-session-aqui-gere-uma-aleatoria-longa

# URL do webhook para envio de rodízios gerados
WEBHOOK_URL=https://webhook.automatizeonline.com.br/webhook/organista

# URL do webhook para envio de notificações (SMS/WhatsApp)
WEBHOOK_NOTIFICACAO=https://webhook.automatizeonline.com.br/webhook/organista

# Ambiente
NODE_ENV=development
```

**Para Produção:**
```env
# Porta do servidor
PORT=5000

# Configurações do MySQL
DB_HOST=localhost
DB_USER=gestao_user
DB_PASSWORD=SUA_SENHA_MYSQL_FORTE_AQUI
DB_NAME=gestao_organista

# URL do frontend (para CORS)
CLIENT_URL=https://gestaoorganista.automatizeonline.com.br

# JWT Secret (gere uma chave forte)
JWT_SECRET=SUA_CHAVE_JWT_SUPER_SECRETA_AQUI_GERE_UMA_ALEATORIA_LONGA

# Session Secret (gere uma chave forte)
SESSION_SECRET=SUA_CHAVE_SESSION_SUPER_SECRETA_AQUI_GERE_UMA_ALEATORIA_LONGA

# URL do webhook para envio de rodízios gerados
WEBHOOK_URL=https://webhook.automatizeonline.com.br/webhook/organista

# URL do webhook para envio de notificações (SMS/WhatsApp)
WEBHOOK_NOTIFICACAO=https://webhook.automatizeonline.com.br/webhook/organista

# Ambiente
NODE_ENV=production
```

### 4. Gerar Chaves Secretas

**JWT_SECRET e SESSION_SECRET** devem ser chaves aleatórias e seguras.

**No Windows PowerShell:**
```powershell
# Gerar JWT_SECRET
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Gerar SESSION_SECRET
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

**No Linux/Mac:**
```bash
# Gerar JWT_SECRET
openssl rand -base64 32

# Gerar SESSION_SECRET
openssl rand -base64 32
```

**Ou use um gerador online:**
- https://www.random.org/strings/
- Gere strings de 32 caracteres aleatórios

### 5. Verificar se o Arquivo Foi Criado

**No Windows:**
```powershell
Test-Path .env
# Deve retornar: True
```

**No Linux/Mac:**
```bash
ls -la .env
# Deve mostrar o arquivo
```

### 6. ⚠️ IMPORTANTE: Não Commitar o .env

O arquivo `.env` contém informações sensíveis e **NÃO deve ser commitado no Git**.

Verifique se o `.gitignore` contém:
```
.env
.env.local
.env.production
```

## ✅ Checklist

- [ ] Arquivo `.env` criado na raiz do projeto
- [ ] Valores configurados corretamente
- [ ] JWT_SECRET e SESSION_SECRET gerados
- [ ] Senha do MySQL configurada
- [ ] URLs dos webhooks configuradas
- [ ] Arquivo `.env` adicionado ao `.gitignore`

## 🚀 Próximos Passos

Após criar o arquivo `.env`:

1. **Iniciar o servidor:**
   ```bash
   npm run server
   ```

2. **Criar usuário admin:**
   ```bash
   npm run create-admin
   ```

3. **Acessar o sistema:**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:5000

## ❓ Problemas Comuns

### Erro: "Cannot find module 'dotenv'"
```bash
npm install
```

### Erro: "Access denied for user"
- Verifique se o usuário e senha do MySQL estão corretos no `.env`
- Verifique se o MySQL está rodando

### Erro: "Database 'gestao_organista' doesn't exist"
- O banco será criado automaticamente na primeira execução
- Verifique se o usuário MySQL tem permissão para criar bancos
