const API_BASE_URL = window.location.origin;
const TMDB_BASE_URL = API_BASE_URL + '/api/tmdb';
const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p';

// ====== NOVOS ASSETS DA PASTA /banner/ ======
const BANNER_COVER_URL = '/banner/capa.png';
const BANNER_BG_URL    = '/banner/fundo.png';
let bannerCoverImg = null;   // capa para o banner de capa (Post)
let bannerBgImg    = null;   // fundo com 5 slots para banner de jogos (Post)

// Pré-carrega imagens da pasta /banner (sem bloquear)
(function preloadBannerAssets() {
    var imgC = new Image();
    imgC.onload = function() { bannerCoverImg = imgC; };
    imgC.onerror = function() { console.warn('Falha ao carregar', BANNER_COVER_URL); };
    imgC.src = BANNER_COVER_URL;

    var imgB = new Image();
    imgB.onload = function() { bannerBgImg = imgB; };
    imgB.onerror = function() { console.warn('Falha ao carregar', BANNER_BG_URL); };
    imgB.src = BANNER_BG_URL;
})();

// ====== Layout dos slots (desenhados via código sobre fundo.png limpo) ======
// fundo.png agora deve vir SEM os retângulos (apenas o fundo decorativo).
// Os retângulos abaixo são desenhados dinamicamente: 1 por jogo (até 5).
const POST_BG_W = 1080;
const POST_BG_H = 1350;
const POST_SLOTS_AREA = {
    top: 380,        // y onde a área disponível para slots começa (após título)
    bottom: 1230,    // y onde termina (antes do footer)
    leftX: 54,
    rightX: 1026,
    slotH: 130,
    slotGap: 18,
    maxSlots: 5
};

function computeSlotPositions(numGames) {
    var n = Math.min(numGames, POST_SLOTS_AREA.maxSlots);
    if (n <= 0) return [];
    var areaH = POST_SLOTS_AREA.bottom - POST_SLOTS_AREA.top;
    var blockH = n * POST_SLOTS_AREA.slotH + (n - 1) * POST_SLOTS_AREA.slotGap;
    var startY = POST_SLOTS_AREA.top + (areaH - blockH) / 2;
    var w = POST_SLOTS_AREA.rightX - POST_SLOTS_AREA.leftX;
    var slots = [];
    for (var i = 0; i < n; i++) {
        slots.push({
            x: POST_SLOTS_AREA.leftX,
            y: Math.round(startY + i * (POST_SLOTS_AREA.slotH + POST_SLOTS_AREA.slotGap)),
            w: w,
            h: POST_SLOTS_AREA.slotH
        });
    }
    return slots;
}

// Desenha a logotipo no canto superior direito do banner (se carregada)
function drawTopRightLogo(c, width) {
    if (!uploadedLogo) return;
    var maxH = 130;
    var ratio = uploadedLogo.width / uploadedLogo.height;
    var logoW = maxH * ratio;
    if (logoW > 280) { logoW = 280; maxH = logoW / ratio; }
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.6)';
    c.shadowBlur = 12;
    c.drawImage(uploadedLogo, width - logoW - 28, 24, logoW, maxH);
    c.restore();
}

// Desenha o retângulo decorativo do slot (estilo neon verde, igual ao template)
function drawSlotFrame(c, slot) {
    var x = slot.x, y = slot.y, w = slot.w, h = slot.h;
    var r = 16;
    var neonColor = '#d4ff4f';

    c.save();

    // Fill preto semi-transparente para destacar do fundo
    c.fillStyle = 'rgba(0, 0, 0, 0.88)';
    roundRect(c, x, y, w, h, r);
    c.fill();

    // Borda neon com glow
    c.shadowColor = 'rgba(212, 255, 79, 0.55)';
    c.shadowBlur = 16;
    c.strokeStyle = neonColor;
    c.lineWidth = 3;
    roundRect(c, x, y, w, h, r);
    c.stroke();
    c.shadowBlur = 0;

    // Abinha (tab) verde no topo central
    var tabW = 90;
    var tabH = 14;
    var tabX = x + (w - tabW) / 2;
    var tabY = y - tabH / 2 + 1;
    c.fillStyle = neonColor;
    roundRect(c, tabX, tabY, tabW, tabH, 7);
    c.fill();

    // Chevron decorativo na base (linha que abaixa no centro)
    var chevHalfW = 110;
    var chevCx = x + w / 2;
    var chevY = y + h - 6;
    c.strokeStyle = neonColor;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(chevCx - chevHalfW, chevY);
    c.lineTo(chevCx - 24, chevY);
    c.lineTo(chevCx, chevY + 8);
    c.lineTo(chevCx + 24, chevY);
    c.lineTo(chevCx + chevHalfW, chevY);
    c.stroke();

    c.restore();
}

let currentMode = null;
let selectedContent = null;
let currentFormat = 'post';
let uploadedLogo = null;
let posterImage = null;
let currentTrailer = null;
let globalSettings = { logo: null, whatsappNumber: '', whatsappText: 'Grupo VIP', ctaText: 'ASSINA JÁ' };

// Filtros de tipo (Filme / Série / Ambos)
let movieTypeFilter = 'both';   // usado no modo Filmes/Séries
let videoTypeFilter = 'both';   // usado no modo Trailer

// Estado do modo Trailer manual
let uploadedVideoFile = null;
let uploadedVideoUrl = null;

const homeScreen = document.getElementById('homeScreen');
const editorScreen = document.getElementById('editorScreen');
const controlPanel = document.getElementById('controlPanel');
let canvas = document.getElementById('bannerCanvas');
let ctx = canvas.getContext('2d');
let videoContainer = document.getElementById('videoContainer');

let footballBgPost = null;
let footballBgStory = null;
let allFootballGames = [];
let selectedDate = '';

