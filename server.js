const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY || '8a0cf7d6b04923d327c7c92f46aa75f7';
const TMDB_API_KEY = process.env.TMDB_API_KEY || 'ed3d0c9bfea7f601924b810c07471202';
const FOOTBALL_API_URL = 'https://v3.football.api-sports.io';
const TMDB_API_URL = 'https://api.themoviedb.org/3';

app.get('/api/image-proxy', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'URL obrigatoria' });
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!response.ok) return res.status(response.status).json({ error: 'Erro ao carregar imagem' });
        const buffer = await response.buffer();
        res.set({ 'Content-Type': response.headers.get('content-type') || 'image/jpeg', 'Cache-Control': 'public, max-age=86400', 'Access-Control-Allow-Origin': '*' });
        res.send(buffer);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/football/fixtures', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ error: 'Parametro date obrigatorio' });
        const response = await fetch(FOOTBALL_API_URL + '/fixtures?date=' + date, { headers: { 'x-apisports-key': FOOTBALL_API_KEY } });
        const data = await response.json();
        res.json(data);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/tmdb/search/movie', async (req, res) => {
    try {
        const { query, language } = req.query;
        const lang = language || 'pt-BR';
        if (!query) return res.status(400).json({ error: 'Parametro query obrigatorio' });
        const response = await fetch(TMDB_API_URL + '/search/movie?api_key=' + TMDB_API_KEY + '&language=' + lang + '&query=' + encodeURIComponent(query));
        const data = await response.json();
        res.json(data);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/tmdb/search/tv', async (req, res) => {
    try {
        const { query, language } = req.query;
        const lang = language || 'pt-BR';
        if (!query) return res.status(400).json({ error: 'Parametro query obrigatorio' });
        const response = await fetch(TMDB_API_URL + '/search/tv?api_key=' + TMDB_API_KEY + '&language=' + lang + '&query=' + encodeURIComponent(query));
        const data = await response.json();
        res.json(data);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/tmdb/movie/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const lang = req.query.language || 'pt-BR';
        const response = await fetch(TMDB_API_URL + '/movie/' + id + '?api_key=' + TMDB_API_KEY + '&language=' + lang);
        const data = await response.json();
        res.json(data);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/tmdb/tv/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const lang = req.query.language || 'pt-BR';
        const response = await fetch(TMDB_API_URL + '/tv/' + id + '?api_key=' + TMDB_API_KEY + '&language=' + lang);
        const data = await response.json();
        res.json(data);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/tmdb/movie/:id/watch', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await fetch(TMDB_API_URL + '/movie/' + id + '/watch/providers?api_key=' + TMDB_API_KEY);
        const data = await response.json();
        res.json(data);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/tmdb/tv/:id/watch', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await fetch(TMDB_API_URL + '/tv/' + id + '/watch/providers?api_key=' + TMDB_API_KEY);
        const data = await response.json();
        res.json(data);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

app.get('/health', (req, res) => { res.json({ status: 'OK' }); });

app.listen(PORT, () => { console.log('Servidor rodando na porta ' + PORT); });
