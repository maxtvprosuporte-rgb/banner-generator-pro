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
let videoFormat = 'post';
let uploadedLogo = null;
let posterImage = null;
let currentTrailer = null;
let globalSettings = { logo: null, whatsappText: '(00) 00000-0000', ctaText: 'ASSINA JÁ', instagramHandle: '@seuinstagram' };

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
// CARREGAR LOGO PADRÃO - tenta raiz e subpastas
// ============================================
function loadDefaultLogo() {
    var folders = ['', 'img/', 'assets/', 'images/', 'static/', 'public/'];
    var extensions = ['logo.PNG', 'logo.png', 'logo.jpg', 'logo.jpeg', 'logo.webp', 'logo.svg'];
    var paths = [];
    folders.forEach(function(folder) {
        extensions.forEach(function(ext) {
            paths.push(folder + ext);
        });
    });
    
    var tried = 0;
    function tryNext() {
        if (tried >= paths.length) {
            console.log('ℹ️ Nenhuma logo padrão encontrada. Tentativas: ' + paths.slice(0, 10).join(', ') + '...');
            return;
        }
        var path = paths[tried];
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
            uploadedLogo = img;
            console.log('✅ Logo padrão carregada: ' + path + ' (' + img.width + 'x' + img.height + ')');
            var slt = document.getElementById('settingsLogoText');
            var slr = document.getElementById('settingsRemoveLogo');
            if (slt) slt.textContent = 'Logo padrão (' + path + ')';
            if (slr) slr.classList.remove('hidden');
        };
        img.onerror = function() {
            tried++;
            tryNext();
        };
        img.src = path;
        tried++;
    }
    tryNext();
}

// ============================================
// SETTINGS
// ============================================
function loadGlobalSettings() {
    try {
        var saved = localStorage.getItem('bannerGeneratorSettings');
        if (saved) {
            globalSettings = JSON.parse(saved);
            console.log('✅ Configurações carregadas do localStorage:', {
                logo: globalSettings.logo ? 'Presente (' + globalSettings.logo.length + ' chars)' : 'Ausente',
                whatsapp: globalSettings.whatsappText,
                cta: globalSettings.ctaText
            });
            if (globalSettings.logo) {
                var img = new Image();
                img.onload = function() { 
                    uploadedLogo = img;
                    console.log('✅ Logo carregada com sucesso:', img.width + 'x' + img.height);
                };
                img.onerror = function() {
                    console.error('❌ Erro ao carregar logo do localStorage');
                    // Tentar remover logo corrompida
                    globalSettings.logo = null;
                    localStorage.setItem('bannerGeneratorSettings', JSON.stringify(globalSettings));
                    // Tentar carregar logo padrão da raiz
                    loadDefaultLogo();
                };
                img.src = globalSettings.logo;
                var slt = document.getElementById('settingsLogoText');
                var slr = document.getElementById('settingsRemoveLogo');
                if (slt) slt.textContent = 'Logo carregada';
                if (slr) slr.classList.remove('hidden');
            } else {
                // Se não há logo salva, tentar carregar logo padrão da raiz
                loadDefaultLogo();
            }
            var w1 = document.getElementById('settingsInstagramHandle');
            var w2 = document.getElementById('settingsWhatsappText');
            var w3 = document.getElementById('settingsCtaText');
            if (w1) w1.value = globalSettings.instagramHandle || '@seuinstagram';
            if (w2) w2.value = globalSettings.whatsappText || '(00) 00000-0000';
            if (w3) w3.value = globalSettings.ctaText || 'ASSINA JÁ';
        } else {
            console.log('ℹ️ Nenhuma configuração salva encontrada');
            // Tentar carregar logo padrão da raiz
            loadDefaultLogo();
        }
    } catch (e) { 
        console.error('❌ Erro ao carregar configurações:', e); 
        // Tentar carregar logo padrão da raiz
        loadDefaultLogo();
    }
}

function openSettings() { document.getElementById('settingsModal').classList.add('active'); }
function closeSettings() { document.getElementById('settingsModal').classList.remove('active'); }

document.getElementById('settingsModal').addEventListener('click', function(e) {
    if (e.target === this) closeSettings();
});

function saveSettings() {
    globalSettings.instagramHandle = document.getElementById('settingsInstagramHandle').value;
    globalSettings.whatsappText = document.getElementById('settingsWhatsappText').value;
    globalSettings.ctaText = document.getElementById('settingsCtaText').value;
    // Logo já foi atribuído a globalSettings.logo no event listener do input
    localStorage.setItem('bannerGeneratorSettings', JSON.stringify(globalSettings));
    console.log('✅ Configurações salvas:', {
        logo: globalSettings.logo ? 'Presente' : 'Ausente',
        instagram: globalSettings.instagramHandle,
        whatsapp: globalSettings.whatsappText,
        cta: globalSettings.ctaText
    });
    alert('Configurações salvas!');
    closeSettings();
}

