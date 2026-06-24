const API_BASE_URL = window.location.origin;
const TMDB_BASE_URL = API_BASE_URL + '/api/tmdb';
const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p';

// Função para gerar URL de imagem via proxy (evita problemas de CORS)
function getTmdbImgUrl(path, size) {
    if (!path) return null;
    var fullUrl = TMDB_IMG_BASE + '/' + (size || 'w500') + path;
    return API_BASE_URL + '/api/image-proxy?url=' + encodeURIComponent(fullUrl);
}

let currentMode = null;
let selectedContent = null;
let currentFormat = 'post';
let uploadedLogo = null;
let posterImage = null;
let currentTrailer = null;
let globalSettings = { logo: null, whatsappNumber: '', whatsappText: 'Grupo VIP', ctaText: 'ASSINA JÁ' };

let movieTypeFilter = 'both';
let videoTypeFilter = 'both';

let uploadedVideoFile = null;
let uploadedVideoUrl = null;

const homeScreen = document.getElementById('homeScreen');
const editorScreen = document.getElementById('editorScreen');
const controlPanel = document.getElementById('controlPanel');
let canvas = document.getElementById('bannerCanvas');
let ctx = canvas.getContext('2d');
let videoContainer = document.getElementById('videoContainer');

// ============================================
// FFmpeg.wasm - usado APENAS quando o navegador
// não consegue gravar MP4 nativamente (Firefox/Safari)
// ============================================
let ffmpegInstance = null;
let ffmpegLoading = null;

function ffmpegSupported() {
    return typeof window !== 'undefined' && typeof window.FFmpeg !== 'undefined'
        && typeof SharedArrayBuffer !== 'undefined' && window.crossOriginIsolated;
}

async function loadFFmpegOnce(onProgress) {
    if (ffmpegInstance) return ffmpegInstance;
    if (ffmpegLoading) return ffmpegLoading;
    if (!ffmpegSupported()) {
        throw new Error('FFmpeg.wasm não suportado neste navegador (SharedArrayBuffer indisponível).');
    }
    ffmpegLoading = (async function() {
        var createFFmpeg = window.FFmpeg.createFFmpeg;
        var inst = createFFmpeg({
            log: false,
            corePath: window.location.origin + '/vendor/ffmpeg-core.js',
            progress: function(p) {
                if (onProgress && typeof p.ratio === 'number') onProgress(p.ratio);
            }
        });
        await inst.load();
        ffmpegInstance = inst;
        return inst;
    })();
    return ffmpegLoading;
}

// Detecção de suporte a MP4 nativo no MediaRecorder
function detectNativeMp4Support() {
    if (typeof MediaRecorder === 'undefined') return '';
    var mp4Types = [
        'video/mp4;codecs=avc1.640033,mp4a.40.2',
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1,mp4a',
        'video/mp4'
    ];
    for (var i = 0; i < mp4Types.length; i++) {
        if (MediaRecorder.isTypeSupported(mp4Types[i])) return mp4Types[i];
    }
    return '';
}

// ============================================
// SETTINGS
// ============================================
function loadGlobalSettings() {
    try {
        var saved = localStorage.getItem('bannerGeneratorSettings');
        if (saved) {
            globalSettings = JSON.parse(saved);
            if (globalSettings.logo) {
                var img = new Image();
                img.onload = function() { uploadedLogo = img; };
                img.src = globalSettings.logo;
                var slt = document.getElementById('settingsLogoText');
                var slr = document.getElementById('settingsRemoveLogo');
                if (slt) slt.textContent = 'Logo carregada';
                if (slr) slr.classList.remove('hidden');
            }
            var w1 = document.getElementById('settingsWhatsappNumber');
            var w2 = document.getElementById('settingsWhatsappText');
            var w3 = document.getElementById('settingsCtaText');
            if (w1) w1.value = globalSettings.whatsappNumber || '';
            if (w2) w2.value = globalSettings.whatsappText || 'Grupo VIP';
            if (w3) w3.value = globalSettings.ctaText || 'ASSINA JÁ';
        }
    } catch (e) { console.error('Erro:', e); }
}

function openSettings() { document.getElementById('settingsModal').classList.add('active'); }
function closeSettings() { document.getElementById('settingsModal').classList.remove('active'); }

document.getElementById('settingsModal').addEventListener('click', function(e) {
    if (e.target === this) closeSettings();
});

function saveSettings() {
    globalSettings.whatsappNumber = document.getElementById('settingsWhatsappNumber').value;
    globalSettings.whatsappText = document.getElementById('settingsWhatsappText').value;
    globalSettings.ctaText = document.getElementById('settingsCtaText').value;
    localStorage.setItem('bannerGeneratorSettings', JSON.stringify(globalSettings));
    alert('Configurações salvas!');
    closeSettings();
}

document.getElementById('settingsLogoInput').addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (file) {
        var reader = new FileReader();
        reader.onload = function(ev) {
            globalSettings.logo = ev.target.result;
            var img = new Image();
            img.onload = function() { uploadedLogo = img; };
            img.src = ev.target.result;
            document.getElementById('settingsLogoText').textContent = file.name;
            document.getElementById('settingsRemoveLogo').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});
document.getElementById('settingsRemoveLogo').addEventListener('click', function() {
    globalSettings.logo = null; uploadedLogo = null;
    document.getElementById('settingsLogoInput').value = '';
    document.getElementById('settingsLogoText').textContent = 'Carregar logo padrão';
    document.getElementById('settingsRemoveLogo').classList.add('hidden');
});

// ============================================
// NAVIGATION
// ============================================
function selectMode(mode) {
    currentMode = mode;
    homeScreen.classList.add('hidden');
    editorScreen.classList.remove('hidden');
    clearPreviousBanners();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    selectedContent = null;
    if (mode === 'movies') loadMoviesMode();
    else if (mode === 'video') loadVideoMode();
}

function goHome() {
    editorScreen.classList.add('hidden');
    homeScreen.classList.remove('hidden');
    clearPreviousBanners();
    currentMode = null;
    selectedContent = null;
    posterImage = null;
    currentTrailer = null;
    if (uploadedVideoUrl) { try { URL.revokeObjectURL(uploadedVideoUrl); } catch(e) {} }
    uploadedVideoFile = null;
    uploadedVideoUrl = null;
}

function clearPreviousBanners() {
    const container = document.getElementById('bannersContainer');
    container.innerHTML = '<canvas id="bannerCanvas" class="canvas-glow max-w-full h-auto rounded-lg mx-auto"></canvas><div id="videoContainer" class="hidden flex flex-col items-center gap-4"></div>';
    canvas = document.getElementById('bannerCanvas');
    ctx = canvas.getContext('2d');
    videoContainer = document.getElementById('videoContainer');
}

