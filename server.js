const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');
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
// ENDPOINT: GERAR VÍDEO (DOWNLOAD + CONVERSÃO)
// ============================================
app.get('/api/video/generate', async (req, res) => {
    try {
        const { youtubeUrl, format } = req.query;
        
        if (!youtubeUrl) {
            return res.status(400).json({ error: 'youtubeUrl é obrigatório' });
        }

        // Validar URL do YouTube
        if (!ytdl.validateURL(youtubeUrl)) {
            return res.status(400).json({ error: 'URL inválida do YouTube' });
        }

        console.log('🎬 Gerando vídeo para:', youtubeUrl);

        // Configurar headers
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', 'attachment; filename="trailer.mp4"');

        // Obter informações do vídeo
        const info = await ytdl.getInfo(youtubeUrl);
        
        // Baixar vídeo em qualidade adequada
        const videoStream = ytdl(youtubeUrl, {
            quality: 'highestvideo',
            filter: 'videoandaudio'
        });

        // Configurar FFmpeg para conversão
        const ffmpegCommand = ffmpeg(videoStream)
            .outputFormat('mp4')
            .videoCodec('libx264')
            .audioCodec('aac')
            .audioBitrate('128k')
            .videoBitrate('2000k')
            .size(format === 'story' ? '1080x1920' : '1920x1080') // Vertical ou horizontal
            .autopad()
            .outputOptions([
                '-preset veryfast',
                '-crf 23',
                '-movflags frag_keyframe+empty_moov',
                '-max_muxing_queue_size 1024'
            ]);

        // Stream direto para o cliente
        ffmpegCommand.pipe(res, { end: true });

        // Tratamento de erros
        ffmpegCommand.on('error', (err) => {
            console.error('❌ Erro FFmpeg:', err.message);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Erro ao processar vídeo: ' + err.message });
            }
        });

        ffmpegCommand.on('end', () => {
            console.log('✅ Vídeo gerado com sucesso');
        });

        // Se o cliente desconectar, parar o processo
        req.on('close', () => {
            console.log('⚠️ Cliente desconectou, abortando...');
            ffmpegCommand.kill('SIGKILL');
        });

    } catch (error) {
        console.error('❌ Erro geral:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

// ============================================
// ENDPOINT: APENAS BAIXAR (SEM CONVERSÃO)
// ============================================
app.get('/api/video/download', async (req, res) => {
    try {
        const { youtubeUrl } = req.query;
        
        if (!youtubeUrl) {
            return res.status(400).json({ error: 'youtubeUrl é obrigatório' });
        }

        if (!ytdl.validateURL(youtubeUrl)) {
            return res.status(400).json({ error: 'URL inválida do YouTube' });
        }

        console.log('📥 Baixando vídeo:', youtubeUrl);

        const info = await ytdl.getInfo(youtubeUrl);
        const title = info.videoDetails.title.replace(/[^a-zA-Z0-9]/g, '_');

        res.setHeader('Content-Disposition', `attachment; filename="${title}.mp4"`);

        ytdl(youtubeUrl, {
            quality: 'highest',
            filter: 'videoandaudio'
        }).pipe(res);

    } catch (error) {
        console.error('❌ Erro download:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

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
