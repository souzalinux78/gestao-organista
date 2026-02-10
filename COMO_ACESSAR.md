# Como Acessar o Sistema de Gestão de Organistas

## Pré-requisitos

Antes de iniciar, certifique-se de ter:

1. ✅ **Node.js instalado** (versão 14 ou superior)
2. ✅ **MySQL instalado e rodando**
3. ✅ **Dependências instaladas**

## Passo a Passo

### 1. Verificar se o MySQL está rodando

Certifique-se de que o MySQL está ativo no seu computador. No Windows, você pode verificar pelos serviços ou tentar conectar usando:
- Usuário: `root`
- Senha: `FLoc25GD!`

### 2. Navegar até a pasta do projeto

Abra o terminal/PowerShell e navegue até a pasta do projeto:

```bash
cd "C:\Gestão de Organista\gestao-organista"
```

### 3. Verificar/Criar arquivo .env

Certifique-se de que existe um arquivo `.env` na raiz do projeto com o seguinte conteúdo:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=FLoc25GD!
DB_NAME=gestao_organista
WEBHOOK_URL=
WEBHOOK_NOTIFICACAO=
```

Se o arquivo não existir, crie-o manualmente.

### 4. Instalar dependências (se ainda não instalou)

```bash
npm run install-all
```

Este comando instalará as dependências do backend e do frontend.

### 5. Iniciar o sistema

Execute o comando:

```bash
npm run dev
```

Este comando iniciará:
- **Backend** na porta **5000** (http://localhost:5000)
- **Frontend** na porta **3000** (http://localhost:3000)

### 6. Acessar o sistema

Abra seu navegador e acesse:

**http://localhost:3000**

Você verá a interface do sistema de gestão de organistas.

## O que você verá ao iniciar

Quando o sistema iniciar corretamente, você verá no terminal:

```
Conectado ao banco de dados MySQL
Banco de dados 'gestao_organista' verificado/criado
Tabelas criadas com sucesso
Servidor rodando na porta 5000
```

E o frontend abrirá automaticamente no navegador em `http://localhost:3000`.

## Interface do Sistema

A interface possui as seguintes seções:

1. **Início** - Página inicial com informações do sistema
2. **Organistas** - Cadastro e gerenciamento de organistas
3. **Igrejas** - Cadastro de igrejas e encarregados
4. **Cultos** - Configuração de dias e horários de cultos
5. **Rodízios** - Geração e visualização de rodízios

## Primeiro Uso

1. **Cadastre Organistas:**
   - Clique em "Organistas" no menu
   - Clique em "+ Nova Organista"
   - Preencha os dados e salve

2. **Cadastre Igrejas:**
   - Clique em "Igrejas"
   - Clique em "+ Nova Igreja"
   - Preencha os dados da igreja e dos encarregados

3. **Associe Organistas às Igrejas:**
   - Na página de Igrejas, clique em "Organistas" do botão de ações
   - Adicione as organistas oficializadas

4. **Cadastre Cultos:**
   - Clique em "Cultos"
   - Clique em "+ Novo Culto"
   - Selecione a igreja, dia da semana e horário

5. **Gere Rodízios:**
   - Clique em "Rodízios"
   - Selecione a igreja e o período (6 ou 12 meses)
   - Clique em "Gerar Rodízio"

## Solução de Problemas

### Erro ao conectar ao MySQL

- Verifique se o MySQL está rodando
- Confirme usuário e senha no arquivo `.env`
- Verifique se o usuário tem permissão para criar bancos

### Porta já em uso

Se a porta 5000 ou 3000 estiver em uso:
- Altere a porta no arquivo `.env` (PORT=5001, por exemplo)
- Ou feche o programa que está usando a porta

### Frontend não abre automaticamente

- Acesse manualmente: http://localhost:3000
- Verifique se o frontend iniciou corretamente no terminal

### Erro ao instalar dependências

```bash
# Limpar cache e reinstalar
npm cache clean --force
npm run install-all
```

## Comandos Úteis

- `npm run dev` - Inicia backend e frontend juntos
- `npm run server` - Inicia apenas o backend
- `npm run client` - Inicia apenas o frontend
- `npm run build` - Compila o frontend para produção

## Acesso Remoto (Opcional)

Para acessar de outros dispositivos na mesma rede:

1. Descubra o IP do seu computador:
   ```bash
   ipconfig
   ```
   Procure por "IPv4 Address" (ex: 192.168.1.100)

2. Acesse de outro dispositivo:
   ```
   http://192.168.1.100:3000
   ```

**Nota:** Certifique-se de que o firewall permite conexões na porta 3000.
