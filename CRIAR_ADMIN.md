# 👤 Como Criar Usuário Admin

## ⚡ Criar Admin (Comando Rápido)

```bash
cd /var/www/gestao-organista
npm run create-admin
```

---

## 📋 Credenciais Padrão

Após executar o comando acima, o sistema criará um usuário admin com:

- **Email:** `admin@gestao.com`
- **Senha:** `admin123`

⚠️ **IMPORTANTE:** Altere a senha após o primeiro login!

---

## 🔧 Passo a Passo

### 1. Ir para o Diretório

```bash
cd /var/www/gestao-organista
```

### 2. Executar Script de Criação

```bash
npm run create-admin
```

**Ou diretamente:**
```bash
node server/scripts/createAdmin.js
```

### 3. Verificar se Foi Criado

Você verá uma mensagem como:
```
✅ Admin criado com sucesso!
Email: admin@gestao.com
Senha: admin123
⚠️  IMPORTANTE: Altere a senha após o primeiro login!
```

### 4. Fazer Login

1. Acesse: `https://gestaoorganista.automatizeonline.com.br`
2. Use as credenciais:
   - Email: `admin@gestao.com`
   - Senha: `admin123`

### 5. Alterar Senha (Recomendado)

Após fazer login, altere a senha para uma mais segura através da interface do sistema.

---

## 🔍 Verificar se Admin Já Existe

Se você executar o script e o admin já existir, verá:

```
Admin já existe!
```

Nesse caso, você precisa:
- Lembrar a senha que foi definida
- Ou resetar a senha (veja seção abaixo)

---

## 🔐 Resetar Senha do Admin

Se você esqueceu a senha do admin, pode resetá-la diretamente no banco:

```bash
# Acessar MySQL
mysql -u root -p gestao_organista

# No prompt do MySQL:
```

```sql
-- Ver usuários
SELECT id, nome, email, role FROM usuarios;

-- Resetar senha para 'admin123' (ou outra senha)
UPDATE usuarios 
SET senha_hash = '$2a$10$rOzJqZqZqZqZqZqZqZqZqO' 
WHERE email = 'admin@gestao.com';

-- Sair
EXIT;
```

**Ou usar Node.js para gerar hash correto:**

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('sua_nova_senha', 10).then(hash => console.log(hash));"
```

Depois use o hash gerado no UPDATE acima.

---

## 📝 Criar Outro Admin

Se você já está logado como admin, pode criar outros admins pela interface:

1. Acesse a página de **Admin**
2. Clique em **Criar Usuário**
3. Preencha os dados e selecione role: **admin**

---

## ✅ Checklist

- [ ] Script executado: `npm run create-admin`
- [ ] Mensagem de sucesso exibida
- [ ] Login testado com `admin@gestao.com` / `admin123`
- [ ] Senha alterada após primeiro login

---

**✅ Admin criado e pronto para uso!**
