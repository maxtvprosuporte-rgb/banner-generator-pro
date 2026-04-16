const API_BASE_URL = window.location.origin;
const TMDB_BASE_URL = API_BASE_URL + '/api/tmdb';
const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p';

let currentMode = null;
let selectedContent = null;
let currentFormat = 'post';
let uploadedLogo = null;
let posterImage = null;
let currentTrailer = null;
let globalSettings = { logo: null, whatsappNumber: '', whatsappText: 'Grupo VIP', ctaText: 'ASSINA JÁ' };

const homeScreen = document.getElementById('homeScreen');
const editorScreen = document.getElementById('editorScreen');
const controlPanel = document.getElementById('controlPanel');
let canvas = document.getElementById('bannerCanvas');
let ctx = canvas.getContext('2d');
const videoContainer = document.getElementById('videoContainer');

let footballBgPost = null;
let footballBgStory = null;
let allFootballGames = [];
let selectedDate = '';

const leagueBroadcasters = {
    'Brasileirão Série A': 'Globo / SporTV / Premiere / Prime Video / CazéTV',
    'Serie A': 'Globo / SporTV / Premiere / Prime Video / CazéTV',
    'Brasileirão Série B': 'ESPN / Disney+ / SporTV',
    'Serie B': 'ESPN / Disney+ / SporTV',
    'Copa do Brasil': 'Globo / SporTV / Premiere / Prime Video',
    'Copa Libertadores': 'Globo / ESPN / Disney+ / Paramount+',
    'Copa Sul-Americana': 'ESPN / Disney+ / Paramount+',
    'Premier League': 'ESPN / Star+',
    'La Liga': 'ESPN / Star+',
    'Ligue 1': 'CazéTV / Prime Video',
    'Bundesliga': 'OneFootball / YouTube',
    'UEFA Champions League': 'SBT / TNT Sports / HBO Max',
    'FIFA World Cup': 'Globo / SporTV / CazéTV',
    'World Cup': 'Globo / SporTV / CazéTV'
};

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
                document.getElementById('settingsLogoText').textContent = 'Logo carregada';
                document.getElementById('settingsRemoveLogo').classList.remove('hidden');
            }
            if (globalSettings.bgPost) {
                var imgP = new Image();
                imgP.onload = function() { footballBgPost = imgP; };
                imgP.src = globalSettings.bgPost;
                document.getElementById('settingsBgPostText').textContent = 'Fundo Post carregado';
                document.getElementById('settingsRemoveBgPost').classList.remove('hidden');
            }
            if (globalSettings.bgStory) {
                var imgS = new Image();
                imgS.onload = function() { footballBgStory = imgS; };
                imgS.src = globalSettings.bgStory;
                document.getElementById('settingsBgStoryText').textContent = 'Fundo Story carregado';
                document.getElementById('settingsRemoveBgStory').classList.remove('hidden');
            }
            document.getElementById('settingsWhatsappNumber').value = globalSettings.whatsappNumber || '';
            document.getElementById('settingsWhatsappText').value = globalSettings.whatsappText || 'Grupo VIP';
            document.getElementById('settingsCtaText').value = globalSettings.ctaText || 'ASSINA JÁ';
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

// Logo
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

// Fundo Post
document.getElementById('settingsBgPostInput').addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (file) {
        var reader = new FileReader();
        reader.onload = function(ev) {
            globalSettings.bgPost = ev.target.result;
            var img = new Image();
            img.onload = function() { footballBgPost = img; };
            img.src = ev.target.result;
            document.getElementById('settingsBgPostText').textContent = file.name;
            document.getElementById('settingsRemoveBgPost').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});
document.getElementById('settingsRemoveBgPost').addEventListener('click', function() {
    globalSettings.bgPost = null; footballBgPost = null;
    document.getElementById('settingsBgPostInput').value = '';
    document.getElementById('settingsBgPostText').textContent = 'Carregar fundo Post';
    document.getElementById('settingsRemoveBgPost').classList.add('hidden');
});

// Fundo Story
document.getElementById('settingsBgStoryInput').addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (file) {
        var reader = new FileReader();
        reader.onload = function(ev) {
            globalSettings.bgStory = ev.target.result;
            var img = new Image();
            img.onload = function() { footballBgStory = img; };
            img.src = ev.target.result;
            document.getElementById('settingsBgStoryText').textContent = file.name;
            document.getElementById('settingsRemoveBgStory').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});
document.getElementById('settingsRemoveBgStory').addEventListener('click', function() {
    globalSettings.bgStory = null; footballBgStory = null;
    document.getElementById('settingsBgStoryInput').value = '';
    document.getElementById('settingsBgStoryText').textContent = 'Carregar fundo Story';
    document.getElementById('settingsRemoveBgStory').classList.add('hidden');
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
    else if (mode === 'football') loadFootballMode();
    else if (mode === 'footballManual') loadFootballManualMode();
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
}

function clearPreviousBanners() {
    const container = document.getElementById('bannersContainer');
    container.innerHTML = '<canvas id="bannerCanvas" class="canvas-glow max-w-full h-auto rounded-lg mx-auto"></canvas><div id="videoContainer" class="hidden flex flex-col items-center gap-4"></div>';
    canvas = document.getElementById('bannerCanvas');
    ctx = canvas.getContext('2d');
}

// ============================================
// FOOTBALL MODE
// ============================================
function loadFootballMode() {
    canvas.classList.add('hidden');
    videoContainer.classList.add('hidden');
    clearPreviousBanners();

    controlPanel.innerHTML = '<header class="border-b border-zinc-800 pb-5"><h2 class="font-oswald text-2xl font-bold text-green-400">&#9917; Futebol do Dia</h2><p class="text-zinc-500 text-sm mt-2">Banners com lista de jogos</p></header>' +
        '<section class="mt-5"><label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold block mb-3">Selecionar Data</label><input type="date" id="footballDate" value="' + getTodayDate() + '" class="bg-black border-2 border-zinc-800 p-4 text-white focus:outline-none focus:border-green-500 w-full rounded-lg" data-testid="football-date-input">' +
        '<button id="footballSearchBtn" class="w-full mt-3 bg-green-500 hover:bg-green-400 text-white font-bold py-3 rounded-lg transition-all" data-testid="football-search-btn">BUSCAR JOGOS</button><div id="footballResults" class="mt-4"></div></section>' +
        '<section id="footballControls" class="hidden flex flex-col gap-5 mt-5"><section class="flex flex-col gap-3"><label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Formato</label><div class="flex gap-2">' +
        '<button id="footballFormatPost" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white" data-testid="football-format-post">Post</button>' +
        '<button id="footballFormatStory" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800" data-testid="football-format-story">Story</button></div></section>' +
        '<div class="flex gap-2"><button id="footballGenerateBtn" class="flex-1 bg-green-500 text-white font-bold uppercase tracking-widest py-4 hover:bg-green-400 transition-all rounded-lg" data-testid="football-generate-btn">GERAR BANNERS</button>' +
        '<button id="footballCopyBtn" class="flex-1 bg-purple-600 text-white font-bold uppercase tracking-widest py-4 hover:bg-purple-500 transition-all rounded-lg" data-testid="football-copy-btn">COPIAR INFO</button></div></section>';

    setTimeout(function() {
        document.getElementById('footballSearchBtn').addEventListener('click', searchFootballGames);
        document.getElementById('footballDate').addEventListener('change', function() { document.getElementById('footballResults').innerHTML = ''; document.getElementById('footballControls').classList.add('hidden'); });
    }, 100);

    showPlaceholder('&#9917;', 'FUTEBOL', 'Selecione uma data e busque jogos', '#0a4d0a', '#001a00');
}

function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

async function searchFootballGames() {
    var date = document.getElementById('footballDate').value;
    var btn = document.getElementById('footballSearchBtn');
    var resultsDiv = document.getElementById('footballResults');
    if (!date) { alert('Selecione uma data'); return; }

    var cacheKey = 'football_cache_' + date;
    var cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            var cachedData = JSON.parse(cached);
            var cacheAge = Date.now() - cachedData.timestamp;
            if (cacheAge < 24 * 60 * 60 * 1000) {
                var cacheHours = Math.floor(cacheAge / (1000 * 60 * 60));
                resultsDiv.innerHTML = '<p class="text-green-400 text-sm p-3">Dados do cache local (salvo há ' + cacheHours + 'h)</p>';
                displayFootballResults(cachedData.data, true);
                return;
            } else { localStorage.removeItem(cacheKey); }
        } catch (e) { localStorage.removeItem(cacheKey); }
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner mx-auto"></div>';
    resultsDiv.innerHTML = '<p class="text-zinc-500 text-sm p-3">Buscando jogos na API...</p>';

    try {
        var response = await fetch(API_BASE_URL + '/api/football/fixtures?date=' + date);
        var data = await response.json();
        btn.disabled = false;
        btn.innerHTML = 'BUSCAR JOGOS';
        if (!data.response || data.response.length === 0) {
            resultsDiv.innerHTML = '<div class="border border-zinc-800 p-4 rounded-lg text-center"><p class="text-zinc-400 text-sm">Nenhum jogo encontrado para esta data</p></div>';
            document.getElementById('footballControls').classList.add('hidden');
            return;
        }
        localStorage.setItem(cacheKey, JSON.stringify({ data: data.response, timestamp: Date.now(), date: date }));
        displayFootballResults(data.response, data.fromCache);
    } catch (error) {
        btn.disabled = false;
        btn.innerHTML = 'BUSCAR JOGOS';
        resultsDiv.innerHTML = '<div class="border border-red-500/30 bg-red-900/20 p-4 rounded-lg"><p class="text-red-400 text-sm">Erro ao buscar jogos</p><p class="text-xs text-zinc-500 mt-2">' + error.message + '</p></div>';
        document.getElementById('footballControls').classList.add('hidden');
    }
}

