# 🔧 Solucionar Problema do Menu Não Aparecer

## 🔍 Diagnóstico

O menu só aparece se:
1. O usuário estiver logado (token válido no localStorage)
2. O frontend estiver buildado corretamente
3. Os arquivos estáticos estiverem sendo servidos pelo Nginx

## ✅ Soluções

### 1. Rebuild do Frontend (Mais Comum)

```bash
cd /var/www/gestao-organista
chmod +x rebuild-frontend.sh
./rebuild-frontend.sh
```

Ou manualmente:
```bash
cd /var/www/gestao-organista/client
rm -rf build node_modules/.cache
npm install
npm run build
cd ..
sudo systemctl reload nginx
```

### 2. Verificar se o Usuário Está Logado

**No navegador:**
1. Abra o Console do Desenvolvedor (F12)
2. Vá na aba "Application" (Chrome) ou "Storage" (Firefox)
3. Verifique se existe:
   - `localStorage.getItem('token')` - deve ter um valor
   - `localStorage.getItem('user')` - deve ter um objeto JSON

**Se não existir:**
- Faça logout e login novamente
- Limpe o cache do navegador

### 3. Verificar Build do Frontend

```bash
# Verificar se o build existe
ls -la /var/www/gestao-organista/client/build

# Verificar se o index.html existe
ls -la /var/www/gestao-organista/client/build/index.html

# Verificar tamanho do build
du -sh /var/www/gestao-organista/client/build
```

### 4. Verificar Nginx

```bash
# Verificar configuração do Nginx
sudo nginx -t

# Verificar se está servindo os arquivos corretos
sudo cat /etc/nginx/sites-available/gestaoorganista.automatizeonline.com.br | grep root

# Deve mostrar:
# root /var/www/gestao-organista/client/build;
```

### 5. Limpar Cache do Navegador

**Chrome/Edge:**
- `Ctrl + Shift + R` (Windows/Linux)
- `Cmd + Shift + R` (Mac)

**Firefox:**
- `Ctrl + Shift + R` (Windows/Linux)
- `Cmd + Shift + R` (Mac)

Ou:
1. Abra DevTools (F12)
2. Clique com botão direito no botão de recarregar
3. Selecione "Esvaziar cache e atualizar forçadamente"

### 6. Verificar Logs do Nginx

```bash
# Ver erros do Nginx
sudo tail -f /var/log/nginx/gestaoorganista-error.log

# Ver acessos
sudo tail -f /var/log/nginx/gestaoorganista-access.log
```

### 7. Verificar Console do Navegador

**No navegador (F12):**
1. Abra o Console
2. Procure por erros em vermelho
3. Erros comuns:
   - `Failed to load resource` - arquivo não encontrado
   - `404 Not Found` - rota não encontrada
   - `CORS error` - problema de CORS

## 🔄 Processo Completo de Correção

```bash
# 1. Rebuild do frontend
cd /var/www/gestao-organista
./rebuild-frontend.sh

# 2. Verificar build
ls -la client/build

# 3. Recarregar Nginx
sudo systemctl reload nginx

# 4. Limpar cache do navegador e testar
```

## 🧪 Testar se Está Funcionando

1. **Acesse:** `https://gestaoorganista.automatizeonline.com.br`
2. **Faça login** com:
   - Email: `admin@gestao.com`
   - Senha: `admin123`
3. **Verifique se o menu aparece** no topo da página
4. **Teste os links** do menu

## ⚠️ Problemas Comuns

### Menu não aparece mesmo logado

**Causa:** Frontend não buildado ou build desatualizado

**Solução:**
```bash
cd /var/www/gestao-organista/client
npm run build
```

### Menu aparece mas links não funcionam

**Causa:** Problema com React Router

**Solução:**
- Verificar se o Nginx está configurado com `try_files $uri $uri/ /index.html;`
- Rebuild do frontend

### Menu aparece mas CSS está quebrado

**Causa:** Arquivos CSS não carregados

**Solução:**
- Verificar se `build/static/css/` existe
- Rebuild do frontend
- Limpar cache do navegador

## 📝 Checklist

- [ ] Frontend buildado (`client/build` existe)
- [ ] Nginx configurado corretamente
- [ ] Nginx recarregado
- [ ] Cache do navegador limpo
- [ ] Usuário logado (token no localStorage)
- [ ] Console do navegador sem erros
- [ ] Menu aparece após login

---

**✅ Menu deve aparecer após seguir estes passos!**
