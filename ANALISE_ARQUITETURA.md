# 📊 Análise de Arquitetura - Sistema de Gestão de Organistas

## 🔍 Resumo Executivo

Análise focada em identificar oportunidades de melhoria na organização do código, sem refatoração agressiva ou movimentação de pastas grandes.

---

## 📁 ARQUIVOS GRANDES (>300 linhas)

### 🔴 **server/services/rodizioService.js** (624 linhas)
**Problema:** Arquivo muito grande com múltiplas responsabilidades.

**Responsabilidades identificadas:**
1. Cálculo de datas (`getProximaData`, `adicionarMeses`, `formatarData`)
2. Cálculo de horários (`calcularHoraMeiaHora`)
3. Lógica de verificação de organistas (`organistaTocouRecentemente`, `organistaTocouMuitoProximo`, `organistaTocouNoMesmoDiaSemana`, `organistaSempreMesmaFuncao`)
4. Contadores e estatísticas (`contarTocadasPorDiaSemana`)
5. Distribuição de organistas (`distribuirOrganistas`)
6. Ordenação de organistas (`ordemBaseOrganistas`, `aplicarCicloOrdem`)
7. Geração de rodízio principal (`gerarRodizio`)
8. Persistência (`inserirRodizios`, `buscarRodiziosCompletos`)

**Sugestão de separação:**
```
server/services/rodizio/
  ├── dateHelpers.js          (getProximaData, adicionarMeses, formatarData)
  ├── timeHelpers.js          (calcularHoraMeiaHora)
  ├── organistaValidators.js  (todas as funções de verificação)
  ├── organistaDistributor.js (distribuirOrganistas, ordemBaseOrganistas, aplicarCicloOrdem)
  ├── rodizioGenerator.js    (gerarRodizio - função principal)
  └── rodizioRepository.js    (inserirRodizios, buscarRodiziosCompletos)
```

**Benefícios:**
- Cada arquivo com responsabilidade única
- Facilita testes unitários
- Melhora legibilidade
- Facilita manutenção

---

### 🟡 **server/routes/auth.js** (551 linhas)
**Problema:** Arquivo grande com múltiplas rotas e lógica de negócio misturada.

**Responsabilidades identificadas:**
1. Registro público (`/register`)
2. Login (`/login`)
3. Verificação de token (`/me`)
4. CRUD de usuários (admin)
5. Aprovação/rejeição de usuários
6. Migração de dados

**Sugestão de separação:**
```
server/routes/auth/
  ├── public.js      (register, login)
  ├── users.js       (CRUD de usuários - admin)
  ├── approval.js    (aprovar, rejeitar)
  └── migrations.js  (migrate/usuarios-igrejas)
```

**Benefícios:**
- Organização por contexto
- Facilita encontrar rotas específicas
- Reduz conflitos em equipe

---

### 🟡 **client/src/pages/Admin.js** (561 linhas)
**Problema:** Componente grande com múltiplas responsabilidades.

**Responsabilidades identificadas:**
1. Gerenciamento de estado (usuários, igrejas, formulários)
2. Filtros e busca
3. Modal de edição
4. Formulário de criação
5. Tabela de usuários
6. Lógica de aprovação/rejeição

**Sugestão de separação:**
```
client/src/pages/Admin/
  ├── Admin.js              (componente principal)
  ├── UserForm.js           (formulário de criação)
  ├── UserEditModal.js      (modal de edição)
  ├── UserTable.js          (tabela de usuários)
  ├── UserFilters.js        (filtros e busca)
  └── hooks/
      └── useUsers.js       (lógica de gerenciamento de usuários)
```

**Benefícios:**
- Componentes menores e reutilizáveis
- Melhor separação de responsabilidades
- Facilita testes

---

### 🟡 **server/routes/rodizios.js** (409 linhas)
**Problema:** Arquivo com múltiplas rotas e lógica repetida.

**Responsabilidades identificadas:**
1. Listagem de rodízios
2. Geração de rodízio
3. Geração de PDF
4. Atualização de rodízio
5. Deleção de rodízio
6. Teste de webhook

**Sugestão:**
- Extrair lógica de verificação de acesso para helper
- Criar `rodizioAccessHelper.js` para centralizar verificação de acesso

---

## 🔄 DUPLICAÇÃO DE CÓDIGO

### 1. **Verificação de Acesso a Igreja** (Repetida em múltiplos lugares)

**Locais:**
- `server/routes/rodizios.js` (linhas 17-18, 81-86, 123-128, 272-277)
- `server/routes/organistas.js` (provavelmente)
- `server/routes/igrejas.js` (provavelmente)

