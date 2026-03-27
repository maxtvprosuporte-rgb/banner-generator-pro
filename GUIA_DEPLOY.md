# 🚀 Guia Rápido de Deploy - Banner Generator Pro v2.0

## 📁 Arquivos para Copiar do /app

Copie estes arquivos para seu repositório GitHub:

```
/app/package.json          → /package.json
/app/server.js             → /server.js
/app/index.html            → /index.html
/app/Dockerfile            → /Dockerfile (NOVO)
/app/.env.example          → /.env.example
/app/README_VIDEO.md       → /README_VIDEO.md
```

## 🔧 Setup no Render

### Opção 1: Com Dockerfile (RECOMENDADO ⭐)

1. **No GitHub:**
   - Faça commit de todos os arquivos acima
   - Certifique-se que o `Dockerfile` está na raiz

2. **No Render Dashboard:**
   - Vá em **Settings** > **Build & Deploy**
   - Altere **Environment** para: `Docker`
   - Build Command: (deixe vazio, o Docker cuida)
   - Start Command: (deixe vazio, definido no Dockerfile)

3. **Variáveis de Ambiente:**
   ```
   TMDB_API_KEY=ed3d0c9bfea7f601924b810c07471202
   FOOTBALL_API_KEY=8a0cf7d6b04923d327c7c92f46aa75f7
   ```

4. **Deploy:**
   - Clique em **Manual Deploy** > **Deploy latest commit**
   - Aguarde ~5 minutos para build

### Opção 2: Sem Docker (Pode ter problemas com FFmpeg)

1. **Build Command:**
   ```bash
   npm install
   ```

2. **Start Command:**
   ```bash
   node server.js
   ```

3. **Adicionar FFmpeg (pode não funcionar no Free Tier):**
   - Render Free não suporta bem buildpacks customizados
   - **Use Opção 1 (Docker) para garantir funcionamento**

## ⚡ Teste Local (Opcional)

```bash
# Instalar dependências
npm install

# Criar arquivo .env
cp .env.example .env

# Instalar FFmpeg (se não tiver)
# Ubuntu/Debian:
sudo apt-get install ffmpeg

# macOS:
brew install ffmpeg

# Windows:
# Baixe de https://ffmpeg.org/download.html

# Rodar servidor
npm start

# Abrir no navegador
http://localhost:3000
```

## 🎬 Como Usar

1. Abra a aplicação
2. Clique em **"Trailers em Vídeo"** (Box 3 roxo)
3. Busque um filme ou série
4. Sistema seleciona automaticamente o melhor trailer (PT-BR dublado)
5. Escolha formato: **16:9 (horizontal)** ou **9:16 (vertical/story)**
6. Clique em **"GERAR TRAILER MP4"**
7. Download iniciará automaticamente

## ⚠️ Limitações Conhecidas

### Render Free Tier:
- ⏱️ **Conversão lenta**: 5-10 minutos para vídeos curtos
- 💾 **Memória limitada**: 512MB pode causar crashes em vídeos longos
- ⏰ **Timeout**: Requisições longas podem falhar
- 🔄 **Cold Start**: Primeira requisição pode demorar ~30s

### Soluções:
1. **Limitar duração**: Cortar vídeos para 30-60 segundos
2. **Reduzir qualidade**: Mudar preset FFmpeg para "ultrafast"
3. **Upgrade para Render Starter** ($7/mês) - mais CPU e memória
4. **Usar serviço externo**: Cloudinary, Mux, etc. para conversão

## 🔍 Verificar se Funcionou

### 1. Health Check
```
https://seu-app.onrender.com/health
```

Deve retornar:
```json
{
  "status": "OK",
  "features": ["football", "movies", "videos"]
}
```

### 2. Teste de Trailer
```
https://seu-app.onrender.com/api/video/best-trailer/movie/550
```

Deve retornar dados do trailer de Fight Club.

### 3. Logs do Render
Verifique se aparece:
```
🚀 Servidor rodando na porta 3000
📦 Recursos: Futebol, Filmes/Séries, Trailers
```

## 🐛 Problemas Comuns

### "Module not found: fluent-ffmpeg"
→ Execute `npm install` novamente

### "ffmpeg not found"
→ Use o Dockerfile (Opção 1)

### "ytdl-core: Unable to extract video info"
→ Vídeo pode estar bloqueado geograficamente ou ter DRM

### Timeout durante geração
→ Vídeo muito longo. Considere adicionar limite de duração.

## 📊 Estrutura de Prioridade

```javascript
Priority 1: 🥇 PT-BR Dublado
  ├─ Language: "pt"
  └─ Name: contém "dublado" ou "legendado"

Priority 2: 🥈 PT-BR
  └─ Language: "pt"

Priority 3: 🥉 Original
  └─ Qualquer outro idioma
```

## 📞 Precisa de Ajuda?

1. Verifique os **logs do Render**
2. Teste os **endpoints da API** separadamente
3. Verifique o **console do navegador** (F12)
4. Confira a aba **Network** para ver requisições

---

✅ **Tudo pronto!** Seu gerador de trailers está funcionando.

🎉 **Boa sorte com seu projeto!**