// ============================================
// MOVIES MODE
// ============================================
async function loadMoviesMode() {
    canvas.classList.remove('hidden');
    videoContainer.classList.add('hidden');
    movieTypeFilter = 'both';

    controlPanel.innerHTML =
        '<header class="border-b border-zinc-800 pb-5"><h2 class="font-oswald text-2xl font-bold text-red-400">Filmes e S\u00E9ries</h2></header>' +
        '<section class="mt-5">' +
            '<label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold block mb-3">Tipo de Conte\u00FAdo</label>' +
            '<div class="flex gap-2">' +
                '<button id="movieTypeBoth" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white" data-testid="movie-type-both">Ambos</button>' +
                '<button id="movieTypeMovie" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800" data-testid="movie-type-movie">Filme</button>' +
                '<button id="movieTypeTv" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800" data-testid="movie-type-tv">S\u00E9rie</button>' +
            '</div>' +
        '</section>' +
        '<section class="mt-5">' +
            '<label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold block mb-3">Buscar Filme ou S\u00E9rie</label>' +
            '<div class="relative">' +
                '<input type="text" id="movieSearch" placeholder="Digite o nome..." class="bg-black border-2 border-zinc-800 p-4 pr-14 text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 w-full rounded-lg" data-testid="movie-search-input">' +
            '</div>' +
            '<div id="movieResults" class="mt-2 max-h-96 overflow-y-auto"></div>' +
        '</section>' +
        '<section id="movieControls" class="hidden flex flex-col gap-5 mt-5">' +
            '<div id="movieSelectedInfo" class="border border-zinc-800 p-4 bg-black/30 rounded-lg"></div>' +
            '<section class="flex flex-col gap-3"><label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Formato</label><div class="flex gap-2"><button id="movieFormatPost" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white">Post</button><button id="movieFormatStory" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800">Story</button></div></section>' +
            '<section class="flex flex-col gap-3"><label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Plataforma <span id="platformAutoText" class="text-green-400 text-xs normal-case"></span></label>' +
            '<select id="moviePlatform" class="bg-black border border-zinc-800 p-4 text-white focus:outline-none focus:border-red-500 w-full appearance-none cursor-pointer rounded pr-10"><option value="">Selecione ou autom\u00E1tico</option><option value="Netflix">Netflix</option><option value="Amazon Prime Video">Amazon Prime Video</option><option value="Disney+">Disney+</option><option value="HBO Max">HBO Max</option><option value="Max">Max</option><option value="Apple TV+">Apple TV+</option><option value="Paramount+">Paramount+</option><option value="Globoplay">Globoplay</option><option value="Star+">Star+</option><option value="Crunchyroll">Crunchyroll</option><option value="Cinema">Cinema</option></select></section>' +
            '<button id="movieDownloadBtn" class="w-full bg-red-500 text-white font-bold uppercase tracking-widest py-4 hover:bg-red-400 transition-all flex items-center justify-center gap-3 rounded-lg cursor-pointer" data-testid="movie-download-btn">BAIXAR BANNER FULL HD</button>' +
        '</section>';

    setTimeout(function() {
        var searchTimeout;
        document.getElementById('movieSearch').addEventListener('input', function(e) { clearTimeout(searchTimeout); searchTimeout = setTimeout(function() { searchMovies(e.target.value); }, 500); });
        document.getElementById('movieFormatPost').addEventListener('click', function() { currentFormat = 'post'; updateMovieFormatButtons(); generateMovieBanner(); });
        document.getElementById('movieFormatStory').addEventListener('click', function() { currentFormat = 'story'; updateMovieFormatButtons(); generateMovieBanner(); });
        document.getElementById('moviePlatform').addEventListener('change', generateMovieBanner);
        document.getElementById('movieDownloadBtn').addEventListener('click', downloadMovieBanner);
        document.getElementById('movieTypeBoth').addEventListener('click', function() { setMovieTypeFilter('both'); });
        document.getElementById('movieTypeMovie').addEventListener('click', function() { setMovieTypeFilter('movie'); });
        document.getElementById('movieTypeTv').addEventListener('click', function() { setMovieTypeFilter('tv'); });
    }, 100);
    showPlaceholder('\uD83C\uDFAC', 'FILMES', 'Busque um filme ou s\u00E9rie', '#7f1d1d', '#18181b');
}

function setMovieTypeFilter(type) {
    movieTypeFilter = type;
    var btns = { both: document.getElementById('movieTypeBoth'), movie: document.getElementById('movieTypeMovie'), tv: document.getElementById('movieTypeTv') };
    Object.keys(btns).forEach(function(k) {
        if (!btns[k]) return;
        btns[k].className = (k === type)
            ? 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white'
            : 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800';
    });
    var inp = document.getElementById('movieSearch');
    if (inp && inp.value.trim()) searchMovies(inp.value);
}

async function searchMovies(query) {
    if (!query.trim()) { document.getElementById('movieResults').innerHTML = ''; return; }
    try {
        var fetches = [];
        if (movieTypeFilter === 'both' || movieTypeFilter === 'movie') {
            fetches.push(fetch(TMDB_BASE_URL + '/search/movie?language=pt-BR&query=' + encodeURIComponent(query)).then(function(r) { return r.json(); }));
        } else { fetches.push(Promise.resolve({ results: [] })); }
        if (movieTypeFilter === 'both' || movieTypeFilter === 'tv') {
            fetches.push(fetch(TMDB_BASE_URL + '/search/tv?language=pt-BR&query=' + encodeURIComponent(query)).then(function(r) { return r.json(); }));
        } else { fetches.push(Promise.resolve({ results: [] })); }
        var results = await Promise.all(fetches);
        var moviesData = results[0];
        var seriesData = results[1];
        var movies = (moviesData.results || []).slice(0, 8).map(function(m) { return { id: m.id, type: 'movie', title: m.title, year: m.release_date ? m.release_date.split('-')[0] : 'N/A', rating: m.vote_average ? m.vote_average.toFixed(1) : 'N/A', overview: m.overview || 'Sinopse n\u00E3o dispon\u00EDvel.', poster: m.poster_path ? getTmdbImgUrl(m.poster_path) : null }; });
        var series = (seriesData.results || []).slice(0, 8).map(function(s) { return { id: s.id, type: 'tv', title: s.name, year: s.first_air_date ? s.first_air_date.split('-')[0] : 'N/A', rating: s.vote_average ? s.vote_average.toFixed(1) : 'N/A', overview: s.overview || 'Sinopse n\u00E3o dispon\u00EDvel.', poster: s.poster_path ? getTmdbImgUrl(s.poster_path) : null }; });
        displayMovieResults(movies.concat(series));
    } catch (error) {
        console.error('Erro:', error);
        document.getElementById('movieResults').innerHTML = '<p class="text-red-500 text-sm p-3">Erro: configure TMDB_API_KEY no backend/.env</p>';
    }
}

function displayMovieResults(results) {
    var resultsDiv = document.getElementById('movieResults');
    if (results.length === 0) { resultsDiv.innerHTML = '<p class="text-zinc-500 text-sm p-3">Nenhum resultado</p>'; return; }
    resultsDiv.innerHTML = results.map(function(item, index) {
        return '<div class="search-result flex items-center gap-3 p-3 cursor-pointer border-b border-zinc-800 hover:bg-zinc-800/50 rounded" data-index="' + index + '">' +
            (item.poster ? '<img src="' + item.poster + '" class="w-12 h-16 object-cover rounded">' : '<div class="w-12 h-16 bg-zinc-800 rounded flex items-center justify-center">\uD83C\uDFAC</div>') +
            '<div class="flex-1 min-w-0"><p class="font-semibold text-sm truncate">' + item.title + '</p><p class="text-zinc-500 text-xs">' + item.year + ' - ' + (item.type === 'movie' ? 'Filme' : 'S\u00E9rie') + ' - ' + item.rating + '</p></div></div>';
    }).join('');
    window.movieSearchResults = results;
    setTimeout(function() {
        document.querySelectorAll('#movieResults .search-result').forEach(function(el) {
            el.addEventListener('click', function() { selectMovie(window.movieSearchResults[parseInt(this.getAttribute('data-index'))]); });
        });
    }, 50);
}

async function selectMovie(movie) {
    selectedContent = movie;
    document.getElementById('movieResults').innerHTML = '';
    document.getElementById('movieSearch').value = '';
    var endpoint = movie.type === 'movie' ? 'movie' : 'tv';
    try {
        var detailsRes = await fetch(TMDB_BASE_URL + '/' + endpoint + '/' + movie.id + '?language=pt-BR');
        var details = await detailsRes.json();
        selectedContent.genres = details.genres ? details.genres.map(function(g) { return g.name; }).join(', ') : 'N/A';
        if (movie.type === 'movie') { selectedContent.runtime = details.runtime ? Math.floor(details.runtime / 60) + 'h ' + (details.runtime % 60) + 'min' : 'N/A'; selectedContent.seasons = null; }
        else { selectedContent.runtime = details.episode_run_time && details.episode_run_time[0] ? details.episode_run_time[0] + 'min/ep' : 'N/A'; selectedContent.seasons = details.number_of_seasons ? details.number_of_seasons + ' temporada' + (details.number_of_seasons > 1 ? 's' : '') : null; }
        var watchRes = await fetch(TMDB_BASE_URL + '/' + endpoint + '/' + movie.id + '/watch');
        var watchData = await watchRes.json();
        var brProviders = (watchData.results && watchData.results.BR) ? (watchData.results.BR.flatrate || watchData.results.BR.ads || []) : [];
        if (brProviders.length > 0) { selectedContent.autoProvider = brProviders[0].provider_name; document.getElementById('platformAutoText').textContent = '(Detectado: ' + selectedContent.autoProvider + ')'; document.getElementById('moviePlatform').value = matchPlatform(selectedContent.autoProvider); }
        else { selectedContent.autoProvider = null; document.getElementById('platformAutoText').textContent = ''; }
    } catch (e) { console.error('Erro:', e); }
    if (movie.poster) { try { posterImage = await loadImage(movie.poster); } catch (e) { posterImage = null; } } else { posterImage = null; }
    document.getElementById('movieControls').classList.remove('hidden');
    document.getElementById('movieSelectedInfo').innerHTML = '<div class="flex gap-3 mb-3">' + (movie.poster ? '<img src="' + movie.poster + '" class="w-20 h-30 object-cover rounded">' : '') + '<div class="flex-1"><h3 class="font-oswald text-lg font-bold">' + movie.title + '</h3><p class="text-zinc-500 text-sm">' + movie.year + ' - ' + (movie.type === 'movie' ? 'Filme' : 'S\u00E9rie') + ' - ' + movie.rating + '</p><p class="text-zinc-400 text-xs mt-2 line-clamp-3">' + movie.overview + '</p></div></div><button onclick="copyMovieInfo()" class="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2">Copiar Informa\u00E7\u00F5es</button>';
    setTimeout(function() { generateMovieBanner(); }, 200);
}

