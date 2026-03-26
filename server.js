const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ========== CONFIGURAÇÃO DAS APIs ==========
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY || '8a0cf7d6b04923d327c7c92f46aa75f7';
const TMDB_API_KEY = process.env.TMDB_API_KEY || 'ed3d0c9bfea7f601924b810c07471202';

const FOOTBALL_API_URL = 'https://v3.football.api-sports.io';
const TMDB_API_URL = 'https://api.themoviedb.org/3';

// ========== PROXY DE IMAGENS (CORS FIX) ==========
app.get('/api/image-proxy', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({ error: 'O parâmetro "url" é obrigatório' });
        }

        console.log(`🖼️ [Image Proxy] Carregando: ${url.substring(0, 50)}...`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            console.error('❌ [Image Proxy] Erro ao carregar imagem');
            return res.status(response.status).json({ error: 'Erro ao carregar imagem' });
        }

        const buffer = await response.buffer();
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        res.set({
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*'
        });

        console.log(`✅ [Image Proxy] Imagem carregada com sucesso`);
        res.send(buffer);

    } catch (error) {
        console.error('❌ [Image Proxy] Erro interno:', error.message);
        res.status(500).json({ error: 'Erro interno ao carregar imagem', message: error.message });
    }
});

// ========== PROXY API FOOTBALL ==========
app.get('/api/football/fixtures', async (req, res) => {
    try {
        const { date } = req.query;
        
        if (!date) {
            return res.status(400).json({ error: 'O parâmetro "date" é obrigatório (formato: YYYY-MM-DD)' });
        }

        console.log(`📡 [Football API] Buscando jogos para: ${date}`);

        const response = await fetch(`${FOOTBALL_API_URL}/fixtures?date=${date}`, {
            headers: {
                'x-apisports-key': FOOTBALL_API_KEY
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ [Football API] Erro:', data);
            return res.status(response.status).json({ error: 'Erro ao buscar dados da API Football', details: data });
        }

        console.log(`✅ [Football API] Retornados ${data.response?.length || 0} jogos`);
        res.json(data);

    } catch (error) {
        console.error('❌ [Football API] Erro interno:', error.message);
        res.status(500).json({ error: 'Erro interno ao buscar jogos', message: error.message });
    }
});

// ========== PROXY API TMDB - BUSCAR FILMES ==========
app.get('/api/tmdb/search/movie', async (req, res) => {
    try {
        const { query, language = 'pt-BR' } = req.query;

        if (!query) {
            return res.status(400).json({ error: 'O parâmetro "query" é obrigatório' });
        }

        console.log(`📡 [TMDB API] Buscando filme: "${query}"`);

        const response = await fetch(
            `${TMDB_API_URL}/search/movie?api_key=${TMDB_API_KEY}&language=${language}&query=${encodeURIComponent(query)}`
        );

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ [TMDB API] Erro:', data);
            return res.status(response.status).json({ error: 'Erro ao buscar filme na TMDB', details: data });
        }

        console.log(`✅ [TMDB API] Retornados ${data.results?.length || 0} filmes`);
        res.json(data);

    } catch (error) {
        console.error('❌ [TMDB API] Erro interno:', error.message);
        res.status(500).json({ error: 'Erro interno ao buscar filme', message: error.message });
    }
});

// ========== PROXY API TMDB - BUSCAR SÉRIES ==========
app.get('/api/tmdb/search/tv', async (req, res) => {
    try {
        const { query, language = 'pt-BR' } = req.query;

        if (!query) {
            return res.status(400).json({ error: 'O parâmetro "query" é obrigatório' });
        }

        console.log(`📡 [TMDB API] Buscando série: "${query}"`);

        const response = await fetch(
            `${TMDB_API_URL}/search/tv?api_key=${TMDB_API_KEY}&language=${language}&query=${encodeURIComponent(query)}`
        );

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ [TMDB API] Erro:', data);
            return res.status(response.status).json({ error: 'Erro ao buscar série na TMDB', details: data });
        }

        console.log(`✅ [TMDB API] Retornados ${data.results?.length || 0} séries`);
        res.json(data);

    } catch (error) {
        console.error('❌ [TMDB API] Erro interno:', error.message);
        res.status(500).json({ error: 'Erro interno ao buscar série', message: error.message });
    }
});

// ========== PROXY API TMDB - DETALHES DO FILME ==========
app.get('/api/tmdb/movie/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { language = 'pt-BR' } = req.query;

        console.log(`📡 [TMDB API] Buscando detalhes do filme ID: ${id}`);

        const response = await fetch(
            `${TMDB_API_URL}/movie/${id}?api_key=${TMDB_API_KEY}&language=${language}`
        );

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ [TMDB API] Erro:', data);
            return res.status(response.status).json({ error: 'Erro ao buscar detalhes do filme', details: data });
        }

        console.log(`✅ [TMDB API] Detalhes do filme "${data.title}" carregados`);
        res.json(data);

    } catch (error) {
        console.error('❌ [TMDB API] Erro interno:', error.message);
        res.status(500).json({ error: 'Erro interno ao buscar detalhes', message: error.message });
    }
});

// ========== PROXY API TMDB - DETALHES DA SÉRIE ==========
app.get('/api/tmdb/tv/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { language = 'pt-BR' } = req.query;

        console.log(`📡 [TMDB API] Buscando detalhes da série ID: ${id}`);

        const response = await fetch(
            `${TMDB_API_URL}/tv/${id}?api_key=${TMDB_API_KEY}&language=${language}`
        );

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ [TMDB API] Erro:', data);
            return res.status(response.status).json({ error: 'Erro ao buscar detalhes da série', details: data });
        }

        console.log(`✅ [TMDB API] Detalhes da série "${data.name}" carregados`);
        res.json(data);

    } catch (error) {
        console.error('❌ [TMDB API] Erro interno:', error.message);
        res.status(500).json({ error: 'Erro interno ao buscar detalhes', message: error.message });
    }
});

// ========== ROTA RAIZ - SERVIR O HTML ==========
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        apis: {
            football: !!FOOTBALL_API_KEY,
            tmdb: !!TMDB_API_KEY
        }
    });
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, () => {
    console.log(`\n🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📡 API Football: ${FOOTBALL_API_KEY ? '✅ Configurada' : '❌ Faltando'}`);
    console.log(`🎬 API TMDB: ${TMDB_API_KEY ? '✅ Configurada' : '❌ Faltando'}`);
    console.log(`\n📍 Endpoints disponíveis:`);
    console.log(`   GET  /                          - Frontend HTML`);
    console.log(`   GET  /api/image-proxy           - Proxy de Imagens (CORS)`);
    console.log(`   GET  /api/football/fixtures     - Proxy Football API`);
    console.log(`   GET  /api/tmdb/search/movie     - Proxy TMDB Movies`);
    console.log(`   GET  /api/tmdb/search/tv        - Proxy TMDB Series`);
    console.log(`   GET  /api/tmdb/movie/:id        - Detalhes do Filme`);
    console.log(`   GET  /api/tmdb/tv/:id           - Detalhes da Série`);
    console.log(`   GET  /health                    - Health Check\n`);
});
