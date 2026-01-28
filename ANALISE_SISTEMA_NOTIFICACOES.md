# 📋 Análise do Sistema de Notificações

## ✅ Status Geral: **SISTEMA CONFIGURADO E FUNCIONAL**

O sistema **ESTÁ** configurado para enviar notificações às **10:00 da manhã** alertando as organistas que é o dia delas tocar.

---

## 🔍 Componentes Encontrados

### 1. **Scheduler (Agendador)** ✅
**Arquivo:** `server/services/scheduler.js`

- **Horário configurado:** `'0 10 * * *'` (todos os dias às 10:00)
- **Função:** `verificarERodiziosDoDia()`
- **Inicialização:** ✅ Está sendo chamado em `server/index.js` (linha 227-228)

**Lógica:**
1. Busca todos os rodízios do dia atual
2. Filtra apenas rodízios que ainda não receberam notificação hoje
3. Envia webhook para cada organista
4. Envia webhook consolidado para encarregados

### 2. **Serviço de Notificações** ✅
**Arquivo:** `server/services/notificacaoService.js`

**Funções principais:**
- `enviarNotificacaoDiaCulto()` - Envia notificação individual para organista
- `enviarNotificacaoEncarregados()` - Envia notificação consolidada para encarregados
- `enviarMensagem()` - Envia webhook via HTTP POST

### 3. **Dependências** ✅
**Arquivo:** `package.json`

- ✅ `node-cron: ^3.0.3` - Instalado
- ✅ `axios: ^1.6.2` - Instalado

---

## ⚙️ Configuração Necessária

### Variável de Ambiente Obrigatória:

```env
WEBHOOK_NOTIFICACAO=https://seu-webhook-url.com/notificacoes
```

**Onde configurar:**
- Arquivo `.env` na raiz do projeto
- Ou variável de ambiente do servidor

**⚠️ IMPORTANTE:** Se `WEBHOOK_NOTIFICACAO` não estiver configurado, o sistema apenas **logará** as notificações no console, mas **NÃO enviará** para nenhum serviço externo.

---

## 📊 Fluxo de Funcionamento

```
10:00 AM (todos os dias)
    ↓
Scheduler executa verificarERodiziosDoDia()
    ↓
Busca rodízios do dia atual no banco
    ↓
Filtra rodízios que ainda não receberam notificação hoje
    ↓
Para cada rodízio:
    ├─ Envia webhook para organista
    └─ Registra notificação no banco (evita duplicatas)
    ↓
Para cada igreja:
    └─ Envia webhook consolidado para encarregados
```

---

## 🔍 Verificações Realizadas

### ✅ **Scheduler está inicializado?**
```javascript
// server/index.js linha 227-228
const scheduler = require('./services/scheduler');
scheduler.init();
```
**Status:** ✅ SIM

### ✅ **Cron job configurado corretamente?**
```javascript
// server/services/scheduler.js linha 10
cron.schedule('0 10 * * *', async () => {
  await verificarERodiziosDoDia();
});
```
**Status:** ✅ SIM - Configurado para 10:00

### ✅ **Dependência node-cron instalada?**
```json
// package.json linha 31
"node-cron": "^3.0.3"
```
**Status:** ✅ SIM

### ⚠️ **Webhook configurado?**
```javascript
// server/services/notificacaoService.js linha 238
const webhookNotificacao = process.env.WEBHOOK_NOTIFICACAO;
```
**Status:** ⚠️ **VERIFICAR** - Precisa estar no `.env`

---

## 🧪 Como Testar

### 1. **Verificar se o scheduler está rodando:**
```bash
# Verificar logs do PM2
pm2 logs gestao-organista-api | grep -i "agendador\|scheduler\|10:00"
```

**Logs esperados:**
```
Inicializando agendador de notificações...
Agendador configurado: verificação diária às 10:00
```

### 2. **Testar manualmente (sem esperar 10:00):**
```bash
# Fazer requisição manual para testar
curl -X POST http://localhost:5001/api/notificacoes/enviar/ID_DO_RODIZIO \
  -H "Authorization: Bearer SEU_TOKEN"
```

### 3. **Verificar variável de ambiente:**
```bash
# No servidor
echo $WEBHOOK_NOTIFICACAO

# Ou verificar no .env
grep WEBHOOK_NOTIFICACAO .env
```

---

## 📝 Mensagem Enviada para Organista

O sistema envia uma mensagem formatada assim:

```
🎹 Lembrete: Você está escalada para hoje!

📅 Data: 27/01/2026
🕐 Hora do culto: 19:00
🎯 Função: 🎹 Tocar no Culto
📍 Igreja: Nome da Igreja

Por favor, esteja presente para tocar durante o culto.
```

**Payload JSON enviado:**
```json
{
  "tipo": "notificacao_organista",
  "timestamp": "27/01/2026 10:00:00",
  "destinatario": {
    "telefone": "11999999999",
    "tipo": "organista"
  },
  "mensagem": "...",
  "dados": {
    "rodizio_id": 123,
    "organista": { ... },
    "igreja": { ... },
    "culto": { ... }
  }
}
```

---

## ⚠️ Possíveis Problemas

### 1. **Webhook não configurado**
**Sintoma:** Notificações aparecem apenas no console, não são enviadas
**Solução:** Adicionar `WEBHOOK_NOTIFICACAO` no `.env`

### 2. **Scheduler não está rodando**
**Sintoma:** Nenhum log às 10:00
**Solução:** Verificar se o servidor está rodando e se `scheduler.init()` foi chamado

### 3. **Fuso horário incorreto**
**Sintoma:** Notificações enviadas em horário errado
**Solução:** Verificar timezone do servidor (`TZ` no `.env` ou sistema)

### 4. **Rodízios sem telefone**
**Sintoma:** Notificações não enviadas para algumas organistas
**Solução:** Verificar se organistas têm telefone cadastrado

---

## ✅ Conclusão

O sistema **ESTÁ CONFIGURADO** para enviar notificações às 10:00 da manhã. 

**Próximos passos para garantir funcionamento:**
1. ✅ Verificar se `WEBHOOK_NOTIFICACAO` está configurado no `.env`
2. ✅ Verificar logs do PM2 às 10:00 para confirmar execução
3. ✅ Testar manualmente via API para validar envio
4. ✅ Verificar se organistas têm telefone cadastrado

---

**Data da análise:** 2026-01-27
**Versão do sistema:** 2.0.31