function matchPlatform(name) {
    var map = { 'Netflix': 'Netflix', 'Amazon Prime Video': 'Amazon Prime Video', 'Prime Video': 'Amazon Prime Video', 'Disney Plus': 'Disney+', 'Disney+': 'Disney+', 'HBO Max': 'HBO Max', 'Max': 'Max', 'Apple TV Plus': 'Apple TV+', 'Apple TV+': 'Apple TV+', 'Paramount Plus': 'Paramount+', 'Paramount+': 'Paramount+', 'Globoplay': 'Globoplay', 'Star Plus': 'Star+', 'Star+': 'Star+', 'Crunchyroll': 'Crunchyroll' };
    return map[name] || '';
}

window.copyMovieInfo = function() {
    if (!selectedContent) return;
    var durationText = selectedContent.type === 'movie' ? selectedContent.runtime : (selectedContent.seasons || selectedContent.runtime);
    var info = '*' + selectedContent.title + '*\n\n' +
    '\uD83D\uDCC5: ' + selectedContent.year +
    '\n' + (selectedContent.type === 'movie' ? '\uD83C\uDFAC Filme' : '\uD83D\uDCFA S\u00E9rie') +
    '\n\u2B50: ' + selectedContent.rating +
    '\n\uD83C\uDFAD: ' + (selectedContent.genres || 'N/A') +
    '\n\u23F1\uFE0F: ' + (durationText || 'N/A') +
    '\n\n' + (selectedContent.overview || 'Sem sinopse');
    navigator.clipboard.writeText(info).then(function() { alert('Informa\u00E7\u00F5es copiadas!'); }).catch(function() { alert('Erro ao copiar'); });
};

function generateMovieBanner() {
    if (!selectedContent || currentMode !== 'movies') return;
    var isPost = currentFormat === 'post';
    var width = 1080;
    var height = isPost ? 1350 : 1920;
    canvas.width = width;
    canvas.height = height;
    canvas.style.maxWidth = isPost ? '400px' : '280px';
    canvas.style.display = 'block';
    renderMovieBannerToCtx(ctx, width, height, isPost);
}

function updateMovieFormatButtons() {
    var postBtn = document.getElementById('movieFormatPost');
    var storyBtn = document.getElementById('movieFormatStory');
    if (currentFormat === 'post') {
        postBtn.className = 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white';
        storyBtn.className = 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800';
    } else {
        storyBtn.className = 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white';
        postBtn.className = 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800';
    }
}

