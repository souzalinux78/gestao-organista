# 🔄 Implementação da Alternância de Ciclos de Organistas

## 📋 Requisitos Implementados

### Comportamento dos Ciclos

**Ciclo 1**: Sequência normal de organistas
- Organistas: 1, 2, 3, 4, 5, 6
- Índices: [0, 1, 2, 3, 4, 5]

**Ciclo 2**: Sequência com pares invertidos
- Organistas: 2, 1, 4, 3, 6, 5
- Índices: [1, 0, 3, 2, 5, 4]

### Lógica de Alternância

A alternância funciona da seguinte forma:
- **Ciclo 1** → ordem normal
- **Ciclo 2** → inverter pares consecutivos
- **Ciclo 3** → volta para ciclo 1 (ordem normal)
- **Ciclo 4** → volta para ciclo 2 (inverter pares)
- E assim por diante...

## 🔧 Implementação Técnica

### Função `gerarOrdemCiclo`

A função foi reimplementada para seguir a lógica de alternância por pares:

```javascript
const gerarOrdemCiclo = (ciclo, totalDias, totalOrganistas) => {
  // Criar lista base de índices [0, 1, 2, ..., totalOrganistas-1]
  const ordem = [];
  for (let i = 0; i < totalOrganistas; i++) {
    ordem.push(i);
  }
  
  // Ciclo 1 = ordem normal: [0, 1, 2, 3, 4, 5]
  if (ciclo === 0 || ciclo === 1) {
    return ordem;
  }
  
  // Ciclo 2 = inverter pares consecutivos
  // [0,1,2,3,4,5] -> [1,0,3,2,5,4]
  if (ciclo === 2) {
    const novaOrdem = [];
    for (let i = 0; i < totalOrganistas; i += 2) {
      if (i + 1 < totalOrganistas) {
        // Par completo: inverter [i, i+1] -> [i+1, i]
        novaOrdem.push(ordem[i + 1]);
        novaOrdem.push(ordem[i]);
      } else {
        // Organista ímpar no final: manter na mesma posição
        novaOrdem.push(ordem[i]);
      }
    }
    return novaOrdem;
  }
  
  // Para ciclos maiores que 2, alternar entre ciclo 1 e 2
  const cicloMod = ((ciclo - 1) % 2) + 1;
  
  if (cicloMod === 1) {
    return ordem; // Ciclo 1 = ordem normal
  } else {
    // Ciclo 2 = inverter pares
    const novaOrdem = [];
    for (let i = 0; i < totalOrganistas; i += 2) {
      if (i + 1 < totalOrganistas) {
        novaOrdem.push(ordem[i + 1]);
        novaOrdem.push(ordem[i]);
      } else {
        novaOrdem.push(ordem[i]);
      }
    }
    return novaOrdem;
  }
};
```

### Exemplos de Sequências

#### Exemplo 1: 6 Organistas

**Ciclo 1** (ordem normal):
- Índices: [0, 1, 2, 3, 4, 5]
- Organistas: 1, 2, 3, 4, 5, 6

**Ciclo 2** (pares invertidos):
- Índices: [1, 0, 3, 2, 5, 4]
- Organistas: 2, 1, 4, 3, 6, 5

**Ciclo 3** (volta para ciclo 1):
- Índices: [0, 1, 2, 3, 4, 5]
- Organistas: 1, 2, 3, 4, 5, 6

**Ciclo 4** (volta para ciclo 2):
- Índices: [1, 0, 3, 2, 5, 4]
- Organistas: 2, 1, 4, 3, 6, 5

#### Exemplo 2: 5 Organistas (número ímpar)

**Ciclo 1** (ordem normal):
- Índices: [0, 1, 2, 3, 4]
- Organistas: 1, 2, 3, 4, 5

**Ciclo 2** (pares invertidos, último mantido):
- Índices: [1, 0, 3, 2, 4]
- Organistas: 2, 1, 4, 3, 5

## 🔄 Como Funciona a Alternância

### Avanço de Ciclo

O ciclo avança automaticamente quando todas as organistas foram utilizadas:

```javascript
if (indiceOrganista >= totalOrganistas) {
  cicloAtual++;
  indiceOrganista = 0;
}
```

### Mapeamento de Ciclo

A função `gerarOrdemCiclo` mapeia qualquer número de ciclo para o padrão correto:

- Ciclos ímpares (1, 3, 5, ...) → Ciclo 1 (ordem normal)
- Ciclos pares (2, 4, 6, ...) → Ciclo 2 (inverter pares)

Isso é feito através da fórmula: `cicloMod = ((ciclo - 1) % 2) + 1`

## ✅ Validação

### Casos de Teste

1. **Ciclo 1 com 6 organistas**:
   - Entrada: ciclo = 1, organistas = 6
   - Saída: [0, 1, 2, 3, 4, 5] ✓

2. **Ciclo 2 com 6 organistas**:
   - Entrada: ciclo = 2, organistas = 6
   - Saída: [1, 0, 3, 2, 5, 4] ✓

3. **Ciclo 3 com 6 organistas** (deve ser igual ao ciclo 1):
   - Entrada: ciclo = 3, organistas = 6
   - Saída: [0, 1, 2, 3, 4, 5] ✓

4. **Ciclo 2 com 5 organistas** (número ímpar):
   - Entrada: ciclo = 2, organistas = 5
   - Saída: [1, 0, 3, 2, 4] ✓

## 📝 Mudanças no Código

### Arquivo: `server/services/rodizioService.js`

1. **Função `gerarOrdemCiclo`**: Reimplementada para inverter pares consecutivos
2. **Inicialização do ciclo**: Ajustada para garantir que o ciclo inicial seja pelo menos 1
3. **Lógica de alternância**: Implementada para alternar entre ciclo 1 e ciclo 2 automaticamente

## 🎯 Resultado

A implementação garante que:
- ✅ Ciclo 1 sempre gera ordem normal
- ✅ Ciclo 2 sempre inverte pares consecutivos
- ✅ A alternância funciona corretamente entre ciclos
- ✅ Funciona com qualquer número de organistas (par ou ímpar)
- ✅ A sequência é gerada corretamente sem erros