**Código duplicado:**
```javascript
const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin');
const temAcesso = req.user.role === 'admin' || igrejas.some(i => i.id === parseInt(igreja_id));
if (!temAcesso) {
  return res.status(403).json({ error: 'Acesso negado a esta igreja' });
}
```

**Sugestão:**
```javascript
// server/middleware/igrejaAccess.js
const { getUserIgrejas } = require('./auth');

async function checkIgrejaAccess(req, res, next) {
  const igrejaId = req.params.igreja_id || req.body.igreja_id || req.query.igreja_id;
  
  if (!igrejaId) {
    return res.status(400).json({ error: 'igreja_id é obrigatório' });
  }
  
  const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin');
  const temAcesso = req.user.role === 'admin' || igrejas.some(i => i.id === parseInt(igrejaId));
  
  if (!temAcesso) {
    return res.status(403).json({ error: 'Acesso negado a esta igreja' });
  }
  
  req.igrejaId = parseInt(igrejaId);
  next();
}

module.exports = { checkIgrejaAccess };
```

---

### 2. **Query de Rodízios com JOINs** (Repetida)

**Locais:**
- `server/routes/rodizios.js` (linhas 31-40, 133-142, 309-323, 332-346)

**Código duplicado:**
```javascript
SELECT r.*, 
       o.nome as organista_nome, o.telefone as organista_telefone, o.email as organista_email,
       i.nome as igreja_nome,
       c.dia_semana, c.hora as hora_culto
FROM rodizios r
INNER JOIN organistas o ON r.organista_id = o.id
INNER JOIN igrejas i ON r.igreja_id = i.id
INNER JOIN cultos c ON r.culto_id = c.id
```

**Sugestão:**
```javascript
// server/services/rodizioRepository.js
const RODIZIO_BASE_QUERY = `
  SELECT r.*, 
         o.nome as organista_nome, o.telefone as organista_telefone, o.email as organista_email,
         i.nome as igreja_nome,
         c.dia_semana, c.hora as hora_culto
  FROM rodizios r
  INNER JOIN organistas o ON r.organista_id = o.id
  INNER JOIN igrejas i ON r.igreja_id = i.id
  INNER JOIN cultos c ON r.culto_id = c.id
`;

function buildRodizioQuery(conditions = [], params = []) {
  let query = RODIZIO_BASE_QUERY;
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  return { query, params };
}
```

---

### 3. **Tratamento de Erros Genérico** (Repetido)

**Locais:**
- Múltiplos arquivos de rotas

**Código duplicado:**
```javascript
catch (error) {
  res.status(500).json({ error: error.message });
}
```

**Sugestão:**
- Já existe `errorHandler.js` - garantir que todas as rotas usem `asyncHandler`

---

## 🏷️ NOMES RUINS / CONFUSOS

### 1. **`organistaTocouRecentemente` vs `organistaTocouMuitoProximo`**
**Problema:** Nomes muito similares, difícil distinguir diferença.

**Sugestão:**
- `organistaTocouRecentemente` → `hasOrganistaPlayedInLastDays`
- `organistaTocouMuitoProximo` → `hasOrganistaPlayedWithinMinDays`

**Ou em português:**
- `organistaTocouRecentemente` → `organistaTocouNosUltimosDias`
- `organistaTocouMuitoProximo` → `organistaTocouDentroDoIntervaloMinimo`

---

### 2. **`gerarOrdemCiclo` (função interna)**
**Problema:** Função muito grande (56 linhas) dentro de `gerarRodizio`.

**Sugestão:**
- Extrair para `server/services/rodizio/cicloHelpers.js`
- Renomear para `calcularOrdemCiclo` (mais descritivo)

---

### 3. **`rodiziosGerados` (variável)**
**Problema:** Nome genérico, não indica que são rodízios já persistidos.

**Sugestão:**
- `rodiziosGerados` → `rodiziosExistentes` ou `rodiziosPersistidos`

---

### 4. **`indiceOrganista` vs `indiceReal`**
**Problema:** Diferença não é clara.

**Sugestão:**
- `indiceOrganista` → `indiceNaSequencia`
- `indiceReal` → `indiceNaListaOrganistas`

---

## 🛠️ FUNÇÕES COM MÚLTIPLAS RESPONSABILIDADES

### 1. **`gerarRodizio` (rodizioService.js)**
**Problema:** Função faz muitas coisas:
- Busca dados do banco
- Calcula datas
- Gera ordem de organistas
- Distribui organistas
- Insere no banco
- Atualiza ciclo da igreja

