# Como Forçar Atualização do Sistema

## Problema
Após fazer rebuild, as mudanças podem não aparecer devido a cache do navegador, service worker ou nginx.

## Solução Rápida

### 1. No Servidor (Execute estes comandos):

```bash
# 1. Rebuild do frontend
cd /var/www/gestao-organista
./rebuild-frontend.sh

# 2. Limpar cache do Nginx
sudo rm -rf /var/cache/nginx/*
sudo systemctl reload nginx

# 3. Reiniciar aplicação
pm2 restart gestao-organista-api
```

### 2. No Navegador (Usuário Final):

#### Chrome/Edge:
1. Pressione `Ctrl+Shift+Delete` (Windows) ou `Cmd+Shift+Delete` (Mac)
2. Selecione "Dados de navegação"
3. Marque "Imagens e arquivos em cache"
4. Selecione "Todo o período"
5. Clique em "Limpar dados"

#### Firefox:
1. Pressione `Ctrl+Shift+Delete` (Windows) ou `Cmd+Shift+Delete` (Mac)
2. Selecione "Cache"
3. Clique em "Limpar agora"

#### Desregistrar Service Worker (PWA):
1. Abra DevTools (F12)
2. Vá em "Application" (Chrome) ou "Armazenamento" (Firefox)
3. Clique em "Service Workers"
4. Clique em "Unregister" para cada service worker listado
5. Recarregue a página com `Ctrl+Shift+R` (hard refresh)

### 3. Modo Anônimo (Teste Rápido):
- Abra uma janela anônima/privada
- Acesse o site
- Isso ignora cache e service workers

## Verificar se Atualizou

1. Abra DevTools (F12)
2. Vá em "Network"
3. Marque "Disable cache"
4. Recarregue a página
5. Verifique se os arquivos CSS/JS são carregados com timestamp atual

## Configurações Aplicadas

- ✅ Service Worker configurado para Network First (sempre buscar da rede)
- ✅ Headers anti-cache no servidor para arquivos HTML
- ✅ Nginx configurado para não usar cache em HTML
- ✅ Script de rebuild limpa todos os caches
