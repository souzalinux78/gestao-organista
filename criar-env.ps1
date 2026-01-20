# Script PowerShell para criar arquivo .env
# Execute: .\criar-env.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Criando arquivo .env" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se .env já existe
if (Test-Path .env) {
    Write-Host "⚠️  O arquivo .env já existe!" -ForegroundColor Yellow
    $resposta = Read-Host "Deseja sobrescrever? (S/N)"
    if ($resposta -ne "S" -and $resposta -ne "s") {
        Write-Host "Operação cancelada." -ForegroundColor Yellow
        exit
    }
}

# Verificar se .env.example existe
if (-not (Test-Path .env.example)) {
    Write-Host "❌ Arquivo .env.example não encontrado!" -ForegroundColor Red
    Write-Host "Criando arquivo .env.example primeiro..." -ForegroundColor Yellow
    
    # Criar .env.example básico
    @"
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
"@ | Out-File -FilePath .env.example -Encoding UTF8
    Write-Host "✅ Arquivo .env.example criado!" -ForegroundColor Green
}

# Copiar .env.example para .env
Copy-Item .env.example .env -Force

Write-Host "✅ Arquivo .env criado com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Próximos passos:" -ForegroundColor Cyan
Write-Host "1. Edite o arquivo .env e configure:" -ForegroundColor White
Write-Host "   - DB_PASSWORD (senha do MySQL)" -ForegroundColor Gray
Write-Host "   - JWT_SECRET (gere uma chave aleatória)" -ForegroundColor Gray
Write-Host "   - SESSION_SECRET (gere uma chave aleatória)" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Para gerar chaves secretas, execute:" -ForegroundColor White
Write-Host "   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Abra o arquivo .env em um editor de texto e ajuste os valores." -ForegroundColor White
Write-Host ""

# Perguntar se deseja abrir o arquivo
$abrir = Read-Host "Deseja abrir o arquivo .env agora? (S/N)"
if ($abrir -eq "S" -or $abrir -eq "s") {
    notepad .env
}

Write-Host ""
Write-Host "✅ Concluído!" -ForegroundColor Green
