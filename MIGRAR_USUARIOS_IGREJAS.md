# Migração: Associar Usuários Sem Igreja

Este script corrige usuários que já estão cadastrados no sistema mas não têm igrejas associadas.

## O que o script faz?

1. **Identifica usuários sem igreja**: Encontra todos os usuários (exceto admin) que não têm igrejas associadas
2. **Cria igreja padrão**: Para cada usuário, cria uma igreja com o nome: `[Nome do Usuário] - Igreja`
3. **Associa usuário**: Vincula o usuário à igreja criada
4. **Associa organistas órfãs**: Associa automaticamente organistas que não estão associadas a nenhuma igreja à nova igreja criada

## Como executar?

### Opção 1: Via linha de comando (recomendado)

```bash
npm run migrate-usuarios-igrejas
```

### Opção 2: Via API (apenas admin)

Faça uma requisição POST para:
```
POST /api/auth/migrate/usuarios-igrejas
```

**Headers:**
```
Authorization: Bearer [token_do_admin]
```

**Resposta de sucesso:**
```json
{
  "message": "Migração concluída: 3 usuário(s) corrigido(s)",
  "usuariosCorrigidos": 3,
  "organistasAssociadas": 5,
  "resultados": [
    {
      "usuario": "João Silva",
      "igreja": "João Silva - Igreja",
      "organistasAssociadas": 2
    },
    {
      "usuario": "Maria Santos",
      "igreja": "Maria Santos - Igreja",
      "organistasAssociadas": 3
    }
  ]
}
```

## Quando executar?

Execute este script quando:
- ✅ Você atualizou o sistema e usuários antigos não têm igrejas associadas
- ✅ Você quer garantir que todos os usuários tenham pelo menos uma igreja
- ✅ Você quer associar organistas "órfãs" a igrejas

## Segurança

- ⚠️ Apenas administradores podem executar via API
- ⚠️ O script não afeta usuários admin
- ⚠️ O script é idempotente: pode ser executado múltiplas vezes sem problemas

## Exemplo de saída

```
🔄 Iniciando migração: associar usuários sem igreja a uma igreja padrão...

📋 Encontrados 2 usuário(s) sem igreja associada:

  🔧 Processando usuário: João Silva (ID: 5)
    ✅ Igreja criada: "João Silva - Igreja" (ID: 10)
    ✅ Usuário associado à igreja
    ✅ 2 organista(s) "órfã(s)" associada(s) à igreja

  🔧 Processando usuário: Maria Santos (ID: 6)
    ✅ Igreja criada: "Maria Santos - Igreja" (ID: 11)
    ✅ Usuário associado à igreja
    ✅ 3 organista(s) "órfã(s)" associada(s) à igreja

📊 Resumo da migração:
   ✅ 2 usuário(s) corrigido(s)
   ✅ 5 organista(s) associada(s)

✅ Migração concluída com sucesso!
```

## Notas

- As igrejas criadas terão apenas o nome preenchido (outros campos ficam vazios)
- Você pode editar as igrejas criadas depois para adicionar mais informações
- Organistas "órfãs" são associadas à primeira igreja criada para cada usuário
- Se um usuário já tiver igreja, ele será ignorado pelo script
