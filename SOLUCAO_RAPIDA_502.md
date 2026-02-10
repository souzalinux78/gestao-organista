# 🚨 SOLUÇÃO RÁPIDA - Erro 502 Bad Gateway

## O Problema
O backend Node.js não está respondendo, causando erro 502.

## Solução Rápida (Execute no Servidor)

```bash
cd /var/www/gestao-organista

# Opção 1: Script automático (RECOMENDADO)
chmod +x restaurar-backend.sh
./restaurar-backend.sh

# Opção 2: Manual
npm install helmet express-rate-limit
pm2 restart gestao-organista-api
pm2 logs gestao-organista-api
```

## Verificação Rápida

```bash
# Verificar se está rodando
pm2 status

# Verificar porta
netstat -tlnp | grep 5001

# Testar conexão
curl http://localhost:5001/api/health
```

## Se Ainda Não Funcionar

1. **Ver logs detalhados:**
```bash
pm2 logs gestao-organista-api --lines 50
```

2. **Tentar iniciar manualmente para ver erros:**
```bash
cd /var/www/gestao-organista
node server/index.js
```

3. **Verificar se as dependências estão instaladas:**
```bash
ls node_modules/helmet
ls node_modules/express-rate-limit
```

4. **Se faltar, instalar:**
```bash
npm install
```

## O Que Foi Corrigido

✅ Backend agora funciona **mesmo sem** `helmet` e `express-rate-limit` instalados
✅ Dependências são opcionais (não quebram o sistema)
✅ Scripts de diagnóstico e restauração criados

## Após Restaurar

O sistema voltará a funcionar normalmente. As dependências de segurança serão instaladas automaticamente quando você executar `npm install` ou o script `restaurar-backend.sh`.
