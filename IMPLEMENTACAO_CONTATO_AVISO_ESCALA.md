# Implementação: Contato Adicional para Aviso de Escala

## 📋 Resumo

Foi implementada a funcionalidade que permite cadastrar um **contato adicional opcional** (telefone/WhatsApp) que receberá uma **cópia da mensagem** enviada à organista quando ela for escalada para tocar no culto.

## ✅ O que foi implementado

### 1. **Banco de Dados**
- ✅ Campo `contato_aviso_escala_telefone` adicionado à tabela `igrejas`
- ✅ Campo é **OPCIONAL** (pode ser NULL)
- ✅ Migração SQL criada: `server/scripts/migrate-add-contato-aviso-escala.sql`
- ✅ Script Node.js criado: `server/scripts/migrate-add-contato-aviso-escala.js`

### 2. **Backend**
- ✅ Rotas atualizadas para incluir o novo campo:
  - `GET /api/igrejas` - Lista inclui o campo
  - `GET /api/igrejas/:id` - Retorna o campo
  - `POST /api/igrejas` - Aceita o campo na criação
  - `PUT /api/igrejas/:id` - Aceita o campo na atualização
- ✅ Queries atualizadas para buscar o campo:
  - `rodizioRepository.js` - Query base de rodízios
  - `scheduler.js` - Query de rodízios do dia
- ✅ Serviço de notificação atualizado:
  - `notificacaoService.js` - Envia mensagem também para o contato adicional
  - Payload do webhook inclui o novo campo

### 3. **Frontend**
- ✅ Campo adicionado no formulário de cadastro/edição de igrejas
- ✅ Label: "Contato para Aviso de Escala (Opcional)"
- ✅ Hint explicativo: "Este contato receberá uma cópia da mensagem enviada à organista quando ela for escalada para tocar no culto. Campo opcional."
- ✅ Estado do formulário atualizado

## 🔄 Como funciona

1. **Cadastro**: O encarregado pode preencher o campo "Contato para Aviso de Escala" no cadastro da igreja (opcional).

2. **Disparo automático**: Quando o sistema dispara a mensagem para a organista (às 10h do dia do culto):
   - ✅ A organista recebe a mensagem normalmente (comportamento atual mantido)
   - ✅ Se o campo `contato_aviso_escala_telefone` estiver preenchido, o contato também recebe a **MESMA mensagem**
   - ✅ Nenhuma alteração no fluxo existente

3. **Webhook**: O payload do webhook inclui:
   - Tipo de destinatário: `'contato_aviso_escala'` quando enviado para o contato adicional
   - Campo `contato_aviso_escala_telefone` nos dados da igreja

## 🚀 Como aplicar a migração

### Opção 1: Script Node.js (Recomendado)
```bash
cd server
node scripts/migrate-add-contato-aviso-escala.js
```

### Opção 2: SQL direto
```bash
mysql -u seu_usuario -p gestao_organista < server/scripts/migrate-add-contato-aviso-escala.sql
```

### Opção 3: Executar SQL manualmente
```sql
ALTER TABLE `igrejas` 
ADD COLUMN `contato_aviso_escala_telefone` VARCHAR(20) NULL 
AFTER `encarregado_regional_telefone`;
```

## 📝 Exemplo de uso

1. **Cadastrar igreja com contato adicional:**
   - Acesse: Gestão de Organistas → Igrejas
   - Cadastre ou edite uma igreja
   - Preencha o campo "Contato para Aviso de Escala (Opcional)" com o telefone/WhatsApp
   - Salve

2. **Resultado:**
   - Quando a organista for escalada, ela receberá a mensagem normalmente
   - O contato adicional também receberá a mesma mensagem automaticamente
   - Nenhuma ação adicional necessária

## ⚠️ Importante

- ✅ **Campo é OPCIONAL**: Se não preenchido, o sistema funciona normalmente
- ✅ **Não quebra funcionalidade existente**: A lógica atual permanece intacta
- ✅ **Mensagem idêntica**: O contato adicional recebe a mesma mensagem da organista
- ✅ **Apenas cópia**: O contato adicional não substitui a organista, apenas recebe uma cópia

## 🔍 Arquivos modificados

### Backend
- `server/routes/igrejas.js` - Rotas GET, POST, PUT
- `server/services/notificacaoService.js` - Lógica de envio
- `server/services/rodizioRepository.js` - Query base
- `server/services/scheduler.js` - Query de rodízios do dia

### Frontend
- `client/src/pages/Igrejas.js` - Formulário de cadastro/edição

### Migração
- `server/scripts/migrate-add-contato-aviso-escala.sql` - SQL de migração
- `server/scripts/migrate-add-contato-aviso-escala.js` - Script Node.js

## ✅ Validação

Após aplicar a migração, verifique:

1. ✅ Campo aparece no formulário de cadastro/edição de igrejas
2. ✅ Campo pode ser preenchido e salvo
3. ✅ Campo aparece na listagem de igrejas (se necessário)
4. ✅ Quando uma organista é escalada, o contato adicional recebe a mensagem (se configurado)
5. ✅ Logs do sistema mostram: `✅ Webhook disparado para contato adicional: [telefone]`

## 📞 Suporte

Em caso de dúvidas ou problemas, verifique:
- Logs do servidor (`console.log` com prefixo `✅` ou `❌`)
- Logs do webhook (payload JSON enviado)
- Banco de dados (campo `contato_aviso_escala_telefone` na tabela `igrejas`)