**Sugestão:**
```javascript
// Separar em funções menores
async function gerarRodizio(igrejaId, periodoMeses, cicloInicial, dataInicial, organistaInicial) {
  const config = await prepararConfiguracaoRodizio(igrejaId, cicloInicial, dataInicial);
  const datasCulto = calcularDatasCulto(config.cultos, config.dataInicio, config.dataFim);
  const organistas = await buscarOrganistas(igrejaId);
  const rodizios = distribuirOrganistasNasDatas(datasCulto, organistas, config);
  await persistirRodizios(rodizios);
  await atualizarCicloIgreja(igrejaId, config.cicloAtual);
  return await buscarRodiziosCompletos(igrejaId, config.dataInicio, config.dataFim);
}
```

---

### 2. **`distribuirOrganistas` (rodizioService.js)**
**Problema:** Função muito complexa (125 linhas) com múltiplas responsabilidades:
- Conta ocorrências
- Calcula desequilíbrios
- Ordena organistas
- Filtra disponíveis

**Sugestão:**
```javascript
// Separar em funções menores
function calcularEstatisticasOrganistas(organistas, rodiziosGerados) {
  // Contadores e desequilíbrios
}

function ordenarOrganistasPorPrioridade(organistas, estatisticas, funcao, diaSemana) {
  // Ordenação
}

function filtrarOrganistasDisponiveis(organistasOrdenadas, rodiziosGerados, dataAtual, funcao) {
  // Filtragem
}

function distribuirOrganistas(organistas, rodiziosGerados, dataAtual, funcao, diaSemana) {
  const estatisticas = calcularEstatisticasOrganistas(organistas, rodiziosGerados);
  const ordenadas = ordenarOrganistasPorPrioridade(organistas, estatisticas, funcao, diaSemana);
  const disponiveis = filtrarOrganistasDisponiveis(ordenadas, rodiziosGerados, dataAtual, funcao);
  return disponiveis[0];
}
```

---

## 📦 HELPERS SUGERIDOS

### 1. **`server/utils/dateHelpers.js`**
```javascript
// Extrair de rodizioService.js
module.exports = {
  getProximaData,
  adicionarMeses,
  formatarData,
  calcularHoraMeiaHora
};
```

### 2. **`server/utils/queryBuilders.js`**
```javascript
// Centralizar construção de queries complexas
module.exports = {
  buildRodizioQuery,
  buildIgrejaQuery,
  // etc.
};
```

### 3. **`client/src/utils/tableHelpers.js`**
```javascript
// Helpers para tabelas (filtros, ordenação, paginação)
module.exports = {
  filterBySearch,
  sortTable,
  paginateResults
};
```

---

## 🎯 PRIORIDADES DE IMPLEMENTAÇÃO

### **Alta Prioridade** (Impacto alto, esforço baixo)
1. ✅ Extrair helpers de data (`dateHelpers.js`)
2. ✅ Criar middleware `checkIgrejaAccess`
3. ✅ Centralizar query de rodízios (`rodizioRepository.js`)
4. ✅ Renomear funções confusas em `rodizioService.js`

### **Média Prioridade** (Impacto médio, esforço médio)
1. ⚠️ Separar `rodizioService.js` em múltiplos arquivos
2. ⚠️ Separar rotas de `auth.js`
3. ⚠️ Extrair componentes de `Admin.js`

### **Baixa Prioridade** (Impacto baixo, esforço alto)
1. ⚪ Refatorar `distribuirOrganistas` (funciona, mas é complexo)
2. ⚪ Criar hooks customizados para lógica de páginas

---

## 📝 NOTAS FINAIS

- **Não mover pastas grandes:** Manter estrutura atual de `server/` e `client/`
- **Não refatorar geral:** Focar em pequenas separações incrementais
- **Manter compatibilidade:** Não alterar assinaturas de funções públicas sem necessidade
- **Testar após cada mudança:** Garantir que nada quebrou

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Criar `server/utils/dateHelpers.js`
- [ ] Criar `server/middleware/igrejaAccess.js`
- [ ] Criar `server/services/rodizioRepository.js`
- [ ] Renomear funções confusas em `rodizioService.js`
- [ ] Extrair `gerarOrdemCiclo` para helper
- [ ] Separar `rodizioService.js` em múltiplos arquivos
- [ ] Separar rotas de `auth.js`
- [ ] Extrair componentes de `Admin.js`

---

**Data da Análise:** 2025-01-26  
**Analista:** Sistema de Análise de Arquitetura
