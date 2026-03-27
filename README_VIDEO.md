# Banner Generator Pro - Atualização Box 3 (Gerador de Vídeo)

## 🎯 O que foi implementado

### ✅ Novas Funcionalidades

1. **Gerador de Trailers em MP4**
   - Busca automática de trailers via API do TMDB
   - Priorização inteligente de idioma (PT-BR Dublado > PT-BR > Original)
   - Download direto do YouTube usando `ytdl-core`
   - Conversão para MP4 com FFmpeg
   - Formatos: 16:9 (horizontal) e 9:16 (vertical/story)

2. **Backend - Novos Endpoints**
   - `GET /api/tmdb/movie/:id/videos` - Lista trailers de filmes
   - `GET /api/tmdb/tv/:id/videos` - Lista trailers de séries
   - `GET /api/video/best-trailer/:type/:id` - Retorna o melhor trailer baseado em prioridade
   - `GET /api/video/generate` - Gera e faz stream do vídeo em MP4
   - `GET /api/video/download` - Apenas download sem conversão

3. **Frontend - Nova Interface**
   - Box 3 agora totalmente funcional
   - Busca de filmes/séries
   - Seleção automática do melhor trailer
   - Visualização da prioridade do trailer
   - Botão de geração de vídeo
   - Barra de progresso durante processamento

## 📦 Novas Dependências

Adicionadas ao `package.json`:
```json
"fluent-ffmpeg": "^2.1.2",
"ytdl-core": "^4.11.5"
```

## 🚀 Como Usar no Render (Free Tier)

### 1. Atualizar Arquivos no GitHub

Copie os seguintes arquivos para seu repositório:
- `package.json` (atualizado com novas dependências)
- `server.js` (com novos endpoints)
- `index.html` (com funcionalidade de vídeo)

### 2. Configurar Buildpack FFmpeg no Render

O Render Free Tier **não** inclui FFmpeg por padrão. Você precisa adicionar um buildpack.

**Opção A: Via Dashboard Render**
1. Vá em **Settings** > **Build & Deploy**
2. Adicione em **Build Command**:
   ```bash
   npm install && apt-get update && apt-get install -y ffmpeg
   ```

**Opção B: Usar Dockerfile (Recomendado)**

Crie um arquivo `Dockerfile` na raiz do projeto:
```dockerfile
FROM node:18

# Instalar FFmpeg
RUN apt-get update && apt-get install -y ffmpeg

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
```

Depois altere o tipo do serviço no Render para **Docker**.

### 3. Variáveis de Ambiente

Adicione no Render Dashboard:
```
TMDB_API_KEY=ed3d0c9bfea7f601924b810c07471202
FOOTBALL_API_KEY=8a0cf7d6b04923d327c7c92f46aa75f7
```

### 4. Limitações do Render Free

⚠️ **IMPORTANTE**: O Render Free Tier tem limitações:
- **CPU limitada**: Conversão de vídeos pode ser muito lenta (5-10 min)
- **Timeout de 30s**: Requisições HTTP têm timeout
- **Memória limitada**: 512MB RAM pode não ser suficiente para vídeos longos

### 5. Solução Alternativa (Recomendado)

Para evitar problemas no Free Tier, modifique o endpoint `/api/video/generate` para apenas redirecionar para download direto do YouTube sem conversão:

```javascript
app.get('/api/video/generate', async (req, res) => {
    const { youtubeUrl } = req.query;
    
    // Apenas redireciona para download direto
    res.redirect(`/api/video/download?youtubeUrl=${youtubeUrl}`);
});
```

Isso vai baixar o vídeo original do YouTube sem processamento.

## 🎬 Fluxo de Uso

1. Usuário acessa o Box 3 "Trailers em Vídeo"
2. Busca um filme/série
3. Sistema busca trailers no TMDB
4. Prioriza automaticamente PT-BR Dublado
5. Exibe informações do trailer
6. Usuário escolhe formato (16:9 ou 9:16)
7. Clica em "Gerar Trailer MP4"
8. Download inicia automaticamente

## 🔧 Priorização de Trailers

```javascript
🥇 Prioridade 1: PT-BR + "dublado" no nome
🥈 Prioridade 2: PT-BR (qualquer)
🥉 Prioridade 3: Outros idiomas
```

## 📝 Arquivos Modificados

1. **package.json** - Novas dependências
2. **server.js** - Novos endpoints e lógica de vídeo
3. **index.html** - Nova interface do Box 3

## 🐛 Troubleshooting

### Erro: "ffmpeg not found"
- Adicione FFmpeg ao buildpack ou use Dockerfile

### Timeout durante conversão
- Vídeos muito longos podem exceder o timeout
- Considere usar apenas download sem conversão

### Erro de memória
- Reduza a qualidade do vídeo no FFmpeg
- Use preset "ultrafast" ao invés de "veryfast"

## 💡 Melhorias Futuras

- [ ] Adicionar corte de vídeo (primeiros 30-60 segundos)
- [ ] Cache de vídeos já processados
- [ ] Fila de processamento
- [ ] Integração com serviços de conversão de vídeo (Cloudinary, etc)
- [ ] Preview do trailer antes de baixar

## 📞 Suporte

Se tiver problemas, verifique:
1. Logs do Render
2. Console do navegador
3. Network tab (requisições)

---

**Criado por:** Banner Generator Pro Team  
**Data:** 2025  
**Versão:** 2.0
