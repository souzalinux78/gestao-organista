# Guia de Instalação e Configuração

## Pré-requisitos

- Node.js (versão 14 ou superior)
- npm (geralmente vem com Node.js)

## Instalação

1. **Instalar dependências do backend:**
```bash
npm install
```

2. **Instalar dependências do frontend:**
```bash
cd client
npm install
cd ..
```

Ou use o comando automatizado:
```bash
npm run install-all
```

## Configuração

1. **Criar arquivo `.env` na raiz do projeto:**
```bash
cp .env.example .env
```

2. **Editar o arquivo `.env` e configurar:**

```env
PORT=5000

# URL do webhook para receber notificações quando um rodízio é gerado
# Exemplo: https://seu-servidor.com/webhook/rodizios
WEBHOOK_URL=

# URL do webhook para envio de notificações (SMS/WhatsApp)
# Este webhook será chamado às 10h do dia do culto
# Exemplo: https://seu-servidor.com/webhook/notificacoes
WEBHOOK_NOTIFICACAO=
```

### Configuração de Webhooks

#### Webhook de Rodízio (WEBHOOK_URL)

Quando um rodízio é gerado, o sistema enviará um POST para esta URL com o seguinte formato:

```json
{
  "tipo": "rodizio_gerado",
  "total": 24,
  "periodo": {
    "inicio": "2024-01-01",
    "fim": "2024-06-30"
  },
  "igreja": "Igreja Central",
  "rodizios": [
    {
      "id": 1,
      "igreja": "Igreja Central",
      "organista": "Maria Silva",
      "data_culto": "2024-01-07",
      "dia_semana": "domingo",
      "hora_culto": "19:00",
      "periodo_inicio": "2024-01-01",
      "periodo_fim": "2024-06-30"
    }
  ]
}
```

#### Webhook de Notificações (WEBHOOK_NOTIFICACAO)

O sistema verifica diariamente às 10:00 e envia notificações para organistas e encarregados. O webhook receberá:

```json
{
  "telefone": "5511999999999",
  "mensagem": "🎹 Lembrete: Você está escalada para tocar hoje!\n\n📅 Data: 07/01/2024\n🕐 Hora do culto: 19:00\n⏰ Meia hora: 18:30\n📍 Igreja: Igreja Central\n\nPor favor, esteja presente meia hora antes do culto.",
  "timestamp": "2024-01-07T10:00:00.000Z"
}
```

**Nota:** Se os webhooks não estiverem configurados, o sistema funcionará normalmente, mas apenas registrará logs no console.

## Executando o Sistema

### Modo Desenvolvimento (Backend + Frontend)

```bash
npm run dev
```

Isso iniciará:
- Backend na porta 5000 (http://localhost:5000)
- Frontend na porta 3000 (http://localhost:3000)

### Apenas Backend

```bash
npm run server
```

### Apenas Frontend

```bash
npm run client
```

## Primeiros Passos

1. **Acesse o sistema:** http://localhost:3000

2. **Cadastre Organistas:**
   - Vá em "Organistas"
   - Clique em "+ Nova Organista"
   - Preencha os dados (nome é obrigatório)
   - Marque "Oficializada" se a organista estiver oficializada

3. **Cadastre Igrejas:**
   - Vá em "Igrejas"
   - Clique em "+ Nova Igreja"
   - Preencha os dados da igreja e dos encarregados
   - Clique em "Organistas" para adicionar organistas oficializadas à igreja

4. **Cadastre Cultos:**
   - Vá em "Cultos"
   - Clique em "+ Novo Culto"
   - Selecione a igreja, dia da semana e horário

5. **Gere Rodízio:**
   - Vá em "Rodízios"
   - Selecione a igreja e o período (6 ou 12 meses)
   - Clique em "Gerar Rodízio"
   - O sistema gerará automaticamente respeitando que todas as organistas toquem antes de repetir

6. **Visualize e Exporte:**
   - Use os filtros para visualizar rodízios
   - Clique em "Gerar PDF" para exportar o rodízio

## Funcionalidades

### Geração de Rodízio

- O sistema distribui as organistas de forma igualitária
- Garante que todas as organistas toquem antes de repetir
- Respeita os dias e horários dos cultos cadastrados
- Não cria rodízios duplicados para a mesma data

### Notificações Automáticas

- O sistema verifica diariamente às 10:00
- Envia notificações para:
  - Organista escalada
  - Encarregado local
  - Encarregado regional
- As notificações incluem:
  - Data e hora do culto
  - Hora da meia hora (30 minutos antes)
  - Nome da igreja

### Geração de PDF

- Gera PDF com todos os rodízios filtrados
- Inclui data, dia da semana, hora e organista
- Formato organizado e fácil de imprimir

## Solução de Problemas

### Erro ao iniciar o servidor

- Verifique se a porta 5000 está disponível
- Verifique se o Node.js está instalado corretamente
- Execute `npm install` novamente

### Banco de dados não criado

- O banco de dados SQLite é criado automaticamente na primeira execução
- Verifique se há permissões de escrita no diretório `server/database/`

### Notificações não estão sendo enviadas

- Verifique se o `WEBHOOK_NOTIFICACAO` está configurado corretamente
- Verifique os logs do servidor para erros
- O sistema verifica apenas às 10:00, então pode não enviar imediatamente

### Rodízio não está gerando

- Verifique se há organistas oficializadas cadastradas na igreja
- Verifique se há cultos ativos cadastrados
- Verifique os logs do servidor para mensagens de erro

## Estrutura do Banco de Dados

O sistema usa SQLite e cria automaticamente as seguintes tabelas:

- `organistas`: Cadastro de organistas
- `igrejas`: Cadastro de igrejas
- `cultos`: Cadastro de cultos
- `organistas_igreja`: Relação entre organistas e igrejas (oficializadas)
- `rodizios`: Rodízios gerados
- `notificacoes`: Histórico de notificações enviadas

## Suporte

Para problemas ou dúvidas, verifique os logs do servidor e do navegador (F12).