function downloadMovieBanner() {
    if (!selectedContent) { alert('Selecione um filme ou s\u00E9rie primeiro!'); return; }
    var hdCanvas = document.createElement('canvas');
    var isPost = currentFormat === 'post';
    var baseW = 1080;
    var baseH = isPost ? 1350 : 1920;
    var scale = 2;
    hdCanvas.width = baseW * scale;
    hdCanvas.height = baseH * scale;
    var hdCtx = hdCanvas.getContext('2d');
    hdCtx.imageSmoothingEnabled = true;
    hdCtx.imageSmoothingQuality = 'high';
    hdCtx.scale(scale, scale);
    renderMovieBannerToCtx(hdCtx, baseW, baseH, isPost);
    var dataUrl = hdCanvas.toDataURL('image/png');
    var link = document.createElement('a');
    link.download = selectedContent.title.replace(/[^a-zA-Z0-9]/g, '_') + '_' + currentFormat + '_FULLHD.png';
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function renderMovieBannerToCtx(c, width, height, isPost) {
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    if (posterImage) {
        var imgR = posterImage.width / posterImage.height;
        var canR = width / height;
        var dw, dh, ox, oy;
        if (imgR > canR) { dh = height; dw = height * imgR; ox = (width - dw) / 2; oy = 0; }
        else { dw = width; dh = width / imgR; ox = 0; oy = (height - dh) / 2; }
        c.drawImage(posterImage, ox, oy, dw, dh);
    } else { c.fillStyle = '#1a1a2e'; c.fillRect(0, 0, width, height); }
    var gradient = c.createLinearGradient(0, height * 0.15, 0, height);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.35, 'rgba(0,0,0,0.5)');
    gradient.addColorStop(0.6, 'rgba(0,0,0,0.8)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.95)');
    c.fillStyle = gradient;
    c.fillRect(0, 0, width, height);
    if (uploadedLogo) {
        c.save(); c.globalAlpha = 0.10;
        var pSize = 80; var logoR = uploadedLogo.width / uploadedLogo.height; var pW = pSize * logoR; var pH = pSize; var spX = pW + 60; var spY = pH + 60;
        c.translate(width / 2, height / 2); c.rotate(-30 * Math.PI / 180); c.translate(-width / 2, -height / 2);
        for (var py = -height; py < height * 2; py += spY) { for (var px = -width; px < width * 2; px += spX) { c.drawImage(uploadedLogo, px, py, pW, pH); } }
        c.restore();
        var cornerH = 300; var cornerW = cornerH * (uploadedLogo.width / uploadedLogo.height); c.globalAlpha = 1; c.drawImage(uploadedLogo, width - cornerW, 0, cornerW, cornerH);
    }
    var mPadding = 50; var footerY = height - mPadding; var boxH = 50;
    c.fillStyle = '#25D366'; roundRect(c, mPadding, footerY - boxH, 180, boxH, 8); c.fill();
    c.fillStyle = '#fff'; c.font = '600 20px Manrope, sans-serif'; c.textAlign = 'center';
    c.fillText(globalSettings.whatsappNumber || globalSettings.whatsappText, mPadding + 90, footerY - boxH / 2 + 7);
    c.fillStyle = '#ef4444'; roundRect(c, mPadding + 195, footerY - boxH, 180, boxH, 8); c.fill();
    c.fillStyle = '#fff'; c.font = '700 20px Manrope, sans-serif';
    c.fillText(globalSettings.ctaText, mPadding + 285, footerY - boxH / 2 + 7);
    var currentY = footerY - boxH - 25;
    var maxTextWidth = width - mPadding * 2;
    c.font = '400 24px Manrope, sans-serif'; c.fillStyle = 'rgba(255,255,255,0.9)'; c.textAlign = 'left';
    var maxLines = isPost ? 5 : 7;
    var synLines = wrapText(c, selectedContent.overview, maxTextWidth).slice(0, maxLines);
    currentY -= 10;
    for (var si = synLines.length - 1; si >= 0; si--) { c.fillText(synLines[si], mPadding, currentY); currentY -= 32; }
    currentY -= 15;
    c.font = '600 24px Manrope, sans-serif';
    var metaX = mPadding; var sep = '  \u2022  ';
    c.fillStyle = '#eab308'; var rt = '\u2605 ' + selectedContent.rating; c.fillText(rt, metaX, currentY); metaX += c.measureText(rt).width;
    c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillText(sep, metaX, currentY); metaX += c.measureText(sep).width;
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillText(selectedContent.year, metaX, currentY); metaX += c.measureText(selectedContent.year).width;
    if (selectedContent.genres !== 'N/A') { c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillText(sep, metaX, currentY); metaX += c.measureText(sep).width; c.fillStyle = 'rgba(255,255,255,0.9)'; var gg = selectedContent.genres.split(',')[0].trim(); c.fillText(gg, metaX, currentY); metaX += c.measureText(gg).width; }
    if (selectedContent.runtime !== 'N/A') { c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillText(sep, metaX, currentY); metaX += c.measureText(sep).width; c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillText(selectedContent.runtime, metaX, currentY); metaX += c.measureText(selectedContent.runtime).width; }
    var plat = (document.getElementById('moviePlatform') ? document.getElementById('moviePlatform').value : '') || selectedContent.autoProvider;
    if (plat) { c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillText(sep, metaX, currentY); metaX += c.measureText(sep).width; c.fillStyle = '#ef4444'; c.fillText(plat, metaX, currentY); }
    currentY -= 50;
    c.font = '700 68px Oswald, sans-serif'; c.fillStyle = '#fff';
    var titleLines = wrapText(c, selectedContent.title.toUpperCase(), maxTextWidth);
    for (var ti = titleLines.length - 1; ti >= 0; ti--) { c.fillText(titleLines[ti], mPadding, currentY); currentY -= 75; }
}
// ============================================
// VIDEO MODE (TRAILER MANUAL) - OTIMIZADO p/ WhatsApp HD
// - Canvas 1080x1920 (9:16 portrait - formato WhatsApp Status)
// - Área de vídeo: 1080x608 (16:9 no topo)
// - Chrome/Edge (MP4 nativo) → grava direto, pula FFmpeg (RÁPIDO)
// - Firefox/Safari (só WebM) → FFmpeg ultrafast + fastdecode
// - Camada estática cacheada + drawFrame travado em 30fps
// ============================================
async function loadVideoMode() {
    videoTypeFilter = 'both';
    uploadedVideoFile = null;
    if (uploadedVideoUrl) { try { URL.revokeObjectURL(uploadedVideoUrl); } catch(e) {} }
    uploadedVideoUrl = null;

    var nativeMp4Type = detectNativeMp4Support();
    var statusHtml;
    if (nativeMp4Type) {
        statusHtml = '<span class="text-green-400">\u26A1 MP4 nativo ativado (modo r\u00E1pido)</span>';
    } else if (ffmpegSupported()) {
        statusHtml = '<span class="text-green-400">\u2713 Convers\u00E3o WebM\u2192MP4 ativada</span>';
    } else {
        statusHtml = '<span class="text-yellow-400">\u26A0 Sem convers\u00E3o - v\u00EDdeo sair\u00E1 em WebM</span>';
    }

    controlPanel.innerHTML =
        '<header class="border-b border-zinc-800 pb-5"><h2 class="font-oswald text-2xl font-bold text-purple-400">Trailer em V\u00EDdeo</h2><p class="text-zinc-500 text-sm mt-2">Carregue um v\u00EDdeo MP4 e gere o banner otimizado para WhatsApp HD</p><p class="text-xs mt-2">' + statusHtml + '</p></header>' +
        '<section class="mt-5">' +
            '<label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold block mb-3">Tipo de Conte\u00FAdo</label>' +
            '<div class="flex gap-2">' +
                '<button id="videoTypeBoth" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white" data-testid="video-type-both">Ambos</button>' +
                '<button id="videoTypeMovie" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800" data-testid="video-type-movie">Filme</button>' +
                '<button id="videoTypeTv" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800" data-testid="video-type-tv">S\u00E9rie</button>' +
            '</div>' +
        '</section>' +
        '<section class="mt-5">' +
            '<label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold block mb-3">Buscar Filme ou S\u00E9rie</label>' +
            '<div class="relative">' +
                '<input type="text" id="videoSearch" placeholder="Digite o nome..." class="bg-black border-2 border-zinc-800 p-4 pr-14 text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 w-full rounded-lg" data-testid="video-search-input">' +
            '</div>' +
            '<div id="videoResults" class="mt-2 max-h-96 overflow-y-auto"></div>' +
        '</section>' +
        '<section id="videoControls" class="hidden flex flex-col gap-5 mt-5">' +
            '<div id="videoSelectedInfo" class="border border-zinc-800 p-4 bg-black/30 rounded-lg"></div>' +
            '<div class="border-2 border-dashed border-purple-500/40 rounded-lg p-5 bg-purple-900/10">' +
                '<label class="text-xs uppercase tracking-widest text-purple-300 font-semibold block mb-3">V\u00EDdeo MP4 (do dispositivo)</label>' +
                '<label class="cursor-pointer flex flex-col items-center gap-2 hover:bg-purple-900/20 transition-colors p-4 rounded">' +
                    '<svg class="w-10 h-10 text-purple-400" fill="currentColor" viewBox="0 0 256 256"><path d="M232,72H160V40a16,16,0,0,0-16-16H40A16,16,0,0,0,24,40V184a16,16,0,0,0,16,16H88v32a16,16,0,0,0,16,16H232a16,16,0,0,0,16-16V88A16,16,0,0,0,232,72ZM40,40H144V72H88a16,16,0,0,0-16,16v96H40Zm192,200H104V88H232V240Z"/></svg>' +
                    '<span id="videoFileName" class="text-sm text-purple-200 font-semibold">Clique para escolher MP4</span>' +
                    '<input type="file" id="videoFileInput" accept="video/mp4,video/*" class="hidden" data-testid="video-file-input">' +
                '</label>' +
                '<video id="videoPreview" class="w-full mt-3 rounded hidden" controls></video>' +
            '</div>' +
            '<section class="flex flex-col gap-2">' +
                '<label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Qualidade Final (WhatsApp HD)</label>' +
                '<select id="videoQuality" class="bg-black border border-zinc-800 p-3 text-white text-sm w-full rounded focus:outline-none focus:border-purple-500 appearance-none cursor-pointer">' +
                    '<option value="high" selected>Alta (HD ~8 Mbps, WhatsApp HD garantido)</option>' +
                    '<option value="medium">M\u00E9dia (~5 Mbps, bom equil\u00EDbrio)</option>' +
                    '<option value="low">Baixa (~2.5 Mbps, m\u00E1xima economia)</option>' +
                '</select>' +
            '</section>' +
            '<button id="videoGenerateBtn" class="w-full bg-purple-500 text-white font-bold uppercase tracking-widest py-4 hover:bg-purple-400 transition-all flex items-center justify-center gap-3 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" disabled data-testid="video-generate-btn">GERAR BANNER MP4 (1080x1920)</button>' +
            '<div id="videoProgressBox" class="hidden text-center"><p class="text-xs text-zinc-400 mb-2" id="videoProgressLabel">Gerando v\u00EDdeo...</p><div class="w-full bg-zinc-800 rounded-full h-2 overflow-hidden"><div id="videoProgressFill" class="h-full bg-purple-500 transition-all" style="width:0%"></div></div></div>' +
        '</section>';

    setTimeout(function() {
        var searchTimeout;
        document.getElementById('videoSearch').addEventListener('input', function(e) { clearTimeout(searchTimeout); searchTimeout = setTimeout(function() { searchVideos(e.target.value); }, 500); });
        document.getElementById('videoTypeBoth').addEventListener('click', function() { setVideoTypeFilter('both'); });
        document.getElementById('videoTypeMovie').addEventListener('click', function() { setVideoTypeFilter('movie'); });
        document.getElementById('videoTypeTv').addEventListener('click', function() { setVideoTypeFilter('tv'); });
        document.getElementById('videoFileInput').addEventListener('change', handleVideoFileUpload);
        document.getElementById('videoGenerateBtn').addEventListener('click', generateTrailerBannerVideo);
    }, 100);

    canvas.classList.add('hidden');
    videoContainer.classList.remove('hidden');
    videoContainer.innerHTML = '<div class="text-center p-12"><div class="text-8xl mb-6">\uD83C\uDFA5</div><h3 class="font-oswald text-3xl font-bold text-purple-400 mb-3">TRAILER EM V\u00CDEO</h3><p class="text-zinc-400 max-w-md mx-auto">1. Filtre por Filme/S\u00E9rie<br>2. Busque o t\u00EDtulo<br>3. Selecione o conte\u00FAdo<br>4. Carregue o v\u00EDdeo MP4 do dispositivo<br>5. Escolha qualidade e clique em <b>Gerar Banner MP4</b><br><br><span class="text-purple-400">\u2728 Formato 1080x1920 (9:16) otimizado para WhatsApp Status/Canais.<br>No Chrome/Edge o v\u00EDdeo \u00E9 gerado em MP4 nativo (sem recompress\u00E3o). Em outros navegadores, convertido automaticamente.</span></p></div>';
}

function setVideoTypeFilter(type) {
    videoTypeFilter = type;
    var btns = { both: document.getElementById('videoTypeBoth'), movie: document.getElementById('videoTypeMovie'), tv: document.getElementById('videoTypeTv') };
    Object.keys(btns).forEach(function(k) {
        if (!btns[k]) return;
        btns[k].className = (k === type)
            ? 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white'
            : 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800';
    });
    var inp = document.getElementById('videoSearch');
    if (inp && inp.value.trim()) searchVideos(inp.value);
}

