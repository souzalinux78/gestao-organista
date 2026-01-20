# 🖼️ Passo a Passo: Adicionar Logos e Ícones

## 📁 Onde Colocar os Arquivos

### Pasta: `client/public/`

Coloque todos os arquivos na pasta:

```
/var/www/gestao-organista/client/public/
```

## 📋 Arquivos Necessários

### 1. Logo Principal
- **Nome:** `logo.png`
- **Tamanho recomendado:** 200x200px ou 300x300px
- **Formato:** PNG com fundo transparente
- **Onde aparece:** Tela de login e header do sistema

### 2. Favicon (Ícone da Aba)
- **Nome:** `favicon.ico`
- **Tamanho:** 32x32px ou 16x16px
- **Formato:** ICO ou PNG
- **Onde aparece:** Aba do navegador

## 🔧 Passo a Passo

### 1. Copiar Arquivos para o Servidor

**Opção A: Via SCP (do seu computador)**
```bash
scp logo.png usuario@seu-servidor:/var/www/gestao-organista/client/public/
scp favicon.ico usuario@seu-servidor:/var/www/gestao-organista/client/public/
```

**Opção B: Via SFTP/FTP**
- Conecte ao servidor
- Navegue até: `/var/www/gestao-organista/client/public/`
- Faça upload dos arquivos

**Opção C: Diretamente no Servidor**
```bash
# No servidor
cd /var/www/gestao-organista/client/public

# Copiar arquivos (ajuste o caminho)
cp /caminho/do/seu/logo.png ./logo.png
cp /caminho/do/seu/favicon.ico ./favicon.ico
```

### 2. Verificar se os Arquivos Foram Copiados

```bash
cd /var/www/gestao-organista/client/public
ls -la
# Deve mostrar: logo.png e favicon.ico
```

### 3. Rebuild do Frontend

```bash
cd /var/www/gestao-organista
./rebuild-frontend.sh
```

Ou manualmente:
```bash
cd /var/www/gestao-organista/client
npm run build
cd ..
sudo systemctl reload nginx
```

### 4. Limpar Cache do Navegador

No navegador:
- `Ctrl + Shift + R` (Windows/Linux)
- `Cmd + Shift + R` (Mac)

## ✅ Verificar se Está Funcionando

1. **Favicon na aba:** Deve aparecer o ícone na aba do navegador
2. **Logo no login:** Deve aparecer acima do título "Sistema de Gestão de Organistas"
3. **Logo no header:** Deve aparecer ao lado do título quando logado

## 📐 Tamanhos Recomendados

| Arquivo | Tamanho | Formato | Onde Aparece |
|---------|---------|---------|--------------|
| `logo.png` | 200x200px | PNG transparente | Login e Header |
| `favicon.ico` | 32x32px | ICO | Aba do navegador |
| `apple-touch-icon.png` | 180x180px | PNG | iOS (opcional) |

## 🎨 Dicas de Design

- **Logo para login:** Use fundo transparente ou branco
- **Logo para header:** Pode ser versão menor (150x50px)
- **Cores:** Prefira cores que combinem com o tema (dourado e azul)
- **Formato:** PNG para transparência, SVG para escalabilidade

## 🔄 Atualizar Logo Existente

Se você já tem um logo e quer trocar:

```bash
# 1. Substituir arquivo
cd /var/www/gestao-organista/client/public
cp novo-logo.png logo.png

# 2. Rebuild
cd /var/www/gestao-organista
./rebuild-frontend.sh

# 3. Limpar cache do navegador
```

## ⚠️ Problemas Comuns

### Logo não aparece

**Causa:** Arquivo não encontrado ou caminho incorreto

**Solução:**
```bash
# Verificar se o arquivo existe
ls -la /var/www/gestao-organista/client/public/logo.png

# Verificar permissões
chmod 644 /var/www/gestao-organista/client/public/logo.png
```

### Logo aparece muito grande/pequeno

**Solução:** Ajuste o tamanho do arquivo ou edite o CSS:
- Login: `client/src/pages/Login.css` (classe `.login-logo img`)
- Header: `client/src/App.js` (style do img)

### Favicon não atualiza

**Solução:**
1. Limpar cache do navegador completamente
2. Verificar se o arquivo está em `client/public/favicon.ico`
3. Rebuild do frontend

## 📝 Checklist

- [ ] Arquivo `logo.png` copiado para `client/public/`
- [ ] Arquivo `favicon.ico` copiado para `client/public/`
- [ ] Frontend rebuildado
- [ ] Nginx recarregado
- [ ] Cache do navegador limpo
- [ ] Logo aparece no login
- [ ] Logo aparece no header
- [ ] Favicon aparece na aba

---

**✅ Logos e ícones configurados!**
