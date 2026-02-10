#!/bin/bash
# Script Bash para criar arquivo .env
# Execute: chmod +x criar-env.sh && ./criar-env.sh

echo "========================================"
echo "  Criando arquivo .env"
echo "========================================"
echo ""

# Verificar se .env já existe
if [ -f .env ]; then
    echo "⚠️  O arquivo .env já existe!"
    read -p "Deseja sobrescrever? (S/N): " resposta
    if [ "$resposta" != "S" ] && [ "$resposta" != "s" ]; then
        echo "Operação cancelada."
        exit
    fi
fi

# Verificar se .env.example existe
if [ ! -f .env.example ]; then
    echo "❌ Arquivo .env.example não encontrado!"
    echo "Criando arquivo .env.example primeiro..."
    
    # Criar .env.example básico
    cat > .env.example << 'EOF'
# Porta do servidor
PORT=5000

# Configurações do MySQL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=FLoc25GD!
DB_NAME=gestao_organista

# URL do frontend (para CORS)
CLIENT_URL=http://localhost:3000

# JWT Secret (gere uma chave forte)
JWT_SECRET=sua-chave-secreta-jwt-aqui-gere-uma-aleatoria-longa

# Session Secret (gere uma chave forte)
SESSION_SECRET=sua-chave-secreta-session-aqui-gere-uma-aleatoria-longa

# URL do webhook para envio de rodízios gerados
WEBHOOK_URL=https://webhook.automatizeonline.com.br/webhook/organista

# URL do webhook para envio de notificações (SMS/WhatsApp)
WEBHOOK_NOTIFICACAO=https://webhook.automatizeonline.com.br/webhook/organista

# Ambiente
NODE_ENV=development
EOF
    
    echo "✅ Arquivo .env.example criado!"
fi

# Copiar .env.example para .env
cp .env.example .env

echo "✅ Arquivo .env criado com sucesso!"
echo ""
echo "📝 Próximos passos:"
echo "1. Edite o arquivo .env e configure:"
echo "   - DB_PASSWORD (senha do MySQL)"
echo "   - JWT_SECRET (gere uma chave aleatória)"
echo "   - SESSION_SECRET (gere uma chave aleatória)"
echo ""
echo "2. Para gerar chaves secretas, execute:"
echo "   openssl rand -base64 32"
echo ""
echo "3. Abra o arquivo .env em um editor de texto e ajuste os valores."
echo ""

# Perguntar se deseja abrir o arquivo
read -p "Deseja abrir o arquivo .env agora? (S/N): " abrir
if [ "$abrir" = "S" ] || [ "$abrir" = "s" ]; then
    if command -v nano &> /dev/null; then
        nano .env
    elif command -v vim &> /dev/null; then
        vim .env
    else
        echo "Editor de texto não encontrado. Abra o arquivo .env manualmente."
    fi
fi

echo ""
echo "✅ Concluído!"