async function searchVideos(query) {
    if (!query.trim()) { document.getElementById('videoResults').innerHTML = ''; return; }
    try {
        var fetches = [];
        if (videoTypeFilter === 'both' || videoTypeFilter === 'movie') {
            fetches.push(fetch(TMDB_BASE_URL + '/search/movie?language=pt-BR&query=' + encodeURIComponent(query)).then(function(r) { return r.json(); }));
        } else { fetches.push(Promise.resolve({ results: [] })); }
        if (videoTypeFilter === 'both' || videoTypeFilter === 'tv') {
            fetches.push(fetch(TMDB_BASE_URL + '/search/tv?language=pt-BR&query=' + encodeURIComponent(query)).then(function(r) { return r.json(); }));
        } else { fetches.push(Promise.resolve({ results: [] })); }
        var results = await Promise.all(fetches);
        var moviesData = results[0];
        var seriesData = results[1];
        var movies = (moviesData.results || []).slice(0, 8).map(function(m) { return { id: m.id, type: 'movie', title: m.title, year: m.release_date ? m.release_date.split('-')[0] : 'N/A', rating: m.vote_average ? m.vote_average.toFixed(1) : 'N/A', overview: m.overview || '', poster: m.poster_path ? getTmdbImgUrl(m.poster_path) : null }; });
        var series = (seriesData.results || []).slice(0, 8).map(function(s) { return { id: s.id, type: 'tv', title: s.name, year: s.first_air_date ? s.first_air_date.split('-')[0] : 'N/A', rating: s.vote_average ? s.vote_average.toFixed(1) : 'N/A', overview: s.overview || '', poster: s.poster_path ? getTmdbImgUrl(s.poster_path) : null }; });
        displayVideoResults(movies.concat(series));
    } catch (error) {
        console.error('Erro:', error);
        document.getElementById('videoResults').innerHTML = '<p class="text-red-500 text-sm p-3">Erro: configure TMDB_API_KEY no backend/.env</p>';
    }
}

function displayVideoResults(results) {
    var resultsDiv = document.getElementById('videoResults');
    if (results.length === 0) { resultsDiv.innerHTML = '<p class="text-zinc-500 text-sm p-3">Nenhum resultado</p>'; return; }
    resultsDiv.innerHTML = results.map(function(item, index) {
        return '<div class="search-result flex items-center gap-3 p-3 cursor-pointer border-b border-zinc-800 hover:bg-zinc-800/50 rounded" data-index="' + index + '">' +
            (item.poster ? '<img src="' + item.poster + '" class="w-12 h-16 object-cover rounded">' : '<div class="w-12 h-16 bg-zinc-800 rounded flex items-center justify-center">\uD83C\uDFAC</div>') +
            '<div class="flex-1 min-w-0"><p class="font-semibold text-sm truncate">' + item.title + '</p><p class="text-zinc-500 text-xs">' + item.year + ' - ' + (item.type === 'movie' ? 'Filme' : 'S\u00E9rie') + '</p></div></div>';
    }).join('');
    window.videoSearchResults = results;
    setTimeout(function() {
        document.querySelectorAll('#videoResults .search-result').forEach(function(el) {
            el.addEventListener('click', function() { selectVideoContent(window.videoSearchResults[parseInt(this.getAttribute('data-index'))]); });
        });
    }, 50);
}

async function selectVideoContent(content) {
    selectedContent = content;
    document.getElementById('videoResults').innerHTML = '';
    document.getElementById('videoSearch').value = '';
    document.getElementById('videoControls').classList.remove('hidden');

    var endpoint = content.type === 'movie' ? 'movie' : 'tv';
    try {
        var detailsRes = await fetch(TMDB_BASE_URL + '/' + endpoint + '/' + content.id + '?language=pt-BR');
        var details = await detailsRes.json();
        selectedContent.genres = details.genres ? details.genres.map(function(g) { return g.name; }).join(', ') : 'N/A';
        if (content.type === 'movie') { selectedContent.runtime = details.runtime ? Math.floor(details.runtime / 60) + 'h ' + (details.runtime % 60) + 'min' : 'N/A'; selectedContent.seasons = null; }
        else { selectedContent.runtime = details.episode_run_time && details.episode_run_time[0] ? details.episode_run_time[0] + 'min/ep' : 'N/A'; selectedContent.seasons = details.number_of_seasons ? details.number_of_seasons + ' temporada' + (details.number_of_seasons > 1 ? 's' : '') : null; }
        var watchRes = await fetch(TMDB_BASE_URL + '/' + endpoint + '/' + content.id + '/watch');
        var watchData = await watchRes.json();
        var brProviders = (watchData.results && watchData.results.BR) ? (watchData.results.BR.flatrate || watchData.results.BR.ads || []) : [];
        selectedContent.autoProvider = brProviders.length > 0 ? brProviders[0].provider_name : null;
    } catch (e) { console.error('Erro detalhes:', e); }

    posterImage = null;
    if (content.poster) {
        try { posterImage = await loadImage(content.poster); } catch (e) { posterImage = null; }
    }

    document.getElementById('videoSelectedInfo').innerHTML =
        '<div class="flex gap-3 mb-3">' +
            (content.poster ? '<img src="' + content.poster + '" class="w-20 h-30 object-cover rounded">' : '') +
            '<div class="flex-1"><h3 class="font-oswald text-lg font-bold">' + content.title + '</h3>' +
            '<p class="text-zinc-500 text-sm">' + content.year + ' - ' + (content.type === 'movie' ? 'Filme' : 'S\u00E9rie') + ' - \u2605 ' + content.rating + '</p>' +
            (selectedContent.genres ? '<p class="text-zinc-400 text-xs mt-1">' + selectedContent.genres + '</p>' : '') +
            (selectedContent.autoProvider ? '<p class="text-green-400 text-xs mt-1">Plataforma: ' + selectedContent.autoProvider + '</p>' : '') +
            '</div></div>' +
        '<button onclick="copyMovieInfo()" class="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2" data-testid="video-copy-info-btn">Copiar Informa\u00E7\u00F5es</button>';

    updateGenerateBtnState();
}

function handleVideoFileUpload(e) {
    var file = e.target.files[0];
    if (!file) return;
    if (uploadedVideoUrl) { try { URL.revokeObjectURL(uploadedVideoUrl); } catch(err) {} }
    uploadedVideoFile = file;
    uploadedVideoUrl = URL.createObjectURL(file);
    document.getElementById('videoFileName').textContent = file.name;
    var prev = document.getElementById('videoPreview');
    prev.src = uploadedVideoUrl;
    prev.classList.remove('hidden');
    updateGenerateBtnState();
}

