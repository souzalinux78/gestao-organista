# 🖼️ Como Adicionar Logos e Ícones

## 📁 Onde Colocar os Arquivos

### Pasta: `client/public/`

Coloque todos os arquivos estáticos (logos, ícones, imagens) na pasta:

```
gestao-organista/client/public/
```

**Estrutura recomendada:**
```
client/public/
├── logo.png          (Logo principal)
├── logo-white.png    (Logo para fundo escuro)
├── favicon.ico       (Ícone da aba do navegador)
├── favicon-16x16.png
├── favicon-32x32.png
└── apple-touch-icon.png
```

## 📝 Como Usar no Código

### 1. No HTML (index.html)

```html
<link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
<link rel="apple-touch-icon" href="%PUBLIC_URL%/apple-touch-icon.png" />
```

### 2. No React (JSX)

```jsx
// Importar imagem
import logo from '../assets/logo.png';

// Ou usar caminho público
<img src="/logo.png" alt="Logo" />
<img src={process.env.PUBLIC_URL + '/logo.png'} alt="Logo" />
```

### 3. No CSS

```css
background-image: url('/logo.png');
```

## 🔧 Passo a Passo

### 1. Copiar Arquivos

```bash
# No servidor ou localmente
cd gestao-organista/client/public

# Copiar seus arquivos
# Exemplo:
cp /caminho/do/seu/logo.png ./logo.png
cp /caminho/do/seu/favicon.ico ./favicon.ico
```

### 2. Atualizar index.html

Edite `client/public/index.html` e adicione:

```html
<link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
<link rel="apple-touch-icon" href="%PUBLIC_URL%/logo.png" />
```

### 3. Rebuild do Frontend

```bash
cd /var/www/gestao-organista
./rebuild-frontend.sh
```

## 📐 Tamanhos Recomendados

- **Logo principal:** 200x200px ou 300x300px (PNG com fundo transparente)
- **Favicon:** 32x32px ou 16x16px (ICO ou PNG)
- **Apple Touch Icon:** 180x180px (PNG)
- **Logo para header:** 150x50px ou proporcional

## ✅ Checklist

- [ ] Arquivos copiados para `client/public/`
- [ ] `index.html` atualizado com favicon
- [ ] Componentes atualizados para usar logo
- [ ] Frontend rebuildado
- [ ] Testado no navegador

---

**✅ Logos e ícones prontos para uso!**
