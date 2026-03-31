const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// VALIDAÇÃO DE API KEYS (SEGURANÇA)
// ============================================
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

if (!FOOTBALL_API_KEY || !TMDB_API_KEY) {
    console.error('❌ ERRO CRÍTICO: Chaves de API não definidas!');
    console.error('📝 Configure as variáveis de ambiente no arquivo .env:');
    console.error('   FOOTBALL_API_KEY=sua_chave');
    console.error('   TMDB_API_KEY=sua_chave');
    process.exit(1);
}

console.log('✅ API Keys carregadas com sucesso');

const FOOTBALL_API_URL = 'https://v3.football.api-sports.io';
const TMDB_API_URL = 'https://api.themoviedb.org/3';

// ============================================
// RATE LIMITING - PROTEÇÃO CONTRA ABUSO
// ============================================
const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 30, // Máximo 30 requisições por minuto
    message: { 
        error: 'Muitas requisições. Tente novamente em 1 minuto.',
        retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Aplicar rate limit em todas as rotas da API
app.use('/api/', apiLimiter);

// ============================================
// MIDDLEWARES
// ============================================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// SISTEMA DE CACHE - SERVIDOR
// ============================================
const cache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas

function getCacheKey(url) {
    return url;
}

function getCache(key) {
    const cached = cache.get(key);
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > CACHE_DURATION) {
        cache.delete(key);
        return null;
    }
    
    console.log('✅ Cache HIT (servidor):', key);
    return cached.data;
}

function setCache(key, data) {
    cache.set(key, {
        data: data,
        timestamp: Date.now()
    });
    console.log('💾 Cache SET (servidor):', key);
}

// Limpar cache antigo a cada hora
setInterval(() => {
    const now = Date.now();
    let deleted = 0;
    for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_DURATION) {
            cache.delete(key);
            deleted++;
        }
    }
    if (deleted > 0) {
        console.log(`🗑️ Cache limpo: ${deleted} items removidos`);
    }
}, 60 * 60 * 1000);

// ============================================
// PROXY DE IMAGEM
// ============================================
app.get('/api/image-proxy', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'URL obrigatoria' });
        
        const response = await fetch(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0' } 
        });
        
        if (!response.ok) {
            return res.status(response.status).json({ error: 'Erro ao carregar imagem' });
        }
        
        const buffer = await response.buffer();
        res.set({ 
            'Content-Type': response.headers.get('content-type') || 'image/jpeg', 
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*' 
        });
        res.send(buffer);
    } catch (error) { 
        console.error('❌ Erro image-proxy:', error.message);
        res.status(500).json({ error: error.message }); 
    }
});

// ============================================
// FOOTBALL API - COM CACHE E PROTEÇÃO
// ============================================
app.get('/api/football/fixtures', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ error: 'Parametro date obrigatorio' });
        }
        
        // Verificar cache do servidor primeiro
        const cacheKey = `football_fixtures_${date}`;
        const cachedData = getCache(cacheKey);
        
        if (cachedData) {
            return res.json({
                ...cachedData,
                fromCache: true,
                cacheSource: 'server',
                message: '✅ Dados do cache do servidor (24h)'
            });
        }
        
        // Chamada à API (apenas se não houver cache)
        console.log('🌐 Chamando API Football para:', date);
        const response = await fetch(
            `${FOOTBALL_API_URL}/fixtures?date=${date}`, 
            { 
                headers: { 'x-apisports-key': FOOTBALL_API_KEY } 
            }
        );
        
        if (!response.ok) {
            throw new Error(`API retornou status ${response.status}`);
        }
        
        const data = await response.json();
        
        // Verificar se API retornou erro
        if (data.errors && Object.keys(data.errors).length > 0) {
            console.error('❌ Erro da API Football:', data.errors);
            return res.status(500).json({ 
                error: 'Erro ao buscar dados da API',
                details: data.errors 
            });
        }
        
        // Salvar no cache do servidor
        setCache(cacheKey, data);
        
        res.json({
            ...data,
            fromCache: false,
            cacheSource: 'api',
            message: '🆕 Dados da API (salvos no cache por 24h)'
        });
    } catch (error) { 
        console.error('❌ Erro Football API:', error.message);
        res.status(500).json({ 
            error: 'Erro ao buscar jogos',
            message: error.message 
        }); 
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
            `${TMDB_API_URL}/search/movie?api_key=${TMDB_API_KEY}&language=${lang}&query=${encodeURIComponent(query)}`
        );
        const data = await response.json();
        res.json(data);
    } catch (error) { 
        console.error('❌ Erro TMDB search movie:', error.message);
        res.status(500).json({ error: error.message }); 
    }
});

