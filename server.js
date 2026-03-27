const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
require('dotenv').config();

const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY || '8a0cf7d6b04923d327c7c92f46aa75f7';
const TMDB_API_KEY = process.env.TMDB_API_KEY || 'ed3d0c9bfea7f601924b810c07471202';
const FOOTBALL_API_URL = 'https://v3.football.api-sports.io';
const TMDB_API_URL = 'https://api.themoviedb.org/3';

// ============================================
// PROXY DE IMAGEM
// ============================================
app.get('/api/image-proxy', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'URL obrigatoria' });
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!response.ok) return res.status(response.status).json({ error: 'Erro ao carregar imagem' });
        const buffer = await response.buffer();
        res.set({ 
            'Content-Type': response.headers.get('content-type') || 'image/jpeg', 
            'Cache-Control': 'public, max-age=86400', 
            'Access-Control-Allow-Origin': '*' 
        });
        res.send(buffer);
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

// ============================================
// FOOTBALL API
// ============================================
app.get('/api/football/fixtures', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ error: 'Parametro date obrigatorio' });
        const response = await fetch(FOOTBALL_API_URL + '/fixtures?date=' + date, { 
            headers: { 'x-apisports-key': FOOTBALL_API_KEY } 
        });
        const data = await response.json();
        res.json(data);
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

