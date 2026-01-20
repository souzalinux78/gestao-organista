# Sistema de Gestão de Organistas

Sistema web para gerenciamento de organistas, igrejas, cultos e rodízios.

## Funcionalidades

- ✅ Cadastro de organistas
- ✅ Cadastro de igrejas (com encarregados local e regional)
- ✅ Cadastro de dias e horários de cultos
- ✅ Cadastro de organistas oficializadas por igreja
- ✅ Geração automática de rodízio (6 ou 12 meses)
- ✅ Rodízio sem repetição até todas tocarem
- ✅ Geração de PDF do rodízio
- ✅ Envio de rodízio para webhook
- ✅ Notificações automáticas às 10h do dia do culto
- ✅ Alertas para organista, encarregado local e regional

## Instalação

1. **Certifique-se de que o MySQL está instalado e rodando**

2. Instalar dependências:
```bash
npm run install-all
```

3. Configurar variáveis de ambiente:
```bash
cp .env.example .env
```

Edite o arquivo `.env` e configure:
- `DB_HOST`: Host do MySQL (padrão: localhost)
- `DB_USER`: Usuário do MySQL (padrão: root)
- `DB_PASSWORD`: Senha do MySQL (padrão: FLoc25GD!)
- `DB_NAME`: Nome do banco de dados (padrão: gestao_organista)
- `PORT`: Porta do servidor (padrão: 5000)
- `WEBHOOK_URL`: URL para envio de rodízios gerados
- `WEBHOOK_NOTIFICACAO`: URL para envio de notificações (SMS/WhatsApp)

**Nota:** O banco de dados será criado automaticamente na primeira execução.

3. Iniciar servidor:
```bash
npm run dev
```

O servidor estará disponível em `http://localhost:5000`

## API Endpoints

### Organistas
- `GET /api/organistas` - Listar organistas
- `GET /api/organistas/:id` - Buscar organista
- `POST /api/organistas` - Criar organista
- `PUT /api/organistas/:id` - Atualizar organista
- `DELETE /api/organistas/:id` - Deletar organista

### Igrejas
- `GET /api/igrejas` - Listar igrejas
- `GET /api/igrejas/:id` - Buscar igreja
- `POST /api/igrejas` - Criar igreja
- `PUT /api/igrejas/:id` - Atualizar igreja
- `DELETE /api/igrejas/:id` - Deletar igreja
- `GET /api/igrejas/:id/organistas` - Listar organistas oficializadas
- `POST /api/igrejas/:id/organistas` - Adicionar organista oficializada
- `DELETE /api/igrejas/:id/organistas/:organista_id` - Remover organista

### Cultos
- `GET /api/cultos` - Listar cultos
- `GET /api/cultos/:id` - Buscar culto
- `GET /api/cultos/igreja/:igreja_id` - Listar cultos de uma igreja
- `POST /api/cultos` - Criar culto
- `PUT /api/cultos/:id` - Atualizar culto
- `DELETE /api/cultos/:id` - Deletar culto

### Rodízios
- `GET /api/rodizios` - Listar rodízios (com filtros: igreja_id, periodo_inicio, periodo_fim)
- `POST /api/rodizios/gerar` - Gerar rodízio
  ```json
  {
    "igreja_id": 1,
    "periodo_meses": 6
  }
  ```
- `GET /api/rodizios/pdf/:igreja_id` - Gerar PDF do rodízio
- `DELETE /api/rodizios/:id` - Deletar rodízio
- `DELETE /api/rodizios/igreja/:igreja_id` - Deletar rodízios de uma igreja

### Notificações
- `GET /api/notificacoes` - Listar notificações
- `POST /api/notificacoes/enviar/:rodizio_id` - Enviar notificação manual

## Notificações Automáticas

O sistema verifica diariamente às 10:00 e envia notificações para:
- Organista escalada
- Encarregado local
- Encarregado regional

As notificações são enviadas via webhook configurado em `WEBHOOK_NOTIFICACAO`.

## Webhook de Rodízio

Quando um rodízio é gerado, os dados são enviados para o webhook configurado em `WEBHOOK_URL`:

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

## Próximos Passos

- [ ] Criar interface frontend (React)
- [ ] Adicionar autenticação
- [ ] Melhorar integração com serviços de SMS/WhatsApp
- [ ] Adicionar relatórios e estatísticas