document.getElementById('settingsLogoInput').addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (file) {
        // Verificar tamanho do arquivo (max 2MB para localStorage)
        if (file.size > 2 * 1024 * 1024) {
            alert('A imagem é muito grande (máximo 2MB). Por favor, use uma imagem menor.');
            return;
        }
        
        var reader = new FileReader();
        reader.onload = function(ev) {
            // Comprimir imagem antes de salvar
            var img = new Image();
            img.onload = function() {
                // Redimensionar se for muito grande
                var maxWidth = 400;
                var maxHeight = 400;
                var width = img.width;
                var height = img.height;
                
                if (width > maxWidth || height > maxHeight) {
                    var ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = width * ratio;
                    height = height * ratio;
                }
                
                // Criar canvas para comprimir
                var canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Detectar transparência: se algum pixel tiver alpha < 255, usar PNG
                var hasTransparency = false;
                try {
                    var pixelData = ctx.getImageData(0, 0, width, height).data;
                    for (var px = 3; px < pixelData.length; px += 4) {
                        if (pixelData[px] < 255) { hasTransparency = true; break; }
                    }
                } catch(e) {}
                
                // Converter para data URL preservando transparência (PNG) ou comprimindo (JPEG)
                var compressedDataUrl = hasTransparency
                    ? canvas.toDataURL('image/png')
                    : canvas.toDataURL('image/jpeg', 0.8);
                
                globalSettings.logo = compressedDataUrl;
                uploadedLogo = img;
                
                // Salvar automaticamente no localStorage
                try {
                    localStorage.setItem('bannerGeneratorSettings', JSON.stringify(globalSettings));
                    console.log('✅ Logo comprimida e salva automaticamente no localStorage');
                } catch (e) {
                    console.error('❌ Erro ao salvar logo no localStorage:', e);
                    if (e.name === 'QuotaExceededError') {
                        alert('Erro: localStorage cheio. Tente usar uma imagem menor.');
                    }
                }
            };
            img.onerror = function() {
                console.error('❌ Erro ao carregar imagem da logo');
            };
            img.src = ev.target.result;
            document.getElementById('settingsLogoText').textContent = file.name;
            document.getElementById('settingsRemoveLogo').classList.remove('hidden');
        };
        reader.onerror = function() {
            console.error('❌ Erro ao ler arquivo da logo');
            alert('Erro ao ler o arquivo. Tente novamente.');
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
        var cornerH = 240; var cornerW = cornerH * (uploadedLogo.width / uploadedLogo.height); c.globalAlpha = 1; c.drawImage(uploadedLogo, width - cornerW - 25, 25, cornerW, cornerH);
    }
    var mPadding = 50; var footerY = height - mPadding; var boxH = 50;
    c.fillStyle = '#25D366'; roundRect(c, mPadding, footerY - boxH, 180, boxH, 8); c.fill();
    c.fillStyle = '#fff'; c.font = '600 20px Manrope, sans-serif'; c.textAlign = 'center';
    c.fillText(globalSettings.whatsappText, mPadding + 90, footerY - boxH / 2 + 7);
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
// VIDEO MODE (TRAILER MANUAL) - OTIMIZADO p/ WhatsApp
// - Canvas 1080x1080 (1:1 square)
// - Área de vídeo: 1080x607 (16:9 no topo)
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
        '<header class="border-b border-zinc-800 pb-5"><h2 class="font-oswald text-2xl font-bold text-purple-400">Trailer em Vídeo</h2><p class="text-zinc-500 text-sm mt-2">Carregue um vídeo MP4 e gere o banner otimizado para WhatsApp (1080x1080)</p><p class="text-xs mt-2">' + statusHtml + '</p></header>' +
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
                '<label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Formato</label>' +
                '<div class="flex gap-2">' +
                    '<button id="videoFormatPost" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white">Post (1:1)</button>' +
                    '<button id="videoFormatStory" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800">Story (9:16)</button>' +
                '</div>' +
            '</section>' +
            '<section class="flex flex-col gap-2">' +
                '<label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Qualidade Final (WhatsApp HD)</label>' +
                '<select id="videoQuality" class="bg-black border border-zinc-800 p-3 text-white text-sm w-full rounded focus:outline-none focus:border-purple-500 appearance-none cursor-pointer">' +
                    '<option value="high" selected>Alta (HD ~8 Mbps, WhatsApp HD garantido)</option>' +
                    '<option value="medium">M\u00E9dia (~5 Mbps, bom equil\u00EDbrio)</option>' +
                    '<option value="low">Baixa (~2.5 Mbps, m\u00E1xima economia)</option>' +
                '</select>' +
            '</section>' +
            '<button id="videoGenerateBtn" class="w-full bg-purple-500 text-white font-bold uppercase tracking-widest py-4 hover:bg-purple-400 transition-all flex items-center justify-center gap-3 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" disabled data-testid="video-generate-btn">GERAR BANNER MP4 (1080x1080)</button>' +
            '<div id="videoProgressBox" class="hidden text-center"><p class="text-xs text-zinc-400 mb-2" id="videoProgressLabel">Gerando v\u00EDdeo...</p><div class="w-full bg-zinc-800 rounded-full h-2 overflow-hidden"><div id="videoProgressFill" class="h-full bg-purple-500 transition-all" style="width:0%"></div></div></div>' +
        '</section>';

    setTimeout(function() {
        var searchTimeout;
        document.getElementById('videoSearch').addEventListener('input', function(e) { clearTimeout(searchTimeout); searchTimeout = setTimeout(function() { searchVideos(e.target.value); }, 500); });
        document.getElementById('videoTypeBoth').addEventListener('click', function() { setVideoTypeFilter('both'); });
        document.getElementById('videoTypeMovie').addEventListener('click', function() { setVideoTypeFilter('movie'); });
        document.getElementById('videoTypeTv').addEventListener('click', function() { setVideoTypeFilter('tv'); });
        document.getElementById('videoFormatPost').addEventListener('click', function() { videoFormat = 'post'; updateVideoFormatButtons(); });
        document.getElementById('videoFormatStory').addEventListener('click', function() { videoFormat = 'story'; updateVideoFormatButtons(); });
        document.getElementById('videoFileInput').addEventListener('change', handleVideoFileUpload);
        document.getElementById('videoGenerateBtn').addEventListener('click', generateTrailerBannerVideo);
    }, 100);

    canvas.classList.add('hidden');
    videoContainer.classList.remove('hidden');
    videoContainer.innerHTML = '<div class="text-center p-12"><div class="text-8xl mb-6">\uD83C\uDFA5</div><h3 class="font-oswald text-3xl font-bold text-purple-400 mb-3">TRAILER EM V\u00CDEO</h3><p class="text-zinc-400 max-w-md mx-auto">1. Filtre por Filme/S\u00E9rie<br>2. Busque o t\u00EDtulo<br>3. Selecione o conte\u00FAdo<br>4. Carregue o v\u00EDdeo MP4 do dispositivo<br>5. Escolha qualidade e clique em <b>Gerar Banner MP4</b><br><br><span class="text-purple-400">\u2728 Formato 1080x1080 (1:1) otimizado para WhatsApp.<br>No Chrome/Edge o v\u00EDdeo \u00E9 gerado em MP4 nativo (sem recompress\u00E3o). Em outros navegadores, convertido automaticamente.</span></p></div>';
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

function updateVideoFormatButtons() {
    var postBtn = document.getElementById('videoFormatPost');
    var storyBtn = document.getElementById('videoFormatStory');
    if (videoFormat === 'post') {
        postBtn.className = 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white';
        storyBtn.className = 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800';
    } else {
        storyBtn.className = 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white';
        postBtn.className = 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800';
    }
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
// Canvas 1080x1080 (1:1 square)
// Layout: Vídeo no topo (16:9) + Informações organizadas abaixo
// ============================================
function renderStaticBannerLayer(oc, W, H, videoAreaH) {
    // Fundo total (preto)
    oc.fillStyle = '#000';
    oc.fillRect(0, 0, W, H);

    // Área do vídeo (topo) - será preenchida pelo drawFrame
    oc.fillStyle = '#000';
    oc.fillRect(0, 0, W, videoAreaH);

    // Área de informações (inferior) - fundo gradiente
    var infoAreaY = videoAreaH;
    var infoAreaH = H - videoAreaH;
    
    var bgGrad = oc.createLinearGradient(0, infoAreaY, 0, H);
    bgGrad.addColorStop(0, '#0a0a0a');
    bgGrad.addColorStop(1, '#050505');
    oc.fillStyle = bgGrad;
    oc.fillRect(0, infoAreaY, W, infoAreaH);

    // Logo no canto superior direito (sobre o vídeo)
    if (uploadedLogo) {
        var logoR = uploadedLogo.width / uploadedLogo.height;
        var logoH = 140;
        var logoW = logoH * logoR;
        if (logoW > 320) { logoW = 320; logoH = logoW / logoR; }
        oc.save();
        oc.globalAlpha = 1.0;
        oc.drawImage(uploadedLogo, W - logoW - 25, 25, logoW, logoH);
        oc.restore();
    }

    // ======== INFO AREA: poster ESQUERDA + conteúdo DIREITA ========
    var pad = 40;
    var posterW = 210, posterH = 315;
    var posterX = pad;
    var posterY = infoAreaY + pad;
    var contentX = posterX + posterW + 30;
    var contentMaxW = W - contentX - pad;

    // Poster do filme (à esquerda)
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
        
        // Borda sutil no poster
        oc.strokeStyle = 'rgba(255,255,255,0.1)';
        oc.lineWidth = 2;
        oc.beginPath();
        roundRect(oc, posterX, posterY, posterW, posterH, 12);
        oc.stroke();
    } else {
        oc.fillStyle = '#1a1a1a';
        roundRect(oc, posterX, posterY, posterW, posterH, 12);
        oc.fill();
    }

    // Calcula a altura total do conteúdo para centralizar verticalmente em relação ao poster
    oc.font = '700 48px Oswald, sans-serif';
    var titleLines = wrapText(oc, selectedContent.title.toUpperCase(), contentMaxW).slice(0, 2);
    var titleBlockH = titleLines.length * 55;

    var metaParts = [];
    if (selectedContent.rating && selectedContent.rating !== 'N/A') metaParts.push({ text: '\u2605 ' + selectedContent.rating, color: '#eab308' });
    if (selectedContent.year && selectedContent.year !== 'N/A') metaParts.push({ text: selectedContent.year, color: 'rgba(255,255,255,0.9)' });
    if (selectedContent.genres && selectedContent.genres !== 'N/A') metaParts.push({ text: selectedContent.genres.split(',')[0].trim(), color: 'rgba(255,255,255,0.9)' });
    if (selectedContent.runtime && selectedContent.runtime !== 'N/A') metaParts.push({ text: selectedContent.runtime, color: 'rgba(255,255,255,0.9)' });
    var plat = selectedContent.autoProvider;
    if (plat) metaParts.push({ text: plat, color: '#ef4444' });
    var metaBlockH = 22;

    oc.font = '400 20px Manrope, sans-serif';
    var synLines = wrapText(oc, selectedContent.overview || '', contentMaxW).slice(0, 5);
    var synBlockH = synLines.length * 28;

    var gap1 = 10, gap2 = 30;
    var totalContentH = titleBlockH + gap1 + metaBlockH + gap2 + synBlockH;
    var curY = posterY + Math.max(0, (posterH - totalContentH) / 2);

    // Título
    oc.textAlign = 'left';
    oc.font = '700 48px Oswald, sans-serif';
    oc.fillStyle = '#fff';
    oc.shadowColor = 'rgba(0,0,0,0.8)';
    oc.shadowBlur = 10;
    curY += 48;
    for (var ti2 = 0; ti2 < titleLines.length; ti2++) {
        oc.fillText(titleLines[ti2], contentX, curY);
        curY += 55;
    }
    oc.shadowBlur = 0;

    // Meta
    curY += gap1;
    oc.font = '600 24px Manrope, sans-serif';
    var sep = '  \u2022  ';
    var metaCursorX = contentX;
    for (var mi = 0; mi < metaParts.length; mi++) {
        if (mi > 0) {
            oc.fillStyle = 'rgba(255,255,255,0.6)';
            oc.fillText(sep, metaCursorX, curY);
            metaCursorX += oc.measureText(sep).width;
        }
        oc.fillStyle = metaParts[mi].color;
        oc.fillText(metaParts[mi].text, metaCursorX, curY);
        metaCursorX += oc.measureText(metaParts[mi].text).width;
    }

    // Sinopse
    curY += gap2;
    oc.font = '400 20px Manrope, sans-serif';
    oc.fillStyle = 'rgba(255,255,255,0.8)';
    for (var sj2 = 0; sj2 < synLines.length; sj2++) {
        oc.fillText(synLines[sj2], contentX, curY);
        curY += 28;
    }

    // Botões WhatsApp + CTA (lado a lado, alinhados com o conteúdo à direita do poster)
    var btnH = 55, btnGap = 15;
    var btnW2 = Math.floor((contentMaxW - btnGap) / 2);
    var btnY = H - btnH - 30;

    // Botão WhatsApp (esquerda)
    oc.fillStyle = '#25D366';
    roundRect(oc, contentX, btnY, btnW2, btnH, 10);
    oc.fill();
    oc.fillStyle = '#fff';
    oc.font = '700 22px Manrope, sans-serif';
    oc.textAlign = 'center';
    oc.fillText(globalSettings.whatsappText, contentX + btnW2 / 2, btnY + btnH / 2 + 7);

    // Botão CTA (direita)
    var btnX2 = contentX + btnW2 + btnGap;
    oc.fillStyle = '#ef4444';
    roundRect(oc, btnX2, btnY, btnW2, btnH, 10);
    oc.fill();
    oc.fillStyle = '#fff';
    oc.font = '800 24px Manrope, sans-serif';
    oc.fillText(globalSettings.ctaText, btnX2 + btnW2 / 2, btnY + btnH / 2 + 7);

    oc.textAlign = 'left';
}

// ============================================
// RENDER ESTÁTICO STORY (cache) — 1080x1920 (9:16 vertical)
// Layout: Fundo = capa do filme + degradê escuro embaixo
// Vídeo no centro + Logo no topo + Info centralizada + Boxes embaixo
// ============================================
function renderStaticStoryLayer(oc, W, H, videoAreaH) {
    // Fundo: poster/capa do filme cobrindo tudo
    if (posterImage) {
        var pR = posterImage.width / posterImage.height;
        var canR = W / H;
        var dw, dh, ox, oy;
        if (pR > canR) {
            dh = H;
            dw = H * pR;
            ox = (W - dw) / 2;
            oy = 0;
        } else {
            dw = W;
            dh = W / pR;
            ox = 0;
            oy = (H - dh) / 2;
        }
        oc.drawImage(posterImage, ox, oy, dw, dh);
    } else {
        oc.fillStyle = '#1a1a2e';
        oc.fillRect(0, 0, W, H);
    }

    // Degradê escuro do meio para baixo
    var gradStartY = H * 0.3;
    var grad = oc.createLinearGradient(0, gradStartY, 0, H);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.25, 'rgba(0,0,0,0.5)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.8)');
    grad.addColorStop(0.75, 'rgba(0,0,0,0.9)');
    grad.addColorStop(1, 'rgba(0,0,0,0.95)');
    oc.fillStyle = grad;
    oc.fillRect(0, 0, W, H);

    // Degradê escuro no topo (para logo)
    var gradTop = oc.createLinearGradient(0, 0, 0, 200);
    gradTop.addColorStop(0, 'rgba(0,0,0,0.7)');
    gradTop.addColorStop(1, 'rgba(0,0,0,0)');
    oc.fillStyle = gradTop;
    oc.fillRect(0, 0, W, 200);

    // ===== TOPO: Logo (apenas) =====
    var topPad = 35;
    if (uploadedLogo) {
        var logoR = uploadedLogo.width / uploadedLogo.height;
        var logoH = 90;
        var logoW = logoH * logoR;
        if (logoW > 260) { logoW = 260; logoH = logoW / logoR; }
        // Centraliza a logo no topo
        oc.drawImage(uploadedLogo, (W - logoW) / 2, topPad, logoW, logoH);
    }

    // ===== CENTRO: Área do vídeo (será preenchida pelo drawFrame) =====
    var videoY = Math.round((H - videoAreaH) / 2) - 150;
    // Borda sutil ao redor da área do vídeo
    oc.strokeStyle = 'rgba(255,255,255,0.15)';
    oc.lineWidth = 2;
    roundRect(oc, 0, videoY, W, videoAreaH, 0);
    oc.stroke();

    // ===== ÁREA DE INFORMAÇÕES (abaixo do vídeo) =====
    var infoAreaStartY = videoY + videoAreaH;
    var infoAreaH = H - infoAreaStartY - 40; // 40px margem inferior
    var pad = 60;
    var maxW = W - pad * 2;

    // Calcula altura de cada bloco para centralizar verticalmente
    oc.font = '700 52px Oswald, sans-serif';
    var titleLines = wrapText(oc, selectedContent.title.toUpperCase(), maxW).slice(0, 2);
    var titleH = titleLines.length * 58;

    var metaH = 30;

    oc.font = '400 22px Manrope, sans-serif';
    var synLines = wrapText(oc, selectedContent.overview || '', maxW).slice(0, 3);
    var synH = synLines.length * 30;

    var logoBlockH = uploadedLogo ? 80 : 0;
    var boxRowH = 70; // altura da linha de boxes

    var gap1 = 20, gap2 = 25, gap3 = 30, gap4 = 40;
    var totalInfoH = titleH + gap1 + metaH + gap2 + synH + gap3 + logoBlockH + gap4 + boxRowH;

    // Centraliza verticalmente no espaço disponível
    var curY = infoAreaStartY + Math.max(20, (infoAreaH - totalInfoH) / 2);

    // Título
    oc.font = '700 52px Oswald, sans-serif';
    oc.fillStyle = '#fff';
    oc.textAlign = 'center';
    oc.shadowColor = 'rgba(0,0,0,0.9)';
    oc.shadowBlur = 12;
    for (var ti = 0; ti < titleLines.length; ti++) {
        oc.fillText(titleLines[ti], W / 2, curY);
        curY += 58;
    }
    oc.shadowBlur = 0;

    // Meta
    curY += gap1;
    oc.font = '600 24px Manrope, sans-serif';
    var metaParts = [];
    if (selectedContent.rating && selectedContent.rating !== 'N/A') metaParts.push({ text: '\u2605 ' + selectedContent.rating, color: '#eab308' });
    if (selectedContent.year && selectedContent.year !== 'N/A') metaParts.push({ text: selectedContent.year, color: 'rgba(255,255,255,0.9)' });
    if (selectedContent.genres && selectedContent.genres !== 'N/A') metaParts.push({ text: selectedContent.genres.split(',')[0].trim(), color: 'rgba(255,255,255,0.9)' });
    if (selectedContent.runtime && selectedContent.runtime !== 'N/A') metaParts.push({ text: selectedContent.runtime, color: 'rgba(255,255,255,0.9)' });
    var plat = selectedContent.autoProvider;
    if (plat) metaParts.push({ text: plat, color: '#ef4444' });

    var sep = '  \u2022  ';
    var totalMetaW = 0;
    for (var mi = 0; mi < metaParts.length; mi++) {
        if (mi > 0) totalMetaW += oc.measureText(sep).width;
        totalMetaW += oc.measureText(metaParts[mi].text).width;
    }
    var metaCursorX = (W - totalMetaW) / 2;
    for (var mi = 0; mi < metaParts.length; mi++) {
        if (mi > 0) {
            oc.fillStyle = 'rgba(255,255,255,0.6)';
            oc.fillText(sep, metaCursorX, curY);
            metaCursorX += oc.measureText(sep).width;
        }
        oc.fillStyle = metaParts[mi].color;
        oc.fillText(metaParts[mi].text, metaCursorX, curY);
        metaCursorX += oc.measureText(metaParts[mi].text).width;
    }

    // Sinopse
    curY += gap2;
    oc.font = '400 22px Manrope, sans-serif';
    oc.fillStyle = 'rgba(255,255,255,0.85)';
    oc.textAlign = 'center';
    for (var sj = 0; sj < synLines.length; sj++) {
        oc.fillText(synLines[sj], W / 2, curY);
        curY += 30;
    }

    // Logo (após sinopse)
    if (uploadedLogo && logoBlockH > 0) {
        curY += gap3;
        var sLogoR = uploadedLogo.width / uploadedLogo.height;
        var sLogoH = 70;
        var sLogoW = sLogoH * sLogoR;
        if (sLogoW > 220) { sLogoW = 220; sLogoH = sLogoW / sLogoR; }
        oc.drawImage(uploadedLogo, (W - sLogoW) / 2, curY - 10, sLogoW, sLogoH);
    }

    // ===== BOXES: @Instagram + WhatsApp + CTA (linha única, com espaçamento) =====
    curY += gap4;
    var boxH = 65;
    var boxGap = 12;
    var boxW = Math.floor((maxW - boxGap * 2) / 3);
    var boxY = curY + (boxRowH - boxH) / 2;

    // Box @Instagram (gradiente Instagram: laranja → rosa → roxo)
    var instaBoxX = pad;
    var instaGrad = oc.createLinearGradient(instaBoxX, boxY, instaBoxX + boxW, boxY + boxH);
    instaGrad.addColorStop(0, '#f09433');
    instaGrad.addColorStop(0.3, '#e6683c');
    instaGrad.addColorStop(0.6, '#dc2743');
    instaGrad.addColorStop(0.8, '#cc2366');
    instaGrad.addColorStop(1, '#bc1888');
    oc.fillStyle = instaGrad;
    roundRect(oc, instaBoxX, boxY, boxW, boxH, 10);
    oc.fill();
    // Ícone Instagram + @handle
    oc.fillStyle = '#fff';
    oc.font = '700 20px Manrope, sans-serif';
    oc.textAlign = 'center';
    var instaHandle = globalSettings.instagramHandle || '@seuinstagram';
    oc.fillText(instaHandle, instaBoxX + boxW / 2, boxY + boxH / 2 + 7);

    // Box WhatsApp (verde)
    var wppBoxX = pad + boxW + boxGap;
    oc.fillStyle = '#25D366';
    roundRect(oc, wppBoxX, boxY, boxW, boxH, 10);
    oc.fill();
    oc.fillStyle = '#fff';
    oc.font = '700 18px Manrope, sans-serif';
    oc.fillText(globalSettings.whatsappText, wppBoxX + boxW / 2, boxY + boxH / 2 + 6);

    // Box CTA (vermelho)
    var ctaBoxX = pad + (boxW + boxGap) * 2;
    oc.fillStyle = '#ef4444';
    roundRect(oc, ctaBoxX, boxY, boxW, boxH, 10);
    oc.fill();
    oc.fillStyle = '#fff';
    oc.font = '800 20px Manrope, sans-serif';
    oc.fillText(globalSettings.ctaText, ctaBoxX + boxW / 2, boxY + boxH / 2 + 7);

    oc.textAlign = 'left';

    return videoY;
}

