# Configuração do MySQL

O sistema foi configurado para usar MySQL ao invés de SQLite.

## Configuração do Banco de Dados

1. **Certifique-se de que o MySQL está instalado e rodando**

2. **Crie o arquivo `.env` na raiz do projeto** (copie do `.env.example`):

```env
# Porta do servidor
PORT=5000

# Configurações do MySQL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=FLoc25GD!
DB_NAME=gestao_organista

# URL do webhook para envio de rodízios gerados
WEBHOOK_URL=

# URL do webhook para envio de notificações (SMS/WhatsApp)
WEBHOOK_NOTIFICACAO=
```

3. **O banco de dados será criado automaticamente** na primeira execução do servidor.

## Instalação das Dependências

Execute o comando para instalar o mysql2:

```bash
npm install
```

## Verificação

Ao iniciar o servidor, você verá as seguintes mensagens:

```
Conectado ao banco de dados MySQL
Banco de dados 'gestao_organista' verificado/criado
Tabelas criadas com sucesso
Servidor rodando na porta 5000
```

## Estrutura do Banco

O sistema criará automaticamente as seguintes tabelas:

- `organistas` - Cadastro de organistas
- `igrejas` - Cadastro de igrejas
- `cultos` - Cadastro de cultos
- `organistas_igreja` - Relação entre organistas e igrejas
- `rodizios` - Rodízios gerados
- `notificacoes` - Histórico de notificações

## Solução de Problemas

### Erro de conexão

- Verifique se o MySQL está rodando
- Verifique se o usuário e senha estão corretos
- Verifique se o usuário tem permissão para criar bancos de dados

### Erro ao criar banco

- Certifique-se de que o usuário MySQL tem permissão `CREATE DATABASE`
- Verifique se não há outro banco com o mesmo nome

### Erro ao criar tabelas

- Verifique os logs do servidor para mensagens de erro específicas
- Certifique-se de que o banco de dados foi criado corretamente