function updateGenerateBtnState() {
    var btn = document.getElementById('videoGenerateBtn');
    if (!btn) return;
    btn.disabled = !(selectedContent && uploadedVideoFile);
}
// ============================================
// RENDER ESTÁTICO (cache) — só desenhado UMA vez
// Canvas 1080x1920 (9:16 portrait) para WhatsApp Status
// Área do vídeo: topo 608px (16:9)
// Inferior: poster + info do filme/série + rodapé WhatsApp/CTA
// ============================================
function renderStaticBannerLayer(oc, W, H, videoAreaH) {
    // fundo total
    oc.fillStyle = '#0a0a0a';
    oc.fillRect(0, 0, W, H);
    // moldura preta atrás do vídeo
    oc.fillStyle = '#000';
    oc.fillRect(0, 0, W, videoAreaH);

    // logo top-right
    if (uploadedLogo) {
        var logoR = uploadedLogo.width / uploadedLogo.height;
        var logoH = 120;
        var logoW = logoH * logoR;
        if (logoW > 280) { logoW = 280; logoH = logoW / logoR; }
        oc.save();
        oc.shadowColor = 'rgba(0,0,0,0.6)';
        oc.shadowBlur = 12;
        oc.drawImage(uploadedLogo, W - logoW - 20, 16, logoW, logoH);
        oc.restore();
    }

    // fundo inferior (gradient)
    var bottomY = videoAreaH;
    var bottomH = H - bottomY;
    var bgGrad = oc.createLinearGradient(0, bottomY, 0, H);
    bgGrad.addColorStop(0, '#0f0f12');
    bgGrad.addColorStop(1, '#050507');
    oc.fillStyle = bgGrad;
    oc.fillRect(0, bottomY, W, bottomH);

    // poster do filme - posicionado à esquerda
    var posterX = 36, posterY = bottomY + 24;
    var posterW = 240, posterH = 360;
    if (posterImage) {
        var pR = posterImage.width / posterImage.height;
        var aR2 = posterW / posterH;
        oc.save();
        oc.beginPath();
        roundRect(oc, posterX, posterY, posterW, posterH, 12);
        oc.clip();
        if (pR > aR2) {
            var dh2 = posterH; var dw2 = posterH * pR;
            oc.drawImage(posterImage, posterX - (dw2 - posterW) / 2, posterY, dw2, dh2);
        } else {
            var dw3 = posterW; var dh3 = posterW / pR;
            oc.drawImage(posterImage, posterX, posterY - (dh3 - posterH) / 2, dw3, dh3);
        }
        oc.restore();
    } else {
        oc.fillStyle = '#27272a';
        roundRect(oc, posterX, posterY, posterW, posterH, 12);
        oc.fill();
    }

    // bloco de texto à direita do poster
    var infoX = posterX + posterW + 30;
    var infoMaxW = W - infoX - 36;

    oc.textAlign = 'left';
    oc.font = '700 44px Oswald, sans-serif';
    var titleLines = wrapText(oc, selectedContent.title.toUpperCase(), infoMaxW).slice(0, 3);
    var titleH = titleLines.length * 50;
    oc.font = '400 18px Manrope, sans-serif';
    var synLines = wrapText(oc, selectedContent.overview || '', infoMaxW).slice(0, 10);
    var synH = synLines.length * 24;
    var gapTitleMeta = 14, gapMetaSyn = 20, metaH = 28;
    var totalTextH = titleH + gapTitleMeta + metaH + gapMetaSyn + synH;
    var posterCenterY = posterY + posterH / 2;
    var blockTop = posterCenterY - totalTextH / 2;
    var minTop = bottomY + 24;
    var maxBottom = H - 100;
    if (blockTop < minTop) blockTop = minTop;
    if (blockTop + totalTextH > maxBottom) blockTop = maxBottom - totalTextH;
    var curY = blockTop + 38;

    // título
    oc.font = '700 44px Oswald, sans-serif';
    oc.fillStyle = '#fff';
    for (var ti2 = 0; ti2 < titleLines.length; ti2++) {
        oc.fillText(titleLines[ti2], infoX, curY);
        curY += 50;
    }
    curY += gapTitleMeta - 4;

    // meta (rating, ano, gênero, plataforma)
    oc.font = '700 20px Manrope, sans-serif';
    var metaParts = [];
    if (selectedContent.rating && selectedContent.rating !== 'N/A') metaParts.push('\u2605 ' + selectedContent.rating);
    if (selectedContent.year && selectedContent.year !== 'N/A') metaParts.push(selectedContent.year);
    if (selectedContent.genres && selectedContent.genres !== 'N/A') metaParts.push(selectedContent.genres.split(',')[0].trim());
    var plat = selectedContent.autoProvider;
    if (plat) metaParts.push(plat);
    var mx = infoX;
    for (var mi2 = 0; mi2 < metaParts.length; mi2++) {
        var part = metaParts[mi2];
        if (mi2 === 0 && part.indexOf('\u2605') === 0) oc.fillStyle = '#eab308';
        else if (mi2 === metaParts.length - 1 && plat) oc.fillStyle = '#a855f7';
        else oc.fillStyle = '#fff';
        oc.fillText(part, mx, curY);
        mx += oc.measureText(part).width;
        if (mi2 < metaParts.length - 1) {
            oc.fillStyle = 'rgba(255,255,255,0.4)';
            var sepStr = '  \u2022  ';
            oc.fillText(sepStr, mx, curY);
            mx += oc.measureText(sepStr).width;
        }
    }
    curY += gapMetaSyn;

    // sinopse
    oc.font = '400 18px Manrope, sans-serif';
    oc.fillStyle = 'rgba(255,255,255,0.85)';
    for (var sj2 = 0; sj2 < synLines.length; sj2++) {
        oc.fillText(synLines[sj2], infoX, curY);
        curY += 24;
        if (curY > H - 80) break;
    }

    // rodapé (WhatsApp + CTA)
    var fY = H - 20;
    var fBoxH = 46, fBoxW = 180, spacing = 10;
    var totalW = fBoxW * 2 + spacing;
    var startX = W - totalW - 36;
    oc.fillStyle = '#25D366';
    roundRect(oc, startX, fY - fBoxH, fBoxW, fBoxH, 8);
    oc.fill();
    oc.fillStyle = '#fff';
    oc.font = '600 16px Manrope, sans-serif';
    oc.textAlign = 'center';
    oc.fillText(globalSettings.whatsappNumber || globalSettings.whatsappText, startX + fBoxW / 2, fY - fBoxH / 2 + 6);
    oc.fillStyle = '#ef4444';
    roundRect(oc, startX + fBoxW + spacing, fY - fBoxH, fBoxW, fBoxH, 8);
    oc.fill();
    oc.fillStyle = '#fff';
    oc.font = '700 17px Manrope, sans-serif';
    oc.fillText(globalSettings.ctaText, startX + fBoxW + spacing + fBoxW / 2, fY - fBoxH / 2 + 6);
}

