# Comandos para atualizar o GitHub (dev) e rodar em produção

## 1. Na máquina de desenvolvimento (Windows)

Execute no diretório raiz do projeto (`gestao-organista`):

```powershell
# Ver o que foi alterado
git status

# Adicionar todos os arquivos alterados (ou use caminhos específicos)
git add .

# Commit com mensagem descritiva
git commit -m "Descrição das alterações"

# Enviar para o GitHub (ajuste 'main' se sua branch principal for outra, ex: master)
git push origin main
```

Se o repositório ainda não tiver `origin` configurado ou você usar outra branch:

```powershell
git remote -v
git push origin <sua-branch>
```

---

## 2. No servidor de produção (Linux)

Conecte-se ao servidor (SSH) e vá até o diretório da aplicação (ex.: `/var/www/gestao-organista`).

```bash
cd /var/www/gestao-organista

# Atualizar código do GitHub
git pull origin main

# Deploy completo (frontend + backend) — recomendado
./deploy.sh
```

O script `deploy.sh` faz:

- **Frontend:** limpa cache, `npm install` no client, `npm run build`, reload do Nginx.
- **Backend:** `npm install` na raiz, reinício do PM2 (`gestao-organista-api`), health check em `http://localhost:5001/api/health`.

**Alternativa manual** (sem usar o script):

```bash
cd /var/www/gestao-organista
git pull origin main

npm install
cd client && npm install && npm run build && cd ..

pm2 restart gestao-organista-api
sudo systemctl reload nginx
```

---

## Resumo do fluxo

1. **Dev:** `git add .` → `git commit -m "..."` → `git push origin main`
2. **Produção:** `git pull origin main` → `./deploy.sh`

---

## Observações

- O `ecosystem.config.js` usa `PORT: 5001`; confira se o Nginx faz proxy para essa porta (e o `.env` em produção).
- O `deploy.sh` **não altera** o arquivo `.env`.
- Após o deploy, pode ser necessário hard refresh (Ctrl+Shift+R) ou limpar cache do navegador para ver o frontend atualizado.