// ============================================
// GERA BANNER VIDEO - OTIMIZADO p/ WhatsApp
// Canvas: 1080x1080 (1:1 square) ou 1080x1920 (9:16 story)
// Vídeo no topo (16:9) + informações organizadas abaixo
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
        btn.innerHTML = 'GERAR BANNER MP4 (1080x1080)';
        progressBox.classList.add('hidden');
        alert('Navegador n\u00E3o suporta MediaRecorder');
        return;
    }

    // Bitrates otimizados para WhatsApp
    // Formato 1080x1080 (1:1 square) com vídeo 1080x607 (16:9) no topo
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
        // Define dimensões baseado no formato
        var W = 1080;
        var H = videoFormat === 'story' ? 1920 : 1080;
        var videoAreaH = Math.round(W * 9 / 16); // Vídeo 16:9 (607px)
        var formatLabel = videoFormat === 'story' ? '1080x1920 (9:16 Story)' : '1080x1080 (1:1 Post)';

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

        videoContainer.innerHTML = '<div class="text-center"><p class="text-purple-300 mb-3 font-semibold">Gerando banner vídeo ' + formatLabel
            + (nativeMp4 ? ' (modo rápido MP4 nativo)' : ' (modo compatível)') + '...</p></div>';
        videoContainer.appendChild(outCanvas);
        outCanvas.style.maxWidth = videoFormat === 'story' ? '250px' : '350px';
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
        var videoY = 0; // Posição Y do vídeo (necessário para Story)
        if (videoFormat === 'story') {
            videoY = renderStaticStoryLayer(sc, W, H, videoAreaH);
        } else {
            renderStaticBannerLayer(sc, W, H, videoAreaH);
        }
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
        // 2. Desenha o vídeo na área apropriada (videoY + videoAreaH)
        // 30fps FIXOS (setInterval 33ms)
        // ===================================================
        function drawFrame() {
            // Copia toda a camada estática (poster, texto, botões, logo)
            oc.drawImage(staticCanvas, 0, 0);

            // Desenha o frame atual do vídeo na área apropriada
            if (!srcVideo.paused && !srcVideo.ended && srcVideo.readyState >= 2) {
                var vR = srcVideo.videoWidth / srcVideo.videoHeight;
                var aR = W / videoAreaH;
                var dw, dh, ox, oy;
                if (vR > aR) { 
                    // Vídeo mais largo que a área - corta nas laterais
                    dw = W; 
                    dh = W / vR; 
                    ox = 0; 
                    oy = (videoAreaH - dh) / 2; 
                } else { 
                    // Vídeo mais alto que a área - corta em cima/embaixo
                    dh = videoAreaH; 
                    dw = videoAreaH * vR; 
                    ox = (W - dw) / 2; 
                    oy = 0; 
                }
                try { 
                    // Salva o estado do canvas
                    oc.save();
                    // Clipping para garantir que o vídeo não ultrapasse a área
                    oc.beginPath();
                    oc.rect(0, videoY, W, videoAreaH);
                    oc.clip();
                    // Desenha o vídeo na posição Y correta
                    oc.drawImage(srcVideo, ox, videoY + oy, dw, dh);
                    // Restaura o estado
                    oc.restore();
                } catch(e) {
                    oc.restore();
                }
            }

            // Redesenha a logo POR CIMA do vídeo (canto superior direito) - apenas para Post
            if (videoFormat === 'post' && uploadedLogo) {
                var logoR2 = uploadedLogo.width / uploadedLogo.height;
                var logoH2 = 140;
                var logoW2 = logoH2 * logoR2;
                if (logoW2 > 320) { logoW2 = 320; logoH2 = logoW2 / logoR2; }
                oc.save();
                oc.globalAlpha = 1.0;
                oc.drawImage(uploadedLogo, W - logoW2 - 25, 25, logoW2, logoH2);
                oc.restore();
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

                // Configurações de compressão otimizados para WhatsApp
                // H.264 High Profile Level 4.0 + AAC + faststart
                // Resolução 1080x1080 (1:1 square)
                var crf, maxrate, bufsize, audioBr;
                if (quality === 'high')      { crf = '20'; maxrate = '8000k'; bufsize = '16000k'; audioBr = '192k'; }
                else if (quality === 'low')  { crf = '26'; maxrate = '2500k'; bufsize = '5000k';  audioBr = '96k';  }
                else                         { crf = '22'; maxrate = '5000k'; bufsize = '10000k'; audioBr = '128k'; }

                // ultrafast + fastdecode = MUITO mais rápido em wasm
                // -vf scale=1080:1080 garante resolução quadrada para WhatsApp
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
                    '-vf', 'scale=' + W + ':' + H + ':flags=fast_bilinear',
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
        var finalSizeBytes = finalBlob.size;
        var savedPct = compressed ? Math.round((1 - finalBlob.size / rawResult.blob.size) * 100) : 0;
        var url = URL.createObjectURL(finalBlob);
        var safeTitle = (selectedContent.title || 'trailer').replace(/[^a-zA-Z0-9]/g, '_');
        var formatSuffix = videoFormat === 'story' ? '_story' : '_post';
        var fileName = safeTitle + '_trailer' + formatSuffix + '_whatsapp_hd.' + finalExt;
        var exceedsLimit = finalSizeBytes > (100 * 1024 * 1024); // 100MB

        // Limpa o container e mostra o resultado final
        videoContainer.innerHTML = '';
        
        // Container principal com layout limpo
        var resultContainer = document.createElement('div');
        resultContainer.className = 'w-full max-w-2xl mx-auto';
        
        // Título de sucesso
        var titleDiv = document.createElement('div');
        titleDiv.className = 'text-center mb-6';
        titleDiv.innerHTML = '<h3 class="font-oswald text-3xl font-bold text-purple-400 mb-2">Banner Gerado com Sucesso!</h3>' +
            '<p class="text-zinc-400 text-sm">' + (videoFormat === 'story' ? '1080x1920 (9:16) — Formato Story' : '1080x1080 (1:1) — Formato Post') + '</p>';
        resultContainer.appendChild(titleDiv);
        
        // Preview do vídeo
        var vidEl = document.createElement('video');
        vidEl.src = url;
        vidEl.controls = true;
        vidEl.autoplay = true;
        vidEl.loop = true;
        vidEl.muted = true;
        vidEl.style.cssText = 'width: 100%; max-width: ' + (videoFormat === 'story' ? '350px' : '600px') + '; border-radius: 12px; box-shadow: 0 0 60px rgba(168,85,247,0.5); margin: 0 auto; display: block;';
        resultContainer.appendChild(vidEl);
        
        // Informações técnicas
        var infoDiv = document.createElement('div');
        infoDiv.className = 'mt-6 p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg';
        var statusHtml2 = '';
        var resLabel = W + 'x' + H;
        if (nativeOut) {
            statusHtml2 = '<div class="flex items-center justify-center gap-2 mb-2">' +
                '<span class="text-green-400 text-sm font-semibold">\u26A1 MP4 nativo (H.264 + AAC) — sem recompressão</span></div>' +
                '<div class="text-center text-zinc-300 text-xs">' +
                '<span class="font-bold">' + finalSizeMB + ' MB</span> · Qualidade: ' + quality.toUpperCase() + ' · ' + resLabel + '</div>';
        } else if (compressed) {
            statusHtml2 = '<div class="flex items-center justify-center gap-2 mb-2">' +
                '<span class="text-green-400 text-sm font-semibold">\u2728 Convertido para MP4 (H.264 High Profile + AAC)</span></div>' +
                '<div class="text-center text-zinc-300 text-xs">' +
                'Original: ' + rawSizeMB + ' MB → Final: <span class="font-bold text-green-400">' + finalSizeMB + ' MB</span> ' +
                '<span class="text-green-400">(-' + savedPct + '%)</span> · ' + resLabel + '</div>';
        } else {
            statusHtml2 = '<div class="flex items-center justify-center gap-2 mb-2">' +
                '<span class="text-yellow-400 text-xs">\u26A0 Sem conversão disponível - vídeo original</span></div>' +
                '<div class="text-center text-zinc-400 text-xs">' +
                'Tamanho: ' + finalSizeMB + ' MB · Formato: ' + finalExt.toUpperCase() + ' · ' + resLabel + '</div>';
        }
        infoDiv.innerHTML = statusHtml2;
        resultContainer.appendChild(infoDiv);
        
        // Aviso se ultrapassar 100MB (limite WhatsApp HD)
        if (exceedsLimit) {
            var warnDiv = document.createElement('div');
            warnDiv.className = 'mt-4 p-4 bg-yellow-900/30 border border-yellow-500/50 rounded-lg';
            warnDiv.innerHTML = '<div class="flex items-start gap-3">' +
                '<span class="text-yellow-400 text-xl flex-shrink-0">\u26A0\uFE0F</span>' +
                '<div>' +
                '<p class="text-yellow-300 font-semibold text-sm mb-1">Arquivo acima de 100MB</p>' +
                '<p class="text-yellow-200/80 text-xs leading-relaxed">O WhatsApp pode não reconhecer o vídeo em HD. O limite para envio no formato HD é de até 100MB (ou até 180MB dependendo da sua região, versão do app e velocidade da conexão). Considere usar qualidade <b>Média</b> ou <b>Baixa</b> para reduzir o tamanho.</p>' +
                '</div></div>';
            resultContainer.appendChild(warnDiv);
        }
        
        // Botão de download grande e profissional
        var dlBtn = document.createElement('a');
        dlBtn.href = url;
        dlBtn.download = fileName;
        dlBtn.className = 'block w-full mt-6 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-bold uppercase tracking-wider py-5 px-8 rounded-xl cursor-pointer transition-all shadow-lg hover:shadow-purple-500/50 text-center';
        dlBtn.innerHTML = '<span class="flex items-center justify-center gap-3">' +
            '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
            '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>' +
            '</svg>' +
            '<span>BAIXAR VÍDEO HD</span></span>';
        dlBtn.setAttribute('data-testid', 'download-trailer-btn');
        resultContainer.appendChild(dlBtn);
        
        // Nome do arquivo
        var fileNameDiv = document.createElement('div');
        fileNameDiv.className = 'text-center mt-3 text-zinc-500 text-xs';
        fileNameDiv.textContent = fileName;
        resultContainer.appendChild(fileNameDiv);
        
        videoContainer.appendChild(resultContainer);

        setTimeout(function() { progressBox.classList.add('hidden'); }, 1500);

        btn.disabled = false;
        btn.innerHTML = 'GERAR BANNER MP4 (1080x1080)';
    } catch (error) {
        console.error('Erro:', error);
        clearTimeout(failsafeTimer);
        cleanupVideoEl();
        try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch(e) {}
        alert('Erro ao gerar banner: ' + error.message);
        btn.disabled = false;
        btn.innerHTML = 'GERAR BANNER MP4 (1080x1080)';
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
