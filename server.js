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
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY || '2d3321116e5faf5c03edf1a6f6dccff5';
const TMDB_API_KEY = process.env.TMDB_API_KEY || 'ed3d0c9bfea7f601924b810c07471202';

const FOOTBALL_API_URL = 'https://v3.football.api-sports.io';
const TMDB_API_URL = 'https://api.themoviedb.org/3';

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
    console.log(`   GET  /api/football/fixtures     - Proxy Football API`);
    console.log(`   GET  /api/tmdb/search/movie     - Proxy TMDB Movies`);
    console.log(`   GET  /api/tmdb/search/tv        - Proxy TMDB Series`);
    console.log(`   GET  /health                    - Health Check\n`);
});
