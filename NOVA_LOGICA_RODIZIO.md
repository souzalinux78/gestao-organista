# 🎹 Nova Lógica de Rodízio - Meia Hora e Tocar no Culto

## 📋 O que mudou?

O sistema agora gera **dois rodízios por culto**:
1. **🎵 Meia Hora**: Organista que toca 30 minutos antes do culto
2. **🎹 Tocar no Culto**: Organista que toca durante o culto

## ✅ Melhorias Implementadas

### 1. Distribuição Inteligente
- **Evita repetições consecutivas**: A mesma organista não toca quinta, sábado e domingo seguidos
- **Distribuição equilibrada**: Todas as organistas fazem todas as funções antes de repetir
- **Prioriza quem tocou menos**: Organistas com menos escalas têm prioridade

### 2. Lógica de Distribuição
- Verifica se a organista já tocou no mesmo dia da semana recentemente
- Evita que a mesma organista toque em dias consecutivos (dentro de 3 dias)
- Garante que todas as organistas participem igualmente

### 3. Notificações
- Notificações diferenciadas para "Meia Hora" e "Tocar no Culto"
- Mensagens claras indicando a função de cada organista
- Horário específico para quem faz a meia hora (30 min antes)

## 🚀 Como Usar

### 1. Executar Migração (se necessário)
Se você já tinha rodízios cadastrados, execute:

```bash
npm run migrate-rodizios
```

Isso adicionará a coluna `funcao` na tabela de rodízios.

### 2. Gerar Novo Rodízio
1. Vá em **"Rodízios"**
2. Selecione a igreja
3. Escolha o período (6 ou 12 meses)
4. Clique em **"Gerar Rodízio"**

O sistema irá:
- Criar 2 rodízios por culto (meia hora + tocar no culto)
- Distribuir as organistas de forma equilibrada
- Evitar repetições consecutivas

### 3. Visualizar Rodízio
Na tabela de rodízios, você verá:
- **Data** e **Dia** do culto
- **Hora** do culto
- **Função**: 🎵 Meia Hora ou 🎹 Tocar no Culto
- **Organista** escalada
- **Telefone** da organista

## 📊 Exemplo de Distribuição

**Cultos**: Quinta, Sábado, Domingo  
**Organistas**: A, B, C

### Semana 1:
- **Quinta**:
  - Meia Hora: Organista A
  - Tocar no Culto: Organista B
- **Sábado**:
  - Meia Hora: Organista C
  - Tocar no Culto: Organista A
- **Domingo**:
  - Meia Hora: Organista B
  - Tocar no Culto: Organista C

### Semana 2:
- **Quinta**:
  - Meia Hora: Organista B (não repetiu A que tocou quinta passada)
  - Tocar no Culto: Organista C
- E assim por diante...

## 🔔 Notificações

As notificações agora incluem:
- **Função específica** (Meia Hora ou Tocar no Culto)
- **Horário correto** (para meia hora: 30 min antes do culto)
- **Mensagem personalizada** para cada função

## 📄 PDF

O PDF gerado também mostra a função de cada organista, facilitando a impressão e distribuição.

## ⚠️ Importante

- **Não repete rodízios existentes**: Se já existe um rodízio para uma data/culto/função, não será recriado
- **Distribuição automática**: O sistema escolhe automaticamente a melhor organista para cada função
- **Equilíbrio garantido**: Todas as organistas participam igualmente antes de repetir

## 🐛 Solução de Problemas

Se o rodízio não estiver sendo gerado corretamente:
1. Verifique se há organistas oficializadas associadas à igreja
2. Verifique se há cultos ativos cadastrados
3. Execute a migração: `npm run migrate-rodizios`
4. Verifique os logs do servidor para mais detalhes