// ============================================
// TMDB API - BUSCA
// ============================================
app.get('/api/tmdb/search/movie', async (req, res) => {
    try {
        const { query, language } = req.query;
        const lang = language || 'pt-BR';
        if (!query) return res.status(400).json({ error: 'Parametro query obrigatorio' });
        const response = await fetch(
            TMDB_API_URL + '/search/movie?api_key=' + TMDB_API_KEY + 
            '&language=' + lang + '&query=' + encodeURIComponent(query)
        );
        const data = await response.json();
        res.json(data);
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

app.get('/api/tmdb/search/tv', async (req, res) => {
    try {
        const { query, language } = req.query;
        const lang = language || 'pt-BR';
        if (!query) return res.status(400).json({ error: 'Parametro query obrigatorio' });
        const response = await fetch(
            TMDB_API_URL + '/search/tv?api_key=' + TMDB_API_KEY + 
            '&language=' + lang + '&query=' + encodeURIComponent(query)
        );
        const data = await response.json();
        res.json(data);
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

// ============================================
// TMDB API - DETALHES
// ============================================
app.get('/api/tmdb/movie/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const lang = req.query.language || 'pt-BR';
        const response = await fetch(
            TMDB_API_URL + '/movie/' + id + '?api_key=' + TMDB_API_KEY + '&language=' + lang
        );
        const data = await response.json();
        res.json(data);
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

app.get('/api/tmdb/tv/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const lang = req.query.language || 'pt-BR';
        const response = await fetch(
            TMDB_API_URL + '/tv/' + id + '?api_key=' + TMDB_API_KEY + '&language=' + lang
        );
        const data = await response.json();
        res.json(data);
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

// ============================================
// TMDB API - PLATAFORMAS
// ============================================
app.get('/api/tmdb/movie/:id/watch', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await fetch(
            TMDB_API_URL + '/movie/' + id + '/watch/providers?api_key=' + TMDB_API_KEY
        );
        const data = await response.json();
        res.json(data);
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

app.get('/api/tmdb/tv/:id/watch', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await fetch(
            TMDB_API_URL + '/tv/' + id + '/watch/providers?api_key=' + TMDB_API_KEY
        );
        const data = await response.json();
        res.json(data);
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

// ============================================
// TMDB API - TRAILERS (NOVO!)
// ============================================
app.get('/api/tmdb/movie/:id/videos', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await fetch(
            TMDB_API_URL + '/movie/' + id + '/videos?api_key=' + TMDB_API_KEY + '&language=pt-BR'
        );
        const data = await response.json();
        res.json(data);
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

app.get('/api/tmdb/tv/:id/videos', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await fetch(
            TMDB_API_URL + '/tv/' + id + '/videos?api_key=' + TMDB_API_KEY + '&language=pt-BR'
        );
        const data = await response.json();
        res.json(data);
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

// ============================================
// FUNÇÃO: PRIORIZAR TRAILERS
// ============================================
function prioritizeTrailers(videos) {
    if (!videos || !videos.results || videos.results.length === 0) {
        return null;
    }

    // Filtrar apenas trailers do YouTube
    const trailers = videos.results.filter(v => 
        v.site === 'YouTube' && 
        (v.type === 'Trailer' || v.type === 'Teaser')
    );

    if (trailers.length === 0) return null;

    // Função de prioridade
    const getPriority = (video) => {
        const lang = video.iso_639_1?.toLowerCase();
        const name = video.name?.toLowerCase() || '';
        
        // 🥇 Prioridade 1: PT-BR Dublado
        if (lang === 'pt' && (name.includes('dublado') || name.includes('legendado'))) {
            return 1;
        }
        // 🥈 Prioridade 2: PT-BR geral
        if (lang === 'pt') {
            return 2;
        }
        // 🥉 Prioridade 3: Original/outros
        return 3;
    };

    // Ordenar por prioridade
    trailers.sort((a, b) => getPriority(a) - getPriority(b));

    // Retornar o melhor trailer
    const best = trailers[0];
    return {
        key: best.key,
        name: best.name,
        language: best.iso_639_1,
        priority: getPriority(best),
        url: `https://www.youtube.com/watch?v=${best.key}`,
        youtubeUrl: `https://www.youtube.com/watch?v=${best.key}`,
        allTrailers: trailers.map(t => ({
            key: t.key,
            name: t.name,
            language: t.iso_639_1,
            priority: getPriority(t)
        }))
    };
}

// ============================================
// ENDPOINT: OBTER MELHOR TRAILER
// ============================================
app.get('/api/video/best-trailer/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        
        if (type !== 'movie' && type !== 'tv') {
            return res.status(400).json({ error: 'Tipo deve ser "movie" ou "tv"' });
        }

        const response = await fetch(
            `${TMDB_API_URL}/${type}/${id}/videos?api_key=${TMDB_API_KEY}&language=pt-BR`
        );
        const data = await response.json();
        
        const bestTrailer = prioritizeTrailers(data);
        
        if (!bestTrailer) {
            return res.status(404).json({ error: 'Nenhum trailer encontrado' });
        }

        res.json(bestTrailer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ENDPOINT: GERAR LINK DE DOWNLOAD
// ============================================
app.get('/api/video/generate', async (req, res) => {
    try {
        const { youtubeUrl, format } = req.query;
        
        if (!youtubeUrl) {
            return res.status(400).json({ error: 'youtubeUrl é obrigatório' });
        }

        // Extrair ID do vídeo
        const videoId = extractYouTubeID(youtubeUrl);
        if (!videoId) {
            return res.status(400).json({ error: 'URL inválida do YouTube' });
        }

        console.log('🎬 Gerando link para vídeo:', videoId);

        // Retornar opções de download
        const downloadOptions = {
            youtubeUrl: youtubeUrl,
            videoId: videoId,
            format: format || 'horizontal',
            // Usar serviços públicos de download
            downloadLinks: {
                // Opção 1: Y2Mate (popular)
                y2mate: `https://www.y2mate.com/youtube/${videoId}`,
                // Opção 2: SaveFrom
                savefrom: `https://savefrom.net/#url=${encodeURIComponent(youtubeUrl)}`,
                // Opção 3: Link direto do YouTube (abre no navegador)
                youtube: youtubeUrl,
                // Opção 4: Redirect para download
                direct: `${API_BASE_URL}/api/video/redirect?url=${encodeURIComponent(youtubeUrl)}`
            },
            instructions: {
                method1: '1. Abra o link Y2Mate abaixo',
                method2: '2. Escolha a qualidade desejada',
                method3: '3. Clique em Download',
                alternative: 'Ou use SaveFrom.net como alternativa'
            }
        };

        res.json(downloadOptions);

    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ENDPOINT: APENAS DOWNLOAD (SEM CONVERSÃO)
// ============================================
app.get('/api/video/download', async (req, res) => {
    try {
        const { youtubeUrl } = req.query;
        
        if (!youtubeUrl) {
            return res.status(400).json({ error: 'youtubeUrl é obrigatório' });
        }

        const videoId = extractYouTubeID(youtubeUrl);
        if (!videoId) {
            return res.status(400).json({ error: 'URL inválida do YouTube' });
        }

        console.log('📥 Redirecionando para download:', videoId);

        // Redirecionar para serviço de download público
        res.redirect(`https://www.y2mate.com/youtube/${videoId}`);

    } catch (error) {
        console.error('❌ Erro download:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ENDPOINT: REDIRECT PARA YOUTUBE
// ============================================
app.get('/api/video/redirect', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'URL é obrigatória' });
    }
    res.redirect(url);
});

// ============================================
// FUNÇÃO AUXILIAR: EXTRAIR ID DO YOUTUBE
// ============================================
function extractYouTubeID(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
}

// ============================================
// ROTAS ESTÁTICAS
// ============================================
app.get('/', (req, res) => { 
    res.sendFile(path.join(__dirname, 'index.html')); 
});

app.get('/health', (req, res) => { 
    res.json({ 
        status: 'OK',
        features: ['football', 'movies', 'videos']
    }); 
});

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(PORT, () => { 
    console.log('🚀 Servidor rodando na porta ' + PORT);
    console.log('📦 Recursos: Futebol, Filmes/Séries, Trailers');
});