function displayFootballResults(games, fromCache) {
    var resultsDiv = document.getElementById('footballResults');
    var allowedLeagues = ['Brasileirão Série A','Serie A','Brasileirão Série B','Serie B','Copa do Brasil','Copa Libertadores','Copa Sul-Americana','Premier League','La Liga','Ligue 1','Bundesliga','UEFA Champions League','FIFA World Cup','World Cup'];

    var filteredGames = games.filter(function(game) {
        var ln = game.league.name;
        if (ln.toLowerCase().includes('women') || ln.toLowerCase().includes('feminino') || ln.toLowerCase().includes('femenino')) return false;
        if (ln.match(/u(\d+)|sub[\s-]?(\d+)|under[\s-]?(\d+)|youth/i)) return false;
        return allowedLeagues.some(function(a) { return ln.includes(a) || a.includes(ln); });
    });

    filteredGames.sort(function(a, b) { return new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime(); });

    var cacheInfo = fromCache ? '<div class="bg-green-900/20 border border-green-500/30 p-2 rounded mb-3"><p class="text-green-400 text-xs text-center">Dados do cache (24h)</p></div>' : '<div class="bg-blue-900/20 border border-blue-500/30 p-2 rounded mb-3"><p class="text-blue-400 text-xs text-center">Dados atualizados da API</p></div>';

    if (filteredGames.length === 0) {
        resultsDiv.innerHTML = cacheInfo + '<div class="border border-zinc-800 p-4 rounded-lg text-center"><p class="text-zinc-400 text-sm">Nenhum jogo encontrado</p></div>';
        return;
    }

    allFootballGames = filteredGames;
    selectedDate = document.getElementById('footballDate').value;

    resultsDiv.innerHTML = cacheInfo + '<div class="border border-green-500/30 bg-green-900/10 p-4 rounded-lg"><p class="text-green-400 text-sm font-semibold mb-2">' + filteredGames.length + ' jogo' + (filteredGames.length > 1 ? 's' : '') + ' encontrado' + (filteredGames.length > 1 ? 's' : '') + '!</p><ul class="text-zinc-300 text-xs space-y-1">' +
        filteredGames.slice(0, 5).map(function(game) {
            var time = new Date(game.fixture.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            return '<li>- ' + game.teams.home.name + ' x ' + game.teams.away.name + ' - ' + time + '</li>';
        }).join('') +
        (filteredGames.length > 5 ? '<li class="text-zinc-500">... e mais ' + (filteredGames.length - 5) + ' jogo' + (filteredGames.length - 5 > 1 ? 's' : '') + '</li>' : '') +
        '</ul></div>';

    document.getElementById('footballControls').classList.remove('hidden');

    setTimeout(function() {
        document.getElementById('footballFormatPost').addEventListener('click', function() { currentFormat = 'post'; updateFootballFormatButtons(); });
        document.getElementById('footballFormatStory').addEventListener('click', function() { currentFormat = 'story'; updateFootballFormatButtons(); });
        document.getElementById('footballGenerateBtn').addEventListener('click', generateAllFootballBanners);
        document.getElementById('footballCopyBtn').addEventListener('click', copyAllFootballGames);
    }, 100);
}

function updateFootballFormatButtons() {
    var postBtn = document.getElementById('footballFormatPost');
    var storyBtn = document.getElementById('footballFormatStory');
    if (currentFormat === 'post') {
        postBtn.className = 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white';
        storyBtn.className = 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800';
    } else {
        storyBtn.className = 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white';
        postBtn.className = 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800';
    }
}

// ============================================
// GENERATE ALL BANNERS - MODIFIED: COVER FIRST
// ============================================
async function generateAllFootballBanners() {
    if (!allFootballGames || allFootballGames.length === 0) { alert('Nenhum jogo encontrado!'); return; }

    var btn = document.getElementById('footballGenerateBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner mx-auto"></div>';

    try {
        var isPost = currentFormat === 'post';
        var gamesPerBanner = isPost ? 5 : 8;

        clearPreviousBanners();
        var container = document.getElementById('bannersContainer');

        // Load all logos
        var gamesWithLogos = await Promise.all(allFootballGames.map(async function(game) {
            try {
                var results = await Promise.all([loadImage(game.teams.home.logo), loadImage(game.teams.away.logo)]);
                return Object.assign({}, game, { homeLogoImg: results[0], awayLogoImg: results[1] });
            } catch (e) { return game; }
        }));

        // Extract unique leagues for cover
        var uniqueLeagues = [];
        var seenLeagues = {};
        for (var g = 0; g < allFootballGames.length; g++) {
            var lid = allFootballGames[g].league.id;
            if (!seenLeagues[lid]) {
                seenLeagues[lid] = true;
                uniqueLeagues.push({ name: allFootballGames[g].league.name, logo: allFootballGames[g].league.logo, country: allFootballGames[g].league.country });
            }
        }

        var totalGameBanners = Math.ceil(gamesWithLogos.length / gamesPerBanner);
        var totalBanners = 1 + totalGameBanners;

        // BANNER 1: COVER (no games, just info)
        var coverCanvas = document.createElement('canvas');
        coverCanvas.className = 'canvas-glow max-w-full h-auto rounded-lg mx-auto mb-4';
        coverCanvas.id = 'footballBannerCover';
        var coverDlBtn = document.createElement('button');
        coverDlBtn.className = 'w-full max-w-md mx-auto bg-green-500 hover:bg-green-400 text-white font-bold py-3 px-6 rounded-lg mb-8 flex items-center justify-center gap-2';
        coverDlBtn.innerHTML = 'BAIXAR CAPA (1 de ' + totalBanners + ')';
        coverDlBtn.onclick = function() { downloadBanner(coverCanvas, 'capa'); };
        container.appendChild(coverCanvas);
        container.appendChild(coverDlBtn);
        await generateFootballCoverBanner(coverCanvas, uniqueLeagues, totalBanners);

        // BANNERS 2+: GAMES
        for (var i = 0; i < totalGameBanners; i++) {
            var startIdx = i * gamesPerBanner;
            var endIdx = Math.min(startIdx + gamesPerBanner, gamesWithLogos.length);
            var bannerGames = gamesWithLogos.slice(startIdx, endIdx);

            var canvasEl = document.createElement('canvas');
            canvasEl.className = 'canvas-glow max-w-full h-auto rounded-lg mx-auto mb-4';
            canvasEl.id = 'footballBanner' + (i + 2);
            var dlBtn = document.createElement('button');
            dlBtn.className = 'w-full max-w-md mx-auto bg-green-500 hover:bg-green-400 text-white font-bold py-3 px-6 rounded-lg mb-8 flex items-center justify-center gap-2';
            dlBtn.innerHTML = 'BAIXAR BANNER ' + (i + 2) + ' de ' + totalBanners;
            (function(ce, idx) { dlBtn.onclick = function() { downloadBanner(ce, idx + 2); }; })(canvasEl, i);
            container.appendChild(canvasEl);
            container.appendChild(dlBtn);
            await generateFootballListBannerModern(canvasEl, bannerGames, i + 2, totalBanners);
        }

        btn.disabled = false;
        btn.innerHTML = 'GERAR BANNERS';
        alert(totalBanners + ' banner' + (totalBanners > 1 ? 's' : '') + ' gerado' + (totalBanners > 1 ? 's' : '') + ' com sucesso!');
    } catch (error) {
        console.error('Erro ao gerar banners:', error);
        alert('Erro ao gerar banners: ' + error.message);
        btn.disabled = false;
        btn.innerHTML = 'GERAR BANNERS';
    }
}

// ============================================
// NEW: PROFESSIONAL COVER BANNER (Dark Premium)
// ============================================
async function generateFootballCoverBanner(canvasEl, uniqueLeagues, totalBanners) {
    var cvs = canvasEl.getContext('2d');
    var isPost = currentFormat === 'post';
    var width = 1080;
    var height = isPost ? 1080 : 1920;
    canvasEl.width = width;
    canvasEl.height = height;
    canvasEl.style.maxWidth = isPost ? '500px' : '300px';

    // === BACKGROUND ===
    var bgImage = isPost ? footballBgPost : footballBgStory;
    if (bgImage) {
        var imgR = bgImage.width / bgImage.height;
        var canR = width / height;
        var dw, dh, ox, oy;
        if (imgR > canR) { dh = height; dw = height * imgR; ox = (width - dw) / 2; oy = 0; }
        else { dw = width; dh = width / imgR; ox = 0; oy = (height - dh) / 2; }
        cvs.drawImage(bgImage, ox, oy, dw, dh);
        cvs.fillStyle = 'rgba(0, 0, 0, 0.85)';
        cvs.fillRect(0, 0, width, height);
    } else {
        var grad = cvs.createLinearGradient(0, 0, width * 0.3, height);
        grad.addColorStop(0, '#0d2818');
        grad.addColorStop(0.4, '#081408');
        grad.addColorStop(1, '#020502');
        cvs.fillStyle = grad;
        cvs.fillRect(0, 0, width, height);
    }

    // Radial glow
    var glow = cvs.createRadialGradient(width / 2, height * 0.28, 0, width / 2, height * 0.28, width * 0.65);
    glow.addColorStop(0, 'rgba(34, 197, 94, 0.07)');
    glow.addColorStop(1, 'transparent');
    cvs.fillStyle = glow;
    cvs.fillRect(0, 0, width, height);

    // Subtle grid
    cvs.strokeStyle = 'rgba(255,255,255,0.018)';
    cvs.lineWidth = 1;
    for (var gx = 0; gx < width; gx += 54) { cvs.beginPath(); cvs.moveTo(gx, 0); cvs.lineTo(gx, height); cvs.stroke(); }
    for (var gy = 0; gy < height; gy += 54) { cvs.beginPath(); cvs.moveTo(0, gy); cvs.lineTo(width, gy); cvs.stroke(); }

    // Top accent line
    var topLine = cvs.createLinearGradient(0, 0, width, 0);
    topLine.addColorStop(0, 'transparent');
    topLine.addColorStop(0.15, '#16a34a');
    topLine.addColorStop(0.85, '#16a34a');
    topLine.addColorStop(1, 'transparent');
    cvs.fillStyle = topLine;
    cvs.fillRect(0, 0, width, 4);

    // Corner decorative lines
    cvs.strokeStyle = 'rgba(34, 197, 94, 0.2)';
    cvs.lineWidth = 2;
    // Top-left corner
    cvs.beginPath(); cvs.moveTo(40, 40); cvs.lineTo(40, 100); cvs.stroke();
    cvs.beginPath(); cvs.moveTo(40, 40); cvs.lineTo(100, 40); cvs.stroke();
    // Bottom-right corner
    cvs.beginPath(); cvs.moveTo(width - 40, height - 40); cvs.lineTo(width - 40, height - 100); cvs.stroke();
    cvs.beginPath(); cvs.moveTo(width - 40, height - 40); cvs.lineTo(width - 100, height - 40); cvs.stroke();

    // Logo top-right
    if (uploadedLogo) {
        cvs.save();
        var logoMaxH = isPost ? 160 : 200;
        var logoRatio = uploadedLogo.width / uploadedLogo.height;
        var logoW = logoMaxH * logoRatio;
        cvs.drawImage(uploadedLogo, width - logoW - 50, 25, logoW, logoMaxH);
        cvs.restore();
    }

    var y = isPost ? 200 : 380;

    // Small label with letter spacing
    cvs.textAlign = 'center';
    cvs.font = '600 20px Manrope, sans-serif';
    cvs.fillStyle = '#22c55e';
    cvs.fillText('P R O G R A M A \u00C7 \u00C3 O   C O M P L E T A', width / 2, y);

    y += 85;

    // Main title "JOGOS DO DIA" with glow effect
    cvs.save();
    cvs.font = '700 ' + (isPost ? '100' : '110') + 'px Oswald, sans-serif';
    cvs.textAlign = 'center';
    // Outer glow
    cvs.shadowColor = 'rgba(34, 197, 94, 0.5)';
    cvs.shadowBlur = 50;
    cvs.fillStyle = '#ffffff';
    cvs.fillText('JOGOS DO DIA', width / 2, y);
    // Inner glow (double render for stronger effect)
    cvs.shadowColor = 'rgba(34, 197, 94, 0.8)';
    cvs.shadowBlur = 15;
    cvs.fillText('JOGOS DO DIA', width / 2, y);
    cvs.restore();

    y += 60;

    // Date
    var dateFormatted = new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
    cvs.font = '500 28px Manrope, sans-serif';
    cvs.fillStyle = 'rgba(255,255,255,0.6)';
    cvs.textAlign = 'center';
    cvs.fillText(dateFormatted.toUpperCase(), width / 2, y);

    y += 55;

    // Separator line
    var sepGrad = cvs.createLinearGradient(width * 0.12, 0, width * 0.88, 0);
    sepGrad.addColorStop(0, 'transparent');
    sepGrad.addColorStop(0.2, 'rgba(34, 197, 94, 0.5)');
    sepGrad.addColorStop(0.5, '#22c55e');
    sepGrad.addColorStop(0.8, 'rgba(34, 197, 94, 0.5)');
    sepGrad.addColorStop(1, 'transparent');
    cvs.fillStyle = sepGrad;
    cvs.fillRect(width * 0.12, y, width * 0.76, 2);

    y += 50;

    // Total games badge
    var totalGames = allFootballGames.length;
    var badgeText = totalGames + ' JOGOS';
    cvs.font = '700 30px Oswald, sans-serif';
    cvs.textAlign = 'center';
    var bw = cvs.measureText(badgeText).width + 80;
    // Badge bg
    cvs.fillStyle = 'rgba(34, 197, 94, 0.12)';
    roundRect(cvs, (width - bw) / 2, y - 28, bw, 52, 26);
    cvs.fill();
    cvs.strokeStyle = 'rgba(34, 197, 94, 0.45)';
    cvs.lineWidth = 1.5;
    roundRect(cvs, (width - bw) / 2, y - 28, bw, 52, 26);
    cvs.stroke();
    cvs.fillStyle = '#22c55e';
    cvs.fillText(badgeText, width / 2, y + 5);

    y += 75;

    // === LEAGUE GRID - ÍCONES LOCAIS DA PASTA /ligue/ ===
    var localLeagueIcons = [
        { path: '/ligue/Campeonato_Brasileiro_Serie_A.png', name: 'Brasileirão Série A' },
        { path: '/ligue/Campeonato_Brasileiro_Srrie_B.png', name: 'Brasileirão Série B' },
        { path: '/ligue/Copa_Libertadores.png', name: 'Copa Libertadores' },
        { path: '/ligue/Premier_League.png', name: 'Premier League' },
        { path: '/ligue/La_Liga.png', name: 'La Liga' },
        { path: '/ligue/Bundesliga.png', name: 'Bundesliga' },
        { path: '/ligue/Ligue_1.png', name: 'Ligue 1' },
        { path: '/ligue/UEFA_Champions_League.png', name: 'Champions League' },
        { path: '/ligue/Copa_do_Mundo_FIFA.png', name: 'Copa do Mundo' },
        { path: '/ligue/Amistosos_Internacionais.png', name: 'Amistosos' }
    ];

    var leagueLogos = await Promise.all(localLeagueIcons.map(async function(item) {
        try {
            var img = await loadImage(item.path);
            return { name: item.name, logoImg: img };
        } catch (e) { return { name: item.name, logoImg: null }; }
    }));
    // Filtrar apenas os que carregaram com sucesso
    leagueLogos = leagueLogos.filter(function(l) { return l.logoImg !== null; });

    var cols = isPost ? 5 : 5;
    var rows = Math.ceil(leagueLogos.length / cols);
    var cellW = (width - 100) / cols;
    var cellH = isPost ? 115 : 135;
    var gridStartX = 50;

    for (var li = 0; li < leagueLogos.length; li++) {
        var league = leagueLogos[li];
        var col = li % cols;
        var row = Math.floor(li / cols);
        var cx = gridStartX + col * cellW;
        var cy = y + row * cellH;

        // Glass card
        cvs.save();
        cvs.fillStyle = 'rgba(255,255,255,0.03)';
        roundRect(cvs, cx + 6, cy, cellW - 12, cellH - 10, 14);
        cvs.fill();
        cvs.strokeStyle = 'rgba(255,255,255,0.08)';
        cvs.lineWidth = 1;
        roundRect(cvs, cx + 6, cy, cellW - 12, cellH - 10, 14);
        cvs.stroke();
        cvs.restore();

        // Logo
        if (league.logoImg) {
            var ls = isPost ? 48 : 56;
            cvs.drawImage(league.logoImg, cx + cellW / 2 - ls / 2, cy + 10, ls, ls);
        }

        // Name
        cvs.textAlign = 'center';
        cvs.font = '600 ' + (isPost ? '11' : '13') + 'px Manrope, sans-serif';
        cvs.fillStyle = 'rgba(255,255,255,0.78)';
        var lname = league.name;
        var maxNW = cellW - 16;
        while (cvs.measureText(lname).width > maxNW && lname.length > 3) lname = lname.slice(0, -1);
        if (lname.length < league.name.length) lname += '...';
        cvs.fillText(lname, cx + cellW / 2, cy + cellH - 20);
    }

    // Warning
    var warningY = Math.min(y + rows * cellH + 25, height - 110);
    cvs.textAlign = 'center';
    cvs.font = '500 15px Manrope, sans-serif';
    cvs.fillStyle = 'rgba(255,255,255,0.3)';
    cvs.fillText('Os canais podem sofrer altera\u00E7\u00E3o de \u00FAltima hora', width / 2, warningY);

    // Footer: WhatsApp + CTA
    var padding = 40;
    var boxH = 50;
    var footerY = height - 40;

    cvs.fillStyle = '#25D366';
    roundRect(cvs, padding, footerY - boxH, 220, boxH, 10);
    cvs.fill();
    cvs.fillStyle = '#fff';
    cvs.font = '600 20px Manrope, sans-serif';
    cvs.textAlign = 'center';
    cvs.fillText(globalSettings.whatsappNumber || globalSettings.whatsappText, padding + 110, footerY - boxH / 2 + 7);

    cvs.fillStyle = '#22c55e';
    roundRect(cvs, padding + 235, footerY - boxH, 220, boxH, 10);
    cvs.fill();
    cvs.fillStyle = '#fff';
    cvs.font = '700 20px Manrope, sans-serif';
    cvs.fillText(globalSettings.ctaText, padding + 345, footerY - boxH / 2 + 7);

    // Bottom accent line
    var btLine = cvs.createLinearGradient(0, 0, width, 0);
    btLine.addColorStop(0, 'transparent');
    btLine.addColorStop(0.15, '#16a34a');
    btLine.addColorStop(0.85, '#16a34a');
    btLine.addColorStop(1, 'transparent');
    cvs.fillStyle = btLine;
    cvs.fillRect(0, height - 4, width, 4);
}

// ============================================
// GAME BANNERS - MODIFIED: NO COVER CARD
// ============================================
async function generateFootballListBannerModern(canvasEl, games, bannerNum, totalBanners) {
    var cvs = canvasEl.getContext('2d');
    var isPost = currentFormat === 'post';
    var width = 1080;
    var height = isPost ? 1080 : 1920;
    canvasEl.width = width;
    canvasEl.height = height;
    canvasEl.style.maxWidth = isPost ? '500px' : '300px';

    // Background
    var bgImage = isPost ? footballBgPost : footballBgStory;
    if (bgImage) {
        var imgR = bgImage.width / bgImage.height;
        var canR = width / height;
        var dw, dh, ox, oy;
        if (imgR > canR) { dh = height; dw = height * imgR; ox = (width - dw) / 2; oy = 0; }
        else { dw = width; dh = width / imgR; ox = 0; oy = (height - dh) / 2; }
        cvs.drawImage(bgImage, ox, oy, dw, dh);
        cvs.fillStyle = 'rgba(0, 0, 0, 0.7)';
        cvs.fillRect(0, 0, width, height);
    } else {
        var gradient = cvs.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#0a4d0a');
        gradient.addColorStop(1, '#001a00');
        cvs.fillStyle = gradient;
        cvs.fillRect(0, 0, width, height);
    }

    // Logo
    if (uploadedLogo) {
        cvs.save();
        cvs.globalAlpha = 1;
        var logoSize = 180;
        var logoRatio = uploadedLogo.width / uploadedLogo.height;
        var logoW = logoSize * logoRatio;
        var logoH = logoSize;
        cvs.drawImage(uploadedLogo, width - logoW - 30, 30, logoW, logoH);
        cvs.restore();
    }

    var currentY = 80;

    // Title
    cvs.font = '700 56px Oswald, sans-serif';
    cvs.fillStyle = '#fff';
    cvs.textAlign = 'center';
    cvs.fillText('JOGOS DO DIA', width / 2, currentY);
    currentY += 50;

    var dateFormatted = new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    cvs.font = '600 32px Manrope, sans-serif';
    cvs.fillStyle = 'rgba(255,255,255,0.8)';
    cvs.fillText(dateFormatted.toUpperCase(), width / 2, currentY);
    currentY += 70;

    // NO COVER CARD - Go straight to game cards

    // Layout: reservar espaço fixo no rodapé
    // [aviso: 30px] + [gap: 15px] + [botões: 50px] + [margem: 30px] = 125px
    var footerReserved = 125;
    var padding = 40;
    var gameCardWidth = width - (padding * 2);
    var availableHeight = height - currentY - footerReserved;
    var spacing = 14;
    var totalSpacing = (games.length - 1) * spacing;
    var cardHeight = Math.max(120, Math.min(160, (availableHeight - totalSpacing) / games.length));

    for (var gi = 0; gi < games.length; gi++) {
        var game = games[gi];
        var league = game.league.name;
        var time = new Date(game.fixture.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        var broadcaster = game.manualBroadcaster || getBroadcaster(league);

        // Card background
        cvs.save();
        if (bgImage) { cvs.fillStyle = 'rgba(0, 0, 0, 0.45)'; }
        else { cvs.fillStyle = 'rgba(255, 255, 255, 0.08)'; }
        roundRect(cvs, padding, currentY, gameCardWidth, cardHeight, 18);
        cvs.fill();
        cvs.fillStyle = 'rgba(255, 255, 255, 0.04)';
        roundRect(cvs, padding, currentY, gameCardWidth, cardHeight, 18);
        cvs.fill();
        cvs.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        cvs.lineWidth = 2;
        roundRect(cvs, padding, currentY, gameCardWidth, cardHeight, 18);
        cvs.stroke();
        cvs.shadowColor = 'rgba(0, 0, 0, 0.7)';
        cvs.shadowBlur = 30;
        cvs.shadowOffsetY = 12;
        roundRect(cvs, padding, currentY, gameCardWidth, cardHeight, 18);
        cvs.fill();
        cvs.restore();

        var cardPadding = 15;
        var logoSz = Math.min(75, cardHeight - 50);
        var centerX = width / 2;
        var leftX = padding + cardPadding + logoSz / 2 + 120;
        var logoY = currentY + cardHeight / 2 - 5;

        // Home logo
        if (game.homeLogoImg) {
            cvs.drawImage(game.homeLogoImg, leftX - logoSz / 2, logoY - logoSz / 2, logoSz, logoSz);
        }

        // Home name
        cvs.textAlign = 'center';
        var homeFontSize = 15;
        var homeName = game.teams.home.name.toUpperCase();
        var maxWidth = 200;
        cvs.font = '600 ' + homeFontSize + 'px Manrope, sans-serif';
        if (cvs.measureText(homeName).width > maxWidth) { homeFontSize = 13; cvs.font = '600 ' + homeFontSize + 'px Manrope, sans-serif'; }
        while (cvs.measureText(homeName).width > maxWidth && homeName.length > 3) homeName = homeName.slice(0, -1);
        if (homeName.length < game.teams.home.name.length) homeName += '...';
        cvs.fillStyle = '#fff';
        cvs.shadowColor = 'rgba(0, 0, 0, 0.9)';
        cvs.shadowBlur = 6;
        var homeNameY = logoY + logoSz / 2 + 24;
        cvs.fillText(homeName, leftX, homeNameY);
        cvs.shadowBlur = 0;

        // Center: League, Time, Broadcaster
        cvs.textAlign = 'center';
        var centerTextY = currentY + cardHeight / 2;
        cvs.font = '700 16px Manrope, sans-serif';
        cvs.fillStyle = '#ffffff';
        cvs.shadowColor = 'rgba(0, 0, 0, 0.8)';
        cvs.shadowBlur = 4;
        var leagueTrunc = league;
        while (cvs.measureText(leagueTrunc).width > 320 && leagueTrunc.length > 3) leagueTrunc = leagueTrunc.slice(0, -1);
        if (leagueTrunc.length < league.length) leagueTrunc += '...';
        cvs.fillText(leagueTrunc, centerX, centerTextY - 35);

        cvs.font = '700 38px Oswald, sans-serif';
        cvs.fillStyle = '#ffffff';
        cvs.shadowBlur = 6;
        cvs.fillText(time, centerX, centerTextY + 10);

        cvs.font = '600 13px Manrope, sans-serif';
        cvs.fillStyle = '#ffffff';
        cvs.shadowBlur = 4;
        var broadcastClean = broadcaster;
        while (cvs.measureText(broadcastClean).width > 350 && broadcastClean.length > 3) broadcastClean = broadcastClean.slice(0, -1);
        if (broadcastClean.length < broadcaster.length) broadcastClean += '...';
        cvs.fillText(broadcastClean, centerX, centerTextY + 40);
        cvs.shadowBlur = 0;

        // Away logo
        var rightX = width - padding - cardPadding - logoSz / 2 - 120;
        if (game.awayLogoImg) {
            cvs.drawImage(game.awayLogoImg, rightX - logoSz / 2, logoY - logoSz / 2, logoSz, logoSz);
        }

        // Away name
        cvs.textAlign = 'center';
        var awayFontSize = 15;
        var awayName = game.teams.away.name.toUpperCase();
        cvs.font = '600 ' + awayFontSize + 'px Manrope, sans-serif';
        if (cvs.measureText(awayName).width > maxWidth) { awayFontSize = 13; cvs.font = '600 ' + awayFontSize + 'px Manrope, sans-serif'; }
        while (cvs.measureText(awayName).width > maxWidth && awayName.length > 3) awayName = awayName.slice(0, -1);
        if (awayName.length < game.teams.away.name.length) awayName += '...';
        cvs.fillStyle = '#fff';
        cvs.shadowColor = 'rgba(0, 0, 0, 0.9)';
        cvs.shadowBlur = 6;
        cvs.fillText(awayName, rightX, homeNameY);
        cvs.shadowBlur = 0;

        currentY += cardHeight + spacing;
    }

    // === RODAPÉ FIXO: Aviso + Botões ===
    // Posicionar de baixo para cima
    var boxH = 45;
    var bottomMargin = 25;
    var btnY = height - bottomMargin;             // base dos botões
    var warningY = btnY - boxH - 20;              // aviso acima dos botões

    // Aviso
    cvs.textAlign = 'center';
    cvs.font = '500 15px Manrope, sans-serif';
    cvs.fillStyle = 'rgba(255,255,255,0.6)';
    cvs.shadowColor = 'rgba(0, 0, 0, 0.8)';
    cvs.shadowBlur = 4;
    cvs.fillText('Os canais podem sofrer altera\u00E7\u00E3o de \u00FAltima hora', width / 2, warningY);
    cvs.shadowBlur = 0;

    // Botões WhatsApp + CTA
    cvs.fillStyle = '#25D366';
    roundRect(cvs, padding, btnY - boxH, 180, boxH, 8);
    cvs.fill();
    cvs.fillStyle = '#fff';
    cvs.font = '600 18px Manrope, sans-serif';
    cvs.textAlign = 'center';
    cvs.fillText(globalSettings.whatsappNumber || globalSettings.whatsappText, padding + 90, btnY - boxH / 2 + 6);
    cvs.fillStyle = '#22c55e';
    roundRect(cvs, padding + 195, btnY - boxH, 180, boxH, 8);
    cvs.fill();
    cvs.fillStyle = '#fff';
    cvs.font = '700 18px Manrope, sans-serif';
    cvs.fillText(globalSettings.ctaText, padding + 285, btnY - boxH / 2 + 6);
}

// ============================================
// FOOTBALL MANUAL MODE
// ============================================
var manualGames = [];
var manualGameIdCounter = 0;

function loadFootballManualMode() {
    canvas.classList.add('hidden');
    videoContainer.classList.add('hidden');
    clearPreviousBanners();

    controlPanel.innerHTML = '<header class="border-b border-zinc-800 pb-5"><h2 class="font-oswald text-2xl font-bold text-emerald-400">&#9997; Futebol Manual</h2><p class="text-zinc-500 text-sm mt-2">Adicione jogos manualmente</p></header>' +
        '<section class="mt-5"><label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold block mb-3">Data dos Jogos</label><input type="date" id="manualDate" value="' + getTodayDate() + '" class="bg-black border-2 border-zinc-800 p-3 text-white focus:outline-none focus:border-emerald-500 w-full rounded-lg" data-testid="manual-date-input"></section>' +
        '<div id="manualGamesList" class="mt-5 flex flex-col gap-3"></div>' +
        '<button id="manualAddGameBtn" class="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg transition-all" data-testid="manual-add-game-btn">+ ADICIONAR JOGO</button>' +
        '<section class="flex flex-col gap-3 mt-5"><label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Formato</label><div class="flex gap-2">' +
        '<button id="manualFormatPost" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white" data-testid="manual-format-post">Post</button>' +
        '<button id="manualFormatStory" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800" data-testid="manual-format-story">Story</button></div></section>' +
        '<button id="manualGenerateBtn" class="w-full mt-4 bg-green-500 hover:bg-green-400 text-white font-bold uppercase tracking-widest py-4 rounded-lg transition-all" data-testid="manual-generate-btn">GERAR BANNERS</button>';

    manualGames = [];
    manualGameIdCounter = 0;

    setTimeout(function() {
        document.getElementById('manualAddGameBtn').addEventListener('click', addManualGame);
        document.getElementById('manualGenerateBtn').addEventListener('click', generateManualBanners);
        document.getElementById('manualFormatPost').addEventListener('click', function() { currentFormat = 'post'; updateManualFormatButtons(); });
        document.getElementById('manualFormatStory').addEventListener('click', function() { currentFormat = 'story'; updateManualFormatButtons(); });
        addManualGame();
    }, 100);

    showPlaceholder('&#9997;', 'MANUAL', 'Adicione jogos manualmente', '#0a4d0a', '#001a00');
}

// Mapeamento liga -> canal padrão
var leagueToBroadcaster = {
    'Campeonato_Brasileiro_Serie_A': 'globo_sportv_premiere_prime_cazetv',
    'Campeonato_Brasileiro_Srrie_B': 'espn_disney_sportv',
    'Copa_Libertadores': 'globo_espn_disney_paramount',
    'Premier_League': 'espn_star',
    'La_Liga': 'espn_star',
    'Bundesliga': 'onefootball_youtube',
    'Ligue_1': 'cazetv_prime',
    'UEFA_Champions_League': 'sbt_tnt_hbo',
    'Copa_do_Mundo_FIFA': 'globo_sportv_cazetv',
    'Amistosos_Internacionais': 'sportv'
};

function addManualGame() {
    var id = manualGameIdCounter++;
    var defaultBroadcaster = leagueToBroadcaster['Campeonato_Brasileiro_Serie_A'];
    manualGames.push({ id: id, homeName: '', awayName: '', homeLogo: null, awayLogo: null, league: 'Campeonato_Brasileiro_Serie_A', time: '20:00', broadcaster: defaultBroadcaster });
    var container = document.getElementById('manualGamesList');
    var gameDiv = document.createElement('div');
    gameDiv.id = 'manualGame_' + id;
    gameDiv.className = 'border border-zinc-800 rounded-lg p-4 bg-black/30';

    var broadcasterOptions =
        '<option value="globo_sportv_premiere_prime_cazetv">Globo / SporTV / Premiere / Prime / Caz\u00E9TV</option>' +
        '<option value="espn_disney_sportv">ESPN / Disney+ / SporTV</option>' +
        '<option value="globo_espn_disney_paramount">Globo / ESPN / Disney+ / Paramount+</option>' +
        '<option value="espn_star">ESPN / Star+</option>' +
        '<option value="espn_disney_paramount">ESPN / Disney+ / Paramount+</option>' +
        '<option value="onefootball_youtube">OneFootball / YouTube</option>' +
        '<option value="cazetv_prime">Caz\u00E9TV / Prime Video</option>' +
        '<option value="sbt_tnt_hbo">SBT / TNT Sports / HBO Max</option>' +
        '<option value="globo_sportv_cazetv">Globo / SporTV / Caz\u00E9TV</option>' +
        '<option value="sportv">SporTV</option>' +
        '<option value="globo_premiere">Globo / Premiere</option>' +
        '<option value="band">Band</option>' +
        '<option value="record">Record</option>';

    gameDiv.innerHTML =
        '<div class="flex items-center justify-between mb-3"><span class="text-xs text-emerald-400 font-semibold uppercase">Jogo ' + (manualGames.length) + '</span><button onclick="removeManualGame(' + id + ')" class="text-red-500 hover:text-red-400 text-xs font-semibold">&#10005; Remover</button></div>' +
        '<div class="grid grid-cols-2 gap-3 mb-3">' +
        '<div><label class="text-xs text-zinc-400 block mb-1">Time Casa</label><div class="flex gap-2 items-center"><label class="w-10 h-10 border border-dashed border-zinc-700 rounded cursor-pointer flex items-center justify-center shrink-0 overflow-hidden" title="Logo"><img id="manualHomeLogo_' + id + '" src="" class="w-full h-full object-contain hidden"><span id="manualHomeLogoIcon_' + id + '" class="text-zinc-600 text-lg">+</span><input type="file" accept="image/*" class="hidden" onchange="handleManualLogo(' + id + ',\'home\',this)"></label><input type="text" placeholder="Nome" class="bg-black border border-zinc-800 p-2 text-white text-sm flex-1 rounded focus:outline-none focus:border-emerald-500 min-w-0" oninput="updateManualGame(' + id + ',\'homeName\',this.value)" data-testid="manual-home-' + id + '"></div></div>' +
        '<div><label class="text-xs text-zinc-400 block mb-1">Time Fora</label><div class="flex gap-2 items-center"><label class="w-10 h-10 border border-dashed border-zinc-700 rounded cursor-pointer flex items-center justify-center shrink-0 overflow-hidden" title="Logo"><img id="manualAwayLogo_' + id + '" src="" class="w-full h-full object-contain hidden"><span id="manualAwayLogoIcon_' + id + '" class="text-zinc-600 text-lg">+</span><input type="file" accept="image/*" class="hidden" onchange="handleManualLogo(' + id + ',\'away\',this)"></label><input type="text" placeholder="Nome" class="bg-black border border-zinc-800 p-2 text-white text-sm flex-1 rounded focus:outline-none focus:border-emerald-500 min-w-0" oninput="updateManualGame(' + id + ',\'awayName\',this.value)" data-testid="manual-away-' + id + '"></div></div></div>' +
        '<div class="mb-3"><label class="text-xs text-zinc-400 block mb-1">Liga</label><select class="bg-black border border-zinc-800 p-2 text-white text-sm w-full rounded focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer" onchange="onManualLeagueChange(' + id + ',this.value)" data-testid="manual-league-' + id + '">' +
        '<option value="Campeonato_Brasileiro_Serie_A">Brasileir\u00E3o S\u00E9rie A</option>' +
        '<option value="Campeonato_Brasileiro_Srrie_B">Brasileir\u00E3o S\u00E9rie B</option>' +
        '<option value="Copa_Libertadores">Copa Libertadores</option>' +
        '<option value="Premier_League">Premier League</option>' +
        '<option value="La_Liga">La Liga</option>' +
        '<option value="Bundesliga">Bundesliga</option>' +
        '<option value="Ligue_1">Ligue 1</option>' +
        '<option value="UEFA_Champions_League">UEFA Champions League</option>' +
        '<option value="Copa_do_Mundo_FIFA">Copa do Mundo FIFA</option>' +
        '<option value="Amistosos_Internacionais">Amistosos Internacionais</option>' +
        '</select></div>' +
        '<div class="grid grid-cols-2 gap-3"><div><label class="text-xs text-zinc-400 block mb-1">Horario</label><input type="time" value="20:00" class="bg-black border border-zinc-800 p-2 text-white text-sm w-full rounded focus:outline-none focus:border-emerald-500" oninput="updateManualGame(' + id + ',\'time\',this.value)"></div>' +
        '<div><label class="text-xs text-zinc-400 block mb-1">Transmissao</label><select id="manualBroadcaster_' + id + '" class="bg-black border border-zinc-800 p-2 text-white text-sm w-full rounded focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer" onchange="updateManualGame(' + id + ',\'broadcaster\',this.value)" data-testid="manual-broadcaster-' + id + '">' + broadcasterOptions + '</select></div></div>';

    container.appendChild(gameDiv);

    // Setar canal padrão no select
    var bcSelect = document.getElementById('manualBroadcaster_' + id);
    if (bcSelect) bcSelect.value = defaultBroadcaster;
}

window.onManualLeagueChange = function(id, leagueValue) {
    updateManualGame(id, 'league', leagueValue);
    // Auto-selecionar canal baseado na liga
    var bc = leagueToBroadcaster[leagueValue] || 'sportv';
    var bcSelect = document.getElementById('manualBroadcaster_' + id);
    if (bcSelect) bcSelect.value = bc;
    updateManualGame(id, 'broadcaster', bc);
};

window.removeManualGame = function(id) {
    manualGames = manualGames.filter(function(g) { return g.id !== id; });
    var el = document.getElementById('manualGame_' + id);
    if (el) el.remove();
    document.querySelectorAll('#manualGamesList > div').forEach(function(item, idx) {
        var label = item.querySelector('span'); if (label) label.textContent = 'Jogo ' + (idx + 1);
    });
};

window.updateManualGame = function(id, field, value) {
    var game = manualGames.find(function(g) { return g.id === id; });
    if (game) game[field] = value;
};

window.handleManualLogo = function(id, side, input) {
    var file = input.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
        var img = new Image();
        img.onload = function() {
            var game = manualGames.find(function(g) { return g.id === id; });
            if (!game) return;
            if (side === 'home') game.homeLogo = img; else game.awayLogo = img;
            var prefix = side === 'home' ? 'Home' : 'Away';
            var imgEl = document.getElementById('manual' + prefix + 'Logo_' + id);
            var iconEl = document.getElementById('manual' + prefix + 'LogoIcon_' + id);
            if (imgEl) { imgEl.src = ev.target.result; imgEl.classList.remove('hidden'); }
            if (iconEl) iconEl.classList.add('hidden');
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
};

function updateManualFormatButtons() {
    var postBtn = document.getElementById('manualFormatPost');
    var storyBtn = document.getElementById('manualFormatStory');
    if (currentFormat === 'post') {
        postBtn.className = 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white';
        storyBtn.className = 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800';
    } else {
        storyBtn.className = 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white';
        postBtn.className = 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800';
    }
}

async function generateManualBanners() {
    var validGames = manualGames.filter(function(g) { return g.homeName.trim() && g.awayName.trim(); });
    if (validGames.length === 0) { alert('Adicione pelo menos 1 jogo com os nomes dos times!'); return; }

    var btn = document.getElementById('manualGenerateBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner mx-auto"></div>';

    selectedDate = document.getElementById('manualDate').value;
    var isPost = currentFormat === 'post';
    var gamesPerBanner = isPost ? 5 : 8;

    // Mapeamento de nomes de arquivo para nomes legíveis
    var leagueDisplayNames = {
        'Campeonato_Brasileiro_Serie_A': 'Brasileirão Série A',
        'Campeonato_Brasileiro_Srrie_B': 'Brasileirão Série B',
        'Copa_Libertadores': 'Copa Libertadores',
        'Premier_League': 'Premier League',
        'La_Liga': 'La Liga',
        'Bundesliga': 'Bundesliga',
        'Ligue_1': 'Ligue 1',
        'UEFA_Champions_League': 'UEFA Champions League',
        'Copa_do_Mundo_FIFA': 'Copa do Mundo FIFA',
        'Amistosos_Internacionais': 'Amistosos Internacionais'
    };

    var broadcasterDisplayNames = {
        'globo_sportv_premiere_prime_cazetv': 'Globo / SporTV / Premiere / Prime / CazéTV',
        'espn_disney_sportv': 'ESPN / Disney+ / SporTV',
        'globo_espn_disney_paramount': 'Globo / ESPN / Disney+ / Paramount+',
        'espn_star': 'ESPN / Star+',
        'espn_disney_paramount': 'ESPN / Disney+ / Paramount+',
        'onefootball_youtube': 'OneFootball / YouTube',
        'cazetv_prime': 'CazéTV / Prime Video',
        'sbt_tnt_hbo': 'SBT / TNT Sports / HBO Max',
        'globo_sportv_cazetv': 'Globo / SporTV / CazéTV',
        'sportv': 'SporTV',
        'globo_premiere': 'Globo / Premiere',
        'band': 'Band',
        'record': 'Record'
    };

    var gamesForBanner = validGames.map(function(g) {
        var leagueName = leagueDisplayNames[g.league] || g.league || '';
        var broadcasterText = broadcasterDisplayNames[g.broadcaster] || g.broadcaster || '';
        return {
            fixture: { date: selectedDate + 'T' + (g.time || '20:00') + ':00' },
            league: { name: leagueName },
            teams: { home: { name: g.homeName }, away: { name: g.awayName } },
            homeLogoImg: g.homeLogo,
            awayLogoImg: g.awayLogo,
            manualBroadcaster: broadcasterText
        };
    });

    allFootballGames = gamesForBanner;

    try {
        clearPreviousBanners();
        var container = document.getElementById('bannersContainer');
        var totalGameBanners = Math.ceil(gamesForBanner.length / gamesPerBanner);
        var totalBanners = 1 + totalGameBanners;

        // CAPA
        var coverCanvas = document.createElement('canvas');
        coverCanvas.className = 'canvas-glow max-w-full h-auto rounded-lg mx-auto mb-4';
        var coverDlBtn = document.createElement('button');
        coverDlBtn.className = 'w-full max-w-md mx-auto bg-green-500 hover:bg-green-400 text-white font-bold py-3 px-6 rounded-lg mb-8 flex items-center justify-center gap-2';
        coverDlBtn.innerHTML = 'BAIXAR CAPA (1 de ' + totalBanners + ')';
        coverDlBtn.onclick = function() { downloadBanner(coverCanvas, 'capa'); };
        container.appendChild(coverCanvas);
        container.appendChild(coverDlBtn);
        await generateFootballCoverBanner(coverCanvas, [], totalBanners);

        // JOGOS
        for (var bi = 0; bi < totalGameBanners; bi++) {
            var bannerGames = gamesForBanner.slice(bi * gamesPerBanner, Math.min((bi + 1) * gamesPerBanner, gamesForBanner.length));
            var canvasEl = document.createElement('canvas');
            canvasEl.className = 'canvas-glow max-w-full h-auto rounded-lg mx-auto mb-4';
            canvasEl.id = 'manualBanner' + (bi + 2);
            var dlBtn = document.createElement('button');
            dlBtn.className = 'w-full max-w-md mx-auto bg-green-500 hover:bg-green-400 text-white font-bold py-3 px-6 rounded-lg mb-8 flex items-center justify-center gap-2';
            dlBtn.innerHTML = 'BAIXAR BANNER ' + (bi + 2) + ' de ' + totalBanners;
            (function(ce, idx) { dlBtn.onclick = function() { downloadBanner(ce, idx + 2); }; })(canvasEl, bi);
            container.appendChild(canvasEl);
            container.appendChild(dlBtn);
            await generateFootballListBannerModern(canvasEl, bannerGames, bi + 2, totalBanners);
        }

        btn.disabled = false;
        btn.innerHTML = 'GERAR BANNERS';
        alert(totalBanners + ' banner' + (totalBanners > 1 ? 's' : '') + ' gerado' + (totalBanners > 1 ? 's' : '') + '!');
    } catch (error) {
        console.error('Erro:', error);
        btn.disabled = false;
        btn.innerHTML = 'GERAR BANNERS';
        alert('Erro: ' + error.message);
    }
}


function getBroadcaster(leagueName) {
    for (var key in leagueBroadcasters) {
        if (leagueName.includes(key)) return leagueBroadcasters[key];
    }
    return 'Verifique a programa\u00E7\u00E3o';
}

function downloadBanner(canvasEl, num) {
    var dataUrl = canvasEl.toDataURL('image/png');
    var link = document.createElement('a');
    var dateStr = new Date(selectedDate).toLocaleDateString('pt-BR').replace(/\//g, '-');
    var label = num === 'capa' ? 'capa' : 'banner_' + num;
    link.download = 'jogos_' + dateStr + '_' + label + '.png';
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function copyAllFootballGames() {
    if (!allFootballGames || allFootballGames.length === 0) { alert('Nenhum jogo encontrado!'); return; }
    var dateFormatted = new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    var text = '*JOGOS DE ' + dateFormatted.toUpperCase() + '*\n\n';
    allFootballGames.forEach(function(game) {
        var league = game.league.name;
        var emoji = getLeagueEmoji(league);
        var time = new Date(game.fixture.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        var broadcaster = getBroadcaster(league);
        text += emoji + ' *' + league + '* - ' + time + '\n' + game.teams.home.name + ' x ' + game.teams.away.name + '\n' + broadcaster + '\n\n';
    });
    text += 'Total: ' + allFootballGames.length + ' jogo' + (allFootballGames.length > 1 ? 's' : '') + '\nOs canais podem sofrer altera\u00E7\u00E3o de \u00FAltima hora';
    navigator.clipboard.writeText(text).then(function() { alert(allFootballGames.length + ' jogo' + (allFootballGames.length > 1 ? 's' : '') + ' copiado' + (allFootballGames.length > 1 ? 's' : '') + '!'); }).catch(function() { alert('Erro ao copiar'); });
}

function getLeagueEmoji(leagueName) {
    var map = { 'Premier League': '👑', 'Copa Libertadores': '🏆', 'Copa Sul-Americana': '🥉', 'Copa do Brasil': '🏅', 'Brasileirão Série A': '🇧🇷', 'Serie A': '🇧🇷', 'Brasileirão Série B': '📈', 'Serie B': '📈', 'La Liga': '🇪🇸', 'Ligue 1': '🇫🇷', 'Bundesliga': '🇩🇪', 'UEFA Champions League': '⭐', 'FIFA World Cup': '🌍', 'World Cup': '🌍' };
    for (var key in map) { if (leagueName.includes(key)) return map[key]; }
    return '⚽';
}

// ============================================
// MOVIES MODE
// ============================================
async function loadMoviesMode() {
    canvas.classList.remove('hidden');
    videoContainer.classList.add('hidden');
    controlPanel.innerHTML = '<header class="border-b border-zinc-800 pb-5"><h2 class="font-oswald text-2xl font-bold text-red-400">Filmes e Séries</h2></header>' +
        '<section class="mt-5"><label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold block mb-3">Buscar Filme ou Série</label><div class="relative"><input type="text" id="movieSearch" placeholder="Digite o nome..." class="bg-black border-2 border-zinc-800 p-4 pr-14 text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 w-full rounded-lg" data-testid="movie-search-input"></div><div id="movieResults" class="mt-2 max-h-96 overflow-y-auto"></div></section>' +
        '<section id="movieControls" class="hidden flex flex-col gap-5 mt-5"><div id="movieSelectedInfo" class="border border-zinc-800 p-4 bg-black/30 rounded-lg"></div>' +
        '<section class="flex flex-col gap-3"><label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Formato</label><div class="flex gap-2"><button id="movieFormatPost" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white">Post</button><button id="movieFormatStory" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800">Story</button></div></section>' +
        '<section class="flex flex-col gap-3"><label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Plataforma <span id="platformAutoText" class="text-green-400 text-xs normal-case"></span></label>' +
        '<select id="moviePlatform" class="bg-black border border-zinc-800 p-4 text-white focus:outline-none focus:border-red-500 w-full appearance-none cursor-pointer rounded pr-10"><option value="">Selecione ou automático</option><option value="Netflix">Netflix</option><option value="Amazon Prime Video">Amazon Prime Video</option><option value="Disney+">Disney+</option><option value="HBO Max">HBO Max</option><option value="Max">Max</option><option value="Apple TV+">Apple TV+</option><option value="Paramount+">Paramount+</option><option value="Globoplay">Globoplay</option><option value="Star+">Star+</option><option value="Crunchyroll">Crunchyroll</option><option value="Cinema">Cinema</option></select></section>' +
        '<button id="movieDownloadBtn" class="w-full bg-red-500 text-white font-bold uppercase tracking-widest py-4 hover:bg-red-400 transition-all flex items-center justify-center gap-3 rounded-lg cursor-pointer" data-testid="movie-download-btn">BAIXAR BANNER</button></section>';
    setTimeout(function() {
        var searchTimeout;
        document.getElementById('movieSearch').addEventListener('input', function(e) { clearTimeout(searchTimeout); searchTimeout = setTimeout(function() { searchMovies(e.target.value); }, 500); });
        document.getElementById('movieFormatPost').addEventListener('click', function() { currentFormat = 'post'; updateMovieFormatButtons(); generateMovieBanner(); });
        document.getElementById('movieFormatStory').addEventListener('click', function() { currentFormat = 'story'; updateMovieFormatButtons(); generateMovieBanner(); });
        document.getElementById('moviePlatform').addEventListener('change', generateMovieBanner);
        document.getElementById('movieDownloadBtn').addEventListener('click', downloadMovieBanner);
    }, 100);
    showPlaceholder('🎬', 'FILMES', 'Busque um filme ou série', '#7f1d1d', '#18181b');
}

async function searchMovies(query) {
    if (!query.trim()) { document.getElementById('movieResults').innerHTML = ''; return; }
    try {
        var results = await Promise.all([
            fetch(TMDB_BASE_URL + '/search/movie?language=pt-BR&query=' + encodeURIComponent(query)),
            fetch(TMDB_BASE_URL + '/search/tv?language=pt-BR&query=' + encodeURIComponent(query))
        ]);
        var moviesData = await results[0].json();
        var seriesData = await results[1].json();
        var movies = (moviesData.results || []).slice(0, 5).map(function(m) { return { id: m.id, type: 'movie', title: m.title, year: m.release_date ? m.release_date.split('-')[0] : 'N/A', rating: m.vote_average ? m.vote_average.toFixed(1) : 'N/A', overview: m.overview || 'Sinopse não disponível.', poster: m.poster_path ? TMDB_IMG_BASE + '/w500' + m.poster_path : null }; });
        var series = (seriesData.results || []).slice(0, 5).map(function(s) { return { id: s.id, type: 'tv', title: s.name, year: s.first_air_date ? s.first_air_date.split('-')[0] : 'N/A', rating: s.vote_average ? s.vote_average.toFixed(1) : 'N/A', overview: s.overview || 'Sinopse não disponível.', poster: s.poster_path ? TMDB_IMG_BASE + '/w500' + s.poster_path : null }; });
        displayMovieResults(movies.concat(series));
    } catch (error) { console.error('Erro:', error); }
}

function displayMovieResults(results) {
    var resultsDiv = document.getElementById('movieResults');
    if (results.length === 0) { resultsDiv.innerHTML = '<p class="text-zinc-500 text-sm p-3">Nenhum resultado</p>'; return; }
    resultsDiv.innerHTML = results.map(function(item, index) {
        return '<div class="search-result flex items-center gap-3 p-3 cursor-pointer border-b border-zinc-800 hover:bg-zinc-800/50 rounded" data-index="' + index + '">' +
            (item.poster ? '<img src="' + item.poster + '" class="w-12 h-16 object-cover rounded">' : '<div class="w-12 h-16 bg-zinc-800 rounded flex items-center justify-center">🎬</div>') +
            '<div class="flex-1 min-w-0"><p class="font-semibold text-sm truncate">' + item.title + '</p><p class="text-zinc-500 text-xs">' + item.year + ' - ' + (item.type === 'movie' ? 'Filme' : 'Série') + ' - ' + item.rating + '</p></div></div>';
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
    if (movie.poster) { try { posterImage = await loadImage(API_BASE_URL + '/api/image-proxy?url=' + encodeURIComponent(movie.poster)); } catch (e) { posterImage = null; } } else { posterImage = null; }
    document.getElementById('movieControls').classList.remove('hidden');
    document.getElementById('movieSelectedInfo').innerHTML = '<div class="flex gap-3 mb-3">' + (movie.poster ? '<img src="' + movie.poster + '" class="w-20 h-30 object-cover rounded">' : '') + '<div class="flex-1"><h3 class="font-oswald text-lg font-bold">' + movie.title + '</h3><p class="text-zinc-500 text-sm">' + movie.year + ' - ' + (movie.type === 'movie' ? 'Filme' : 'Série') + ' - ' + movie.rating + '</p><p class="text-zinc-400 text-xs mt-2 line-clamp-3">' + movie.overview + '</p></div></div><button onclick="copyMovieInfo()" class="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2">Copiar Informações</button>';
    setTimeout(function() { generateMovieBanner(); }, 200);
}

function matchPlatform(name) {
    var map = { 'Netflix': 'Netflix', 'Amazon Prime Video': 'Amazon Prime Video', 'Prime Video': 'Amazon Prime Video', 'Disney Plus': 'Disney+', 'Disney+': 'Disney+', 'HBO Max': 'HBO Max', 'Max': 'Max', 'Apple TV Plus': 'Apple TV+', 'Apple TV+': 'Apple TV+', 'Paramount Plus': 'Paramount+', 'Paramount+': 'Paramount+', 'Globoplay': 'Globoplay', 'Star Plus': 'Star+', 'Star+': 'Star+', 'Crunchyroll': 'Crunchyroll' };
    return map[name] || '';
}

window.copyMovieInfo = function() {
    if (!selectedContent) return;
    var durationText = selectedContent.type === 'movie' ? selectedContent.runtime : (selectedContent.seasons || selectedContent.runtime);
    var info = '*' + selectedContent.title + '*\n\nAno: ' + selectedContent.year + '\nTipo: ' + (selectedContent.type === 'movie' ? 'Filme' : 'Série') + '\nNota: ' + selectedContent.rating + '\nGêneros: ' + (selectedContent.genres || 'N/A') + '\nDuração: ' + (durationText || 'N/A') + '\n\n' + (selectedContent.overview || 'Sem sinopse');
    navigator.clipboard.writeText(info).then(function() { alert('Informações copiadas!'); }).catch(function() { alert('Erro ao copiar'); });
};

function generateMovieBanner() {
    if (!selectedContent || currentMode !== 'movies') return;
    var isPost = currentFormat === 'post';
    var width = 1080;
    var height = isPost ? 1080 : 1920;
    canvas.width = width;
    canvas.height = height;
    canvas.style.maxWidth = isPost ? '400px' : '280px';
    canvas.style.display = 'block';
    if (posterImage) {
        var imgR = posterImage.width / posterImage.height;
        var canR = width / height;
        var dw, dh, ox, oy;
        if (imgR > canR) { dh = height; dw = height * imgR; ox = (width - dw) / 2; oy = 0; }
        else { dw = width; dh = width / imgR; ox = 0; oy = (height - dh) / 2; }
        ctx.drawImage(posterImage, ox, oy, dw, dh);
    } else { ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, 0, width, height); }
    var gradient = ctx.createLinearGradient(0, height * 0.15, 0, height);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.35, 'rgba(0,0,0,0.5)');
    gradient.addColorStop(0.6, 'rgba(0,0,0,0.8)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    if (uploadedLogo) {
        ctx.save(); ctx.globalAlpha = 0.15;
        var pSize = 80; var logoR = uploadedLogo.width / uploadedLogo.height; var pW = pSize * logoR; var pH = pSize; var spX = pW + 60; var spY = pH + 60;
        ctx.translate(width / 2, height / 2); ctx.rotate(-30 * Math.PI / 180); ctx.translate(-width / 2, -height / 2);
        for (var py = -height; py < height * 2; py += spY) { for (var px = -width; px < width * 2; px += spX) { ctx.drawImage(uploadedLogo, px, py, pW, pH); } }
        ctx.restore();
        var cornerH = 300; var cornerW = cornerH * logoR; ctx.globalAlpha = 1; ctx.drawImage(uploadedLogo, width - cornerW, 0, cornerW, cornerH);
    }
    var mPadding = 50; var footerY = height - mPadding; var boxH = 50;
    ctx.fillStyle = '#25D366'; roundRect(ctx, mPadding, footerY - boxH, 180, boxH, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '600 20px Manrope, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(globalSettings.whatsappNumber || globalSettings.whatsappText, mPadding + 90, footerY - boxH / 2 + 7);
    ctx.fillStyle = '#ef4444'; roundRect(ctx, mPadding + 195, footerY - boxH, 180, boxH, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 20px Manrope, sans-serif';
    ctx.fillText(globalSettings.ctaText, mPadding + 285, footerY - boxH / 2 + 7);
    var currentY = footerY - boxH - 25;
    var maxTextWidth = width - mPadding * 2;
    ctx.font = '400 24px Manrope, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.textAlign = 'left';
    var maxLines = isPost ? 5 : 7;
    var synLines = wrapText(ctx, selectedContent.overview, maxTextWidth).slice(0, maxLines);
    currentY -= 10;
    for (var si = synLines.length - 1; si >= 0; si--) { ctx.fillText(synLines[si], mPadding, currentY); currentY -= 32; }
    currentY -= 15;
    ctx.font = '600 24px Manrope, sans-serif';
    var metaX = mPadding; var sep = '  •  ';
    ctx.fillStyle = '#eab308'; var rt = '★ ' + selectedContent.rating; ctx.fillText(rt, metaX, currentY); metaX += ctx.measureText(rt).width;
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText(sep, metaX, currentY); metaX += ctx.measureText(sep).width;
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillText(selectedContent.year, metaX, currentY); metaX += ctx.measureText(selectedContent.year).width;
    if (selectedContent.genres !== 'N/A') { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText(sep, metaX, currentY); metaX += ctx.measureText(sep).width; ctx.fillStyle = 'rgba(255,255,255,0.9)'; var gg = selectedContent.genres.split(',')[0].trim(); ctx.fillText(gg, metaX, currentY); metaX += ctx.measureText(gg).width; }
    if (selectedContent.runtime !== 'N/A') { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText(sep, metaX, currentY); metaX += ctx.measureText(sep).width; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillText(selectedContent.runtime, metaX, currentY); metaX += ctx.measureText(selectedContent.runtime).width; }
    var plat = (document.getElementById('moviePlatform') ? document.getElementById('moviePlatform').value : '') || selectedContent.autoProvider;
    if (plat) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText(sep, metaX, currentY); metaX += ctx.measureText(sep).width; ctx.fillStyle = '#ef4444'; ctx.fillText(plat, metaX, currentY); }
    currentY -= 50;
    ctx.font = '700 68px Oswald, sans-serif'; ctx.fillStyle = '#fff';
    var titleLines = wrapText(ctx, selectedContent.title.toUpperCase(), maxTextWidth);
    for (var ti = titleLines.length - 1; ti >= 0; ti--) { ctx.fillText(titleLines[ti], mPadding, currentY); currentY -= 75; }
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
    if (!selectedContent) { alert('Selecione um filme ou série primeiro!'); return; }
    var dataUrl = canvas.toDataURL('image/png');
    var link = document.createElement('a');
    link.download = selectedContent.title.replace(/[^a-zA-Z0-9]/g, '_') + '_' + currentFormat + '.png';
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================
// VIDEO MODE
// ============================================
async function loadVideoMode() {
    controlPanel.innerHTML = '<header class="border-b border-zinc-800 pb-5"><h2 class="font-oswald text-2xl font-bold text-purple-400">Gerador de Trailers</h2><p class="text-zinc-500 text-sm mt-2">Busque filmes/séries e gere trailers em MP4</p></header>' +
        '<section class="mt-5"><label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold block mb-3">Buscar Filme ou Série</label><div class="relative"><input type="text" id="videoSearch" placeholder="Digite o nome..." class="bg-black border-2 border-zinc-800 p-4 pr-14 text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 w-full rounded-lg" data-testid="video-search-input"></div><div id="videoResults" class="mt-2 max-h-96 overflow-y-auto"></div></section>' +
        '<section id="videoControls" class="hidden flex flex-col gap-5 mt-5"><div id="videoSelectedInfo" class="border border-zinc-800 p-4 bg-black/30 rounded-lg"></div>' +
        '<div id="trailerInfo" class="hidden border border-purple-500/30 bg-purple-900/10 p-4 rounded-lg"><div class="flex items-center gap-2 mb-2"><span class="text-purple-400 text-sm font-semibold">Trailer Selecionado</span></div><p id="trailerName" class="text-white text-sm font-semibold"></p><p id="trailerLang" class="text-zinc-400 text-xs mt-1"></p><a id="trailerYoutubeLink" href="#" target="_blank" class="text-purple-400 hover:text-purple-300 text-xs mt-2 inline-block">Ver no YouTube</a></div>' +
        '<section class="flex flex-col gap-3"><label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Formato do Vídeo</label><div class="flex gap-2"><button id="videoFormatHorizontal" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white">16:9 Horizontal</button><button id="videoFormatVertical" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800">9:16 Story</button></div></section>' +
        '<button id="videoGenerateBtn" class="w-full bg-purple-500 text-white font-bold uppercase tracking-widest py-4 hover:bg-purple-400 transition-all flex items-center justify-center gap-3 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" data-testid="video-generate-btn">GERAR TRAILER MP4</button>' +
        '<p class="text-xs text-zinc-500 text-center">Prioridade: PT-BR Dublado > PT-BR > Original</p></section>';
    setTimeout(function() {
        var searchTimeout;
        document.getElementById('videoSearch').addEventListener('input', function(e) { clearTimeout(searchTimeout); searchTimeout = setTimeout(function() { searchVideos(e.target.value); }, 500); });
        document.getElementById('videoFormatHorizontal').addEventListener('click', function() { currentFormat = 'horizontal'; updateVideoFormatButtons(); });
        document.getElementById('videoFormatVertical').addEventListener('click', function() { currentFormat = 'story'; updateVideoFormatButtons(); });
        document.getElementById('videoGenerateBtn').addEventListener('click', generateTrailerVideo);
    }, 100);
    canvas.classList.add('hidden');
    videoContainer.classList.remove('hidden');
    videoContainer.innerHTML = '<div class="text-center p-12"><div class="text-8xl mb-6">🎥</div><h3 class="font-oswald text-3xl font-bold text-purple-400 mb-3">GERADOR DE TRAILERS</h3><p class="text-zinc-400">Busque um filme ou série para começar</p></div>';
}

async function searchVideos(query) {
    if (!query.trim()) { document.getElementById('videoResults').innerHTML = ''; return; }
    try {
        var results = await Promise.all([
            fetch(TMDB_BASE_URL + '/search/movie?language=pt-BR&query=' + encodeURIComponent(query)),
            fetch(TMDB_BASE_URL + '/search/tv?language=pt-BR&query=' + encodeURIComponent(query))
        ]);
        var moviesData = await results[0].json();
        var seriesData = await results[1].json();
        var movies = (moviesData.results || []).slice(0, 5).map(function(m) { return { id: m.id, type: 'movie', title: m.title, year: m.release_date ? m.release_date.split('-')[0] : 'N/A', rating: m.vote_average ? m.vote_average.toFixed(1) : 'N/A', overview: m.overview || '', poster: m.poster_path ? TMDB_IMG_BASE + '/w500' + m.poster_path : null }; });
        var series = (seriesData.results || []).slice(0, 5).map(function(s) { return { id: s.id, type: 'tv', title: s.name, year: s.first_air_date ? s.first_air_date.split('-')[0] : 'N/A', rating: s.vote_average ? s.vote_average.toFixed(1) : 'N/A', overview: s.overview || '', poster: s.poster_path ? TMDB_IMG_BASE + '/w500' + s.poster_path : null }; });
        displayVideoResults(movies.concat(series));
    } catch (error) { console.error('Erro:', error); }
}

function displayVideoResults(results) {
    var resultsDiv = document.getElementById('videoResults');
    if (results.length === 0) { resultsDiv.innerHTML = '<p class="text-zinc-500 text-sm p-3">Nenhum resultado</p>'; return; }
    resultsDiv.innerHTML = results.map(function(item, index) {
        return '<div class="search-result flex items-center gap-3 p-3 cursor-pointer border-b border-zinc-800 hover:bg-zinc-800/50 rounded" data-index="' + index + '">' +
            (item.poster ? '<img src="' + item.poster + '" class="w-12 h-16 object-cover rounded">' : '<div class="w-12 h-16 bg-zinc-800 rounded flex items-center justify-center">🎬</div>') +
            '<div class="flex-1 min-w-0"><p class="font-semibold text-sm truncate">' + item.title + '</p><p class="text-zinc-500 text-xs">' + item.year + ' - ' + (item.type === 'movie' ? 'Filme' : 'Série') + '</p></div></div>';
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
    currentTrailer = null;
    document.getElementById('videoResults').innerHTML = '';
    document.getElementById('videoSearch').value = '';
    document.getElementById('videoControls').classList.remove('hidden');
    document.getElementById('trailerInfo').classList.add('hidden');
    document.getElementById('videoSelectedInfo').innerHTML = '<div class="flex gap-3 mb-3">' + (content.poster ? '<img src="' + content.poster + '" class="w-20 h-30 object-cover rounded">' : '') + '<div class="flex-1"><h3 class="font-oswald text-lg font-bold">' + content.title + '</h3><p class="text-zinc-500 text-sm">' + content.year + ' - ' + (content.type === 'movie' ? 'Filme' : 'Série') + '</p></div></div><div class="flex items-center gap-2 mt-3"><div class="spinner"></div><span class="text-sm text-zinc-400">Buscando melhor trailer...</span></div>';
    try {
        var response = await fetch(API_BASE_URL + '/api/video/best-trailer/' + content.type + '/' + content.id);
        var data = await response.json();
        if (response.ok && data.key) { currentTrailer = data; displayTrailerInfo(data); }
        else {
            document.getElementById('videoSelectedInfo').innerHTML = '<div class="flex gap-3 mb-3">' + (content.poster ? '<img src="' + content.poster + '" class="w-20 h-30 object-cover rounded">' : '') + '<div class="flex-1"><h3 class="font-oswald text-lg font-bold">' + content.title + '</h3><p class="text-zinc-500 text-sm">' + content.year + '</p></div></div><div class="bg-red-900/20 border border-red-500/30 p-3 rounded-lg"><p class="text-red-400 text-sm">Nenhum trailer disponível</p></div>';
            document.getElementById('videoGenerateBtn').disabled = true;
        }
    } catch (error) { console.error('Erro:', error); alert('Erro ao buscar trailer'); }
}

function displayTrailerInfo(trailer) {
    document.getElementById('videoSelectedInfo').innerHTML = '<div class="flex gap-3">' + (selectedContent.poster ? '<img src="' + selectedContent.poster + '" class="w-20 h-30 object-cover rounded">' : '') + '<div class="flex-1"><h3 class="font-oswald text-lg font-bold">' + selectedContent.title + '</h3><p class="text-zinc-500 text-sm">' + selectedContent.year + ' - ' + (selectedContent.type === 'movie' ? 'Filme' : 'Série') + '</p></div></div>';
    var priorityText = trailer.priority === 1 ? 'PT-BR Dublado' : trailer.priority === 2 ? 'PT-BR' : 'Original';
    document.getElementById('trailerInfo').classList.remove('hidden');
    document.getElementById('trailerName').textContent = trailer.name;
    document.getElementById('trailerLang').textContent = 'Idioma: ' + (trailer.language || '').toUpperCase() + ' - ' + priorityText;
    document.getElementById('trailerYoutubeLink').href = trailer.youtubeUrl;
    document.getElementById('videoGenerateBtn').disabled = false;
}

function updateVideoFormatButtons() {
    var hBtn = document.getElementById('videoFormatHorizontal');
    var vBtn = document.getElementById('videoFormatVertical');
    if (currentFormat === 'story') {
        vBtn.className = 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white';
        hBtn.className = 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800';
    } else {
        hBtn.className = 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white';
        vBtn.className = 'flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800';
    }
}

async function generateTrailerVideo() {
    if (!currentTrailer) { alert('Nenhum trailer selecionado'); return; }
    var btn = document.getElementById('videoGenerateBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner mx-auto"></div>';
    try {
        var format = currentFormat === 'story' ? 'story' : 'horizontal';
        canvas.classList.add('hidden');
        videoContainer.classList.remove('hidden');
        var youtubeUrl = currentTrailer.youtubeUrl;
        videoContainer.innerHTML = '<div class="text-center p-8 bg-zinc-900/50 border border-purple-500/30 rounded-xl max-w-2xl mx-auto"><div class="text-6xl mb-4">🎬</div><h3 class="font-oswald text-2xl font-bold text-purple-400 mb-4">Como Baixar o Trailer</h3><div class="bg-black/50 border border-zinc-800 rounded-lg p-6 mb-4 text-left"><p class="text-white font-semibold mb-3">Passo a passo:</p><ol class="text-zinc-300 text-sm space-y-2 list-decimal list-inside"><li>Clique no botão abaixo</li><li>No site que abrir, cole a URL do trailer</li><li>Escolha a qualidade desejada</li><li>Clique em Download</li></ol></div><div class="space-y-3 mb-6"><a href="https://y2meta.is/en107/" target="_blank" class="block w-full bg-gradient-to-r from-red-600 to-red-500 text-white font-bold uppercase tracking-widest py-4 px-6 rounded-lg hover:from-red-500 hover:to-red-400 transition-all">Baixar via Y2Meta</a><a href="https://savefrom.net/pt1/" target="_blank" class="block w-full bg-gradient-to-r from-green-600 to-green-500 text-white font-bold uppercase tracking-widest py-4 px-6 rounded-lg hover:from-green-500 hover:to-green-400 transition-all">Baixar via SaveFrom</a></div><div class="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 mb-4"><p class="text-purple-300 text-sm font-semibold mb-2">URL do Trailer:</p><div class="flex items-center gap-2"><input type="text" id="trailerUrlInput" value="' + youtubeUrl + '" readonly class="flex-1 bg-black border border-zinc-700 text-white text-xs p-3 rounded"><button onclick="copyTrailerUrl()" class="bg-purple-500 hover:bg-purple-400 text-white px-4 py-3 rounded font-semibold text-sm">Copiar</button></div></div><div class="flex gap-3"><a href="' + youtubeUrl + '" target="_blank" class="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-3 rounded-lg text-center">Ver no YouTube</a></div><p class="text-xs text-zinc-500 mt-6">Formato recomendado: ' + (format === 'story' ? '1080x1920 (Vertical)' : '1920x1080 (Horizontal)') + '</p></div>';
        btn.disabled = false;
        btn.innerHTML = 'GERAR TRAILER MP4';
    } catch (error) { console.error('Erro:', error); alert('Erro: ' + error.message); btn.disabled = false; btn.innerHTML = 'GERAR TRAILER MP4'; }
}

window.copyTrailerUrl = function() {
    var input = document.getElementById('trailerUrlInput');
    input.select();
    document.execCommand('copy');
    alert('URL copiada!');
};

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