app.get('/api/tmdb/search/tv', async (req, res) => {
    try {
        const { query, language } = req.query;
        const lang = language || 'pt-BR';
        if (!query) return res.status(400).json({ error: 'Parametro query obrigatorio' });
        
        const response = await fetch(
            `${TMDB_API_URL}/search/tv?api_key=${TMDB_API_KEY}&language=${lang}&query=${encodeURIComponent(query)}`
        );
        const data = await response.json();
        res.json(data);
    } catch (error) { 
        console.error('❌ Erro TMDB search tv:', error.message);
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
            `${TMDB_API_URL}/movie/${id}?api_key=${TMDB_API_KEY}&language=${lang}`
        );
        const data = await response.json();
        res.json(data);
    } catch (error) { 
        console.error('❌ Erro TMDB movie details:', error.message);
        res.status(500).json({ error: error.message }); 
    }
});

app.get('/api/tmdb/tv/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const lang = req.query.language || 'pt-BR';
        const response = await fetch(
            `${TMDB_API_URL}/tv/${id}?api_key=${TMDB_API_KEY}&language=${lang}`
        );
        const data = await response.json();
        res.json(data);
    } catch (error) { 
        console.error('❌ Erro TMDB tv details:', error.message);
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
            `${TMDB_API_URL}/movie/${id}/watch/providers?api_key=${TMDB_API_KEY}`
        );
        const data = await response.json();
        res.json(data);
    } catch (error) { 
        console.error('❌ Erro TMDB movie watch:', error.message);
        res.status(500).json({ error: error.message }); 
    }
});

app.get('/api/tmdb/tv/:id/watch', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await fetch(
            `${TMDB_API_URL}/tv/${id}/watch/providers?api_key=${TMDB_API_KEY}`
        );
        const data = await response.json();
        res.json(data);
    } catch (error) { 
        console.error('❌ Erro TMDB tv watch:', error.message);
        res.status(500).json({ error: error.message }); 
    }
});

// ============================================
// TMDB API - TRAILERS
// ============================================
app.get('/api/tmdb/movie/:id/videos', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await fetch(
            `${TMDB_API_URL}/movie/${id}/videos?api_key=${TMDB_API_KEY}&language=pt-BR`
        );
        const data = await response.json();
        res.json(data);
    } catch (error) { 
        console.error('❌ Erro TMDB movie videos:', error.message);
        res.status(500).json({ error: error.message }); 
    }
});

app.get('/api/tmdb/tv/:id/videos', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await fetch(
            `${TMDB_API_URL}/tv/${id}/videos?api_key=${TMDB_API_KEY}&language=pt-BR`
        );
        const data = await response.json();
        res.json(data);
    } catch (error) { 
        console.error('❌ Erro TMDB tv videos:', error.message);
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

    const trailers = videos.results.filter(v => 
        v.site === 'YouTube' && 
        (v.type === 'Trailer' || v.type === 'Teaser')
    );

    if (trailers.length === 0) return null;

    const getPriority = (video) => {
        const lang = video.iso_639_1?.toLowerCase();
        const name = video.name?.toLowerCase() || '';
        
        if (lang === 'pt' && (name.includes('dublado') || name.includes('legendado'))) {
            return 1;
        }
        if (lang === 'pt') {
            return 2;
        }
        return 3;
    };

    trailers.sort((a, b) => getPriority(a) - getPriority(b));

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
        console.error('❌ Erro best-trailer:', error.message);
        res.status(500).json({ error: error.message });
    }
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
// ROTAS ESTÁTICAS
// ============================================
app.get('/', (req, res) => { 
    res.sendFile(path.join(__dirname, 'public', 'index.html')); 
});

app.get('/health', (req, res) => { 
    res.json({ 
        status: 'OK',
        features: ['football', 'movies', 'videos'],
        cache: {
            size: cache.size,
            duration: '24h'
        },
        rateLimit: {
            window: '1 minute',
            max: 30
        },
        security: {
            apiKeysProtected: true,
            rateLimitEnabled: true,
            cacheEnabled: true
        }
    }); 
});

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(PORT, () => { 
    console.log('🚀 Servidor rodando na porta', PORT);
    console.log('📦 Recursos: Futebol, Filmes/Séries, Trailers');
    console.log('🛡️ Rate Limit: 30 req/min');
    console.log('💾 Cache: 24 horas');
    console.log('🔒 Segurança: API Keys protegidas');
});
