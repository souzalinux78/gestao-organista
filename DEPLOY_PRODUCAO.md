# Guia Completo de Deploy em Produção

## 📋 Índice
1. [Pré-requisitos](#pré-requisitos)
2. [Instalação do MySQL](#instalação-do-mysql)
3. [Configuração do Banco de Dados](#configuração-do-banco-de-dados)
4. [Instalação do Node.js e Dependências](#instalação-do-nodejs-e-dependências)
5. [Configuração do Aplicativo](#configuração-do-aplicativo)
6. [Configuração do Nginx](#configuração-do-nginx)
7. [Instalação do Certificado SSL com Certbot](#instalação-do-certificado-ssl-com-certbot)
8. [Configuração do PM2 (Gerenciador de Processos)](#configuração-do-pm2-gerenciador-de-processos)
9. [Configuração do Firewall](#configuração-do-firewall)
10. [Testes e Verificação](#testes-e-verificação)
11. [Manutenção e Monitoramento](#manutenção-e-monitoramento)

---

## Pré-requisitos

- Servidor Linux (Ubuntu 20.04/22.04 ou Debian 11/12 recomendado)
- Acesso root ou usuário com sudo
- Domínio `gestaoorganista.automatizeonline.com.br` apontando para o IP do servidor
- Porta 80 e 443 liberadas no firewall

---

## 1. Instalação do MySQL

### 1.1. Instalar MySQL Server

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar MySQL Server
sudo apt install mysql-server -y

# Iniciar e habilitar MySQL
sudo systemctl start mysql
sudo systemctl enable mysql

# Verificar status
sudo systemctl status mysql
```

### 1.2. Configurar Segurança do MySQL

```bash
# Executar script de segurança
sudo mysql_secure_installation
```

**Durante a configuração:**
- Definir senha para root: `FLoc25GD!` (ou outra senha forte)
- Remover usuários anônimos: **Y**
- Desabilitar login remoto do root: **Y**
- Remover banco de teste: **Y**
- Recarregar privilégios: **Y**

### 1.3. Criar Usuário e Banco de Dados

```bash
# Acessar MySQL
sudo mysql -u root -p
# Digite a senha: FLoc25GD!
```

**No prompt do MySQL, execute:**

```sql
-- Criar banco de dados
CREATE DATABASE IF NOT EXISTS gestao_organista 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Criar usuário (substitua 'senha_forte_aqui' por uma senha segura)
CREATE USER IF NOT EXISTS 'gestao_user'@'localhost' IDENTIFIED BY 'senha_forte_aqui';

-- Conceder privilégios
GRANT ALL PRIVILEGES ON gestao_organista.* TO 'gestao_user'@'localhost';

-- Aplicar mudanças
FLUSH PRIVILEGES;

-- Verificar
SHOW DATABASES;
SELECT user, host FROM mysql.user WHERE user = 'gestao_user';

-- Sair
EXIT;
```

### 1.4. Configurar MySQL para Conexões Remotas (Opcional)

Se precisar acessar o MySQL remotamente:

```bash
# Editar configuração
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf
```

**Alterar a linha:**
```ini
bind-address = 127.0.0.1
```

**Para:**
```ini
bind-address = 0.0.0.0
```

**Reiniciar MySQL:**
```bash
sudo systemctl restart mysql
```

**⚠️ IMPORTANTE:** Se habilitar acesso remoto, configure firewall adequadamente!

---

## 2. Configuração do Banco de Dados

O banco será criado automaticamente na primeira execução do servidor, mas você pode verificar:

```bash
# Verificar se o banco existe
sudo mysql -u root -p -e "SHOW DATABASES LIKE 'gestao_organista';"
```

---

## 3. Instalação do Node.js e Dependências

### 3.1. Instalar Node.js (versão 18.x ou superior)

```bash
# Instalar Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalação
node --version
npm --version
```

### 3.2. Instalar PM2 (Gerenciador de Processos)

```bash
sudo npm install -g pm2
```

### 3.3. Preparar Diretório da Aplicação

```bash
# Criar diretório (ajuste o caminho conforme necessário)
sudo mkdir -p /var/www/gestao-organista
sudo chown -R $USER:$USER /var/www/gestao-organista

# Ou usar diretório home
mkdir -p ~/gestao-organista
cd ~/gestao-organista
```

### 3.4. Fazer Upload do Código

**Opção 1: Via Git (recomendado)**
```bash
cd /var/www/gestao-organista
git clone <seu-repositorio> .
```

**Opção 2: Via SCP/SFTP**
```bash
# Do seu computador local
scp -r gestao-organista/* usuario@seu-servidor:/var/www/gestao-organista/
```

### 3.5. Instalar Dependências

```bash
cd /var/www/gestao-organista

# Instalar dependências do backend
npm install

# Instalar dependências do frontend
cd client
npm install
npm run build
cd ..
```

---

## 4. Configuração do Aplicativo

### 4.1. Criar Arquivo .env

```bash
cd /var/www/gestao-organista
nano .env
```

**Conteúdo do arquivo `.env`:**

```env
# Porta do servidor (será usado pelo PM2)
PORT=5000

# Configurações do MySQL
DB_HOST=localhost
DB_USER=gestao_user
DB_PASSWORD=senha_forte_aqui
DB_NAME=gestao_organista

# URL do frontend (para CORS)
CLIENT_URL=https://gestaoorganista.automatizeonline.com.br

# JWT Secret (gere uma chave forte)
JWT_SECRET=SUA_CHAVE_JWT_SUPER_SECRETA_AQUI_GERE_UMA_ALEATORIA_LONGA
SESSION_SECRET=SUA_CHAVE_SESSION_SUPER_SECRETA_AQUI_GERE_UMA_ALEATORIA_LONGA

# URL do webhook para envio de rodízios gerados
WEBHOOK_URL=https://webhook.automatizeonline.com.br/webhook/organista

# URL do webhook para envio de notificações (SMS/WhatsApp)
WEBHOOK_NOTIFICACAO=https://webhook.automatizeonline.com.br/webhook/organista

# Ambiente
NODE_ENV=production
```

**Gerar chaves secretas:**
```bash
# Gerar JWT_SECRET
openssl rand -base64 32

# Gerar SESSION_SECRET
openssl rand -base64 32
```

### 4.2. Criar Usuário Admin

```bash
cd /var/www/gestao-organista
node server/scripts/createAdmin.js
```

**Siga as instruções para criar o primeiro usuário administrador.**

---

## 5. Configuração do Nginx

### 5.1. Instalar Nginx

```bash
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 5.2. Criar Configuração do Site

```bash
sudo nano /etc/nginx/sites-available/gestaoorganista.automatizeonline.com.br
```

**Conteúdo do arquivo:**

```nginx
# Redirecionar HTTP para HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name gestaoorganista.automatizeonline.com.br;
    
    # Redirecionar para HTTPS (será configurado pelo Certbot)
    return 301 https://$server_name$request_uri;
}

# Configuração HTTPS (será atualizada pelo Certbot)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name gestaoorganista.automatizeonline.com.br;

    # Certificados SSL (serão configurados pelo Certbot)
    # ssl_certificate /etc/letsencrypt/live/gestaoorganista.automatizeonline.com.br/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/gestaoorganista.automatizeonline.com.br/privkey.pem;
    # include /etc/letsencrypt/options-ssl-nginx.conf;
    # ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Logs
    access_log /var/log/nginx/gestaoorganista-access.log;
    error_log /var/log/nginx/gestaoorganista-error.log;

    # Tamanho máximo de upload
    client_max_body_size 10M;

    # Proxy para API (backend)
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Servir arquivos estáticos do React (frontend)
    location / {
        root /var/www/gestao-organista/client/build;
        try_files $uri $uri/ /index.html;
        
        # Cache para arquivos estáticos
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Health check
    location /api/health {
        proxy_pass http://localhost:5000/api/health;
        access_log off;
    }
}
```

### 5.3. Habilitar Site

```bash
# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/gestaoorganista.automatizeonline.com.br /etc/nginx/sites-enabled/

# Remover configuração padrão (opcional)
sudo rm /etc/nginx/sites-enabled/default

# Testar configuração
sudo nginx -t

# Se tudo estiver OK, recarregar Nginx
sudo systemctl reload nginx
```

---

## 6. Instalação do Certificado SSL com Certbot

### 6.1. Instalar Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 6.2. Obter Certificado SSL

```bash
# Obter certificado e configurar automaticamente o Nginx
sudo certbot --nginx -d gestaoorganista.automatizeonline.com.br

# Durante a configuração:
# - Email: informe seu email para notificações
# - Aceitar termos: Y
# - Compartilhar email: N (ou Y, conforme preferência)
# - Redirecionar HTTP para HTTPS: 2 (recomendado)
```

### 6.3. Verificar Renovação Automática

```bash
# Testar renovação automática
sudo certbot renew --dry-run

# Verificar status do certificado
sudo certbot certificates
```

### 6.4. Configurar Renovação Automática

O Certbot cria automaticamente um cron job, mas você pode verificar:

```bash
# Verificar cron job
sudo systemctl status certbot.timer

# Ou verificar manualmente
sudo crontab -l | grep certbot
```

**O certificado será renovado automaticamente antes de expirar (30 dias antes).**

---

## 7. Configuração do PM2 (Gerenciador de Processos)

### 7.1. Criar Arquivo de Configuração do PM2

```bash
cd /var/www/gestao-organista
nano ecosystem.config.js
```

**Conteúdo:**

```javascript
module.exports = {
  apps: [{
    name: 'gestao-organista-api',
    script: './server/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    // Reiniciar se o servidor cair
    min_uptime: '10s',
    max_restarts: 10
  }]
};
```

### 7.2. Criar Diretório de Logs

```bash
mkdir -p /var/www/gestao-organista/logs
```

### 7.3. Iniciar Aplicação com PM2

```bash
cd /var/www/gestao-organista

# Iniciar aplicação
pm2 start ecosystem.config.js

# Salvar configuração do PM2
pm2 save

# Configurar PM2 para iniciar no boot
pm2 startup
# Execute o comando que será exibido (algo como: sudo env PATH=... pm2 startup systemd -u usuario --hp /home/usuario)
```

### 7.4. Comandos Úteis do PM2

```bash
# Ver status
pm2 status

# Ver logs
pm2 logs gestao-organista-api

# Reiniciar
pm2 restart gestao-organista-api

# Parar
pm2 stop gestao-organista-api

# Monitorar
pm2 monit
```

---

## 8. Configuração do Firewall

### 8.1. Configurar UFW (Uncomplicated Firewall)

```bash
# Verificar status
sudo ufw status

# Permitir SSH (IMPORTANTE: faça isso antes de habilitar o firewall!)
sudo ufw allow 22/tcp

# Permitir HTTP e HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Habilitar firewall
sudo ufw enable

# Verificar regras
sudo ufw status verbose
```

### 8.2. Se Usar Cloud Provider (AWS, DigitalOcean, etc.)

**Configure o Security Group/Firewall do provedor:**
- Porta 22 (SSH): Permitir apenas seu IP
- Porta 80 (HTTP): Permitir de qualquer lugar
- Porta 443 (HTTPS): Permitir de qualquer lugar
- Porta 5000: **NÃO** expor publicamente (apenas localhost)

---

## 9. Testes e Verificação

### 9.1. Verificar Status dos Serviços

```bash
# MySQL
sudo systemctl status mysql

# Nginx
sudo systemctl status nginx

# PM2
pm2 status

# Certbot
sudo systemctl status certbot.timer
```

### 9.2. Verificar Logs

```bash
# Logs do Nginx
sudo tail -f /var/log/nginx/gestaoorganista-access.log
sudo tail -f /var/log/nginx/gestaoorganista-error.log

# Logs do PM2
pm2 logs gestao-organista-api

# Logs do MySQL
sudo tail -f /var/log/mysql/error.log
```

### 9.3. Testar Aplicação

```bash
# Testar API localmente
curl http://localhost:5000/api/health

# Testar via domínio
curl https://gestaoorganista.automatizeonline.com.br/api/health
```

### 9.4. Verificar Certificado SSL

```bash
# Verificar certificado
echo | openssl s_client -servername gestaoorganista.automatizeonline.com.br -connect gestaoorganista.automatizeonline.com.br:443 2>/dev/null | openssl x509 -noout -dates

# Ou usar ferramenta online
# https://www.ssllabs.com/ssltest/analyze.html?d=gestaoorganista.automatizeonline.com.br
```

### 9.5. Acessar Aplicação

Abra no navegador:
```
https://gestaoorganista.automatizeonline.com.br
```

---

## 10. Manutenção e Monitoramento

### 10.1. Atualizar Aplicação

```bash
cd /var/www/gestao-organista

# Fazer backup (recomendado)
cp -r . ../gestao-organista-backup-$(date +%Y%m%d)

# Atualizar código (se usar Git)
git pull origin main

# Instalar novas dependências
npm install
cd client && npm install && npm run build && cd ..

# Reiniciar aplicação
pm2 restart gestao-organista-api
```

### 10.2. Backup do Banco de Dados

```bash
# Criar script de backup
nano /usr/local/bin/backup-gestao-organista.sh
```

**Conteúdo:**

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/gestao-organista"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="gestao_organista"
DB_USER="gestao_user"
DB_PASS="senha_forte_aqui"

mkdir -p $BACKUP_DIR

# Backup do banco
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

# Compactar
gzip $BACKUP_DIR/backup_$DATE.sql

# Manter apenas últimos 7 dias
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "Backup criado: backup_$DATE.sql.gz"
```

**Tornar executável e agendar:**

```bash
sudo chmod +x /usr/local/bin/backup-gestao-organista.sh

# Agendar backup diário às 2h da manhã
sudo crontab -e
# Adicionar linha:
# 0 2 * * * /usr/local/bin/backup-gestao-organista.sh
```

### 10.3. Monitoramento

```bash
# Monitorar recursos do sistema
htop

# Monitorar espaço em disco
df -h

# Monitorar uso de memória
free -h

# Ver processos do Node.js
pm2 monit
```

---

## 11. Solução de Problemas Comuns

### Problema: Aplicação não inicia

```bash
# Verificar logs
pm2 logs gestao-organista-api --lines 50

# Verificar se a porta está em uso
sudo netstat -tulpn | grep 5000

# Verificar variáveis de ambiente
pm2 env gestao-organista-api
```

### Problema: Erro de conexão com MySQL

```bash
# Testar conexão
mysql -u gestao_user -p gestao_organista

# Verificar se MySQL está rodando
sudo systemctl status mysql

# Verificar logs do MySQL
sudo tail -f /var/log/mysql/error.log
```

### Problema: Certificado SSL não renova

```bash
# Forçar renovação
sudo certbot renew --force-renewal

# Verificar logs
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

### Problema: Nginx retorna 502 Bad Gateway

```bash
# Verificar se a aplicação está rodando
pm2 status

# Verificar logs do Nginx
sudo tail -f /var/log/nginx/gestaoorganista-error.log

# Testar configuração do Nginx
sudo nginx -t
```

---

## 12. Checklist Final

- [ ] MySQL instalado e configurado
- [ ] Banco de dados criado
- [ ] Node.js e PM2 instalados
- [ ] Aplicação instalada e dependências instaladas
- [ ] Arquivo `.env` configurado
- [ ] Usuário admin criado
- [ ] Nginx instalado e configurado
- [ ] Certificado SSL instalado
- [ ] PM2 configurado e aplicação rodando
- [ ] Firewall configurado
- [ ] Backup automático configurado
- [ ] Aplicação acessível via HTTPS
- [ ] Testes realizados com sucesso

---

## 📞 Suporte

Em caso de problemas, verifique:
1. Logs do PM2: `pm2 logs gestao-organista-api`
2. Logs do Nginx: `/var/log/nginx/gestaoorganista-error.log`
3. Logs do MySQL: `/var/log/mysql/error.log`
4. Status dos serviços: `sudo systemctl status nginx mysql`

---

**✅ Sistema pronto para produção!**