// ============================================
// LIGAS E TRANSMISSÕES (ATUALIZADAS)
// ============================================
// Mapa nome-de-exibição -> transmissão (usado pelo modo automático/fallback)
const leagueBroadcasters = {
    'Brasileirão Betano': 'Globo / SporTV / Premiere / Prime Video / CazéTV',
    'Brasileirão Série B Superbet': 'ESPN / Disney+ / SporTV',
    'Copa Betano do Brasil': 'Globo / SporTV / Premiere / Prime Video',
    'CONMEBOL Libertadores': 'Globo / ESPN / Disney+ / Paramount+',
    'CONMEBOL Sudamericana': 'ESPN / Disney+ / Paramount+',
    'Copa do Mundo FIFA': 'Globo / SporTV / CazéTV',
    'UEFA Liga dos Campeões': 'SBT / TNT Sports / HBO Max',
    'UEFA Liga Europa': 'ESPN / Star+',
    'Premier League': 'ESPN / Star+',
    'LaLiga': 'ESPN / Star+',
    'Bundesliga': 'OneFootball / YouTube / SporTV',
    'Ligue 1': 'CazéTV / Prime Video',
    'Serie A': 'ESPN / Star+',
    'Liga Portugal': 'ESPN / Star+',
    'Supercopa do Brasil': 'Globo'
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
    // Limpa estado do Trailer manual
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
// FOOTBALL UTILS (compartilhados pelo modo Manual)
// ============================================
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

// ============================================
// COVER BANNER
// - POST: usa /banner/capa.png como imagem única (sem overlays)
// - STORY: mantém o design original (premium dark + grid de ligas)
// ============================================
async function generateFootballCoverBanner(canvasEl, uniqueLeagues, totalBanners) {
    var isPost = currentFormat === 'post';

    // ====== POST: usa capa.png pronta ======
    if (isPost) {
        var width = POST_BG_W;   // 1080
        var height = POST_BG_H;  // 1350
        canvasEl.width = width;
        canvasEl.height = height;
        canvasEl.style.maxWidth = '500px';
        var cvsP = canvasEl.getContext('2d');
        cvsP.imageSmoothingEnabled = true;
        cvsP.imageSmoothingQuality = 'high';

        // Garante imagem carregada
        var coverImg = bannerCoverImg;
        if (!coverImg) {
            try { coverImg = await loadImage(BANNER_COVER_URL); bannerCoverImg = coverImg; }
            catch(e) {
                console.warn('capa.png indisponível, usando fallback:', e);
                coverImg = null;
            }
        }
        if (coverImg) {
            // Cover-fit (preenche todo o canvas, recortando se necessário)
            var iR = coverImg.width / coverImg.height;
            var cR = width / height;
            var dw, dh, ox, oy;
            if (iR > cR) { dh = height; dw = height * iR; ox = (width - dw) / 2; oy = 0; }
            else { dw = width; dh = width / iR; ox = 0; oy = (height - dh) / 2; }
            cvsP.drawImage(coverImg, ox, oy, dw, dh);
        } else {
            cvsP.fillStyle = '#0a0a0a';
            cvsP.fillRect(0, 0, width, height);
            cvsP.fillStyle = '#fff';
            cvsP.font = '700 48px Oswald, sans-serif';
            cvsP.textAlign = 'center';
            cvsP.fillText('CAPA INDISPONÍVEL', width/2, height/2);
        }
        // Logo no canto superior direito
        drawTopRightLogo(cvsP, width);
        return;
    }

    // ====== STORY: mantém o design original ======
    var cvs = canvasEl.getContext('2d');
    var width = 1080;
    var height = 1920;
    canvasEl.width = width;
    canvasEl.height = height;
    canvasEl.style.maxWidth = '300px';

    var bgImage = footballBgStory;
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

    var glow = cvs.createRadialGradient(width / 2, height * 0.28, 0, width / 2, height * 0.28, width * 0.65);
    glow.addColorStop(0, 'rgba(34, 197, 94, 0.07)');
    glow.addColorStop(1, 'transparent');
    cvs.fillStyle = glow;
    cvs.fillRect(0, 0, width, height);

    cvs.strokeStyle = 'rgba(255,255,255,0.018)';
    cvs.lineWidth = 1;
    for (var gx = 0; gx < width; gx += 54) { cvs.beginPath(); cvs.moveTo(gx, 0); cvs.lineTo(gx, height); cvs.stroke(); }
    for (var gy = 0; gy < height; gy += 54) { cvs.beginPath(); cvs.moveTo(0, gy); cvs.lineTo(width, gy); cvs.stroke(); }

    var topLine = cvs.createLinearGradient(0, 0, width, 0);
    topLine.addColorStop(0, 'transparent');
    topLine.addColorStop(0.15, '#16a34a');
    topLine.addColorStop(0.85, '#16a34a');
    topLine.addColorStop(1, 'transparent');
    cvs.fillStyle = topLine;
    cvs.fillRect(0, 0, width, 4);

    cvs.strokeStyle = 'rgba(34, 197, 94, 0.2)';
    cvs.lineWidth = 2;
    cvs.beginPath(); cvs.moveTo(40, 40); cvs.lineTo(40, 100); cvs.stroke();
    cvs.beginPath(); cvs.moveTo(40, 40); cvs.lineTo(100, 40); cvs.stroke();
    cvs.beginPath(); cvs.moveTo(width - 40, height - 40); cvs.lineTo(width - 40, height - 100); cvs.stroke();
    cvs.beginPath(); cvs.moveTo(width - 40, height - 40); cvs.lineTo(width - 100, height - 40); cvs.stroke();

    if (uploadedLogo) {
        cvs.save();
        var logoMaxH = 160;
        var logoRatio = uploadedLogo.width / uploadedLogo.height;
        var logoW = logoMaxH * logoRatio;
        cvs.drawImage(uploadedLogo, width - logoW - 20, 20, logoW, logoMaxH);
        cvs.restore();
    }

    if (uploadedLogo) {
        cvs.save();
        cvs.globalAlpha = 0.10;
        var coverPSize = 90;
        var coverPRatio = uploadedLogo.width / uploadedLogo.height;
        var coverPW = coverPSize * coverPRatio;
        var coverPH = coverPSize;
        var coverSpX = coverPW + 80;
        var coverSpY = coverPH + 80;
        cvs.translate(width / 2, height / 2);
        cvs.rotate(-30 * Math.PI / 180);
        cvs.translate(-width / 2, -height / 2);
        for (var cvWmY = -height; cvWmY < height * 2; cvWmY += coverSpY) {
            for (var cvWmX = -width; cvWmX < width * 2; cvWmX += coverSpX) {
                cvs.drawImage(uploadedLogo, cvWmX, cvWmY, coverPW, coverPH);
            }
        }
        cvs.restore();
    }

    var y = 380;

    cvs.textAlign = 'center';
    cvs.font = '600 20px Manrope, sans-serif';
    cvs.fillStyle = '#22c55e';
    cvs.fillText('P R O G R A M A \u00C7 \u00C3 O   C O M P L E T A', width / 2, y);

    y += 85;

    cvs.save();
    cvs.font = '700 110px Oswald, sans-serif';
    cvs.textAlign = 'center';
    cvs.shadowColor = 'rgba(34, 197, 94, 0.5)';
    cvs.shadowBlur = 50;
    cvs.fillStyle = '#ffffff';
    cvs.fillText('JOGOS DO DIA', width / 2, y);
    cvs.shadowColor = 'rgba(34, 197, 94, 0.8)';
    cvs.shadowBlur = 15;
    cvs.fillText('JOGOS DO DIA', width / 2, y);
    cvs.restore();

    y += 60;

    var dateFormatted = new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
    cvs.font = '500 28px Manrope, sans-serif';
    cvs.fillStyle = 'rgba(255,255,255,0.6)';
    cvs.textAlign = 'center';
    cvs.fillText(dateFormatted.toUpperCase(), width / 2, y);

    y += 55;

    var sepGrad = cvs.createLinearGradient(width * 0.12, 0, width * 0.88, 0);
    sepGrad.addColorStop(0, 'transparent');
    sepGrad.addColorStop(0.2, 'rgba(34, 197, 94, 0.5)');
    sepGrad.addColorStop(0.5, '#22c55e');
    sepGrad.addColorStop(0.8, 'rgba(34, 197, 94, 0.5)');
    sepGrad.addColorStop(1, 'transparent');
    cvs.fillStyle = sepGrad;
    cvs.fillRect(width * 0.12, y, width * 0.76, 2);

    y += 50;

    var totalGames = allFootballGames.length;
    var badgeText = totalGames + ' JOGOS';
    cvs.font = '700 30px Oswald, sans-serif';
    cvs.textAlign = 'center';
    var bw = cvs.measureText(badgeText).width + 80;
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

    // Ícones de ligas (mantemos arquivos existentes em /ligue/, mas com nomes atualizados)
    var localLeagueIcons = [
        { path: '/ligue/Campeonato_Brasileiro_Serie_A.png', name: 'Brasileirão Betano' },
        { path: '/ligue/Campeonato_Brasileiro_Srrie_B.png', name: 'Brasileirão Série B Superbet' },
        { path: '/ligue/Copa_do_Brasil.png',                name: 'Copa Betano do Brasil' },
        { path: '/ligue/Copa_Libertadores.png',             name: 'CONMEBOL Libertadores' },
        { path: '/ligue/Copa_Sul_Americana.png',            name: 'CONMEBOL Sudamericana' },
        { path: '/ligue/Premier_League.png',                name: 'Premier League' },
        { path: '/ligue/La_Liga.png',                       name: 'LaLiga' },
        { path: '/ligue/Bundesliga.png',                    name: 'Bundesliga' },
        { path: '/ligue/Ligue_1.png',                       name: 'Ligue 1' },
        { path: '/ligue/Serie_A.png',                       name: 'Serie A' },
        { path: '/ligue/Liga_Portugal.png',                 name: 'Liga Portugal' },
        { path: '/ligue/UEFA_Champions_League.png',         name: 'UEFA Liga dos Campeões' },
        { path: '/ligue/UEFA_Europa_League.png',            name: 'UEFA Liga Europa' },
        { path: '/ligue/Copa_do_Mundo_FIFA.png',            name: 'Copa do Mundo FIFA' },
        { path: '/ligue/Supercopa_do_Brasil.png',           name: 'Supercopa do Brasil' }
    ];

    var leagueLogos = await Promise.all(localLeagueIcons.map(async function(item) {
        try {
            var img = await loadImage(item.path);
            return { name: item.name, logoImg: img };
        } catch (e) { return { name: item.name, logoImg: null }; }
    }));
    leagueLogos = leagueLogos.filter(function(l) { return l.logoImg !== null; });

    var cols = 5;
    var rows = Math.ceil(leagueLogos.length / cols);
    var cellW = (width - 100) / cols;
    var cellH = 135;
    var gridStartX = 50;

    for (var li = 0; li < leagueLogos.length; li++) {
        var league = leagueLogos[li];
        var col = li % cols;
        var row = Math.floor(li / cols);
        var cx = gridStartX + col * cellW;
        var cy = y + row * cellH;

        cvs.save();
        cvs.fillStyle = 'rgba(255,255,255,0.03)';
        roundRect(cvs, cx + 6, cy, cellW - 12, cellH - 10, 14);
        cvs.fill();
        cvs.strokeStyle = 'rgba(255,255,255,0.08)';
        cvs.lineWidth = 1;
        roundRect(cvs, cx + 6, cy, cellW - 12, cellH - 10, 14);
        cvs.stroke();
        cvs.restore();

        if (league.logoImg) {
            var ls = 56;
            cvs.drawImage(league.logoImg, cx + cellW / 2 - ls / 2, cy + 10, ls, ls);
        }

        cvs.textAlign = 'center';
        cvs.font = '600 13px Manrope, sans-serif';
        cvs.fillStyle = 'rgba(255,255,255,0.78)';
        var lname = league.name;
        var maxNW = cellW - 16;
        while (cvs.measureText(lname).width > maxNW && lname.length > 3) lname = lname.slice(0, -1);
        if (lname.length < league.name.length) lname += '...';
        cvs.fillText(lname, cx + cellW / 2, cy + cellH - 20);
    }

    var warningY = Math.min(y + rows * cellH + 25, height - 110);
    cvs.textAlign = 'center';
    cvs.font = '500 15px Manrope, sans-serif';
    cvs.fillStyle = 'rgba(255,255,255,0.3)';
    cvs.fillText('Os canais podem sofrer altera\u00E7\u00E3o de \u00FAltima hora', width / 2, warningY);

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

    var btLine = cvs.createLinearGradient(0, 0, width, 0);
    btLine.addColorStop(0, 'transparent');
    btLine.addColorStop(0.15, '#16a34a');
    btLine.addColorStop(0.85, '#16a34a');
    btLine.addColorStop(1, 'transparent');
    cvs.fillStyle = btLine;
    cvs.fillRect(0, height - 4, width, 4);
}

// ============================================
// GAME BANNERS
// - POST: usa /banner/fundo.png como template, mapeia dados nos 5 slots
// - STORY: mantém o design original (cards customizados sobre fundo opcional)
// ============================================
async function generateFootballListBannerModern(canvasEl, games, bannerNum, totalBanners) {
    var isPost = currentFormat === 'post';

    // ====== POST: novo template com fundo.png + slots ======
    if (isPost) {
        var width = POST_BG_W;   // 1080
        var height = POST_BG_H;  // 1350
        canvasEl.width = width;
        canvasEl.height = height;
        canvasEl.style.maxWidth = '500px';
        var c = canvasEl.getContext('2d');
        c.imageSmoothingEnabled = true;
        c.imageSmoothingQuality = 'high';

        // Carrega fundo
        var bgImg = bannerBgImg;
        if (!bgImg) {
            try { bgImg = await loadImage(BANNER_BG_URL); bannerBgImg = bgImg; }
            catch(e) { console.warn('fundo.png indisponível:', e); bgImg = null; }
        }
        if (bgImg) {
            // Stretch exato (a imagem foi medida em 1080x1350)
            c.drawImage(bgImg, 0, 0, width, height);
        } else {
            c.fillStyle = '#0a0a0a';
            c.fillRect(0, 0, width, height);
            c.fillStyle = '#fff';
            c.font = '700 48px Oswald, sans-serif';
            c.textAlign = 'center';
            c.fillText('FUNDO INDISPONÍVEL', width/2, height/2);
        }

        // Logo no canto superior direito
        drawTopRightLogo(c, width);

        // Mapeia jogos: desenha 1 retângulo decorativo + dados por jogo (até 5)
        var slots = computeSlotPositions(games.length);
        for (var si = 0; si < slots.length; si++) {
            drawSlotFrame(c, slots[si]);
            drawGameInSlot(c, games[si], slots[si]);
        }
        return;
    }

    // ====== STORY: mantém o design original ======
    var cvs = canvasEl.getContext('2d');
    var width = 1080;
    var height = 1920;
    canvasEl.width = width;
    canvasEl.height = height;
    canvasEl.style.maxWidth = '300px';

    var bgImage = footballBgStory;
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

    if (uploadedLogo) {
        cvs.save();
        cvs.globalAlpha = 1;
        var logoSize = 130;
        var logoRatio = uploadedLogo.width / uploadedLogo.height;
        var logoW = logoSize * logoRatio;
        var logoH = logoSize;
        cvs.drawImage(uploadedLogo, width - logoW - 20, 20, logoW, logoH);
        cvs.restore();
    }

    if (uploadedLogo) {
        cvs.save();
        cvs.globalAlpha = 0.10;
        var pSize = 90;
        var pRatio = uploadedLogo.width / uploadedLogo.height;
        var pW = pSize * pRatio;
        var pH = pSize;
        var spX = pW + 80;
        var spY = pH + 80;
        cvs.translate(width / 2, height / 2);
        cvs.rotate(-30 * Math.PI / 180);
        cvs.translate(-width / 2, -height / 2);
        for (var wmY = -height; wmY < height * 2; wmY += spY) {
            for (var wmX = -width; wmX < width * 2; wmX += pW + 80) {
                cvs.drawImage(uploadedLogo, wmX, wmY, pW, pH);
            }
        }
        cvs.restore();
    }

    var currentY = 80;

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

        if (game.homeLogoImg) {
            cvs.drawImage(game.homeLogoImg, leftX - logoSz / 2, logoY - logoSz / 2, logoSz, logoSz);
        }

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

        var rightX = width - padding - cardPadding - logoSz / 2 - 120;
        if (game.awayLogoImg) {
            cvs.drawImage(game.awayLogoImg, rightX - logoSz / 2, logoY - logoSz / 2, logoSz, logoSz);
        }

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

    var boxH = 45;
    var bottomMargin = 25;
    var btnY = height - bottomMargin;
    var warningY = btnY - boxH - 20;

    cvs.textAlign = 'center';
    cvs.font = '500 15px Manrope, sans-serif';
    cvs.fillStyle = 'rgba(255,255,255,0.6)';
    cvs.shadowColor = 'rgba(0, 0, 0, 0.8)';
    cvs.shadowBlur = 4;
    cvs.fillText('Os canais podem sofrer altera\u00E7\u00E3o de \u00FAltima hora', width / 2, warningY);
    cvs.shadowBlur = 0;

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
// DESENHA UM JOGO DENTRO DE UM SLOT (template fundo.png)
// Layout (por bloco lateral):
//   [LOGO]
//   [NOME DO TIME]
// Centro: [LIGA / HORA / TRANSMISSÃO]
// Slot esperado: 972 x 130
// ============================================
function drawGameInSlot(c, game, slot) {
    var league = (game.league && game.league.name) ? game.league.name : '';
    var time = '';
    try { time = new Date(game.fixture.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch(e) {}
    var broadcaster = game.manualBroadcaster || getBroadcaster(league);
    var homeName = (game.teams && game.teams.home && game.teams.home.name) ? game.teams.home.name.toUpperCase() : '';
    var awayName = (game.teams && game.teams.away && game.teams.away.name) ? game.teams.away.name.toUpperCase() : '';

    var sx = slot.x, sy = slot.y, sw = slot.w, sh = slot.h;

    // Áreas laterais (bloco home / away) e central
    var sideBlockW = 280;        // largura do bloco lateral (logo + nome)
    var sideMargin = 20;         // margem lateral interna
    var logoSize = 58;
    var logoTopY = sy + 10;

    // Centros horizontais dos blocos laterais
    var homeBlockCx = sx + sideMargin + sideBlockW / 2;
    var awayBlockCx = sx + sw - sideMargin - sideBlockW / 2;

    // Logos no TOPO, centralizadas no bloco
    if (game.homeLogoImg) {
        try { c.drawImage(game.homeLogoImg, homeBlockCx - logoSize / 2, logoTopY, logoSize, logoSize); } catch(e) {}
    }
    if (game.awayLogoImg) {
        try { c.drawImage(game.awayLogoImg, awayBlockCx - logoSize / 2, logoTopY, logoSize, logoSize); } catch(e) {}
    }

    // Nomes dos times EMBAIXO da logo, centralizados (largura total do bloco disponível)
    var nameMaxW = sideBlockW - 12;
    var nameBaselineY = sy + sh - 16;
    c.textAlign = 'center';
    c.font = '700 18px Manrope, sans-serif';
    c.fillStyle = '#ffffff';
    c.shadowColor = 'rgba(0,0,0,0.9)';
    c.shadowBlur = 4;
    c.fillText(fitTextToWidth(c, homeName, nameMaxW), homeBlockCx, nameBaselineY);
    c.fillText(fitTextToWidth(c, awayName, nameMaxW), awayBlockCx, nameBaselineY);
    c.shadowBlur = 0;

    // ÁREA CENTRAL: liga (topo), hora (meio), transmissão (base)
    var centerX = sx + sw / 2;
    var centerMaxW = sw - 2 * (sideMargin + sideBlockW + 8);
    if (centerMaxW < 280) centerMaxW = 280;

    // Liga
    c.textAlign = 'center';
    c.font = '700 16px Manrope, sans-serif';
    c.fillStyle = '#bef264';
    c.shadowColor = 'rgba(0,0,0,0.85)';
    c.shadowBlur = 3;
    c.fillText(fitTextToWidth(c, league.toUpperCase(), centerMaxW), centerX, sy + 30);

    // Hora
    c.font = '700 38px Oswald, sans-serif';
    c.fillStyle = '#ffffff';
    c.shadowColor = 'rgba(0,0,0,0.9)';
    c.shadowBlur = 4;
    c.fillText(time, centerX, sy + 78);

    // Transmissão
    c.font = '600 14px Manrope, sans-serif';
    c.fillStyle = '#e4e4e7';
    c.shadowColor = 'rgba(0,0,0,0.8)';
    c.shadowBlur = 3;
    c.fillText(fitTextToWidth(c, broadcaster, centerMaxW), centerX, sy + 113);

    c.shadowBlur = 0;
}

// Ajusta texto para caber na largura, truncando com "..."
function fitTextToWidth(c, text, maxWidth) {
    if (!text) return '';
    var t = String(text);
    if (c.measureText(t).width <= maxWidth) return t;
    while (t.length > 3 && c.measureText(t + '...').width > maxWidth) {
        t = t.slice(0, -1);
    }
    return t + '...';
}

// ============================================
// FOOTBALL MANUAL MODE
// ============================================
var manualGames = [];
var manualGameIdCounter = 0;

var TEAM_FILES = [
    'ABC.png','America_Mineiro.png','Arsenal_Football_Club.png','Associazione_Calcio_Firenze_Fiorentina.png',
    'Associazione_Calcio_Milan.png','Associazione_Sportiva_Roma.png','Aston_Villa_Football_Club.png','AS_Monaco.png',
    'Atalanta_Bergamasca_Calcio.png','Athletic_Club.png','Atletico_Goianiense.png','Atletico_Mineiro.png',
    'Atletico_Osasuna.png','Atletico_Paranaense.png','Avai.png','Bahia.png','Barcelona.png','Bayern_Munchen.png',
    'Bayer_04_Leverkusen.png','Bologna_1909.png','Borussia_Dortmund.png','Borussia_Monchengladbach.png',
    'Botafogo_PB.png','Botafogo_RJ.png','Botafogo_SP.png','Brentford_Football_Club.png',
    'Brighton_&_Hove_Albion_Football_Club.png','Brusque.png','Burnley_Football.png','Cadiz_Club_de_Futbol.png',
    'Cagliari_Calcio.png','Ceara.png','Chapecoense.png','Chelsea_Football_Club.png','Clermont_Foot_63.png',
    'Clube_de_Regatas.png','Club_Atletico_de_Madrid.png','Confianca_SE.png','Corinthians.png','Coritiba.png',
    'Criciuma.png','Cruzeiro.png','Crystal_Palace_Football.png','CSA_Centro_Sportivo.png','Cuiaba.png',
    'Deportivo_Alaves.png','Eintracht_Frankfurt.png','Empoli.png','Everton_Football_Club.png',
    'FC_Augsburg_1907.png','FC_Koln.png','FC_Lorient.png','FC_Metz.png','FC_Union_Berlin.png','Figueirense.png',
    'Flamengo.png','Fluminense.png','Football_Club_de_Nantes.png','Football_Club_Internazionale_Milano.png',
    'Fortaleza.png','Genoa_Cricket.png','Getafe_Club_de_Futbol.png','Girona_Futbol.png','Goias.png',
    'Granada_Club.png','Gremio.png','Gremio_Novorizontino.png','Guarani.png','Hellas_Verona_Football_Club.png',
    'Internacional.png','Ituano.png','Juventude.png','Juventus_Football_Club.png','Le_Racing_Club_de_Lens.png',
    'Lille_Olympique_Sporting_Club.png','Liverpool_Football_Club.png','Londrina.png','Mainz_05.png',
    'Manchester_City_Football_Club.png','Manchester_United_Football_Club.png','Mirassol.png',
    'Montpellier_Herault_Sport_Club.png','Nautico.png','Newcastle_United.png','Olympique_de_Marseille.png',
    'Olympique_Lyonnais.png','Operario_PR.png','Palmeiras.png','Paris_Saint_Germain.png','Paysandu.png',
    'Ponte_Preta.png','Racing_Club_de_Strasbourg_Alsace.png','Rayo_Vallecano_de_Madrid.png','RB_Leipzig.png',
    'Real_Betis_Balompie.png','Real_Club_Celta_de_Vigo.png','Real_Club_Deportivo_Mallorca.png',
    'Real_Madrid_Club.png','Real_Sociedad.png','Recife.png','Red_Bull_Bragantino.png','Remo.png',
    'Sampaio_Correa.png','Santos.png','Sao_Bernardo.png','Sao_Jose_RS.png','Sao_Paulo.png','Sevilla_Futbol.png',
    'Societa_Sportiva_Calcio_Napoli.png','Societa_Sportiva_Lazio.png','Sport_Club_Freiburg.png',
    'Stade_de_Reims.png','Tombense.png','Torino_Football_Club.png','Tottenham_Hotspur.png',
    'TSG_1899_Hoffenheim.png','Udinese_Calcio.png','Unione_Sportiva_Salernitana_1919.png',
    'Unione_Sportiva_Sassuolo_Calcio.png','Valencia_Club.png','Vasco_da_Gama.png','VfB_Stuttgart.png',
    'VfL_Bochum.png','VfL_Wolfsburg.png','Vila_Nova.png','Villarreal_Club.png','Vitoria.png',
    'Volta_Redonda.png','West_Ham_United.png','Wolverhampton_Wanderers_Football.png','Ypiranga_de_Erechim.png',
    'AFC_Bournemouth.png','Africa_do_Sul.png','Ajax_Amsterdam.png','AJ_Auxerre.png','Alemanha.png','Always_Ready.png',
    'Angers_SCO.png','Arabia_Saudita.png','Argelia.png','Argentina.png','Atletico_Boca_Juniors.png','Atletico_Lanus.png',
    'Atletico_Platense.png','Atletico_Rosario.png','Australia.png','Austria.png','Belgica.png','Benfica.png','Bolivar.png',
    'Bosnia.png','Brasil.png','Cabo_Verde.png','Canada.png','Cerro_Porteno.png','Club_Brugge_K.V.png','Colombia.png',
    'coquimbo.png','Coreia.png','Costa_do_Marfim.png','Croacia.png','Curacao.png','cusco.png','Deportes_Tolima.png',
    'Deportivo_La_Guaira.png','Egito.png','Elche.png','Equador.png','Escocia.png','Espanha.png','Espanyol.png',
    'Estudiantes.png','FC_Heidenheim_1846.png','FC_Kairat.png','FC_Kobenhavn.png','FC_St_Pauli.png','FK_Bodo_Glimt.png',
    'Franca.png','Fulham_FC.png','Galatasaray.png','Gana.png','Haiti.png','Hamburger.png','Independiente_del_Valle.png',
    'Independiente_Medellin.png','Independiente_Rivadavia.png','independiente_Santa_Fe.png','Inglaterra.png','Ira.png',
    'Iraque.png','Japao.png','Jordania.png','Junior_Barranquilla.png','LDU_Liga_de_Quito.png','Leeds_United.png',
    'Levante.png','Libertad_PAR.png','Marrocos.png','Mexico.png','Nacional.png','Noruega.png','Nottingham_Forest.png',
    'Nova_Zelandia.png','Olympiakos.png','Pafos_FC.png','Paises_Baixos.png','Panama.png','Paraguai.png','Parana.png',
    'Paris_FC.png','Penarol.png','Portugal.png','PSV Eindhoven.png','Qarabag.png','Qatar.png','Real_Oviedo.png',
    'Republica_Democratica-do_Congo.png','Royale_Union_Saint_Gilloise.png','Senegal.png','Slavia_Praga.png',
    'Sporting_Cristal.png','Sporting_Portugal.png','Stade_Brestois_29.png','Stade_Rennais.png','Suecia.png','Suica.png',
    'Sunderland_AFC.png','Tchequia.png','Toulouse_FC.png','Tunísia.png','Turquia.png','UCV_FC.png',
    'Universidad_Catolica.png','Universitario.png','Uruguai.png','USA.png','Uzbequistao.png','Werder_Bremen.png',
    'Club_Nacional_de_Football.png','Academia_Puerto_Cabello.png','Alianza_Atletico.png','America_de_Cali.png',
    'Atletico_River_Plate.png','Audax.png','Barracas_Central.png','Boston_River.png','Carabobo_FC.png','Caracas.png',
    'Cienciano.png','Club_Blooming.png','Club_Deportivo_Cuenca.png','CSD_Macara.png','Deportivo_Palestino.png',
    'Deportivo_Riestra.png','Higgins_F.C..png','Independiente.png','Juventud_de_Las_Piedras.png','Millonarios_F.C..png',
    'Montevideo_City_Torque.png','Olimpia.png','Recoleta.png','San_Lorenzo.png','Tigre.png','Racing_Club.png','C.D._Tondela.png',
    'Barcelona_SC.png','FC_Steaua_Bucuresti.png','FC_Utrecht.png','Fenerbahce.png','Ferencvaros.png','Feyenoord.png','GNK_Dinamo.png',
    'Go_Ahead_Eagles.png','KRC_Genk.png','Lecce.png','Maccabi.png','Malmo.png','Midtjylland.png','Nice.png','Panathinaikos.png',
    'PAOK.png','Parma.png','Pisa.png','Rangers.png','Red_Star_Belgrade.png','Salzburg.png','SC_Braga.png','Sturm_Graz.png',
    'Viktoria_Plzen.png','Young_Boys.png','Nacional_da_Madeira.png','AVS_Futebol_SAD.png','Moreirense.png','Estrela_da_Amadora.png',
    'Arouca.png','Santa_Clara.png','Famalicao.png','Alverca.png'
];
var TEAMS_LIST = TEAM_FILES.map(function(f) {
    return { file: f, name: f.replace('.png', '').replace(/_/g, ' ') };
}).sort(function(a, b) { return a.name.localeCompare(b.name, 'pt-BR'); });

function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.filterManualTeams = function(id, side, query) {
    var dropdown = document.getElementById('manualTeamDropdown_' + side + '_' + id);
    if (!dropdown) return;
    var q = (query || '').toLowerCase().trim();
    var filtered = q ? TEAMS_LIST.filter(function(t) { return t.name.toLowerCase().indexOf(q) !== -1; }) : TEAMS_LIST;
    if (filtered.length === 0) {
        dropdown.innerHTML = '<div class="p-3 text-zinc-500 text-sm">Nenhum time encontrado</div>';
    } else {
        dropdown.innerHTML = filtered.slice(0, 80).map(function(t) {
            var safeName = escapeHtml(t.name);
            var safeFile = escapeHtml(t.file);
            return '<div onmousedown="event.preventDefault()" onclick="selectManualTeam(' + id + ',\'' + side + '\',\'' + safeFile + '\',\'' + safeName.replace(/'/g, '&#39;') + '\')" class="flex items-center gap-2 p-2 hover:bg-emerald-600/30 cursor-pointer border-b border-zinc-800">' +
                '<img src="/logo_time/' + encodeURI(t.file) + '" class="w-7 h-7 object-contain shrink-0" onerror="this.style.display=\'none\'">' +
                '<span class="text-white text-sm">' + safeName + '</span></div>';
        }).join('');
    }
    dropdown.classList.remove('hidden');
};

window.showManualDropdown = function(id, side) {
    var inp = document.getElementById('manualTeamSearch_' + side + '_' + id);
    window.filterManualTeams(id, side, inp ? inp.value : '');
};

window.hideManualDropdown = function(id, side) {
    setTimeout(function() {
        var dd = document.getElementById('manualTeamDropdown_' + side + '_' + id);
        if (dd) dd.classList.add('hidden');
    }, 200);
};

window.selectManualTeam = function(id, side, filename, name) {
    var game = manualGames.find(function(g) { return g.id === id; });
    if (!game) return;
    var searchInput = document.getElementById('manualTeamSearch_' + side + '_' + id);
    if (searchInput) searchInput.value = name;
    if (side === 'home') game.homeName = name; else game.awayName = name;
    var img = new Image();
    img.onload = function() {
        if (side === 'home') game.homeLogo = img; else game.awayLogo = img;
        var prefix = side === 'home' ? 'Home' : 'Away';
        var imgEl = document.getElementById('manual' + prefix + 'Logo_' + id);
        var iconEl = document.getElementById('manual' + prefix + 'LogoIcon_' + id);
        if (imgEl) { imgEl.src = '/logo_time/' + encodeURI(filename); imgEl.classList.remove('hidden'); }
        if (iconEl) iconEl.classList.add('hidden');
    };
    img.onerror = function() {
        if (side === 'home') game.homeLogo = null; else game.awayLogo = null;
    };
    img.src = '/logo_time/' + encodeURI(filename);
    var dd = document.getElementById('manualTeamDropdown_' + side + '_' + id);
    if (dd) dd.classList.add('hidden');
};

function loadFootballManualMode() {
    canvas.classList.add('hidden');
    videoContainer.classList.add('hidden');
    clearPreviousBanners();

    controlPanel.innerHTML = '<section><label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold block mb-3">Data dos Jogos</label><input type="date" id="manualDate" value="' + getTodayDate() + '" class="bg-black border-2 border-zinc-800 p-3 text-white focus:outline-none focus:border-emerald-500 w-full rounded-lg" data-testid="manual-date-input"></section>' +
        '<div id="manualGamesList" class="mt-5 flex flex-col gap-3"></div>' +
        '<button id="manualAddGameBtn" class="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg transition-all" data-testid="manual-add-game-btn">+ ADICIONAR JOGO</button>' +
        '<section class="flex flex-col gap-3 mt-5"><label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Formato</label><div class="flex gap-2">' +
        '<button id="manualFormatPost" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white" data-testid="manual-format-post">Post</button>' +
        '<button id="manualFormatStory" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800" data-testid="manual-format-story">Story</button></div></section>' +
        '<button id="manualGenerateBtn" class="w-full mt-4 bg-green-500 hover:bg-green-400 text-white font-bold uppercase tracking-widest py-4 rounded-lg transition-all" data-testid="manual-generate-btn">GERAR BANNERS</button>' +
        '<button id="manualCopyBtn" class="w-full mt-2 bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-widest py-3 rounded-lg transition-all" data-testid="manual-copy-btn">COPIAR INFORMAÇÕES</button>';

    manualGames = [];
    manualGameIdCounter = 0;

    setTimeout(function() {
        document.getElementById('manualAddGameBtn').addEventListener('click', addManualGame);
        document.getElementById('manualGenerateBtn').addEventListener('click', generateManualBanners);
        document.getElementById('manualCopyBtn').addEventListener('click', copyAllFootballGames);
        document.getElementById('manualFormatPost').addEventListener('click', function() { currentFormat = 'post'; updateManualFormatButtons(); });
        document.getElementById('manualFormatStory').addEventListener('click', function() { currentFormat = 'story'; updateManualFormatButtons(); });
        addManualGame();
    }, 100);

    showPlaceholder('&#9997;', 'MANUAL', 'Adicione jogos manualmente', '#0a4d0a', '#001a00');
}

// ============================================
// MAPEAMENTOS DE LIGA -> TRANSMISSÃO PADRÃO (modo manual)
// chave da liga (key interna) -> chave da transmissão (key interna)
// ============================================
var leagueToBroadcaster = {
    'Brasileirao_Betano':            'globo_sportv_premiere_prime_cazetv',
    'Brasileirao_Serie_B_Superbet':  'espn_disney_sportv',
    'Copa_Betano_do_Brasil':         'globo_sportv_premiere_prime',
    'CONMEBOL_Libertadores':         'globo_espn_disney_paramount',
    'CONMEBOL_Sudamericana':         'espn_disney_paramount',
    'Copa_do_Mundo_FIFA':            'globo_sportv_cazetv',
    'UEFA_Liga_dos_Campeoes':        'sbt_tnt_hbo',
    'UEFA_Liga_Europa':              'espn_star',
    'Premier_League':                'espn_star',
    'LaLiga':                        'espn_star',
    'Bundesliga':                    'onefootball_youtube_sportv',
    'Ligue_1':                       'cazetv_prime',
    'Serie_A':                       'espn_star',
    'Liga_Portugal':                 'espn_star',
    'Supercopa_do_Brasil':           'globo'
};

function addManualGame() {
    var id = manualGameIdCounter++;
    var defaultBroadcaster = leagueToBroadcaster['Brasileirao_Betano'];
    manualGames.push({ id: id, homeName: '', awayName: '', homeLogo: null, awayLogo: null, league: 'Brasileirao_Betano', time: '20:00', broadcaster: defaultBroadcaster });
    var container = document.getElementById('manualGamesList');
    var gameDiv = document.createElement('div');
    gameDiv.id = 'manualGame_' + id;
    gameDiv.className = 'border border-zinc-800 rounded-lg p-4 bg-black/30';

    var broadcasterOptions =
        '<option value="globo_sportv_premiere_prime_cazetv">Globo / SporTV / Premiere / Prime Video / Caz\u00E9TV</option>' +
        '<option value="globo_sportv_premiere_prime">Globo / SporTV / Premiere / Prime Video</option>' +
        '<option value="espn_disney_sportv">ESPN / Disney+ / SporTV</option>' +
        '<option value="globo_espn_disney_paramount">Globo / ESPN / Disney+ / Paramount+</option>' +
        '<option value="espn_disney_paramount">ESPN / Disney+ / Paramount+</option>' +
        '<option value="espn_star">ESPN / Star+</option>' +
        '<option value="onefootball_youtube_sportv">OneFootball / YouTube / SporTV</option>' +
        '<option value="cazetv_prime">Caz\u00E9TV / Prime Video</option>' +
        '<option value="sbt_tnt_hbo">SBT / TNT Sports / HBO Max</option>' +
        '<option value="globo_sportv_cazetv">Globo / SporTV / Caz\u00E9TV</option>' +
        '<option value="globo">Globo</option>' +
        '<option value="sportv">SporTV</option>' +
        '<option value="band">Band</option>' +
        '<option value="record">Record</option>';

    gameDiv.innerHTML =
        '<div class="flex items-center justify-between mb-3"><span class="text-xs text-emerald-400 font-semibold uppercase">Jogo ' + (manualGames.length) + '</span><button onclick="removeManualGame(' + id + ')" class="text-red-500 hover:text-red-400 text-xs font-semibold">&#10005; Remover</button></div>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">' +
        '<div class="min-w-0"><label class="text-xs text-zinc-400 block mb-1">Time Casa</label>' +
            '<div class="relative">' +
                '<div class="flex gap-2 items-center min-w-0">' +
                    '<div class="w-10 h-10 border border-zinc-700 rounded flex items-center justify-center shrink-0 overflow-hidden bg-black" title="Logo">' +
                        '<img id="manualHomeLogo_' + id + '" src="" class="w-full h-full object-contain hidden">' +
                        '<span id="manualHomeLogoIcon_' + id + '" class="text-zinc-600 text-lg">+</span>' +
                    '</div>' +
                    '<input type="text" id="manualTeamSearch_home_' + id + '" placeholder="Buscar time..." autocomplete="off" class="bg-black border border-zinc-800 p-2 text-white text-sm flex-1 rounded focus:outline-none focus:border-emerald-500 min-w-0 box-border w-full" oninput="filterManualTeams(' + id + ',\'home\',this.value)" onfocus="showManualDropdown(' + id + ',\'home\')" onblur="hideManualDropdown(' + id + ',\'home\')" data-testid="manual-home-' + id + '">' +
                '</div>' +
                '<div id="manualTeamDropdown_home_' + id + '" class="absolute left-0 right-0 top-full mt-1 bg-zinc-900 border border-zinc-700 rounded max-h-60 overflow-y-auto z-50 hidden shadow-2xl"></div>' +
            '</div>' +
        '</div>' +
        '<div class="min-w-0"><label class="text-xs text-zinc-400 block mb-1">Time Fora</label>' +
            '<div class="relative">' +
                '<div class="flex gap-2 items-center min-w-0">' +
                    '<div class="w-10 h-10 border border-zinc-700 rounded flex items-center justify-center shrink-0 overflow-hidden bg-black" title="Logo">' +
                        '<img id="manualAwayLogo_' + id + '" src="" class="w-full h-full object-contain hidden">' +
                        '<span id="manualAwayLogoIcon_' + id + '" class="text-zinc-600 text-lg">+</span>' +
                    '</div>' +
                    '<input type="text" id="manualTeamSearch_away_' + id + '" placeholder="Buscar time..." autocomplete="off" class="bg-black border border-zinc-800 p-2 text-white text-sm flex-1 rounded focus:outline-none focus:border-emerald-500 min-w-0 box-border w-full" oninput="filterManualTeams(' + id + ',\'away\',this.value)" onfocus="showManualDropdown(' + id + ',\'away\')" onblur="hideManualDropdown(' + id + ',\'away\')" data-testid="manual-away-' + id + '">' +
                '</div>' +
                '<div id="manualTeamDropdown_away_' + id + '" class="absolute left-0 right-0 top-full mt-1 bg-zinc-900 border border-zinc-700 rounded max-h-60 overflow-y-auto z-50 hidden shadow-2xl"></div>' +
            '</div>' +
        '</div>' +
        '</div>' +
        '<div class="mb-3 min-w-0"><label class="text-xs text-zinc-400 block mb-1">Liga</label><select class="bg-black border border-zinc-800 p-2 text-white text-sm w-full rounded focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer box-border min-w-0 truncate" onchange="onManualLeagueChange(' + id + ',this.value)" data-testid="manual-league-' + id + '">' +
        '<option value="Brasileirao_Betano">Brasileir\u00E3o Betano</option>' +
        '<option value="Brasileirao_Serie_B_Superbet">Brasileir\u00E3o S\u00E9rie B Superbet</option>' +
        '<option value="Copa_Betano_do_Brasil">Copa Betano do Brasil</option>' +
        '<option value="CONMEBOL_Libertadores">CONMEBOL Libertadores</option>' +
        '<option value="CONMEBOL_Sudamericana">CONMEBOL Sudamericana</option>' +
        '<option value="Copa_do_Mundo_FIFA">Copa do Mundo FIFA</option>' +
        '<option value="UEFA_Liga_dos_Campeoes">UEFA Liga dos Campe\u00F5es</option>' +
        '<option value="UEFA_Liga_Europa">UEFA Liga Europa</option>' +
        '<option value="Premier_League">Premier League</option>' +
        '<option value="LaLiga">LaLiga</option>' +
        '<option value="Bundesliga">Bundesliga</option>' +
        '<option value="Ligue_1">Ligue 1</option>' +
        '<option value="Serie_A">Serie A</option>' +
        '<option value="Liga_Portugal">Liga Portugal</option>' +
        '<option value="Supercopa_do_Brasil">Supercopa do Brasil</option>' +
        '</select></div>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3"><div class="min-w-0"><label class="text-xs text-zinc-400 block mb-1">Horario</label><input type="time" value="20:00" class="bg-black border border-zinc-800 p-2 text-white text-sm w-full rounded focus:outline-none focus:border-emerald-500 box-border min-w-0 appearance-none" oninput="updateManualGame(' + id + ',\'time\',this.value)"></div>' +
        '<div class="min-w-0"><label class="text-xs text-zinc-400 block mb-1">Transmissao</label><select id="manualBroadcaster_' + id + '" class="bg-black border border-zinc-800 p-2 text-white text-sm w-full rounded focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer box-border min-w-0 truncate" onchange="updateManualGame(' + id + ',\'broadcaster\',this.value)" data-testid="manual-broadcaster-' + id + '">' + broadcasterOptions + '</select></div></div>';

    container.appendChild(gameDiv);

    var bcSelect = document.getElementById('manualBroadcaster_' + id);
    if (bcSelect) bcSelect.value = defaultBroadcaster;
}

window.onManualLeagueChange = function(id, leagueValue) {
    updateManualGame(id, 'league', leagueValue);
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

    // ============================================
    // NOMES DE EXIBIÇÃO ATUALIZADOS
    // ============================================
    var leagueDisplayNames = {
        'Brasileirao_Betano':            'Brasileirão Betano',
        'Brasileirao_Serie_B_Superbet':  'Brasileirão Série B Superbet',
        'Copa_Betano_do_Brasil':         'Copa Betano do Brasil',
        'CONMEBOL_Libertadores':         'CONMEBOL Libertadores',
        'CONMEBOL_Sudamericana':         'CONMEBOL Sudamericana',
        'Copa_do_Mundo_FIFA':            'Copa do Mundo FIFA',
        'UEFA_Liga_dos_Campeoes':        'UEFA Liga dos Campeões',
        'UEFA_Liga_Europa':              'UEFA Liga Europa',
        'Premier_League':                'Premier League',
        'LaLiga':                        'LaLiga',
        'Bundesliga':                    'Bundesliga',
        'Ligue_1':                       'Ligue 1',
        'Serie_A':                       'Serie A',
        'Liga_Portugal':                 'Liga Portugal',
        'Supercopa_do_Brasil':           'Supercopa do Brasil'
    };

    var broadcasterDisplayNames = {
        'globo_sportv_premiere_prime_cazetv': 'Globo / SporTV / Premiere / Prime Video / CazéTV',
        'globo_sportv_premiere_prime':        'Globo / SporTV / Premiere / Prime Video',
        'espn_disney_sportv':                 'ESPN / Disney+ / SporTV',
        'globo_espn_disney_paramount':        'Globo / ESPN / Disney+ / Paramount+',
        'espn_disney_paramount':              'ESPN / Disney+ / Paramount+',
        'espn_star':                          'ESPN / Star+',
        'onefootball_youtube_sportv':         'OneFootball / YouTube / SporTV',
        'cazetv_prime':                       'CazéTV / Prime Video',
        'sbt_tnt_hbo':                        'SBT / TNT Sports / HBO Max',
        'globo_sportv_cazetv':                'Globo / SporTV / CazéTV',
        'globo':                              'Globo',
        'sportv':                             'SporTV',
        'band':                               'Band',
        'record':                             'Record'
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

        var coverCanvas = document.createElement('canvas');
        coverCanvas.className = 'canvas-glow max-w-full h-auto rounded-lg mx-auto mb-4';
        var coverDlBtn = document.createElement('button');
        coverDlBtn.className = 'w-full max-w-md mx-auto bg-green-500 hover:bg-green-400 text-white font-bold py-3 px-6 rounded-lg mb-8 flex items-center justify-center gap-2';
        coverDlBtn.innerHTML = 'BAIXAR CAPA (1 de ' + totalBanners + ')';
        coverDlBtn.onclick = function() { downloadBanner(coverCanvas, 'capa'); };
        container.appendChild(coverCanvas);
        container.appendChild(coverDlBtn);
        await generateFootballCoverBanner(coverCanvas, [], totalBanners);

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
    if (!leagueName) return 'Verifique a programa\u00E7\u00E3o';
    // tenta match exato primeiro
    if (leagueBroadcasters[leagueName]) return leagueBroadcasters[leagueName];
    // depois tenta match parcial (inclui)
    for (var key in leagueBroadcasters) {
        if (leagueName.indexOf(key) !== -1) return leagueBroadcasters[key];
    }
    return 'Verifique a programa\u00E7\u00E3o';
}

function downloadBanner(canvasEl, num) {
    // PNG sem perdas - máxima qualidade
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
    if (!allFootballGames || allFootballGames.length === 0) { alert('Nenhum jogo para copiar! Gere os banners primeiro.'); return; }
    var dateFormatted = new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    var text = '*JOGOS DE ' + dateFormatted.toUpperCase() + '*\n\n';
    allFootballGames.forEach(function(game) {
        var league = game.league.name;
        var emoji = getLeagueEmoji(league);
        var time = new Date(game.fixture.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        var broadcaster = game.manualBroadcaster || getBroadcaster(league);
        text += emoji + ' *' + league + '* - ' + time + '\n' + game.teams.home.name + ' x ' + game.teams.away.name + '\n' + broadcaster + '\n\n';
    });
    text += 'Total: ' + allFootballGames.length + ' jogo' + (allFootballGames.length > 1 ? 's' : '') + '\nOs canais podem sofrer altera\u00E7\u00E3o de \u00FAltima hora';
    navigator.clipboard.writeText(text).then(function() { alert(allFootballGames.length + ' jogo' + (allFootballGames.length > 1 ? 's' : '') + ' copiado' + (allFootballGames.length > 1 ? 's' : '') + '!'); }).catch(function() { alert('Erro ao copiar'); });
}

function getLeagueEmoji(leagueName) {
    var map = {
        'Brasileirão Betano': '🇧🇷',
        'Brasileirão Série B Superbet': '📈',
        'Copa Betano do Brasil': '🏅',
        'CONMEBOL Libertadores': '🏆',
        'CONMEBOL Sudamericana': '🥉',
        'Copa do Mundo FIFA': '🌍',
        'UEFA Liga dos Campeões': '⭐',
        'UEFA Liga Europa': '🟠',
        'Premier League': '👑',
        'LaLiga': '🇪🇸',
        'Bundesliga': '🇩🇪',
        'Ligue 1': '🇫🇷',
        'Serie A': '🇮🇹',
        'Liga Portugal': '🇵🇹',
        'Supercopa do Brasil': '🏆'
    };
    if (map[leagueName]) return map[leagueName];
    for (var key in map) { if (leagueName.indexOf(key) !== -1) return map[key]; }
    return '⚽';
}

// ============================================
// MOVIES MODE  ============== ALTERADO ============================================
// ============================================
async function loadMoviesMode() {
    canvas.classList.remove('hidden');
    videoContainer.classList.add('hidden');
    movieTypeFilter = 'both';

    controlPanel.innerHTML =
        '<header class="border-b border-zinc-800 pb-5"><h2 class="font-oswald text-2xl font-bold text-red-400">Filmes e Séries</h2></header>' +
        '<section class="mt-5">' +
            '<label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold block mb-3">Tipo de Conteúdo</label>' +
            '<div class="flex gap-2">' +
                '<button id="movieTypeBoth" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white" data-testid="movie-type-both">Ambos</button>' +
                '<button id="movieTypeMovie" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800" data-testid="movie-type-movie">Filme</button>' +
                '<button id="movieTypeTv" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800" data-testid="movie-type-tv">Série</button>' +
            '</div>' +
        '</section>' +
        '<section class="mt-5">' +
            '<label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold block mb-3">Buscar Filme ou Série</label>' +
            '<div class="relative">' +
                '<input type="text" id="movieSearch" placeholder="Digite o nome..." class="bg-black border-2 border-zinc-800 p-4 pr-14 text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 w-full rounded-lg" data-testid="movie-search-input">' +
            '</div>' +
            '<div id="movieResults" class="mt-2 max-h-96 overflow-y-auto"></div>' +
        '</section>' +
        '<section id="movieControls" class="hidden flex flex-col gap-5 mt-5">' +
            '<div id="movieSelectedInfo" class="border border-zinc-800 p-4 bg-black/30 rounded-lg"></div>' +
            '<section class="flex flex-col gap-3"><label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Formato</label><div class="flex gap-2"><button id="movieFormatPost" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white">Post</button><button id="movieFormatStory" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800">Story</button></div></section>' +
            '<section class="flex flex-col gap-3"><label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Plataforma <span id="platformAutoText" class="text-green-400 text-xs normal-case"></span></label>' +
            '<select id="moviePlatform" class="bg-black border border-zinc-800 p-4 text-white focus:outline-none focus:border-red-500 w-full appearance-none cursor-pointer rounded pr-10"><option value="">Selecione ou automático</option><option value="Netflix">Netflix</option><option value="Amazon Prime Video">Amazon Prime Video</option><option value="Disney+">Disney+</option><option value="HBO Max">HBO Max</option><option value="Max">Max</option><option value="Apple TV+">Apple TV+</option><option value="Paramount+">Paramount+</option><option value="Globoplay">Globoplay</option><option value="Star+">Star+</option><option value="Crunchyroll">Crunchyroll</option><option value="Cinema">Cinema</option></select></section>' +
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
    showPlaceholder('🎬', 'FILMES', 'Busque um filme ou série', '#7f1d1d', '#18181b');
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
        var movies = (moviesData.results || []).slice(0, 8).map(function(m) { return { id: m.id, type: 'movie', title: m.title, year: m.release_date ? m.release_date.split('-')[0] : 'N/A', rating: m.vote_average ? m.vote_average.toFixed(1) : 'N/A', overview: m.overview || 'Sinopse não disponível.', poster: m.poster_path ? TMDB_IMG_BASE + '/w500' + m.poster_path : null }; });
        var series = (seriesData.results || []).slice(0, 8).map(function(s) { return { id: s.id, type: 'tv', title: s.name, year: s.first_air_date ? s.first_air_date.split('-')[0] : 'N/A', rating: s.vote_average ? s.vote_average.toFixed(1) : 'N/A', overview: s.overview || 'Sinopse não disponível.', poster: s.poster_path ? TMDB_IMG_BASE + '/w500' + s.poster_path : null }; });
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
    var info = '*' + selectedContent.title + '*\n\n' +
    '📅: ' + selectedContent.year +
    '\n' + (selectedContent.type === 'movie' ? '🎬 Filme' : '📺 Série') +
    '\n⭐: ' + selectedContent.rating +
    '\n🎭: ' + (selectedContent.genres || 'N/A') +
    '\n⏱️: ' + (durationText || 'N/A') +
    '\n\n' + (selectedContent.overview || 'Sem sinopse');
    navigator.clipboard.writeText(info).then(function() { alert('Informações copiadas!'); }).catch(function() { alert('Erro ao copiar'); });
};

// ============================================
// MOVIE BANNER (Full HD - 2x escala interna)
// ============================================
function generateMovieBanner() {
    if (!selectedContent || currentMode !== 'movies') return;
    var isPost = currentFormat === 'post';
    var width = isPost ? 1080 : 1080;
    var height = isPost ? 1350 : 1920;
    canvas.width = width;
    canvas.height = height;
    canvas.style.maxWidth = isPost ? '400px' : '280px';
    canvas.style.display = 'block';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
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
        ctx.save(); ctx.globalAlpha = 0.10;
        var pSize = 80; var logoR = uploadedLogo.width / uploadedLogo.height; var pW = pSize * logoR; var pH = pSize; var spX = pW + 60; var spY = pH + 60;
        ctx.translate(width / 2, height / 2); ctx.rotate(-30 * Math.PI / 180); ctx.translate(-width / 2, -height / 2);
        for (var py = -height; py < height * 2; py += spY) { for (var px = -width; px < width * 2; px += spX) { ctx.drawImage(uploadedLogo, px, py, pW, pH); } }
        ctx.restore();
        var cornerH = 300; var cornerW = cornerH * (uploadedLogo.width / uploadedLogo.height); ctx.globalAlpha = 1; ctx.drawImage(uploadedLogo, width - cornerW, 0, cornerW, cornerH);
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
    var hdCanvas = document.createElement('canvas');
    var isPost = currentFormat === 'post';
    var baseW = isPost ? 1080 : 1080;
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
    var metaX = mPadding; var sep = '  •  ';
    c.fillStyle = '#eab308'; var rt = '★ ' + selectedContent.rating; c.fillText(rt, metaX, currentY); metaX += c.measureText(rt).width;
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
// VIDEO MODE (TRAILER MANUAL) ============== ALTERADO ===========================
// ============================================
async function loadVideoMode() {
    videoTypeFilter = 'both';
    uploadedVideoFile = null;
    if (uploadedVideoUrl) { try { URL.revokeObjectURL(uploadedVideoUrl); } catch(e) {} }
    uploadedVideoUrl = null;

    controlPanel.innerHTML =
        '<header class="border-b border-zinc-800 pb-5"><h2 class="font-oswald text-2xl font-bold text-purple-400">Trailer Manual</h2><p class="text-zinc-500 text-sm mt-2">Carregue um vídeo MP4 e gere o banner</p></header>' +
        '<section class="mt-5">' +
            '<label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold block mb-3">Tipo de Conteúdo</label>' +
            '<div class="flex gap-2">' +
                '<button id="videoTypeBoth" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-white text-black border-white" data-testid="video-type-both">Ambos</button>' +
                '<button id="videoTypeMovie" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800" data-testid="video-type-movie">Filme</button>' +
                '<button id="videoTypeTv" class="flex-1 py-3 px-4 border font-semibold text-sm uppercase tracking-wider rounded bg-zinc-900 text-zinc-400 border-zinc-800" data-testid="video-type-tv">Série</button>' +
            '</div>' +
        '</section>' +
        '<section class="mt-5">' +
            '<label class="text-xs uppercase tracking-widest text-zinc-500 font-semibold block mb-3">Buscar Filme ou Série</label>' +
            '<div class="relative">' +
                '<input type="text" id="videoSearch" placeholder="Digite o nome..." class="bg-black border-2 border-zinc-800 p-4 pr-14 text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 w-full rounded-lg" data-testid="video-search-input">' +
            '</div>' +
            '<div id="videoResults" class="mt-2 max-h-96 overflow-y-auto"></div>' +
        '</section>' +
        '<section id="videoControls" class="hidden flex flex-col gap-5 mt-5">' +
            '<div id="videoSelectedInfo" class="border border-zinc-800 p-4 bg-black/30 rounded-lg"></div>' +
            '<div class="border-2 border-dashed border-purple-500/40 rounded-lg p-5 bg-purple-900/10">' +
                '<label class="text-xs uppercase tracking-widest text-purple-300 font-semibold block mb-3">Vídeo MP4 (do dispositivo)</label>' +
                '<label class="cursor-pointer flex flex-col items-center gap-2 hover:bg-purple-900/20 transition-colors p-4 rounded">' +
                    '<svg class="w-10 h-10 text-purple-400" fill="currentColor" viewBox="0 0 256 256"><path d="M232,72H160V40a16,16,0,0,0-16-16H40A16,16,0,0,0,24,40V184a16,16,0,0,0,16,16H88v32a16,16,0,0,0,16,16H232a16,16,0,0,0,16-16V88A16,16,0,0,0,232,72ZM40,40H144V72H88a16,16,0,0,0-16,16v96H40Zm192,200H104V88H232V240Z"/></svg>' +
                    '<span id="videoFileName" class="text-sm text-purple-200 font-semibold">Clique para escolher MP4</span>' +
                    '<input type="file" id="videoFileInput" accept="video/mp4,video/*" class="hidden" data-testid="video-file-input">' +
                '</label>' +
                '<video id="videoPreview" class="w-full mt-3 rounded hidden" controls></video>' +
            '</div>' +
            '<button id="videoGenerateBtn" class="w-full bg-purple-500 text-white font-bold uppercase tracking-widest py-4 hover:bg-purple-400 transition-all flex items-center justify-center gap-3 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" disabled data-testid="video-generate-btn">GERAR BANNER MP4</button>' +
            '<div id="videoProgressBox" class="hidden text-center"><p class="text-xs text-zinc-400 mb-2" id="videoProgressLabel">Gerando vídeo...</p><div class="w-full bg-zinc-800 rounded-full h-2 overflow-hidden"><div id="videoProgressFill" class="h-full bg-purple-500 transition-all" style="width:0%"></div></div></div>' +
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
    videoContainer.innerHTML = '<div class="text-center p-12"><div class="text-8xl mb-6">🎥</div><h3 class="font-oswald text-3xl font-bold text-purple-400 mb-3">TRAILER MANUAL</h3><p class="text-zinc-400 max-w-md mx-auto">1. Filtre por Filme/Série<br>2. Busque o título<br>3. Selecione o conteúdo<br>4. Carregue o vídeo MP4 do dispositivo<br>5. Clique em <b>Gerar Banner MP4</b></p></div>';
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
        var movies = (moviesData.results || []).slice(0, 8).map(function(m) { return { id: m.id, type: 'movie', title: m.title, year: m.release_date ? m.release_date.split('-')[0] : 'N/A', rating: m.vote_average ? m.vote_average.toFixed(1) : 'N/A', overview: m.overview || '', poster: m.poster_path ? TMDB_IMG_BASE + '/w500' + m.poster_path : null }; });
        var series = (seriesData.results || []).slice(0, 8).map(function(s) { return { id: s.id, type: 'tv', title: s.name, year: s.first_air_date ? s.first_air_date.split('-')[0] : 'N/A', rating: s.vote_average ? s.vote_average.toFixed(1) : 'N/A', overview: s.overview || '', poster: s.poster_path ? TMDB_IMG_BASE + '/w500' + s.poster_path : null }; });
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
        try { posterImage = await loadImage(API_BASE_URL + '/api/image-proxy?url=' + encodeURIComponent(content.poster)); } catch (e) { posterImage = null; }
    }

    document.getElementById('videoSelectedInfo').innerHTML =
        '<div class="flex gap-3 mb-3">' +
            (content.poster ? '<img src="' + content.poster + '" class="w-20 h-30 object-cover rounded">' : '') +
            '<div class="flex-1"><h3 class="font-oswald text-lg font-bold">' + content.title + '</h3>' +
            '<p class="text-zinc-500 text-sm">' + content.year + ' - ' + (content.type === 'movie' ? 'Filme' : 'Série') + ' - ★ ' + content.rating + '</p>' +
            (selectedContent.genres ? '<p class="text-zinc-400 text-xs mt-1">' + selectedContent.genres + '</p>' : '') +
            (selectedContent.autoProvider ? '<p class="text-green-400 text-xs mt-1">Plataforma: ' + selectedContent.autoProvider + '</p>' : '') +
            '</div></div>' +
        '<button onclick="copyMovieInfo()" class="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2" data-testid="video-copy-info-btn">Copiar Informações</button>';

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
// GERA O BANNER EM VIDEO (1080x1080 - Full HD bitrate)
// ============================================
async function generateTrailerBannerVideo() {
    if (!selectedContent || !uploadedVideoFile) { alert('Selecione um conteúdo e carregue um MP4'); return; }
    var btn = document.getElementById('videoGenerateBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner mx-auto"></div>';
    var progressBox = document.getElementById('videoProgressBox');
    var progressLabel = document.getElementById('videoProgressLabel');
    var progressFill = document.getElementById('videoProgressFill');
    progressBox.classList.remove('hidden');
    progressLabel.textContent = 'Preparando vídeo...';
    progressFill.style.width = '5%';

    var srcVideo = null;
    var recorder = null;
    var failsafeTimer = null;
    var stopRequested = false;

    function cleanupVideoEl() {
        try { if (srcVideo && srcVideo.parentNode) srcVideo.parentNode.removeChild(srcVideo); } catch(e) {}
        try { if (audioCtxRef && audioCtxRef.state !== 'closed') audioCtxRef.close(); } catch(e) {}
    }

    var audioCtxRef = null;

    try {
        var W = 1080, H = 1080;
        var outCanvas = document.createElement('canvas');
        outCanvas.width = W; outCanvas.height = H;
        var oc = outCanvas.getContext('2d');
        oc.imageSmoothingEnabled = true;
        oc.imageSmoothingQuality = 'high';

        videoContainer.innerHTML = '<div class="text-center"><p class="text-purple-300 mb-3 font-semibold">Gerando banner vídeo...</p></div>';
        videoContainer.appendChild(outCanvas);
        outCanvas.style.maxWidth = '480px';
        outCanvas.style.borderRadius = '12px';
        outCanvas.style.boxShadow = '0 0 60px rgba(168,85,247,0.4)';

        oc.fillStyle = '#0a0a0a';
        oc.fillRect(0, 0, W, H);

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
            function fail(e) { if (done) return; done = true; clearTimeout(to); rej(new Error('Erro ao carregar MP4')); }
            srcVideo.addEventListener('canplay', ok, { once: true });
            srcVideo.addEventListener('loadeddata', ok, { once: true });
            srcVideo.addEventListener('error', fail, { once: true });
            if (srcVideo.readyState >= 3) ok();
        });

        progressLabel.textContent = 'Iniciando reprodução...';
        progressFill.style.width = '10%';

        var audioStream = null;
        var audioCtx = null;
        try {
            var AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                audioCtx = new AudioCtx();
                audioCtxRef = audioCtx;
                if (audioCtx.state === 'suspended') {
                    try { await audioCtx.resume(); } catch(e) {}
                }
                var sourceNode = audioCtx.createMediaElementSource(srcVideo);
                var destNode = audioCtx.createMediaStreamDestination();
                sourceNode.connect(destNode);
                var muteGain = audioCtx.createGain();
                muteGain.gain.value = 0;
                sourceNode.connect(muteGain);
                muteGain.connect(audioCtx.destination);
                audioStream = destNode.stream;
                console.log('Web Audio: áudio configurado.', audioStream.getAudioTracks().length, 'tracks');
            }
        } catch(e) {
            console.warn('Web Audio API falhou:', e);
        }

        try { srcVideo.currentTime = 0; } catch(e) {}
        try {
            await srcVideo.play();
        } catch(e) {
            console.error('Erro ao iniciar play():', e);
            throw new Error('Não foi possível reproduzir o vídeo. Tente outro arquivo.');
        }

        progressLabel.textContent = 'Configurando gravação...';
        progressFill.style.width = '15%';

        if (!audioStream) {
            try {
                if (typeof srcVideo.captureStream === 'function') audioStream = srcVideo.captureStream();
                else if (typeof srcVideo.mozCaptureStream === 'function') audioStream = srcVideo.mozCaptureStream();
                if (audioStream) console.log('Fallback captureStream:', audioStream.getAudioTracks().length, 'audio tracks');
            } catch(e) { console.warn('captureStream também falhou:', e); }
        }

        var canvasStream = outCanvas.captureStream(30);
        var combinedTracks = [].concat(canvasStream.getVideoTracks());
        if (audioStream) {
            audioStream.getAudioTracks().forEach(function(t) { combinedTracks.push(t); });
        }
        console.log('Tracks combinadas:', combinedTracks.length, 'video:', canvasStream.getVideoTracks().length, 'audio:', audioStream ? audioStream.getAudioTracks().length : 0);
        var combinedStream = new MediaStream(combinedTracks);

        var preferredTypes = [
            'video/mp4;codecs=avc1.640033,mp4a.40.2',
            'video/mp4;codecs=avc1,mp4a',
            'video/mp4',
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm'
        ];
        var mimeType = '';
        for (var mi = 0; mi < preferredTypes.length; mi++) {
            if (window.MediaRecorder && MediaRecorder.isTypeSupported(preferredTypes[mi])) { mimeType = preferredTypes[mi]; break; }
        }
        if (!mimeType) throw new Error('Navegador não suporta MediaRecorder');
        console.log('Usando mimeType:', mimeType);

        recorder = new MediaRecorder(combinedStream, {
            mimeType: mimeType,
            videoBitsPerSecond: 12000000,
            audioBitsPerSecond: 192000
        });
        var chunks = [];
        recorder.ondataavailable = function(ev) {
            if (ev.data && ev.data.size > 0) {
                chunks.push(ev.data);
                console.log('chunk recebido:', ev.data.size, 'total chunks:', chunks.length);
            }
        };
        recorder.onerror = function(e) { console.error('MediaRecorder error:', e); };

        var donePromise = new Promise(function(resolve, reject) {
            recorder.onstop = function() {
                console.log('recorder.onstop disparado. chunks:', chunks.length);
                try {
                    if (chunks.length === 0) {
                        reject(new Error('Nenhum dado gravado. Tente outro vídeo.'));
                        return;
                    }
                    var ext = mimeType.indexOf('mp4') !== -1 ? 'mp4' : 'webm';
                    var blob = new Blob(chunks, { type: mimeType.split(';')[0] });
                    console.log('Blob criado:', blob.size, 'bytes');
                    var url = URL.createObjectURL(blob);
                    var safeTitle = (selectedContent.title || 'trailer').replace(/[^a-zA-Z0-9]/g, '_');
                    var fileName = safeTitle + '_trailer.' + ext;

                    videoContainer.innerHTML = '';
                    var infoDiv = document.createElement('div');
                    infoDiv.className = 'text-center mb-4';
                    infoDiv.innerHTML = '<h3 class="font-oswald text-2xl font-bold text-purple-400 mb-2">Banner gerado!</h3>' +
                        '<p class="text-zinc-400 text-xs mb-2">Tamanho: ' + (blob.size / 1024 / 1024).toFixed(2) + ' MB - Formato: ' + ext.toUpperCase() + '</p>' +
                        (ext === 'mp4' ? '' : '<p class="text-yellow-400 text-xs mb-2">⚠ Seu navegador exportou em WebM. Para MP4 puro, abra em Chrome desktop atualizado.</p>');
                    videoContainer.appendChild(infoDiv);

                    var vidEl = document.createElement('video');
                    vidEl.src = url;
                    vidEl.controls = true;
                    vidEl.style.maxWidth = '480px';
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

                    resolve();
                } catch(err) {
                    console.error('Erro em onstop:', err);
                    reject(err);
                }
            };
        });

        function drawFrame() {
            oc.fillStyle = '#0a0a0a';
            oc.fillRect(0, 0, W, H);

            var videoAreaH = Math.round(W * 9 / 16);
            oc.fillStyle = '#000';
            oc.fillRect(0, 0, W, videoAreaH);
            if (!srcVideo.paused && !srcVideo.ended && srcVideo.readyState >= 2) {
                var vR = srcVideo.videoWidth / srcVideo.videoHeight;
                var aR = W / videoAreaH;
                var dw, dh, ox, oy;
                if (vR > aR) { dw = W; dh = W / vR; ox = 0; oy = (videoAreaH - dh) / 2; }
                else { dh = videoAreaH; dw = videoAreaH * vR; ox = (W - dw) / 2; oy = 0; }
                try { oc.drawImage(srcVideo, ox, oy, dw, dh); } catch(e) {}
            }

            if (uploadedLogo) {
                var logoR = uploadedLogo.width / uploadedLogo.height;
                var logoH = 140;
                var logoW = logoH * logoR;
                if (logoW > 320) { logoW = 320; logoH = logoW / logoR; }
                oc.drawImage(uploadedLogo, W - logoW - 25, 20, logoW, logoH);
            } else {
                var phW = 180, phH = 130;
                oc.fillStyle = 'rgba(0,0,0,0.55)';
                roundRect(oc, W - phW - 25, 20, phW, phH, 12);
                oc.fill();
                oc.fillStyle = 'rgba(255,255,255,0.85)';
                oc.font = '700 22px Manrope, sans-serif';
                oc.textAlign = 'center';
                oc.fillText('LOGO', W - phW / 2 - 25, 20 + phH / 2 + 8);
            }

            var bottomY = videoAreaH;
            var bottomH = H - bottomY;
            var bgGrad = oc.createLinearGradient(0, bottomY, 0, H);
            bgGrad.addColorStop(0, '#0f0f12');
            bgGrad.addColorStop(1, '#050507');
            oc.fillStyle = bgGrad;
            oc.fillRect(0, bottomY, W, bottomH);

            var posterX = 40, posterY = bottomY + 20;
            var posterW = 280, posterH = 400;
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
                oc.fillStyle = '#52525b';
                oc.font = '600 18px Manrope, sans-serif';
                oc.textAlign = 'center';
                oc.fillText('CAPA', posterX + posterW / 2, posterY + posterH / 2);
            }

            var infoX = posterX + posterW + 40;
            var infoMaxW = W - infoX - 40;

            oc.textAlign = 'left';
            oc.font = '700 50px Oswald, sans-serif';
            var titleLines = wrapText(oc, selectedContent.title.toUpperCase(), infoMaxW).slice(0, 2);
            var titleH = titleLines.length * 56;

            var metaH = 30;

            oc.font = '400 19px Manrope, sans-serif';
            var maxSynLines = 8;
            var synLines = wrapText(oc, selectedContent.overview || '', infoMaxW).slice(0, maxSynLines);
            var synH = synLines.length * 26;

            var gapTitleMeta = 18;
            var gapMetaSyn = 30;
            var totalTextH = titleH + gapTitleMeta + metaH + gapMetaSyn + synH;

            var posterCenterY = posterY + posterH / 2;
            var blockTop = posterCenterY - totalTextH / 2;

            var minTop = bottomY + 30;
            var maxBottom = H - 110;
            if (blockTop < minTop) blockTop = minTop;
            if (blockTop + totalTextH > maxBottom) blockTop = maxBottom - totalTextH;

            var curY = blockTop + 42;

            oc.font = '700 50px Oswald, sans-serif';
            oc.fillStyle = '#fff';
            for (var ti2 = 0; ti2 < titleLines.length; ti2++) {
                oc.fillText(titleLines[ti2], infoX, curY);
                curY += 56;
            }
            curY += gapTitleMeta - 8;

            oc.font = '700 22px Manrope, sans-serif';
            var metaParts = [];
            if (selectedContent.rating && selectedContent.rating !== 'N/A') metaParts.push('★ ' + selectedContent.rating);
            if (selectedContent.year && selectedContent.year !== 'N/A') metaParts.push(selectedContent.year);
            if (selectedContent.genres && selectedContent.genres !== 'N/A') metaParts.push(selectedContent.genres.split(',')[0].trim());
            var plat = selectedContent.autoProvider;
            if (plat) metaParts.push(plat);

            var mx = infoX;
            for (var mi2 = 0; mi2 < metaParts.length; mi2++) {
                var part = metaParts[mi2];
                if (mi2 === 0 && part.indexOf('★') === 0) oc.fillStyle = '#eab308';
                else if (mi2 === metaParts.length - 1 && plat) oc.fillStyle = '#a855f7';
                else oc.fillStyle = '#fff';
                oc.fillText(part, mx, curY);
                mx += oc.measureText(part).width;
                if (mi2 < metaParts.length - 1) {
                    oc.fillStyle = 'rgba(255,255,255,0.4)';
                    var sepStr = '  •  ';
                    oc.fillText(sepStr, mx, curY);
                    mx += oc.measureText(sepStr).width;
                }
            }
            curY += gapMetaSyn;

            oc.font = '400 19px Manrope, sans-serif';
            oc.fillStyle = 'rgba(255,255,255,0.85)';
            for (var sj2 = 0; sj2 < synLines.length; sj2++) {
                oc.fillText(synLines[sj2], infoX, curY);
                curY += 26;
                if (curY > H - 90) break;
            }

            var fY = H - 25;
            var fBoxH = 50;
            var fBoxW = 200;
            var spacing = 12;
            var totalW = fBoxW * 2 + spacing;
            var startX = W - totalW - 40;

            oc.fillStyle = '#25D366';
            roundRect(oc, startX, fY - fBoxH, fBoxW, fBoxH, 8);
            oc.fill();
            oc.fillStyle = '#fff';
            oc.font = '600 18px Manrope, sans-serif';
            oc.textAlign = 'center';
            oc.fillText(globalSettings.whatsappNumber || globalSettings.whatsappText, startX + fBoxW / 2, fY - fBoxH / 2 + 6);

            oc.fillStyle = '#ef4444';
            roundRect(oc, startX + fBoxW + spacing, fY - fBoxH, fBoxW, fBoxH, 8);
            oc.fill();
            oc.fillStyle = '#fff';
            oc.font = '700 19px Manrope, sans-serif';
            oc.fillText(globalSettings.ctaText, startX + fBoxW + spacing + fBoxW / 2, fY - fBoxH / 2 + 6);

            if (recorder && recorder.state === 'recording') {
                requestAnimationFrame(drawFrame);
            }

            if (srcVideo.duration > 0) {
                var pct = Math.min(95, 15 + (srcVideo.currentTime / srcVideo.duration) * 80);
                progressFill.style.width = pct + '%';
                progressLabel.textContent = 'Gerando: ' + Math.floor(srcVideo.currentTime) + 's / ' + Math.floor(srcVideo.duration) + 's';
            }
        }

        function stopRecording(reason) {
            if (stopRequested) return;
            stopRequested = true;
            console.log('Parando gravação. Motivo:', reason);
            try { srcVideo.pause(); } catch(e) {}
            setTimeout(function() {
                try {
                    if (recorder && recorder.state !== 'inactive') {
                        recorder.requestData();
                        setTimeout(function() {
                            try { if (recorder.state !== 'inactive') recorder.stop(); } catch(e) {}
                        }, 100);
                    }
                } catch(e) { console.error('Erro ao parar recorder:', e); }
            }, 250);
        }

        srcVideo.addEventListener('ended', function() { stopRecording('ended'); });
        srcVideo.addEventListener('pause', function() {
            if (srcVideo.duration > 0 && srcVideo.currentTime >= srcVideo.duration - 0.2) {
                stopRecording('pause-near-end');
            }
        });
        srcVideo.addEventListener('timeupdate', function() {
            if (srcVideo.duration > 0 && srcVideo.currentTime >= srcVideo.duration - 0.05) {
                stopRecording('timeupdate-end');
            }
        });

        var maxMs = ((srcVideo.duration || 60) + 3) * 1000;
        failsafeTimer = setTimeout(function() { stopRecording('failsafe-timeout'); }, maxMs);

        progressLabel.textContent = 'Gravando...';
        progressFill.style.width = '20%';
        recorder.start(500);
        console.log('Recorder iniciado. estado:', recorder.state, 'duração:', srcVideo.duration);
        drawFrame();

        await donePromise;
        clearTimeout(failsafeTimer);
        cleanupVideoEl();
        progressFill.style.width = '100%';
        progressLabel.textContent = 'Concluído!';
        setTimeout(function() { progressBox.classList.add('hidden'); }, 1500);

        btn.disabled = false;
        btn.innerHTML = 'GERAR BANNER MP4';
    } catch (error) {
        console.error('Erro:', error);
        clearTimeout(failsafeTimer);
        cleanupVideoEl();
        try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch(e) {}
        alert('Erro ao gerar banner: ' + error.message);
        btn.disabled = false;
        btn.innerHTML = 'GERAR BANNER MP4';
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
