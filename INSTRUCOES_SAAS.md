# Sistema SaaS Multi-Igreja - Instruções

## O que mudou?

O sistema agora é um **SaaS multi-igreja** com autenticação e controle de acesso:

✅ **Sistema de Login** - Usuários precisam fazer login
✅ **Controle de Acesso** - Cada usuário só vê/gerencia suas igrejas
✅ **Perfis de Usuário** - Admin e Usuário comum
✅ **Gerenciamento de Usuários** - Admin pode criar e associar usuários a igrejas

## Primeiro Acesso

### 1. Criar usuário Admin

Execute o comando para criar o admin padrão:

```bash
npm run create-admin
```

Isso criará um usuário admin com:
- **Email:** `admin@gestao.com`
- **Senha:** `admin123`

⚠️ **IMPORTANTE:** Altere a senha após o primeiro login!

### 2. Fazer Login

1. Acesse: http://localhost:3000
2. Você será redirecionado para a tela de login
3. Use as credenciais do admin criado

### 3. Criar Igrejas

1. Após login, vá em **Igrejas**
2. Clique em **"+ Nova Igreja"**
3. Preencha os dados da igreja

### 4. Criar Usuários

1. Vá em **Admin** (menu só aparece para admin)
2. Clique em **"+ Novo Usuário"**
3. Preencha:
   - Nome
   - Email
   - Senha
   - Perfil (Usuário ou Admin)
   - **Selecione as igrejas** que o usuário pode gerenciar (apenas para usuários comuns)

### 5. Associar Organistas às Igrejas

1. Vá em **Igrejas**
2. Clique em **"Organistas"** da igreja
3. Selecione e adicione as organistas oficializadas

## Como Funciona

### Para Administradores

- ✅ Acesso a **todas** as igrejas
- ✅ Pode criar/editar/deletar igrejas
- ✅ Pode criar/editar/deletar usuários
- ✅ Pode associar usuários a igrejas
- ✅ Vê todas as organistas, cultos e rodízios

### Para Usuários Comuns

- ✅ Acesso **apenas** às igrejas associadas pelo admin
- ✅ Pode editar dados da sua igreja
- ✅ Pode gerenciar organistas, cultos e rodízios da sua igreja
- ✅ **Não** pode criar/deletar igrejas
- ✅ **Não** vê outras igrejas
- ✅ Se tiver apenas 1 igreja, ela é selecionada automaticamente

## Fluxo de Trabalho

1. **Admin cria igrejas**
2. **Admin cria usuários** e associa às igrejas
3. **Usuário faz login** e gerencia apenas sua(s) igreja(s)
4. **Usuário cadastra organistas** e marca como oficializadas
5. **Usuário associa organistas à igreja** (botão "Organistas" na igreja)
6. **Usuário cadastra cultos** da igreja
7. **Usuário gera rodízios** automaticamente

## Segurança

- ✅ Senhas são criptografadas (bcrypt)
- ✅ Tokens JWT para autenticação
- ✅ Verificação de acesso em todas as rotas
- ✅ Usuários só veem dados das suas igrejas
- ✅ Validação de permissões no backend

## Variáveis de Ambiente

Adicione ao arquivo `.env`:

```env
JWT_SECRET=sua-chave-secreta-jwt-aqui
SESSION_SECRET=sua-chave-secreta-session-aqui
```

## Próximos Passos

1. Instalar dependências: `npm install`
2. Criar admin: `npm run create-admin`
3. Iniciar sistema: `npm run dev`
4. Fazer login e começar a usar!
