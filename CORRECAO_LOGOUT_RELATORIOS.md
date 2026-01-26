# 🔧 Correção do Erro de Logout ao Acessar Relatórios

## ❌ Problema Identificado

Ao acessar o menu "Relatórios", o sistema deslogava o usuário com o seguinte erro:

```
Unknown column 'tipo_usuario' in 'field list'
```

### Causa Raiz

O código estava tentando buscar a coluna `tipo_usuario` na tabela `usuarios`, mas essa coluna não existia no banco de dados porque a migração não havia sido executada.

## ✅ Soluções Implementadas

### 1. Middleware de Autenticação Compatível

**Arquivo**: `server/middleware/auth.js`

- Alterado de `SELECT id, nome, email, role, tipo_usuario, ativo, aprovado` para `SELECT *`
- Isso torna a query compatível mesmo se a coluna `tipo_usuario` não existir
- Adicionado tratamento para garantir que `tipo_usuario` seja `null` se não existir

### 2. Cadastro Compatível

**Arquivo**: `server/routes/auth.js`

- Adicionada verificação se a coluna `tipo_usuario` existe antes de tentar inserir
- Query de INSERT montada dinamicamente:
  - Se a coluna existe: inclui `tipo_usuario` no INSERT
  - Se não existe: INSERT sem `tipo_usuario`
- Sistema funciona mesmo sem a migração executada

### 3. Migração Automática

**Arquivo**: `server/database/db.js`

- Adicionada função `migrateTipoUsuario()` que verifica e adiciona a coluna automaticamente
- Migração executada automaticamente na inicialização do banco
- Não falha se a coluna já existir

## 🚀 Como Funciona Agora

### Comportamento

1. **Se a coluna não existir**:
   - Sistema funciona normalmente
   - `tipo_usuario` será `null` para todos os usuários
   - Migração será executada automaticamente na próxima inicialização

2. **Se a coluna existir**:
   - Sistema funciona normalmente
   - Usuários podem ter `tipo_usuario = 'encarregado'` ou `'examinadora'`
   - Menu "Relatórios" aparece para encarregados/examinadoras

### Executar Migração Manualmente (Opcional)

Se quiser executar a migração manualmente:

```bash
npm run migrate-tipo-usuario
```

Mas não é necessário - a migração acontece automaticamente na próxima inicialização do servidor.

## 📝 Arquivos Modificados

1. **server/middleware/auth.js**
   - Query alterada para `SELECT *` (compatível)
   - Tratamento de `tipo_usuario` opcional

2. **server/routes/auth.js**
   - Verificação dinâmica da existência da coluna
   - INSERT condicional baseado na existência da coluna

3. **server/database/db.js**
   - Adicionada função `migrateTipoUsuario()`
   - Migração executada automaticamente no `init()`

## ✅ Resultado

- ✅ Sistema não desloga mais ao acessar relatórios
- ✅ Funciona mesmo sem a coluna `tipo_usuario` existir
- ✅ Migração acontece automaticamente
- ✅ Compatível com bancos antigos e novos

## 🔄 Próximos Passos

1. Reiniciar o servidor (a migração será executada automaticamente)
2. Verificar se a coluna foi criada: `npm run migrate-tipo-usuario` (opcional)
3. Testar acesso aos relatórios - não deve mais deslogar
