# 📊 Novas Funcionalidades de Relatórios

## ✅ O que foi implementado

### 1. Campo Tipo de Usuário no Cadastro
- Adicionado campo `tipo_usuario` na tabela `usuarios`
- Valores possíveis: `encarregado`, `examinadora` ou `NULL`
- Campo opcional no formulário de cadastro

### 2. Menu de Relatórios para Administrador
- Nova página `/relatorios-admin` exclusiva para administradores
- Visualiza **todas** as igrejas cadastradas no sistema
- Permite gerar PDF por igreja com filtros de período
- Mostra estatísticas: total de organistas, cultos e usuários por igreja

### 3. Menu de Relatórios para Encarregados/Examinadoras
- Nova página `/relatorios` para encarregados e examinadoras
- Visualiza **apenas** as igrejas associadas ao usuário
- Permite gerar PDF por igreja com filtros de período
- Mostra estatísticas das igrejas que o usuário cadastrou

## 🚀 Como Usar

### Para Administradores

1. **Acessar Relatórios**:
   - Faça login como administrador
   - No menu, clique em **"Relatórios"**
   - Você verá todas as igrejas cadastradas

2. **Gerar PDF**:
   - Selecione uma igreja (ou deixe "Todas as igrejas" para ver todas)
   - Opcionalmente, defina um período (data início e fim)
   - Clique em **"📄 Gerar PDF"** na linha da igreja desejada
   - O PDF será baixado automaticamente

### Para Encarregados/Examinadoras

1. **Cadastro**:
   - Ao se cadastrar, selecione o tipo de usuário:
     - **Encarregado**: Para encarregados locais ou regionais
     - **Examinadora**: Para examinadoras
   - O campo é opcional, mas recomendado

2. **Acessar Relatórios**:
   - Faça login com sua conta
   - No menu, clique em **"Relatórios"**
   - Você verá apenas as igrejas que você cadastrou

3. **Gerar PDF**:
   - Selecione uma igreja (ou deixe "Todas as igrejas")
   - Opcionalmente, defina um período
   - Clique em **"📄 Gerar PDF"** na linha da igreja desejada
   - O PDF será baixado automaticamente

## 🔧 Migração do Banco de Dados

Antes de usar as novas funcionalidades, execute a migração:

```bash
npm run migrate-tipo-usuario
```

Isso adicionará o campo `tipo_usuario` na tabela `usuarios`.

## 📝 Estrutura de Dados

### Tabela `usuarios`
- Novo campo: `tipo_usuario` ENUM('encarregado', 'examinadora', NULL)
- Posição: Após o campo `role`
- Valor padrão: NULL (opcional)

### Rotas Adicionadas

**Frontend:**
- `/relatorios-admin` - Página de relatórios para admin
- `/relatorios` - Página de relatórios para encarregados/examinadoras

**Backend:**
- Nenhuma nova rota (usa rotas existentes de igrejas e PDF)

## 🎯 Funcionalidades

### Página de Relatórios Admin
- ✅ Lista todas as igrejas do sistema
- ✅ Mostra estatísticas por igreja (organistas, cultos, usuários)
- ✅ Filtro por igreja
- ✅ Filtro por período (data início e fim)
- ✅ Geração de PDF por igreja
- ✅ Download automático do PDF

### Página de Relatórios Encarregado/Examinadora
- ✅ Lista apenas igrejas associadas ao usuário
- ✅ Mostra estatísticas por igreja
- ✅ Filtro por igreja
- ✅ Filtro por período
- ✅ Geração de PDF por igreja
- ✅ Download automático do PDF

## 🔒 Controle de Acesso

- **Admin**: Acesso a `/relatorios-admin` (vê todas as igrejas)
- **Encarregado/Examinadora**: Acesso a `/relatorios` (vê apenas suas igrejas)
- **Usuário comum**: Sem acesso às páginas de relatórios (apenas menu padrão)

## 📋 Notas Importantes

1. O campo `tipo_usuario` é opcional no cadastro
2. Usuários existentes terão `tipo_usuario = NULL`
3. Apenas usuários com `tipo_usuario = 'encarregado'` ou `'examinadora'` verão o menu "Relatórios"
4. O PDF gerado é o mesmo formato usado na página de Rodízios
5. O período é opcional - se não informado, gera PDF de todos os rodízios da igreja

## 🐛 Troubleshooting

### Menu "Relatórios" não aparece
- Verifique se o usuário tem `tipo_usuario = 'encarregado'` ou `'examinadora'`
- Para admin, verifique se o `role = 'admin'`
- Faça logout e login novamente após alterar o tipo de usuário

### Erro ao gerar PDF
- Verifique se há rodízios gerados para a igreja
- Verifique se o período está correto
- Verifique se a igreja tem cultos cadastrados

### Campo tipo_usuario não aparece no cadastro
- Verifique se a migração foi executada: `npm run migrate-tipo-usuario`
- Verifique se o servidor foi reiniciado após a migração