// ============================================
// GERA BANNER VIDEO - OTIMIZADO p/ WhatsApp HD
// Canvas: 1080x1920 (9:16 portrait - formato WhatsApp Status)
// Vídeo: 1080x608 (16:9) no topo
// compressão H.264 High Profile Level 4.0 + AAC
// ============================================
async function generateTrailerBannerVideo() {
    if (!selectedContent || !uploadedVideoFile) { alert('Selecione um conte\u00FAdo e carregue um MP4'); return; }
    var btn = document.getElementById('videoGenerateBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner mx-auto"></div>';
    var progressBox = document.getElementById('videoProgressBox');
    var progressLabel = document.getElementById('videoProgressLabel');
    var progressFill = document.getElementById('videoProgressFill');
    progressBox.classList.remove('hidden');
    progressLabel.textContent = 'Preparando v\u00EDdeo...';
    progressFill.style.width = '5%';

    var quality = (document.getElementById('videoQuality') || {}).value || 'high';

    // Detecta suporte a MP4 nativo
    var nativeMp4Type = detectNativeMp4Support();
    var nativeMp4 = !!nativeMp4Type;
    var webmTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
    ];
    var mimeType = nativeMp4Type;
    if (!mimeType) {
        for (var wi = 0; wi < webmTypes.length; wi++) {
            if (window.MediaRecorder && MediaRecorder.isTypeSupported(webmTypes[wi])) { mimeType = webmTypes[wi]; break; }
        }
    }
    if (!mimeType) {
        btn.disabled = false;
        btn.innerHTML = 'GERAR BANNER MP4 (1080x1920)';
        progressBox.classList.add('hidden');
        alert('Navegador n\u00E3o suporta MediaRecorder');
        return;
    }

    // Bitrates otimizados para WhatsApp HD
    // WhatsApp marca como HD quando: H.264 High Profile, >=1280x720, ~6-8 Mbps
    // Formato 1080x1920 (portrait) com vídeo 1080x608 (16:9) no topo
    var recVideoBitrate, recAudioBitrate;
    if (quality === 'high')      { recVideoBitrate = nativeMp4 ? 8000000 : 10000000; recAudioBitrate = 192000; }
    else if (quality === 'low')  { recVideoBitrate = nativeMp4 ? 2500000 : 5000000; recAudioBitrate = 96000;  }
    else                         { recVideoBitrate = nativeMp4 ? 5000000 : 7000000; recAudioBitrate = 128000; }

    var srcVideo = null;
    var recorder = null;
    var failsafeTimer = null;
    var stopRequested = false;
    var audioCtxRef = null;
    var drawIntervalId = null;

    function cleanupVideoEl() {
        try { if (drawIntervalId) clearInterval(drawIntervalId); } catch(e) {}
        try { if (srcVideo && srcVideo.parentNode) srcVideo.parentNode.removeChild(srcVideo); } catch(e) {}
        try { if (audioCtxRef && audioCtxRef.state !== 'closed') audioCtxRef.close(); } catch(e) {}
    }

    try {
        // Canvas 1080x1920 (9:16 portrait) - formato WhatsApp Status
        var W = 1080, H = 1920;
        var videoAreaH = Math.round(W * 9 / 16); // 607px - área do vídeo 16:9 no topo

        // Canvas final (o que vai pro MediaRecorder)
        var outCanvas = document.createElement('canvas');
        outCanvas.width = W; outCanvas.height = H;
        var oc = outCanvas.getContext('2d', { alpha: false });
        oc.imageSmoothingEnabled = true;
        oc.imageSmoothingQuality = 'high';

        // Canvas offscreen com a camada ESTÁTICA (cache) - só desenhada 1 vez
        var staticCanvas = document.createElement('canvas');
        staticCanvas.width = W; staticCanvas.height = H;
        var sc = staticCanvas.getContext('2d', { alpha: false });
        sc.imageSmoothingEnabled = true;
        sc.imageSmoothingQuality = 'high';

        videoContainer.innerHTML = '<div class="text-center"><p class="text-purple-300 mb-3 font-semibold">Gerando banner v\u00EDdeo 1080x1920'
            + (nativeMp4 ? ' (modo r\u00E1pido MP4 nativo)' : ' (modo compat\u00EDvel)') + '...</p></div>';
        videoContainer.appendChild(outCanvas);
        outCanvas.style.maxWidth = '280px';
        outCanvas.style.borderRadius = '12px';
        outCanvas.style.boxShadow = '0 0 60px rgba(168,85,247,0.4)';

        srcVideo = document.createElement('video');
        srcVideo.src = uploadedVideoUrl;
        srcVideo.preload = 'auto';
        srcVideo.playsInline = true;
        srcVideo.muted = false;
        srcVideo.style.cssText = 'position:fixed;left:-99999px;top:-99999px;width:1px;height:1px;opacity:0;pointer-events:none;';
        document.body.appendChild(srcVideo);

        await new Promise(function(res, rej) {
            var done = false;
            var to = setTimeout(function() { if (!done) { done = true; rej(new Error('Timeout ao carregar MP4 (15s)')); } }, 15000);
            function ok() { if (done) return; done = true; clearTimeout(to); res(); }
            function fail() { if (done) return; done = true; clearTimeout(to); rej(new Error('Erro ao carregar MP4')); }
            srcVideo.addEventListener('canplay', ok, { once: true });
            srcVideo.addEventListener('loadeddata', ok, { once: true });
            srcVideo.addEventListener('error', fail, { once: true });
            if (srcVideo.readyState >= 3) ok();
        });

        // Renderiza a camada estática UMA VEZ no offscreen
        renderStaticBannerLayer(sc, W, H, videoAreaH);
        // Copia já pro canvas final (preview inicial)
        oc.drawImage(staticCanvas, 0, 0);

        progressLabel.textContent = 'Iniciando reprodu\u00E7\u00E3o...';
        progressFill.style.width = '10%';

        var audioStream = null;
        var audioCtx = null;
        try {
            var AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                audioCtx = new AudioCtx();
                audioCtxRef = audioCtx;
                if (audioCtx.state === 'suspended') { try { await audioCtx.resume(); } catch(e) {} }
                var sourceNode = audioCtx.createMediaElementSource(srcVideo);
                var destNode = audioCtx.createMediaStreamDestination();
                sourceNode.connect(destNode);
                var muteGain = audioCtx.createGain();
                muteGain.gain.value = 0;
                sourceNode.connect(muteGain);
                muteGain.connect(audioCtx.destination);
                audioStream = destNode.stream;
            }
        } catch(e) { console.warn('Web Audio API falhou:', e); }

        try { srcVideo.currentTime = 0; } catch(e) {}
        try { await srcVideo.play(); }
        catch(e) { throw new Error('N\u00E3o foi poss\u00EDvel reproduzir o v\u00EDdeo. Tente outro arquivo.'); }

        progressLabel.textContent = 'Configurando grava\u00E7\u00E3o...';
        progressFill.style.width = '15%';

        if (!audioStream) {
            try {
                if (typeof srcVideo.captureStream === 'function') audioStream = srcVideo.captureStream();
                else if (typeof srcVideo.mozCaptureStream === 'function') audioStream = srcVideo.mozCaptureStream();
            } catch(e) {}
        }

        var canvasStream = outCanvas.captureStream(30);
        var combinedTracks = [].concat(canvasStream.getVideoTracks());
        if (audioStream) audioStream.getAudioTracks().forEach(function(t) { combinedTracks.push(t); });
        var combinedStream = new MediaStream(combinedTracks);

        recorder = new MediaRecorder(combinedStream, {
            mimeType: mimeType,
            videoBitsPerSecond: recVideoBitrate,
            audioBitsPerSecond: recAudioBitrate
        });
        var chunks = [];
        recorder.ondataavailable = function(ev) { if (ev.data && ev.data.size > 0) chunks.push(ev.data); };
        recorder.onerror = function(e) { console.error('MediaRecorder error:', e); };

        var rawBlobPromise = new Promise(function(resolve, reject) {
            recorder.onstop = function() {
                try {
                    if (chunks.length === 0) { reject(new Error('Nenhum dado gravado.')); return; }
                    var ext = mimeType.indexOf('mp4') !== -1 ? 'mp4' : 'webm';
                    var blob = new Blob(chunks, { type: mimeType.split(';')[0] });
                    resolve({ blob: blob, ext: ext });
                } catch(err) { reject(err); }
            };
        });

        // ===================================================
        // drawFrame OTIMIZADO:
        // 1. Copia a camada estática (1 drawImage) - rápido
        // 2. Desenha SÓ a área do vídeo (topo 607px)
        // 30fps FIXOS (setInterval 33ms)
        // ===================================================
        function drawFrame() {
            // Copia toda a camada estática (poster, texto, rodapé, logo)
            oc.drawImage(staticCanvas, 0, 0);

            // Desenha SÓ o frame atual do vídeo na área superior (16:9)
            if (!srcVideo.paused && !srcVideo.ended && srcVideo.readyState >= 2) {
                var vR = srcVideo.videoWidth / srcVideo.videoHeight;
                var aR = W / videoAreaH;
                var dw, dh, ox, oy;
                if (vR > aR) { dw = W; dh = W / vR; ox = 0; oy = (videoAreaH - dh) / 2; }
                else { dh = videoAreaH; dw = videoAreaH * vR; ox = (W - dw) / 2; oy = 0; }
                try { oc.drawImage(srcVideo, ox, oy, dw, dh); } catch(e) {}
            }

            // Progresso
            if (srcVideo.duration > 0) {
                var topPct = nativeMp4 ? 95 : 50;
                var basePct = 15;
                var pct = Math.min(topPct, basePct + (srcVideo.currentTime / srcVideo.duration) * (topPct - basePct));
                progressFill.style.width = pct + '%';
                progressLabel.textContent = 'Gravando: ' + Math.floor(srcVideo.currentTime) + 's / ' + Math.floor(srcVideo.duration) + 's';
            }
        }

        function stopRecording(reason) {
            if (stopRequested) return;
            stopRequested = true;
            try { if (drawIntervalId) { clearInterval(drawIntervalId); drawIntervalId = null; } } catch(e) {}
            try { srcVideo.pause(); } catch(e) {}
            setTimeout(function() {
                try {
                    if (recorder && recorder.state !== 'inactive') {
                        recorder.requestData();
                        setTimeout(function() { try { if (recorder.state !== 'inactive') recorder.stop(); } catch(e) {} }, 100);
                    }
                } catch(e) {}
            }, 250);
        }

        srcVideo.addEventListener('ended', function() { stopRecording('ended'); });
        srcVideo.addEventListener('pause', function() {
            if (srcVideo.duration > 0 && srcVideo.currentTime >= srcVideo.duration - 0.2) stopRecording('pause-near-end');
        });
        srcVideo.addEventListener('timeupdate', function() {
            if (srcVideo.duration > 0 && srcVideo.currentTime >= srcVideo.duration - 0.05) stopRecording('timeupdate-end');
        });

        var maxMs = ((srcVideo.duration || 60) + 3) * 1000;
        failsafeTimer = setTimeout(function() { stopRecording('failsafe-timeout'); }, maxMs);

        progressLabel.textContent = 'Gravando...';
        progressFill.style.width = '20%';
        recorder.start(500);

        // Loop de desenho TRAVADO em 30fps
        drawIntervalId = setInterval(drawFrame, 1000 / 30);

        var rawResult = await rawBlobPromise;
        clearTimeout(failsafeTimer);
        cleanupVideoEl();

        // ============================================
        // FINALIZAÇÃO - Conversão FFmpeg se necessário
        // ============================================
        var finalBlob = rawResult.blob;
        var finalExt = rawResult.ext;
        var rawSizeMB = (rawResult.blob.size / 1024 / 1024).toFixed(2);
        var compressed = false;
        var nativeOut = false;

        if (nativeMp4 && rawResult.ext === 'mp4') {
            nativeOut = true;
            progressFill.style.width = '100%';
            progressLabel.textContent = 'Finalizando...';
        } else if (ffmpegSupported()) {
            try {
                progressLabel.textContent = 'Carregando compressor FFmpeg...';
                progressFill.style.width = '55%';
                var ffmpeg = await loadFFmpegOnce(function(ratio) {
                    var pct = 60 + Math.max(0, Math.min(1, ratio)) * 35;
                    progressFill.style.width = pct + '%';
                    progressLabel.textContent = 'Convertendo WebM \u2192 MP4... ' + Math.round(ratio * 100) + '%';
                });

                progressLabel.textContent = 'Convertendo WebM \u2192 MP4...';
                progressFill.style.width = '60%';

                var inputName = 'input.' + rawResult.ext;
                var outputName = 'output.mp4';
                var fetchFile = window.FFmpeg.fetchFile;
                ffmpeg.FS('writeFile', inputName, await fetchFile(rawResult.blob));

                // Configurações de compressão otimizados para WhatsApp HD
                // H.264 High Profile Level 4.0 + AAC + faststart
                // Resolução 1080x1920 mantida (portrait WhatsApp Status)
                var crf, maxrate, bufsize, audioBr;
                if (quality === 'high')      { crf = '20'; maxrate = '8000k'; bufsize = '16000k'; audioBr = '192k'; }
                else if (quality === 'low')  { crf = '26'; maxrate = '2500k'; bufsize = '5000k';  audioBr = '96k';  }
                else                         { crf = '22'; maxrate = '5000k'; bufsize = '10000k'; audioBr = '128k'; }

                // ultrafast + fastdecode = MUITO mais rápido em wasm
                // -vf scale=1080:1920 garante resolução exata para WhatsApp HD
                await ffmpeg.run(
                    '-i', inputName,
                    '-c:v', 'libx264',
                    '-preset', 'ultrafast',
                    '-tune', 'fastdecode',
                    '-profile:v', 'high',
                    '-level', '4.0',
                    '-pix_fmt', 'yuv420p',
                    '-crf', crf,
                    '-maxrate', maxrate,
                    '-bufsize', bufsize,
                    '-vf', 'scale=1080:1920:flags=fast_bilinear',
                    '-r', '30',
                    '-c:a', 'aac',
                    '-b:a', audioBr,
                    '-ar', '44100',
                    '-ac', '2',
                    '-movflags', '+faststart',
                    '-threads', '0',
                    '-y', outputName
                );

                var data = ffmpeg.FS('readFile', outputName);
                finalBlob = new Blob([data.buffer], { type: 'video/mp4' });
                finalExt = 'mp4';
                compressed = true;
                try { ffmpeg.FS('unlink', inputName); ffmpeg.FS('unlink', outputName); } catch(e) {}
            } catch (compErr) {
                console.error('Erro na compacta\u00E7\u00E3o FFmpeg, mantendo v\u00EDdeo original:', compErr);
            }
        }

        progressFill.style.width = '100%';
        progressLabel.textContent = 'Conclu\u00EDdo!';

        var finalSizeMB = (finalBlob.size / 1024 / 1024).toFixed(2);
        var savedPct = compressed ? Math.round((1 - finalBlob.size / rawResult.blob.size) * 100) : 0;
        var url = URL.createObjectURL(finalBlob);
        var safeTitle = (selectedContent.title || 'trailer').replace(/[^a-zA-Z0-9]/g, '_');
        var fileName = safeTitle + '_trailer_whatsapp_hd.' + finalExt;

        videoContainer.innerHTML = '';
        var infoDiv = document.createElement('div');
        infoDiv.className = 'text-center mb-4';
        var statusHtml2 = '';
        if (nativeOut) {
            statusHtml2 = '<p class="text-green-400 text-sm mb-1">\u26A1 MP4 nativo (H.264 + AAC) \u2014 sem recompress\u00E3o</p>' +
                          '<p class="text-zinc-300 text-xs">Tamanho: <b>' + finalSizeMB + ' MB</b> \u00B7 Qualidade: ' + quality.toUpperCase() + ' \u00B7 1080x1920 (WhatsApp HD)</p>';
        } else if (compressed) {
            statusHtml2 = '<p class="text-green-400 text-sm mb-1">\u2728 Convertido para MP4 (H.264 High Profile + AAC)</p>' +
                          '<p class="text-zinc-300 text-xs">Original: ' + rawSizeMB + ' MB \u2192 Final: <b>' + finalSizeMB + ' MB</b> ' +
                          '<span class="text-green-400">(-' + savedPct + '%)</span> \u00B7 1080x1920 (WhatsApp HD)</p>';
        } else {
            statusHtml2 = '<p class="text-yellow-400 text-xs mb-1">\u26A0 Sem convers\u00E3o dispon\u00EDvel - v\u00EDdeo original</p>' +
                          '<p class="text-zinc-400 text-xs">Tamanho: ' + finalSizeMB + ' MB \u00B7 Formato: ' + finalExt.toUpperCase() + '</p>';
        }
        infoDiv.innerHTML = '<h3 class="font-oswald text-2xl font-bold text-purple-400 mb-2">Banner gerado!</h3>' +
            '<p class="text-zinc-400 text-xs mb-2">1080x1920 (9:16) \u2014 Otimizado para WhatsApp Status/Canais HD</p>' +
            statusHtml2;
        videoContainer.appendChild(infoDiv);

        var vidEl = document.createElement('video');
        vidEl.src = url;
        vidEl.controls = true;
        vidEl.style.maxWidth = '280px';
        vidEl.style.borderRadius = '12px';
        vidEl.style.boxShadow = '0 0 60px rgba(168,85,247,0.5)';
        videoContainer.appendChild(vidEl);

        var dlBtn = document.createElement('a');
        dlBtn.href = url;
        dlBtn.download = fileName;
        dlBtn.className = 'inline-block mt-4 bg-purple-500 hover:bg-purple-400 text-white font-bold uppercase tracking-widest py-3 px-8 rounded-lg cursor-pointer';
        dlBtn.textContent = 'Baixar ' + fileName;
        dlBtn.setAttribute('data-testid', 'download-trailer-btn');
        videoContainer.appendChild(dlBtn);

        setTimeout(function() { progressBox.classList.add('hidden'); }, 1500);

        btn.disabled = false;
        btn.innerHTML = 'GERAR BANNER MP4 (1080x1920)';
    } catch (error) {
        console.error('Erro:', error);
        clearTimeout(failsafeTimer);
        cleanupVideoEl();
        try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch(e) {}
        alert('Erro ao gerar banner: ' + error.message);
        btn.disabled = false;
        btn.innerHTML = 'GERAR BANNER MP4 (1080x1920)';
        progressBox.classList.add('hidden');
    }
}
// ============================================
// UTILITIES
// ============================================
function showPlaceholder(icon, title, subtitle, color1, color2) {
    canvas.width = 1080;
    canvas.height = 1080;
    canvas.style.maxWidth = '400px';
    canvas.style.display = 'block';
    var gradient = ctx.createLinearGradient(0, 0, 0, 1080);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1080);
    ctx.font = '200px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(icon, 540, 450);
    ctx.font = '700 64px Oswald, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(title, 540, 580);
    ctx.font = '400 28px Manrope, sans-serif';
    ctx.fillStyle = '#71717a';
    ctx.fillText(subtitle, 540, 650);
}

function loadImage(url) {
    return new Promise(function(resolve, reject) {
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() { resolve(img); };
        img.onerror = reject;
        img.src = url;
    });
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
    if (!text) return [''];
    var words = text.split(' ');
    var lines = [];
    var currentLine = words[0] || '';
    for (var i = 1; i < words.length; i++) {
        var word = words[i];
        var width = ctx.measureText(currentLine + ' ' + word).width;
        if (width < maxWidth) { currentLine += ' ' + word; }
        else { lines.push(currentLine); currentLine = word; }
    }
    lines.push(currentLine);
    return lines;
}

// Init
loadGlobalSettings();
