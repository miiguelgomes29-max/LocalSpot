// ==========================================
// CONFIGURAÇÃO SUPABASE E LÓGICA COMPLETA DA APLICAÇÃO
// ==========================================
const SUPABASE_URL = "https://ufzjexbihnwflqktpomm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmempleGJpaG53Zmxxa3Rwb21tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzMjU5NDUsImV4cCI6MjEwOTkwMTk0NX0.hy3x0RuyuKYwTOGvdAA2hYKH_02SEy49YRaZHoD2ufA";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = id => document.getElementById(id);

// Elementos de Autenticação
const authOverlay = $("authOverlay");
const tabLogin = $("tabLogin");
const tabRegister = $("tabRegister");
const loginForm = $("loginForm");
const registerForm = $("registerForm");
const regAccountType = $("regAccountType");
const businessTypeGroup = $("businessTypeGroup");
const regNameLabel = $("regNameLabel");
const regNameInput = $("regName");

// Elementos do Cabeçalho e Notificações
const notifBtn = $("notifBtn");
const notifBadge = $("notifBadge");
const notifDropdown = $("notifDropdown");
const notifList = $("notifList");
const userBadge = $("userBadge");
const adminPanelBtn = $("adminPanelBtn");
const logoutButton = $("logoutButton");
const addEventButton = $("addEventButton");
const adminModal = $("adminModal");
const profileModal = $("profileModal");

// Elementos de Filtros e Lista
const mainEl = $("main");
const mobileViewToggle = $("mobileViewToggle");
const searchInput = $("searchInput");
const categoryChips = $("categoryChips");
const districtFilter = $("districtFilter");
const periodFilter = $("periodFilter");
const radiusSlider = $("radiusSlider");
const radiusValue = $("radiusValue");
const sortFilter = $("sortFilter");
const favoritesToggle = $("favoritesToggle");
const freeOnlyToggle = $("freeOnlyToggle");
const followingOnlyToggle = $("followingOnlyToggle");
const resetFiltersBtn = $("resetFilters");
const eventsList = $("eventsList");
const eventCount = $("eventCount");
const emptyState = $("emptyState");
const locationButton = $("locationButton");

// Elementos dos Modais
const modal = $("eventModal");
const closeModal = $("closeModal");
const eventForm = $("eventForm");
const eventImageInput = $("eventImage");
const imagePreview = $("imagePreview");
const coordsText = $("selectedCoordinates");
const formError = $("formError");
const changeLocationButton = $("changeLocationButton");
const aboutModal = $("aboutModal");
const detailModal = $("detailModal");
const ticketModal = $("ticketModal");
const reportModal = $("reportModal");
const pickBanner = $("pickBanner");

const STORAGE_FAVS = "localspot_favorites";
const STORAGE_EXPLORATION = "localspot_exploration_v1";

function loadJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
}

function saveJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        return false;
    }
}

// ---------- Estado Global ----------
const state = {
    search: "",
    category: "all",
    district: "all",
    period: "all",
    radius: 100,
    sort: "date",
    onlyFavorites: false,
    onlyFree: false,
    onlyFollowing: false
};

let currentUser = null;
let currentProfile = null;
let favorites = new Set(loadJSON(STORAGE_FAVS, []).map(String));
let myEnrollments = new Set();
let myFollowing = new Map();
let myFollowingProfiles = [];
let myFollowersList = [];
let notifications = [];
let activeId = null;
let pendingLocation = null;
let editingEventId = null;
let detailEventId = null;
let currentList = [];

// Estado Social Bump & Chat
window.friendsList = [];
let friendshipRecords = new Map();
let incomingFriendRequests = [];
let sentFriendRequestIds = new Set();
let animatedIncomingFriendshipIds = new Set();
let lastChatMessageByFriend = new Map();
let allEnrollmentsMap = new Map();
let activeChatFriendId = null;
let unreadMessagesBySender = new Map();
let onlineUserIds = new Set();
let typingTimer = null;
let lastShakeTime = 0;
let shakeSensorBound = false;
let locationSyncInterval = null;
let geoWatchId = null;
let realtimeChannel = null;
let bumpBroadcastChannel = null;
const bumpCooldownMap = new Map();
const recentIncomingBumpTs = new Map();

// Estado de Exploração & Percurso (Footsteps)
let explorationData = loadJSON(STORAGE_EXPLORATION, {
    date: new Date().toISOString().slice(0, 10),
    zones: [],
    trail: [],
    distanceKm: 0
});
let trailVisible = false;

// Estado do Welcome Splash & Onboarding
let welcomeSplashTimer = null;
let onboardingStep = 1;
const onboardingData = {
    fullName: "",
    bio: "",
    birthDate: "",
    businessType: "Empresa / Comércio",
    avatarFile: null,
    avatarPreviewUrl: null,
    statusEmoji: "📍",
    statusText: "No LocalSpot",
    privacyMode: "precise"
};

const BUMP_STATUSES = [
    { emoji: "📍", text: "No LocalSpot" },
    { emoji: "☕", text: "Num café" },
    { emoji: "🎉", text: "Pronto para sair" },
    { emoji: "🚗", text: "A caminho" },
    { emoji: "📚", text: "A estudar" },
    { emoji: "🎧", text: "A ouvir música" },
    { emoji: "🏃", text: "A treinar" },
    { emoji: "🍔", text: "A comer" },
    { emoji: "🔥", text: "Na festa" },
    { emoji: "🏠", text: "Em casa" }
];

const BUSINESS_SECTORS = [
    { emoji: "🏛️", label: "Câmara Municipal / Junta" },
    { emoji: "🤝", label: "Associação / Coletividade" },
    { emoji: "🍽️", label: "Restauração / Café" },
    { emoji: "🎭", label: "Cultura / Espetáculos" },
    { emoji: "🏟️", label: "Desporto / Ginásio" },
    { emoji: "🏢", label: "Empresa / Comércio" },
    { emoji: "🎓", label: "Educação / Universidade" },
    { emoji: "💼", label: "Serviços / Instituição" }
];

function isBusinessAccount() {
    return currentProfile?.role === "business";
}

function isNormalUserAccount() {
    return currentProfile?.role === "user";
}

function isAdminAccount() {
    return currentProfile?.role === "admin";
}

function isEntityVerified(profile) {
    return profile?.role === "business" && (profile?.is_verified === true || profile?.status_emoji === "✅");
}

function verifiedBadgeHTML(profile) {
    if (isEntityVerified(profile)) {
        return `<span class="verified-check" title="Entidade Oficial Verificada">✓</span>`;
    }
    return "";
}

window.isFriendLiveOnline = friendId => onlineUserIds.has(String(friendId));

window.getFriendshipTier = (bumpCount = 0) => {
    if (bumpCount >= 30) {
        return { badge: "👑 BFF / Alma Gémea", next: 50, pct: 100 };
    }
    if (bumpCount >= 15) {
        return { badge: "🔥 Melhores Amigos", next: 30, pct: Math.round(((bumpCount - 15) / 15) * 100) };
    }
    if (bumpCount >= 5) {
        return { badge: "⚡ Bons Amigos", next: 15, pct: Math.round(((bumpCount - 5) / 10) * 100) };
    }
    return { badge: "🌱 Novos Amigos", next: 5, pct: Math.round((bumpCount / 5) * 100) };
};

window.getMapSocialEntities = () => {
    const followedVisibleEntities = myFollowingProfiles.filter(e =>
        e.role === "business" &&
        !e.ghost_mode &&
        e.privacy_mode !== "ghost" &&
        typeof e.last_lat === "number" &&
        typeof e.last_lng === "number"
    );
    return [...window.friendsList, ...followedVisibleEntities];
};

// ---------- Som & Notificação de Segundo Plano ----------
function playBumpSound(isSuper = false) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = isSuper ? "triangle" : "sine";
        osc.frequency.setValueAtTime(isSuper ? 220 : 150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(
            isSuper ? 680 : 45,
            ctx.currentTime + (isSuper ? 0.35 : 0.2)
        );

        gain.gain.setValueAtTime(0.38, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (isSuper ? 0.38 : 0.22));

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + (isSuper ? 0.4 : 0.25));
    } catch (e) {}
}

function playFriendWooshSound(isIncoming = false) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        if (isIncoming) {
            osc.frequency.setValueAtTime(340, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(680, ctx.currentTime + 0.16);
            osc.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.32);
        } else {
            osc.frequency.setValueAtTime(280, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(760, ctx.currentTime + 0.26);
        }

        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.34);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.36);
    } catch (e) {}
}

function sendBackgroundBumpNotification(title, body) {
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        try {
            new Notification(title, { body });
        } catch (e) {}
    }
}

// ==========================================
// ANIMAÇÕES DE PEDIDO DE AMIZADE (ENVIO & RECEBIDO COM FOTO)
// ==========================================
function triggerFriendSentAnimation(targetUser) {
    if (navigator.vibrate) {
        try { navigator.vibrate([60, 40, 90]); } catch (e) {}
    }
    playFriendWooshSound(false);

    const existing = document.querySelector(".friend-anim-overlay");
    if (existing) existing.remove();

    const name = targetUser?.full_name || "Utilizador";
    const avatarUrl = targetUser?.avatar_url || null;
    const initials = name.trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join("");

    const overlay = document.createElement("div");
    overlay.className = "friend-anim-overlay sent-mode";
    overlay.innerHTML = `
        <div class="friend-sent-stage">
            <div class="friend-sent-avatar-wrap">
                ${avatarUrl ? `<img src="${escapeHTML(avatarUrl)}" alt="" onerror="this.remove()">` : escapeHTML(initials)}
            </div>
            <div class="friend-sent-plane">✈️</div>
            <div class="friend-sent-pill">👊 Pedido enviado para ${escapeHTML(name)}!</div>
        </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 1750);
}

function triggerFriendRequestAnimation(senderUser, friendshipId) {
    if (!senderUser) return;
    if (navigator.vibrate) {
        try { navigator.vibrate([120, 60, 160, 60, 200]); } catch (e) {}
    }
    playFriendWooshSound(true);

    const existing = document.querySelector(".friend-anim-overlay");
    if (existing) existing.remove();

    const name = senderUser.full_name || "Novo Amigo";
    const avatarUrl = senderUser.avatar_url || null;
    const initials = name.trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join("");
    const bioLine = senderUser.bio
        ? escapeHTML(senderUser.bio)
        : `${senderUser.status_emoji || "📍"} ${escapeHTML(senderUser.status_text || "Quer ligar-se contigo no LocalSpot!")}`;

    const overlay = document.createElement("div");
    overlay.className = "friend-anim-overlay";
    overlay.innerHTML = `
        <div class="friend-req-burst-card">
            <span style="display:inline-block; background:rgba(236,72,153,0.2); border:1px solid rgba(236,72,153,0.5); color:#fbcfe8; font-size:11px; font-weight:800; padding:4px 12px; border-radius:999px; margin-bottom:14px;">
                ✨ NOVO PEDIDO DE AMIZADE
            </span>
            <div class="friend-req-photo-ring">
                <div class="friend-req-photo-inner">
                    ${avatarUrl ? `<img src="${escapeHTML(avatarUrl)}" alt="" onerror="this.remove()">` : escapeHTML(initials)}
                </div>
                <div class="friend-req-badge-fist">👊</div>
            </div>
            <h2 style="margin:0 0 6px; font-size:21px;">${escapeHTML(name)}</h2>
            <p style="margin:0; font-size:13px; color:#cbd5e1;">${bioLine}</p>
            <div class="friend-req-actions-row">
                <button type="button" id="animAcceptReqBtn" class="btn-bump" style="padding:10px; font-size:13.5px;">✅ Aceitar</button>
                <button type="button" id="animLaterReqBtn" class="btn-soft" style="padding:10px; font-size:13px;">Ver Depois</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const autoCloseTimer = setTimeout(() => {
        if (overlay.parentElement) overlay.remove();
    }, 9000);

    $("animLaterReqBtn").onclick = () => {
        clearTimeout(autoCloseTimer);
        overlay.remove();
    };

    $("animAcceptReqBtn").onclick = async () => {
        clearTimeout(autoCloseTimer);
        overlay.remove();
        if (friendshipId) {
            await window.acceptFriendRequest(friendshipId, senderUser.id);
        } else {
            await loadSocialData();
            const match = incomingFriendRequests.find(r => String(r.user.id) === String(senderUser.id));
            if (match) {
                await window.acceptFriendRequest(match.friendshipId, senderUser.id);
            }
        }
    };
}

// ---------- Toast Notifications ----------
let toastTimer;
function showToast(message, type = "info") {
    const toast = $("toast");
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3500);
}

function translateAuthError(error) {
    if (!error) return "Ocorreu um erro inesperado.";
    const msg = (error.message || "").toLowerCase();

    if (msg.includes("invalid login credentials")) return "E-mail ou palavra-passe incorretos.";
    if (msg.includes("email not confirmed")) return "Desativa «Confirm email» no Supabase para entrar de imediato.";
    if (msg.includes("user already registered") || msg.includes("already been registered")) return "Este e-mail já está registado. Muda para «Entrar».";
    if (msg.includes("password should be at least")) return "A palavra-passe tem de ter pelo menos 6 caracteres.";
    if (msg.includes("rate limit") || msg.includes("too many requests")) return "Muitas tentativas seguidas. Aguarda alguns minutos.";
    return error.message;
}

// ==========================================
// EXPLORAÇÃO & PERCURSO DE HOJE (FOOTSTEPS BUMP)
// ==========================================
function ensureTodayExplorationState() {
    const today = new Date().toISOString().slice(0, 10);
    if (explorationData.date !== today) {
        explorationData = {
            date: today,
            zones: explorationData.zones || [],
            trail: [],
            distanceKm: 0
        };
        saveJSON(STORAGE_EXPLORATION, explorationData);
    }
}

window.recordExplorationPoint = (lat, lng) => {
    if (typeof lat !== "number" || typeof lng !== "number") return;
    ensureTodayExplorationState();

    const zoneKey = `${lat.toFixed(3)}_${lng.toFixed(3)}`;
    if (!explorationData.zones.includes(zoneKey)) {
        explorationData.zones.push(zoneKey);
    }

    const trail = explorationData.trail;
    if (trail.length > 0) {
        const [prevLng, prevLat] = trail[trail.length - 1];
        const stepKm = distanceKm(prevLat, prevLng, lat, lng);
        if (stepKm >= 0.015 && stepKm < 25) {
            explorationData.distanceKm = Number((explorationData.distanceKm + stepKm).toFixed(2));
            trail.push([lng, lat]);
            if (trail.length > 250) trail.shift();
        }
    } else {
        trail.push([lng, lat]);
    }

    saveJSON(STORAGE_EXPLORATION, explorationData);
    updateExplorationPill();
    if (typeof setTodayTrailCoords === "function") {
        setTodayTrailCoords(explorationData.trail, trailVisible);
    }
};

function updateExplorationPill() {
    const btn = $("explorationMapBtn");
    if (!btn) return;
    ensureTodayExplorationState();
    const zonesCount = explorationData.zones.length;
    const kmStr = explorationData.distanceKm.toFixed(1).replace(".", ",");
    btn.textContent = `🗺️ ${zonesCount} zonas · ${kmStr} km`;
    btn.classList.toggle("active", trailVisible);
}

// ==========================================
// ECRÃ DE BOAS-VINDAS AUTOMÁTICO (3 SEGUNDOS) & QUESTIONÁRIO ANIMADO
// ==========================================
function getAgeAndZodiac(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3) return null;
    const [year, month, day] = parts;
    const dob = new Date(year, month - 1, day);
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const mDiff = now.getMonth() - dob.getMonth();
    if (mDiff < 0 || (mDiff === 0 && now.getDate() < dob.getDate())) age--;

    if (age < 0 || age > 120) return null;

    const signs = [
        { name: "Capricórnio", emoji: "♑", endDay: 19 },
        { name: "Aquário", emoji: "♒", endDay: 18 },
        { name: "Peixes", emoji: "♓", endDay: 20 },
        { name: "Carneiro", emoji: "♈", endDay: 19 },
        { name: "Touro", emoji: "♉", endDay: 20 },
        { name: "Gémeos", emoji: "♊", endDay: 20 },
        { name: "Caranguejo", emoji: "♋", endDay: 22 },
        { name: "Leão", emoji: "♌", endDay: 22 },
        { name: "Virgem", emoji: "♍", endDay: 22 },
        { name: "Balança", emoji: "♎", endDay: 22 },
        { name: "Escorpião", emoji: "♏", endDay: 21 },
        { name: "Sagitário", emoji: "♐", endDay: 21 },
        { name: "Capricórnio", emoji: "♑", endDay: 31 }
    ];
    const sign = day <= signs[month - 1].endDay ? signs[month - 1] : signs[month];
    return { age, sign };
}

function showWelcomeSplash(isBusiness = false) {
    let splash = $("welcomeSplash");
    if (splash) splash.remove();

    splash = document.createElement("div");
    splash.id = "welcomeSplash";
    splash.className = `welcome-splash${isBusiness ? " business-theme" : ""}`;

    if (isBusiness) {
        splash.innerHTML = `
            <div class="welcome-content">
                <div class="welcome-logo-pill">🏛️ LocalSpot · Empresas & Domínio Público</div>
                <div class="welcome-wave-wrap"><span class="welcome-suit-emoji">👔</span></div>
                <h1 class="welcome-title">Bem-vindo!</h1>
                <p class="welcome-desc">
                    Divulgue iniciativas oficiais, alcance seguidores locais em tempo real e gira a presença institucional no mapa.
                </p>
                <div class="welcome-feature-pills">
                    <span class="welcome-feat-chip">🏛️ Perfil Institucional</span>
                    <span class="welcome-feat-chip">✅ Selo Verificado</span>
                    <span class="welcome-feat-chip">📊 Seguidores & Eventos</span>
                </div>
                <div class="welcome-loader-track">
                    <div class="welcome-loader-fill"></div>
                </div>
            </div>
        `;
    } else {
        splash.innerHTML = `
            <div class="welcome-content">
                <div class="welcome-logo-pill">📍 LocalSpot · Mapa Social 3D</div>
                <div class="welcome-wave-wrap"><span class="welcome-wave-emoji">👋</span></div>
                <h1 class="welcome-title">Bem-vindo!</h1>
                <p class="welcome-desc">
                    Descobre eventos perto de ti, liga-te aos teus amigos em tempo real e segue as tuas entidades favoritas.
                </p>
                <div class="welcome-feature-pills">
                    <span class="welcome-feat-chip">🗺️ Mapa 3D ao vivo</span>
                    <span class="welcome-feat-chip">👊 Amigos & Bumps</span>
                    <span class="welcome-feat-chip">💬 Chat em Tempo Real</span>
                </div>
                <div class="welcome-loader-track">
                    <div class="welcome-loader-fill"></div>
                </div>
            </div>
        `;
    }

    document.body.appendChild(splash);

    clearTimeout(welcomeSplashTimer);
    welcomeSplashTimer = setTimeout(() => {
        splash.classList.add("leaving");
        setTimeout(() => {
            splash.remove();
            if (currentUser && currentProfile && currentProfile.onboarding_completed === false && !isAdminAccount()) {
                startOnboardingWizard();
            }
        }, 550);
    }, 3000);
}

function startOnboardingWizard() {
    const isBiz = isBusinessAccount();
    onboardingStep = 1;
    onboardingData.fullName = currentProfile?.full_name || "";
    onboardingData.bio = currentProfile?.bio || "";
    onboardingData.birthDate = currentProfile?.birth_date || "";
    onboardingData.businessType = currentProfile?.business_type || "Empresa / Comércio";
    onboardingData.avatarFile = null;
    onboardingData.avatarPreviewUrl = currentProfile?.avatar_url || null;
    onboardingData.statusEmoji = isBiz ? (isEntityVerified(currentProfile) ? "✅" : "🏢") : (currentProfile?.status_emoji || "📍");
    onboardingData.statusText = isBiz ? (currentProfile?.business_type || "Entidade Oficial") : (currentProfile?.status_text || "No LocalSpot");
    onboardingData.privacyMode = currentProfile?.privacy_mode || (isBiz ? "ghost" : "precise");

    let overlay = $("onboardingOverlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "onboardingOverlay";
        overlay.className = "onboarding-overlay";
        overlay.innerHTML = `<div id="onboardingCard" class="onboarding-card"></div>`;
        document.body.appendChild(overlay);
    }

    const card = $("onboardingCard");
    if (card) card.classList.toggle("business-card", isBiz);

    overlay.classList.remove("hidden");
    renderOnboardingStep();
}

function renderOnboardingStep() {
    const card = $("onboardingCard");
    if (!card) return;
    const isBiz = isBusinessAccount();
    const totalSteps = 4;
    const pct = Math.round((onboardingStep / totalSteps) * 100);

    let stepBody = "";

    if (isBiz) {
        if (onboardingStep === 1) {
            stepBody = `
                <div class="onboarding-step-panel">
                    <div class="onboarding-step-emoji">👔</div>
                    <h2>Identidade Institucional</h2>
                    <p class="ob-sub">Configure o nome oficial da empresa ou organismo público que aparecerá aos seus seguidores.</p>
                    <label style="display:block; font-size:12.5px; font-weight:700; margin-bottom:6px;">Nome Oficial da Entidade / Empresa *</label>
                    <input type="text" id="obNameInput" value="${escapeHTML(onboardingData.fullName)}" placeholder="Ex: Câmara Municipal / Teatro Municipal" maxlength="60" required>
                    <label style="display:block; font-size:12.5px; font-weight:700; margin-bottom:6px;">Apresentação ou Missão Institucional (opcional)</label>
                    <input type="text" id="obBioInput" value="${escapeHTML(onboardingData.bio)}" placeholder="Ex: Programação cultural, desportiva e comunitária" maxlength="110">
                    <div class="onboarding-nav-row">
                        <button type="button" id="obNextBtn" class="ob-btn-next">Continuar →</button>
                    </div>
                </div>
            `;
        } else if (onboardingStep === 2) {
            stepBody = `
                <div class="onboarding-step-panel">
                    <div class="onboarding-step-emoji">💼</div>
                    <h2>Setor de Atividade</h2>
                    <p class="ob-sub">Selecione a categoria que melhor representa a sua organização ou domínio público.</p>
                    <div id="obBusinessSectorGrid" class="business-sector-grid">
                        ${BUSINESS_SECTORS.map(s => `
                            <button type="button" class="sector-opt-btn${onboardingData.businessType === s.label ? " active" : ""}" data-sector="${escapeHTML(s.label)}">
                                ${s.emoji} ${escapeHTML(s.label)}
                            </button>
                        `).join("")}
                    </div>
                    <div class="onboarding-nav-row">
                        <button type="button" id="obBackBtn" class="ob-btn-back">← Voltar</button>
                        <button type="button" id="obNextBtn" class="ob-btn-next">Continuar →</button>
                    </div>
                </div>
            `;
        } else if (onboardingStep === 3) {
            const initials = (onboardingData.fullName || "E").trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join("");
            const avatarInner = onboardingData.avatarPreviewUrl
                ? `<img src="${escapeHTML(onboardingData.avatarPreviewUrl)}" alt="">`
                : escapeHTML(initials);

            stepBody = `
                <div class="onboarding-step-panel">
                    <div class="onboarding-step-emoji">🏛️</div>
                    <h2>Logótipo Oficial</h2>
                    <p class="ob-sub">Carregue o logótipo ou imagem representativa da entidade para destacar a sua página e eventos.</p>
                    <div class="ob-avatar-picker">
                        <label for="obAvatarFile" class="ob-avatar-circle business-logo-shape" id="obAvatarCircle" title="Carregar logótipo">${avatarInner}</label>
                        <input type="file" id="obAvatarFile" accept="image/*" class="hidden">
                        <button type="button" class="btn-soft" onclick="$('obAvatarFile').click()">🏢 Carregar Logótipo</button>
                    </div>
                    <div class="onboarding-nav-row">
                        <button type="button" id="obBackBtn" class="ob-btn-back">← Voltar</button>
                        <button type="button" id="obNextBtn" class="ob-btn-next">Continuar →</button>
                    </div>
                </div>
            `;
        } else if (onboardingStep === 4) {
            stepBody = `
                <div class="onboarding-step-panel">
                    <div class="onboarding-step-emoji">📊</div>
                    <h2>Presença no Mapa & Verificação</h2>
                    <p class="ob-sub">Defina como a sua entidade é apresentada aos seus seguidores no mapa.</p>
                    <div id="obPrivacyGrid" class="privacy-selector-grid two-cols">
                        <button type="button" class="privacy-opt-btn business-opt${onboardingData.privacyMode === "precise" ? " active" : ""}" data-mode="precise">🏢 Sede Visível no Mapa</button>
                        <button type="button" class="privacy-opt-btn business-opt${onboardingData.privacyMode === "ghost" ? " active" : ""}" data-mode="ghost">📅 Apenas Eventos Públicos</button>
                    </div>
                    <div style="background:var(--bg); border:1px solid var(--border); border-radius:12px; padding:12px; font-size:12.5px; color:var(--muted); margin-bottom:10px;">
                        ✅ <strong>Selo de Verificação:</strong> Após concluir, um Administrador poderá validar a sua conta para atribuir o selo oficial de entidade verificada.
                    </div>
                    <div class="onboarding-nav-row">
                        <button type="button" id="obBackBtn" class="ob-btn-back">← Voltar</button>
                        <button type="button" id="obFinishBtn" class="ob-btn-next">Concluir Configuração 🏛️</button>
                    </div>
                </div>
            `;
        }
    } else {
        if (onboardingStep === 1) {
            stepBody = `
                <div class="onboarding-step-panel">
                    <div class="onboarding-step-emoji">✨</div>
                    <h2>Como queres ser chamado?</h2>
                    <p class="ob-sub">Este é o nome que os teus amigos vão ver no mapa e nos eventos.</p>
                    <label style="display:block; font-size:12.5px; font-weight:700; margin-bottom:6px;">Nome ou Alcunha *</label>
                    <input type="text" id="obNameInput" value="${escapeHTML(onboardingData.fullName)}" placeholder="Ex: Rodrigo Silva" maxlength="40" required>
                    <label style="display:block; font-size:12.5px; font-weight:700; margin-bottom:6px;">Bio rápida (opcional)</label>
                    <input type="text" id="obBioInput" value="${escapeHTML(onboardingData.bio)}" placeholder="Ex: Sempre pronto para um café ou concerto 🎸" maxlength="80">
                    <div class="onboarding-nav-row">
                        <button type="button" id="obNextBtn" class="ob-btn-next">Continuar →</button>
                    </div>
                </div>
            `;
        } else if (onboardingStep === 2) {
            const info = getAgeAndZodiac(onboardingData.birthDate);
            const maxDate = new Date().toISOString().slice(0, 10);
            stepBody = `
                <div class="onboarding-step-panel">
                    <div class="onboarding-step-emoji">🎂</div>
                    <h2>Quando fazes anos?</h2>
                    <p class="ob-sub">Usamos a tua data de nascimento para personalizar o teu perfil.</p>
                    <input type="date" id="obBirthInput" value="${escapeHTML(onboardingData.birthDate)}" max="${maxDate}">
                    <div id="obZodiacWrap">
                        ${info ? `<div class="zodiac-preview-pill">🎉 ${info.age} anos · ${info.sign.emoji} ${info.sign.name}</div>` : ""}
                    </div>
                    <div class="onboarding-nav-row">
                        <button type="button" id="obBackBtn" class="ob-btn-back">← Voltar</button>
                        <button type="button" id="obNextBtn" class="ob-btn-next">Continuar →</button>
                    </div>
                </div>
            `;
        } else if (onboardingStep === 3) {
            const initials = (onboardingData.fullName || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join("");
            const avatarInner = onboardingData.avatarPreviewUrl
                ? `<img src="${escapeHTML(onboardingData.avatarPreviewUrl)}" alt="">`
                : escapeHTML(initials);

            stepBody = `
                <div class="onboarding-step-panel">
                    <div class="onboarding-step-emoji">📸</div>
                    <h2>Escolhe a tua foto & vibe</h2>
                    <p class="ob-sub">Toca no círculo para carregar uma foto de perfil e escolhe o teu estado inicial.</p>
                    <div class="ob-avatar-picker">
                        <label for="obAvatarFile" class="ob-avatar-circle" id="obAvatarCircle" title="Escolher foto">${avatarInner}</label>
                        <input type="file" id="obAvatarFile" accept="image/*" class="hidden">
                        <button type="button" class="btn-soft" onclick="$('obAvatarFile').click()">📷 Escolher Foto</button>
                    </div>
                    <div id="obStatusPills" class="status-pills-grid" style="justify-content:center;">
                        ${BUMP_STATUSES.map(s => `
                            <button type="button" class="status-pill-btn${onboardingData.statusEmoji === s.emoji && onboardingData.statusText === s.text ? " active" : ""}" data-emoji="${s.emoji}" data-text="${s.text}">
                                ${s.emoji} ${s.text}
                            </button>
                        `).join("")}
                    </div>
                    <div class="onboarding-nav-row">
                        <button type="button" id="obBackBtn" class="ob-btn-back">← Voltar</button>
                        <button type="button" id="obNextBtn" class="ob-btn-next">Continuar →</button>
                    </div>
                </div>
            `;
        } else if (onboardingStep === 4) {
            stepBody = `
                <div class="onboarding-step-panel">
                    <div class="onboarding-step-emoji">🛰️</div>
                    <h2>Privacidade no Mapa</h2>
                    <p class="ob-sub">Apenas os teus amigos aceites podem ver a tua localização. Podes mudar isto a qualquer momento.</p>
                    <div id="obPrivacyGrid" class="privacy-selector-grid">
                        <button type="button" class="privacy-opt-btn${onboardingData.privacyMode === "precise" ? " active" : ""}" data-mode="precise">📍 Precisa</button>
                        <button type="button" class="privacy-opt-btn${onboardingData.privacyMode === "blurred" ? " active" : ""}" data-mode="blurred">🌫️ Borrão</button>
                        <button type="button" class="privacy-opt-btn${onboardingData.privacyMode === "ghost" ? " active" : ""}" data-mode="ghost">👻 Fantasma</button>
                    </div>
                    <div style="background:var(--bg); border:1px solid var(--border); border-radius:12px; padding:12px; font-size:12.5px; color:var(--muted); margin-bottom:10px;">
                        💡 <strong>Dica Bump:</strong> Abana o telemóvel perto de um amigo para fazer um <strong>Bump</strong> instantâneo no mapa!
                    </div>
                    <div class="onboarding-nav-row">
                        <button type="button" id="obBackBtn" class="ob-btn-back">← Voltar</button>
                        <button type="button" id="obFinishBtn" class="ob-btn-next">Entrar no Mapa 🎉</button>
                    </div>
                </div>
            `;
        }
    }

    card.innerHTML = `
        <div class="onboarding-top-bar">
            <div class="onboarding-progress-track">
                <div class="onboarding-progress-fill" style="width:${pct}%;"></div>
            </div>
            <span class="onboarding-step-counter">Passo ${onboardingStep} de ${totalSteps}</span>
        </div>
        ${stepBody}
    `;

    if ($("obBackBtn")) {
        $("obBackBtn").onclick = () => {
            onboardingStep = Math.max(1, onboardingStep - 1);
            renderOnboardingStep();
        };
    }

    if (onboardingStep === 1) {
        const nameInp = $("obNameInput");
        setTimeout(() => nameInp.focus(), 60);
        $("obNextBtn").onclick = () => {
            const val = nameInp.value.trim();
            if (!val) {
                showToast(isBiz ? "Indique o nome oficial da entidade!" : "Escreve o teu nome para continuar!", "error");
                nameInp.focus();
                return;
            }
            onboardingData.fullName = val;
            onboardingData.bio = $("obBioInput").value.trim();
            onboardingStep = 2;
            renderOnboardingStep();
        };
    } else if (onboardingStep === 2) {
        if (isBiz) {
            $("obBusinessSectorGrid").onclick = e => {
                const btn = e.target.closest(".sector-opt-btn");
                if (!btn) return;
                $("obBusinessSectorGrid").querySelectorAll(".sector-opt-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                onboardingData.businessType = btn.dataset.sector;
            };
            $("obNextBtn").onclick = () => {
                onboardingStep = 3;
                renderOnboardingStep();
            };
        } else {
            const birthInp = $("obBirthInput");
            birthInp.onchange = () => {
                onboardingData.birthDate = birthInp.value;
                const info = getAgeAndZodiac(birthInp.value);
                $("obZodiacWrap").innerHTML = info
                    ? `<div class="zodiac-preview-pill">🎉 ${info.age} anos · ${info.sign.emoji} ${info.sign.name}</div>`
                    : "";
            };
            $("obNextBtn").onclick = () => {
                if (!birthInp.value) {
                    showToast("Seleciona a tua data de nascimento!", "error");
                    birthInp.focus();
                    return;
                }
                onboardingData.birthDate = birthInp.value;
                onboardingStep = 3;
                renderOnboardingStep();
            };
        }
    } else if (onboardingStep === 3) {
        $("obAvatarFile").onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            onboardingData.avatarFile = file;
            onboardingData.avatarPreviewUrl = URL.createObjectURL(file);
            $("obAvatarCircle").innerHTML = `<img src="${onboardingData.avatarPreviewUrl}" alt="">`;
        };
        if (!isBiz && $("obStatusPills")) {
            $("obStatusPills").onclick = e => {
                const btn = e.target.closest(".status-pill-btn");
                if (!btn) return;
                $("obStatusPills").querySelectorAll(".status-pill-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                onboardingData.statusEmoji = btn.dataset.emoji;
                onboardingData.statusText = btn.dataset.text;
            };
        }
        $("obNextBtn").onclick = () => {
            onboardingStep = 4;
            renderOnboardingStep();
        };
    } else if (onboardingStep === 4) {
        $("obPrivacyGrid").onclick = e => {
            const btn = e.target.closest(".privacy-opt-btn");
            if (!btn) return;
            $("obPrivacyGrid").querySelectorAll(".privacy-opt-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            onboardingData.privacyMode = btn.dataset.mode;
        };
        $("obFinishBtn").onclick = finishOnboardingWizard;
    }
}

async function finishOnboardingWizard() {
    const btn = $("obFinishBtn");
    const isBiz = isBusinessAccount();
    if (btn) {
        btn.disabled = true;
        btn.textContent = isBiz ? "A guardar perfil institucional..." : "A preparar o teu mapa...";
    }

    try {
        let avatarUrl = currentProfile?.avatar_url || null;
        if (onboardingData.avatarFile) {
            avatarUrl = await uploadAvatarImage(onboardingData.avatarFile);
        }

        const isGhost = onboardingData.privacyMode === "ghost";
        const updatePayload = {
            full_name: onboardingData.fullName || currentProfile.full_name,
            bio: onboardingData.bio,
            birth_date: isBiz ? null : (onboardingData.birthDate || null),
            business_type: isBiz ? onboardingData.businessType : currentProfile.business_type,
            avatar_url: avatarUrl,
            status_emoji: isBiz ? (isEntityVerified(currentProfile) ? "✅" : "🏢") : onboardingData.statusEmoji,
            status_text: isBiz ? onboardingData.businessType : onboardingData.statusText,
            privacy_mode: onboardingData.privacyMode,
            ghost_mode: isGhost,
            onboarding_completed: true
        };

        await supabaseClient.from("profiles").update(updatePayload).eq("id", currentUser.id);
        Object.assign(currentProfile, updatePayload);
        applyRoleUI();

        const overlay = $("onboardingOverlay");
        if (overlay) overlay.classList.add("hidden");

        if (isBiz) {
            triggerBumpVisual("🏛️", `Perfil Institucional ativo: ${currentProfile.full_name}`);
        } else {
            triggerBumpVisual("🎉", `Tudo pronto, ${currentProfile.full_name}!`);
            launchEmojiBombAnimation("🚀");
        }

        if (!isGhost) {
            try { await locateUser(); } catch (e) {}
        }
    } catch (err) {
        showToast("Erro ao guardar perfil inicial.", "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = isBiz ? "Concluir Configuração 🏛️" : "Entrar no Mapa 🎉";
        }
    }
}

// ==========================================
// INJEÇÃO DA UI SOCIAL, AMIGOS & CHAT
// ==========================================
function ensureSocialUI() {
    const nav = document.querySelector(".header nav");

    if (nav && !$("friendsNavBtn")) {
        const friendsBtn = document.createElement("button");
        friendsBtn.type = "button";
        friendsBtn.id = "friendsNavBtn";
        friendsBtn.className = "btn-friends-nav hidden";
        friendsBtn.innerHTML = `👊 Amigos & Chat <span id="friendsReqBadge" class="friends-req-badge hidden">0</span>`;
        nav.insertBefore(friendsBtn, notifBtn);
    }

    if (nav && !$("entityNetworkNavBtn")) {
        const entBtn = document.createElement("button");
        entBtn.type = "button";
        entBtn.id = "entityNetworkNavBtn";
        entBtn.className = "btn-entity-nav hidden";
        entBtn.innerHTML = `🏛️ Seguidores (<span id="headerFollowersCount">0</span>)`;
        nav.insertBefore(entBtn, notifBtn);
    }

    const mapCtrls = document.querySelector(".map-floating-controls");
    if (mapCtrls && !$("privacyMapBtn")) {
        const bumpRadarBtn = document.createElement("button");
        bumpRadarBtn.type = "button";
        bumpRadarBtn.id = "bumpShakeMapBtn";
        bumpRadarBtn.className = "map-ctrl-btn hidden";
        bumpRadarBtn.style.borderColor = "#ec4899";
        bumpRadarBtn.textContent = "👊 Bump!";
        bumpRadarBtn.title = "Fazer Bump com amigo próximo ou abanar telemóvel";
        mapCtrls.appendChild(bumpRadarBtn);

        const iosPermBtn = document.createElement("button");
        iosPermBtn.type = "button";
        iosPermBtn.id = "iosShakePermMapBtn";
        iosPermBtn.className = "map-ctrl-btn ios-perm-btn hidden";
        iosPermBtn.textContent = "📳 Ativar Abanão (iPhone)";
        iosPermBtn.title = "Conceder permissão do acelerómetro no iOS/Safari";
        mapCtrls.appendChild(iosPermBtn);

        const quickMoodBtn = document.createElement("button");
        quickMoodBtn.type = "button";
        quickMoodBtn.id = "quickMoodMapBtn";
        quickMoodBtn.className = "map-ctrl-btn hidden";
        quickMoodBtn.textContent = "📍 Vibe";
        quickMoodBtn.title = "Mudar estado/emoji rapidamente no mapa";
        mapCtrls.appendChild(quickMoodBtn);

        const privacyBtn = document.createElement("button");
        privacyBtn.type = "button";
        privacyBtn.id = "privacyMapBtn";
        privacyBtn.className = "map-ctrl-btn hidden";
        privacyBtn.textContent = "📍 Precisa";
        privacyBtn.title = "Alternar visibilidade no mapa";
        mapCtrls.appendChild(privacyBtn);

        const checkinBtn = document.createElement("button");
        checkinBtn.type = "button";
        checkinBtn.id = "quickCheckinMapBtn";
        checkinBtn.className = "map-ctrl-btn hidden";
        checkinBtn.textContent = "📌 Check-in";
        checkinBtn.title = "Partilhar onde estás agora";
        mapCtrls.appendChild(checkinBtn);

        const expBtn = document.createElement("button");
        expBtn.type = "button";
        expBtn.id = "explorationMapBtn";
        expBtn.className = "map-ctrl-btn exploration-pill-btn hidden";
        expBtn.textContent = "🗺️ 0 zonas · 0,0 km";
        expBtn.title = "Mostrar/esconder o teu percurso de hoje no mapa";
        mapCtrls.appendChild(expBtn);
    }

    const mapContainer = document.querySelector(".map-container");
    if (mapContainer && !$("hangoutBanner")) {
        const hBanner = document.createElement("div");
        hBanner.id = "hangoutBanner";
        hBanner.className = "hangout-banner hidden";
        mapContainer.appendChild(hBanner);

        const moodPopover = document.createElement("div");
        moodPopover.id = "quickMoodPopover";
        moodPopover.className = "quick-mood-popover hidden";
        moodPopover.innerHTML = `
            <h4>
                <span>✨ O que estás a fazer?</span>
                <button type="button" id="closeQuickMoodBtn" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:15px;">&times;</button>
            </h4>
            <div class="quick-mood-grid">
                ${BUMP_STATUSES.map(s => `
                    <button type="button" class="quick-mood-item" data-emoji="${s.emoji}" data-text="${s.text}">
                        ${s.emoji} ${s.text}
                    </button>
                `).join("")}
            </div>
            <div style="display:flex; gap:6px;">
                <input type="text" id="quickCustomMoodEmoji" maxlength="4" placeholder="😎" style="width:46px; text-align:center; padding:6px;">
                <input type="text" id="quickCustomMoodText" maxlength="32" placeholder="Estado personalizado..." style="flex:1; padding:6px 8px; font-size:12px;">
                <button type="button" id="saveQuickCustomMoodBtn" class="btn-primary-sm" style="padding:6px 10px;">OK</button>
            </div>
        `;
        mapContainer.appendChild(moodPopover);
    }

    const profileForm = $("profileUpdateForm");
    if (profileForm && !$("profileAvatarBox")) {
        const statsBar = document.createElement("div");
        statsBar.id = "profileStatsBar";
        statsBar.className = "profile-stats-bar";
        profileForm.parentElement.insertBefore(statsBar, profileForm.parentElement.querySelector(".profile-edit-box"));

        const avatarSection = document.createElement("div");
        avatarSection.id = "profileAvatarBox";
        avatarSection.style.marginBottom = "12px";
        avatarSection.innerHTML = `
            <div style="display:flex; align-items:center; gap:14px; margin-bottom:12px;">
                <div id="profileAvatarPreview" class="avatar-circle lg">?</div>
                <div style="flex:1;">
                    <label id="profileAvatarLabel" for="profileAvatarInput" style="margin:0 0 6px;">Foto de Perfil</label>
                    <input type="file" id="profileAvatarInput" accept="image/*" style="padding:6px; font-size:12px;">
                </div>
            </div>

            <div id="businessOnlyProfileFields" class="hidden">
                <label for="profileBusinessTypeSelect">Setor / Tipologia da Entidade</label>
                <select id="profileBusinessTypeSelect" style="margin-bottom:12px;">
                    ${BUSINESS_SECTORS.map(s => `<option value="${escapeHTML(s.label)}">${s.emoji} ${escapeHTML(s.label)}</option>`).join("")}
                </select>
                <label>Visibilidade da Sede no Mapa</label>
                <div id="businessPrivacyGrid" class="privacy-selector-grid two-cols">
                    <button type="button" class="privacy-opt-btn business-opt" data-mode="precise">🏢 Sede Visível</button>
                    <button type="button" class="privacy-opt-btn business-opt" data-mode="ghost">📅 Apenas Eventos</button>
                </div>
            </div>

            <div id="userOnlyProfileFields">
                <label for="profileBirthDateInput">Data de Nascimento</label>
                <input type="date" id="profileBirthDateInput" style="margin-bottom:10px;">
                <label>Estado / Vibe atual (visível apenas para amigos no mapa)</label>
                <div id="statusPillsContainer" class="status-pills-grid">
                    ${BUMP_STATUSES.map(s => `
                        <button type="button" class="status-pill-btn" data-emoji="${s.emoji}" data-text="${s.text}">${s.emoji} ${s.text}</button>
                    `).join("")}
                </div>
                <div style="display:grid; grid-template-columns: 64px 1fr; gap:8px; margin-bottom:12px;">
                    <input type="text" id="profileCustomEmoji" maxlength="4" placeholder="📍" style="text-align:center;">
                    <input type="text" id="profileCustomStatus" maxlength="40" placeholder="Escreve o teu estado personalizado...">
                </div>
                <label>Privacidade da localização no mapa</label>
                <div id="privacySelectorGrid" class="privacy-selector-grid">
                    <button type="button" class="privacy-opt-btn" data-mode="precise">📍 Precisa</button>
                    <button type="button" class="privacy-opt-btn" data-mode="blurred">🌫️ Borrão (~400m)</button>
                    <button type="button" class="privacy-opt-btn" data-mode="ghost">👻 Fantasma</button>
                </div>
            </div>

            <div style="text-align:right; margin-bottom:8px;">
                <button type="button" id="replayOnboardingBtn" class="btn-link small">✨ Repetir introdução e questionário</button>
            </div>
        `;
        profileForm.insertBefore(avatarSection, profileForm.firstChild);
    }

    const tabFollowing = $("tabMyFollowing");
    if (tabFollowing && !$("tabMyFriends")) {
        const friendsTab = document.createElement("button");
        friendsTab.type = "button";
        friendsTab.id = "tabMyFriends";
        friendsTab.className = "auth-tab";
        friendsTab.textContent = "Amigos";
        tabFollowing.parentElement.insertBefore(friendsTab, tabFollowing);

        const friendsPanel = document.createElement("div");
        friendsPanel.id = "profileFriendsList";
        friendsPanel.className = "profile-events-list hidden";
        $("profileFollowingList").parentElement.insertBefore(friendsPanel, $("profileFollowingList"));
    }

    if (!$("friendsModal")) {
        const fModal = document.createElement("div");
        fModal.id = "friendsModal";
        fModal.className = "modal hidden";
        fModal.setAttribute("aria-hidden", "true");
        fModal.innerHTML = `
            <div class="modal-content">
                <button type="button" id="closeFriendsModal" class="close-button" aria-label="Fechar">&times;</button>
                <div style="display:flex; justify-content:space-between; align-items:center; padding-right:34px; margin-bottom:4px;">
                    <h2 style="margin:0;">👊 Amigos & Chat</h2>
                    <button type="button" id="enableBgNotifBumpBtn" class="btn-soft" style="font-size:11.5px; padding:5px 9px;">🔔 Alertas</button>
                </div>
                <p style="color:var(--muted); font-size:13px; margin:0 0 14px;">Conversa em tempo real, envia pedidos de amizade e faz Bumps! ⚡</p>
                
                <div class="auth-tabs three-cols" style="margin-bottom:14px;">
                    <button type="button" id="tabFriendsList" class="auth-tab active">👥 Amigos (<span id="friendsTabCount">0</span>)</button>
                    <button type="button" id="tabFriendsChats" class="auth-tab">💬 Conversas <span id="chatsTabUnreadBadge" class="friends-req-badge hidden">0</span></button>
                    <button type="button" id="tabFriendsAdd" class="auth-tab">🔍 Adicionar (<span id="requestsTabCount">0</span>)</button>
                </div>

                <div id="panelFriendsList">
                    <div id="bumpLeaderboardSection"></div>
                    <div id="friendsContainerList"></div>
                </div>

                <div id="panelFriendsChats" class="hidden">
                    <div id="chatsListContainer"></div>
                </div>

                <div id="panelFriendsAdd" class="hidden">
                    <div id="incomingRequestsSection" style="margin-bottom:16px;"></div>
                    <label for="friendSearchInput">Procurar utilizadores (para amizade) ou entidades (para seguir)</label>
                    <div style="display:flex; gap:8px; margin-bottom:12px;">
                        <input type="text" id="friendSearchInput" placeholder="Ex: Maria, Câmara Municipal, joao@email.com...">
                        <button type="button" id="friendSearchBtn" class="btn-primary-sm">Procurar</button>
                    </div>
                    <div id="friendSearchResults"></div>
                </div>
            </div>
        `;
        document.body.appendChild(fModal);
    }

    if (!$("entityNetworkModal")) {
        const eModal = document.createElement("div");
        eModal.id = "entityNetworkModal";
        eModal.className = "modal hidden";
        eModal.setAttribute("aria-hidden", "true");
        eModal.innerHTML = `
            <div class="modal-content">
                <button type="button" id="closeEntityNetworkModal" class="close-button" aria-label="Fechar">&times;</button>
                <h2 style="margin:0 0 4px;">🏛️ Rede Institucional</h2>
                <p style="color:var(--muted); font-size:13px; margin:0 0 14px;">Gira os seguidores da sua entidade e acompanhe outras organizações verificadas.</p>
                
                <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:6px; background:var(--bg); padding:4px; border-radius:10px; margin-bottom:14px;">
                    <button type="button" id="tabEntFollowers" class="auth-tab active">👥 Seguidores (<span id="entFollowersTabCount">0</span>)</button>
                    <button type="button" id="tabEntFollowing" class="auth-tab">🏛️ A Seguir (<span id="entFollowingTabCount">0</span>)</button>
                    <button type="button" id="tabEntDiscover" class="auth-tab">🔍 Seguir</button>
                </div>

                <div id="panelEntFollowers">
                    <div id="entFollowersListContainer"></div>
                </div>

                <div id="panelEntFollowing" class="hidden">
                    <div id="entFollowingListContainer"></div>
                </div>

                <div id="panelEntDiscover" class="hidden">
                    <label for="entitySearchInput">Procurar empresas ou entidades públicas para seguir</label>
                    <div style="display:flex; gap:8px; margin-bottom:12px;">
                        <input type="text" id="entitySearchInput" placeholder="Ex: Câmara Municipal, Associação, Teatro...">
                        <button type="button" id="entitySearchBtn" class="btn-primary-sm">Procurar</button>
                    </div>
                    <div id="entitySearchResults"></div>
                </div>
            </div>
        `;
        document.body.appendChild(eModal);
    }

    if (!$("friendChatModal")) {
        const chatModal = document.createElement("div");
        chatModal.id = "friendChatModal";
        chatModal.className = "modal hidden";
        chatModal.setAttribute("aria-hidden", "true");
        chatModal.innerHTML = `
            <div class="modal-content" style="width:450px;">
                <button type="button" id="closeFriendChatModal" class="close-button" aria-label="Fechar">&times;</button>
                <div id="chatFriendHeader" style="display:flex; align-items:center; gap:10px; margin-bottom:10px;"></div>
                
                <div class="emoji-bomb-bar" title="Enviar chuva de emojis em tempo real!">
                    <button type="button" class="emoji-bomb-btn" data-bomb="👊">👊</button>
                    <button type="button" class="emoji-bomb-btn" data-bomb="🔥">🔥</button>
                    <button type="button" class="emoji-bomb-btn" data-bomb="❤️">❤️</button>
                    <button type="button" class="emoji-bomb-btn" data-bomb="😂">😂</button>
                    <button type="button" class="emoji-bomb-btn" data-bomb="🎉">🎉</button>
                    <button type="button" class="emoji-bomb-btn" data-bomb="👀">👀</button>
                </div>

                <div id="chatQuickRepliesBar" class="chat-quick-replies">
                    <button type="button" class="chat-quick-pill" data-msg="📍 Onde estás?">📍 Onde estás?</button>
                    <button type="button" class="chat-quick-pill" data-msg="👊 Bora dar Bump!">👊 Bora dar Bump!</button>
                    <button type="button" class="chat-quick-pill" data-msg="☕ Vamos tomar café?">☕ Café?</button>
                    <button type="button" class="chat-quick-pill" data-msg="🎉 Vou a um evento, vens?">🎉 Bora a um evento?</button>
                </div>

                <div id="chatMessagesBox" class="chat-messages-box"></div>
                <div id="chatTypingIndicator" class="typing-indicator-pill"></div>

                <form id="friendChatForm" style="display:flex; gap:8px;">
                    <input type="text" id="friendChatInput" placeholder="Escreve uma mensagem..." required autocomplete="off">
                    <button type="submit" class="btn-primary-sm">Enviar</button>
                </form>
            </div>
        `;
        document.body.appendChild(chatModal);
    }

    bindSocialEvents();
}

function attachShakeSensorListener() {
    if (shakeSensorBound) return;
    shakeSensorBound = true;
    window.addEventListener("devicemotion", e => {
        if (!currentUser || !isNormalUserAccount()) return;
        const acc = e.accelerationIncludingGravity || e.acceleration;
        if (!acc) return;
        const totalForce = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
        if (totalForce > 24 && Date.now() - lastShakeTime > 2500) {
            lastShakeTime = Date.now();
            performSmartBumpAction(true);
        }
    });
}

function setupMotionSensorWithIOSPermission() {
    const iosBtn = $("iosShakePermMapBtn");
    if (
        typeof DeviceMotionEvent !== "undefined" &&
        typeof DeviceMotionEvent.requestPermission === "function"
    ) {
        if (iosBtn && isNormalUserAccount()) {
            iosBtn.classList.remove("hidden");
            iosBtn.onclick = async () => {
                try {
                    const perm = await DeviceMotionEvent.requestPermission();
                    if (perm === "granted") {
                        iosBtn.classList.add("hidden");
                        attachShakeSensorListener();
                        showToast("📳 Sensor ativado! Abana o iPhone para fazer Bump.", "success");
                    } else {
                        showToast("Permissão do acelerómetro recusada.", "error");
                    }
                } catch (e) {
                    showToast("Não foi possível ativar o sensor.", "error");
                }
            };
        }
    } else {
        attachShakeSensorListener();
    }
}

function bindSocialEvents() {
    const friendsNavBtn = $("friendsNavBtn");
    const friendsModal = $("friendsModal");
    if (friendsNavBtn && !friendsNavBtn.dataset.bound) {
        friendsNavBtn.dataset.bound = "1";
        friendsNavBtn.addEventListener("click", async () => {
            openModal(friendsModal);
            await Promise.all([loadSocialData(), loadRecentChatSummaries()]);
        });
    }

    const bgNotifBtn = $("enableBgNotifBumpBtn");
    if (bgNotifBtn && !bgNotifBtn.dataset.bound) {
        bgNotifBtn.dataset.bound = "1";
        bgNotifBtn.addEventListener("click", async () => {
            if (!("Notification" in window)) {
                showToast("O teu navegador não suporta notificações.", "error");
                return;
            }
            const perm = await Notification.requestPermission();
            if (perm === "granted") {
                showToast("🔔 Alertas ativados mesmo em segundo plano!", "success");
            }
        });
    }

    const closeFriendsBtn = $("closeFriendsModal");
    if (closeFriendsBtn && !closeFriendsBtn.dataset.bound) {
        closeFriendsBtn.dataset.bound = "1";
        closeFriendsBtn.addEventListener("click", () => closeModalEl(friendsModal));
        friendsModal.addEventListener("mousedown", e => { if (e.target === friendsModal) closeModalEl(friendsModal); });
    }

    const entNavBtn = $("entityNetworkNavBtn");
    const entModal = $("entityNetworkModal");
    if (entNavBtn && !entNavBtn.dataset.bound) {
        entNavBtn.dataset.bound = "1";
        entNavBtn.addEventListener("click", async () => {
            openModal(entModal);
            await Promise.all([loadMyFollowers(), loadMyFollowing()]);
            renderEntityNetworkModal();
        });
    }

    const closeEntBtn = $("closeEntityNetworkModal");
    if (closeEntBtn && !closeEntBtn.dataset.bound) {
        closeEntBtn.dataset.bound = "1";
        closeEntBtn.addEventListener("click", () => closeModalEl(entModal));
        entModal.addEventListener("mousedown", e => { if (e.target === entModal) closeModalEl(entModal); });
    }

    if ($("tabEntFollowers") && !$("tabEntFollowers").dataset.bound) {
        $("tabEntFollowers").dataset.bound = "1";
        const switchEntTab = (activeId) => {
            ["tabEntFollowers", "tabEntFollowing", "tabEntDiscover"].forEach(id => $(id).classList.toggle("active", id === activeId));
            $("panelEntFollowers").classList.toggle("hidden", activeId !== "tabEntFollowers");
            $("panelEntFollowing").classList.toggle("hidden", activeId !== "tabEntFollowing");
            $("panelEntDiscover").classList.toggle("hidden", activeId !== "tabEntDiscover");
        };
        $("tabEntFollowers").addEventListener("click", () => switchEntTab("tabEntFollowers"));
        $("tabEntFollowing").addEventListener("click", () => switchEntTab("tabEntFollowing"));
        $("tabEntDiscover").addEventListener("click", () => {
            switchEntTab("tabEntDiscover");
            searchEntitiesToFollow();
        });
        $("entitySearchBtn").addEventListener("click", searchEntitiesToFollow);
        $("entitySearchInput").addEventListener("keydown", e => {
            if (e.key === "Enter") { e.preventDefault(); searchEntitiesToFollow(); }
        });
    }

    const closeChatBtn = $("closeFriendChatModal");
    const chatModal = $("friendChatModal");
    if (closeChatBtn && !closeChatBtn.dataset.bound) {
        closeChatBtn.dataset.bound = "1";
        closeChatBtn.addEventListener("click", () => {
            activeChatFriendId = null;
            closeModalEl(chatModal);
        });
        chatModal.addEventListener("mousedown", e => {
            if (e.target === chatModal) {
                activeChatFriendId = null;
                closeModalEl(chatModal);
            }
        });
    }

    const chatInput = $("friendChatInput");
    if (chatInput && !chatInput.dataset.bound) {
        chatInput.dataset.bound = "1";
        chatInput.addEventListener("input", () => {
            if (!activeChatFriendId || !bumpBroadcastChannel) return;
            bumpBroadcastChannel.send({
                type: "broadcast",
                event: "typing_indicator",
                payload: { senderId: currentUser.id, receiverId: activeChatFriendId }
            });
        });
    }

    const chatForm = $("friendChatForm");
    if (chatForm && !chatForm.dataset.bound) {
        chatForm.dataset.bound = "1";
        chatForm.addEventListener("submit", async e => {
            e.preventDefault();
            if (!activeChatFriendId) return;
            const input = $("friendChatInput");
            const text = input.value.trim();
            if (!text) return;
            input.value = "";
            await sendDirectMessage(activeChatFriendId, text, "text");
        });
    }

    const bombBar = document.querySelector(".emoji-bomb-bar");
    if (bombBar && !bombBar.dataset.bound) {
        bombBar.dataset.bound = "1";
        bombBar.addEventListener("click", async e => {
            const btn = e.target.closest(".emoji-bomb-btn");
            if (!btn || !activeChatFriendId) return;
            const emoji = btn.dataset.bomb;
            launchEmojiBombAnimation(emoji);
            await sendDirectMessage(activeChatFriendId, emoji, "emoji_bomb");
        });
    }

    const quickRepliesBar = $("chatQuickRepliesBar");
    if (quickRepliesBar && !quickRepliesBar.dataset.bound) {
        quickRepliesBar.dataset.bound = "1";
        quickRepliesBar.addEventListener("click", async e => {
            const pill = e.target.closest(".chat-quick-pill");
            if (!pill || !activeChatFriendId) return;
            await sendDirectMessage(activeChatFriendId, pill.dataset.msg, "text");
        });
    }

    const tabList = $("tabFriendsList");
    const tabChats = $("tabFriendsChats");
    const tabAdd = $("tabFriendsAdd");
    if (tabList && !tabList.dataset.bound) {
        tabList.dataset.bound = "1";
        const switchFriendsTab = (activeId) => {
            ["tabFriendsList", "tabFriendsChats", "tabFriendsAdd"].forEach(id => $(id).classList.toggle("active", id === activeId));
            $("panelFriendsList").classList.toggle("hidden", activeId !== "tabFriendsList");
            $("panelFriendsChats").classList.toggle("hidden", activeId !== "tabFriendsChats");
            $("panelFriendsAdd").classList.toggle("hidden", activeId !== "tabFriendsAdd");
        };
        tabList.addEventListener("click", () => switchFriendsTab("tabFriendsList"));
        tabChats.addEventListener("click", async () => {
            switchFriendsTab("tabFriendsChats");
            await loadRecentChatSummaries();
        });
        tabAdd.addEventListener("click", () => switchFriendsTab("tabFriendsAdd"));
    }

    const searchBtn = $("friendSearchBtn");
    const searchInp = $("friendSearchInput");
    if (searchBtn && !searchBtn.dataset.bound) {
        searchBtn.dataset.bound = "1";
        searchBtn.addEventListener("click", searchUsersAndEntities);
        searchInp.addEventListener("keydown", e => {
            if (e.key === "Enter") { e.preventDefault(); searchUsersAndEntities(); }
        });
    }

    const bumpShakeBtn = $("bumpShakeMapBtn");
    if (bumpShakeBtn && !bumpShakeBtn.dataset.bound) {
        bumpShakeBtn.dataset.bound = "1";
        bumpShakeBtn.addEventListener("click", () => performSmartBumpAction(false));
    }

    const quickMoodBtn = $("quickMoodMapBtn");
    const moodPopover = $("quickMoodPopover");
    if (quickMoodBtn && !quickMoodBtn.dataset.bound) {
        quickMoodBtn.dataset.bound = "1";
        quickMoodBtn.addEventListener("click", e => {
            e.stopPropagation();
            moodPopover.classList.toggle("hidden");
        });
        $("closeQuickMoodBtn").addEventListener("click", () => moodPopover.classList.add("hidden"));
        moodPopover.addEventListener("click", async e => {
            const item = e.target.closest(".quick-mood-item");
            if (!item) return;
            moodPopover.classList.add("hidden");
            await updateQuickUserMood(item.dataset.emoji, item.dataset.text);
        });
        $("saveQuickCustomMoodBtn").addEventListener("click", async () => {
            const emoji = ($("quickCustomMoodEmoji").value || "📍").trim() || "📍";
            const text = ($("quickCustomMoodText").value || "No LocalSpot").trim() || "No LocalSpot";
            moodPopover.classList.add("hidden");
            await updateQuickUserMood(emoji, text);
        });
    }

    const expMapBtn = $("explorationMapBtn");
    if (expMapBtn && !expMapBtn.dataset.bound) {
        expMapBtn.dataset.bound = "1";
        expMapBtn.addEventListener("click", () => {
            trailVisible = !trailVisible;
            updateExplorationPill();
            if (typeof setTodayTrailCoords === "function") {
                setTodayTrailCoords(explorationData.trail, trailVisible);
            }
            if (trailVisible) {
                showToast(
                    explorationData.trail.length >= 2
                        ? "🟢 Percurso de hoje visível no mapa!"
                        : "Caminha ou ativa o GPS para desenhar o teu percurso de hoje!"
                );
            }
        });
    }

    const privacyMapBtn = $("privacyMapBtn");
    if (privacyMapBtn && !privacyMapBtn.dataset.bound) {
        privacyMapBtn.dataset.bound = "1";
        privacyMapBtn.addEventListener("click", () => cyclePrivacyMode());
    }

    const checkinMapBtn = $("quickCheckinMapBtn");
    if (checkinMapBtn && !checkinMapBtn.dataset.bound) {
        checkinMapBtn.dataset.bound = "1";
        checkinMapBtn.addEventListener("click", () => doQuickCheckin());
    }

    const statusContainer = $("statusPillsContainer");
    if (statusContainer && !statusContainer.dataset.bound) {
        statusContainer.dataset.bound = "1";
        statusContainer.addEventListener("click", e => {
            const btn = e.target.closest(".status-pill-btn");
            if (!btn) return;
            statusContainer.querySelectorAll(".status-pill-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            if ($("profileCustomEmoji")) $("profileCustomEmoji").value = btn.dataset.emoji;
            if ($("profileCustomStatus")) $("profileCustomStatus").value = btn.dataset.text;
        });
    }

    const privacyGrid = $("privacySelectorGrid");
    if (privacyGrid && !privacyGrid.dataset.bound) {
        privacyGrid.dataset.bound = "1";
        privacyGrid.addEventListener("click", e => {
            const btn = e.target.closest(".privacy-opt-btn");
            if (!btn) return;
            privacyGrid.querySelectorAll(".privacy-opt-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            if (currentProfile) currentProfile.privacy_mode = btn.dataset.mode;
        });
    }

    const bizPrivacyGrid = $("businessPrivacyGrid");
    if (bizPrivacyGrid && !bizPrivacyGrid.dataset.bound) {
        bizPrivacyGrid.dataset.bound = "1";
        bizPrivacyGrid.addEventListener("click", e => {
            const btn = e.target.closest(".privacy-opt-btn");
            if (!btn) return;
            bizPrivacyGrid.querySelectorAll(".privacy-opt-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            if (currentProfile) currentProfile.privacy_mode = btn.dataset.mode;
        });
    }

    const avatarInput = $("profileAvatarInput");
    if (avatarInput && !avatarInput.dataset.bound) {
        avatarInput.dataset.bound = "1";
        avatarInput.addEventListener("change", () => {
            const file = avatarInput.files[0];
            if (!file) return;
            const url = URL.createObjectURL(file);
            $("profileAvatarPreview").innerHTML = `<img src="${url}" alt="">`;
        });
    }

    const replayBtn = $("replayOnboardingBtn");
    if (replayBtn && !replayBtn.dataset.bound) {
        replayBtn.dataset.bound = "1";
        replayBtn.addEventListener("click", () => {
            closeModalEl(profileModal);
            if (currentProfile) currentProfile.onboarding_completed = false;
            showWelcomeSplash(isBusinessAccount());
        });
    }

    if ($("tabMyFriends") && !$("tabMyFriends").dataset.bound) {
        $("tabMyFriends").dataset.bound = "1";
        $("tabMyFriends").addEventListener("click", () => switchProfileTab("tabMyFriends", "profileFriendsList"));
    }

    setupMotionSensorWithIOSPermission();
}

async function updateQuickUserMood(emoji, text) {
    if (!currentUser || !currentProfile || !isNormalUserAccount()) return;
    const { error } = await supabaseClient
        .from("profiles")
        .update({
            status_emoji: emoji,
            status_text: text,
            last_seen: new Date().toISOString()
        })
        .eq("id", currentUser.id);

    if (error) {
        showToast("Erro ao atualizar estado.", "error");
        return;
    }

    currentProfile.status_emoji = emoji;
    currentProfile.status_text = text;
    applyRoleUI();
    showToast(`Estado atualizado: ${emoji} ${text}`, "success");

    if (bumpBroadcastChannel) {
        bumpBroadcastChannel.send({
            type: "broadcast",
            event: "live_status",
            payload: { userId: currentUser.id, emoji, text }
        });
    }
}

async function performSmartBumpAction(fromShake = false) {
    if (!currentUser || !isNormalUserAccount()) return;

    if (!window.friendsList.length) {
        showToast("Adiciona primeiro um amigo para fazer Bump! 👊");
        openModal($("friendsModal"));
        $("tabFriendsAdd").click();
        return;
    }

    if (fromShake) {
        const myPrivacy = currentProfile?.privacy_mode || "precise";
        if (myPrivacy !== "precise" || currentProfile?.ghost_mode) {
            if (navigator.vibrate) try { navigator.vibrate(80); } catch (e) {}
            showToast("👻 Ativa a localização Precisa para fazer Bump por abanão.");
            return;
        }

        if (!userPosition) {
            showToast("📍 Aguardando GPS preciso para detetar amigos por perto...");
            return;
        }

        const nearbyFriends = window.friendsList.filter(f =>
            !f.ghost_mode &&
            (!f.privacy_mode || f.privacy_mode === "precise") &&
            typeof f.last_lat === "number" &&
            typeof f.last_lng === "number" &&
            distanceKm(userPosition.lat, userPosition.lng, f.last_lat, f.last_lng) <= 0.25
        );

        if (nearbyFriends.length === 0) {
            if (navigator.vibrate) try { navigator.vibrate(70); } catch (e) {}
            showToast("📳 Abanão detetado, mas nenhum amigo com GPS preciso está a menos de 250m.");
            return;
        }

        for (const friend of nearbyFriends) {
            await window.sendBump(friend.id, "👊", "Shake Bump!");
        }
        return;
    }

    if (userPosition) {
        const nearbyFriend = window.friendsList.find(f =>
            !f.ghost_mode &&
            (!f.privacy_mode || f.privacy_mode === "precise") &&
            typeof f.last_lat === "number" &&
            typeof f.last_lng === "number" &&
            distanceKm(userPosition.lat, userPosition.lng, f.last_lat, f.last_lng) <= 0.25
        );

        if (nearbyFriend) {
            await window.sendBump(nearbyFriend.id, "👊", "BUMP DE PROXIMIDADE!");
            return;
        }
    }

    if (window.friendsList.length === 1) {
        await window.sendBump(window.friendsList[0].id, "👊", "Bump!");
        return;
    }

    openModal($("friendsModal"));
    $("tabFriendsList").click();
    showToast("Escolhe um amigo na lista para enviar um Bump! 👊");
}

// ==========================================
// CONTROLOS DO MAPA E VISTA MOBILE
// ==========================================
$("mapStyleToggle").addEventListener("click", () => {
    const mode = toggleMapStyleMode();
    $("mapStyleToggle").textContent = mode === "satellite" ? "🗺️ Mapa Noturno" : "🛰️ Satélite 3D";
});

$("mapPitchToggle").addEventListener("click", () => {
    const is3D = toggleMapPitchMode();
    $("mapPitchToggle").textContent = is3D ? "📐 Vista 2D" : "🧊 Vista 3D";
});

function setMobileView(view) {
    mainEl.dataset.view = view;
    mobileViewToggle.textContent = view === "map" ? "📋 Ver Lista" : "🗺️ Ver Mapa";
    if (view === "map" && typeof map !== "undefined") {
        setTimeout(() => map.resize(), 60);
    }
}

mobileViewToggle.addEventListener("click", () => {
    setMobileView(mainEl.dataset.view === "map" ? "list" : "map");
});

// ==========================================
// SISTEMA DE AUTENTICAÇÃO E PERFIS
// ==========================================
tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    $("loginError").classList.add("hidden");
});

tabRegister.addEventListener("click", () => {
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
    $("registerError").classList.add("hidden");
});

regAccountType.addEventListener("change", () => {
    const isBusiness = regAccountType.value === "business";
    businessTypeGroup.classList.toggle("hidden", !isBusiness);
    regNameLabel.textContent = isBusiness ? "Nome da Empresa / Estabelecimento *" : "Nome completo *";
    regNameInput.placeholder = isBusiness ? "Ex: Café Central / Câmara Municipal" : "Ex: João Silva";
});

loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    const errEl = $("loginError");
    errEl.classList.add("hidden");
    const btn = $("loginSubmitBtn");
    btn.disabled = true;
    btn.textContent = "A entrar...";

    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            errEl.textContent = translateAuthError(error);
            errEl.classList.remove("hidden");
            return;
        }
        if (data?.user) {
            await handleAuthenticatedSession(data.user, { showSplash: true });
            showToast("Sessão iniciada com sucesso!", "success");
        }
    } catch (err) {
        errEl.textContent = "Falha de ligação ao servidor.";
        errEl.classList.remove("hidden");
    } finally {
        btn.disabled = false;
        btn.textContent = "Entrar no LocalSpot";
    }
});

registerForm.addEventListener("submit", async e => {
    e.preventDefault();
    const errEl = $("registerError");
    errEl.classList.add("hidden");
    const btn = $("registerSubmitBtn");
    btn.disabled = true;
    btn.textContent = "A criar perfil...";

    const role = regAccountType.value;
    const businessType = role === "business" ? $("regBusinessType").value : null;
    const fullName = regNameInput.value.trim();
    const email = $("regEmail").value.trim();
    const password = $("regPassword").value;

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName, role, business_type: businessType } }
        });

        if (error) {
            errEl.textContent = translateAuthError(error);
            errEl.classList.remove("hidden");
            return;
        }

        if (data?.user) {
            if (!data.session) {
                errEl.textContent = "Conta criada! Desativa «Confirm email» no Supabase para entrar de imediato.";
                errEl.classList.remove("hidden");
                return;
            }

            await supabaseClient.from("profiles").upsert({
                id: data.user.id,
                email,
                full_name: fullName,
                role,
                business_type: businessType,
                status_emoji: role === "business" ? "🏢" : "📍",
                status_text: role === "business" ? (businessType || "Entidade Oficial") : "No LocalSpot",
                onboarding_completed: false
            });

            await handleAuthenticatedSession(data.user, { isNewSignup: true, showSplash: true });
        }
    } catch (err) {
        errEl.textContent = "Falha de ligação ao criar conta.";
        errEl.classList.remove("hidden");
    } finally {
        btn.disabled = false;
        btn.textContent = "Criar Perfil";
    }
});

logoutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    if (locationSyncInterval) clearInterval(locationSyncInterval);
    if (geoWatchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(geoWatchId);
    if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
    if (bumpBroadcastChannel) supabaseClient.removeChannel(bumpBroadcastChannel);
    currentUser = null;
    currentProfile = null;
    myEnrollments.clear();
    myFollowing.clear();
    myFollowingProfiles = [];
    myFollowersList = [];
    window.friendsList = [];
    onlineUserIds.clear();
    animatedIncomingFriendshipIds.clear();
    lastChatMessageByFriend.clear();
    if (typeof showFriendsOnMap === "function") showFriendsOnMap([]);
    ["friendsNavBtn", "entityNetworkNavBtn", "bumpShakeMapBtn", "iosShakePermMapBtn", "quickMoodMapBtn", "privacyMapBtn", "quickCheckinMapBtn", "explorationMapBtn", "hangoutBanner"].forEach(id => {
        if ($(id)) $(id).classList.add("hidden");
    });
    notifBtn.classList.add("hidden");
    userBadge.classList.add("hidden");
    userBadge.classList.remove("business-badge", "admin-badge");
    adminPanelBtn.classList.add("hidden");
    logoutButton.classList.add("hidden");
    authOverlay.classList.remove("hidden");
    showToast("Sessão terminada.");
});

async function handleAuthenticatedSession(user, { isNewSignup = false, showSplash = false } = {}) {
    currentUser = user;
    const meta = user.user_metadata || {};
    let profile = null;

    try {
        const { data } = await supabaseClient.from("profiles").select("*").eq("id", user.id).maybeSingle();
        profile = data;
        if (!profile) {
            const roleVal = meta.role || "user";
            const newProfile = {
                id: user.id,
                email: user.email,
                full_name: meta.full_name || user.email.split("@")[0],
                role: roleVal,
                business_type: meta.business_type || null,
                status_emoji: roleVal === "business" ? "🏢" : "📍",
                status_text: roleVal === "business" ? (meta.business_type || "Entidade Oficial") : "No LocalSpot",
                onboarding_completed: !isNewSignup
            };
            const { data: inserted } = await supabaseClient.from("profiles").upsert(newProfile).select().maybeSingle();
            profile = inserted || newProfile;
        }
    } catch (e) {
        const roleVal = meta.role || "user";
        profile = {
            id: user.id,
            email: user.email,
            full_name: meta.full_name || user.email.split("@")[0],
            role: roleVal,
            business_type: meta.business_type || null,
            onboarding_completed: !isNewSignup
        };
    }

    currentProfile = profile;
    if (!currentProfile.privacy_mode) {
        currentProfile.privacy_mode = currentProfile.ghost_mode ? "ghost" : "precise";
    }

    if (showSplash) {
        showWelcomeSplash(isBusinessAccount());
    } else if ((isNewSignup || currentProfile.onboarding_completed === false) && !isAdminAccount()) {
        startOnboardingWizard();
    }

    applyRoleUI();
    setupMotionSensorWithIOSPermission();
    authOverlay.classList.add("hidden");
    if (typeof map !== "undefined") map.resize();

    await Promise.all([
        loadMyEnrollments(),
        loadAllEnrollmentsSummary(),
        loadMyFollowing(),
        loadMyFollowers(),
        loadNotifications(),
        loadUnreadMessagesCount(),
        loadSocialData({ animateInitialRequests: true }),
        loadRecentChatSummaries()
    ]);
    await loadEventsFromSupabase();
    startLiveSocialSync();
    checkSharedEventUrl();
}

function renderAvatarChip(profile, sizeClass = "sm") {
    const isBiz = profile?.role === "business";
    const isAdm = profile?.role === "admin";
    const extraClass = isBiz ? " business-avatar" : (isAdm ? " admin-avatar" : "");
    if (profile?.avatar_url) {
        return `<span class="avatar-circle ${sizeClass}${extraClass}"><img src="${escapeHTML(profile.avatar_url)}" alt="" onerror="this.remove()"></span>`;
    }
    const initials = (profile?.full_name || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join("");
    return `<span class="avatar-circle ${sizeClass}${extraClass}">${escapeHTML(initials)}</span>`;
}

function applyRoleUI() {
    if (!currentProfile) return;
    const { role, full_name, business_type, privacy_mode } = currentProfile;
    const isBiz = role === "business";
    const isUser = role === "user";
    const isAdm = role === "admin";

    if ($("friendsNavBtn")) $("friendsNavBtn").classList.toggle("hidden", !isUser);
    if ($("bumpShakeMapBtn")) $("bumpShakeMapBtn").classList.toggle("hidden", !isUser);
    if ($("quickMoodMapBtn")) {
        $("quickMoodMapBtn").classList.toggle("hidden", !isUser);
        $("quickMoodMapBtn").textContent = `${currentProfile.status_emoji || "📍"} Vibe`;
    }
    if ($("quickCheckinMapBtn")) $("quickCheckinMapBtn").classList.toggle("hidden", !isUser);
    if ($("explorationMapBtn")) {
        $("explorationMapBtn").classList.toggle("hidden", !isUser);
        updateExplorationPill();
    }

    if ($("entityNetworkNavBtn")) {
        $("entityNetworkNavBtn").classList.toggle("hidden", !isBiz);
        if ($("headerFollowersCount")) $("headerFollowersCount").textContent = myFollowersList.length;
    }

    if ($("privacyMapBtn")) {
        const pBtn = $("privacyMapBtn");
        pBtn.classList.toggle("hidden", isAdm);
        pBtn.classList.remove("privacy-blurred", "privacy-ghost");
        if (isBiz) {
            if (privacy_mode === "ghost") {
                pBtn.classList.add("privacy-ghost");
                pBtn.textContent = "📅 Apenas Eventos";
            } else {
                pBtn.textContent = "🏢 Sede Visível";
            }
        } else if (isUser) {
            if (privacy_mode === "ghost") {
                pBtn.classList.add("privacy-ghost");
                pBtn.textContent = "👻 Fantasma";
            } else if (privacy_mode === "blurred") {
                pBtn.classList.add("privacy-blurred");
                pBtn.textContent = "🌫️ Borrão";
            } else {
                pBtn.textContent = "📍 Precisa";
            }
        }
    }

    notifBtn.classList.remove("hidden");
    logoutButton.classList.remove("hidden");
    userBadge.classList.remove("hidden", "business-badge", "admin-badge");

    const avatarHtml = renderAvatarChip(currentProfile, "sm");

    if (isAdm) {
        userBadge.classList.add("admin-badge");
        userBadge.innerHTML = `${avatarHtml} <span>🛡️ Admin · ${escapeHTML(full_name)}</span>`;
        adminPanelBtn.classList.remove("hidden");
    } else if (isBiz) {
        userBadge.classList.add("business-badge");
        const tipo = business_type || "Entidade";
        const vBadge = verifiedBadgeHTML(currentProfile);
        userBadge.innerHTML = `${avatarHtml} <span>👔 ${escapeHTML(tipo)} · ${escapeHTML(full_name)}</span>${vBadge}`;
        adminPanelBtn.classList.add("hidden");
    } else {
        userBadge.innerHTML = `${avatarHtml} <span>${escapeHTML(full_name)}</span>`;
        adminPanelBtn.classList.add("hidden");
    }
}

async function initAuth() {
    ensureSocialUI();

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && session.user) {
            await handleAuthenticatedSession(session.user, { showSplash: true });
        } else {
            showWelcomeSplash(false);
            authOverlay.classList.remove("hidden");
        }
    } catch (e) {
        showWelcomeSplash(false);
        authOverlay.classList.remove("hidden");
    }
}

// ==========================================
// SISTEMA DE AMIZADES, CONVERSAS & PÓDIO BUMP
// ==========================================
window.updateHangoutBanner = (hangoutNames, firstFriend) => {
    const banner = $("hangoutBanner");
    if (!banner) return;
    if (!hangoutNames || hangoutNames.length === 0) {
        banner.classList.add("hidden");
        return;
    }
    banner.textContent = `🔥 Hangout! ${hangoutNames[0]} estão juntos agora!`;
    banner.classList.remove("hidden");
    banner.onclick = () => {
        if (firstFriend) focusFriendOnMap(firstFriend.id);
    };
};

async function loadUnreadMessagesCount() {
    if (!currentUser || !isNormalUserAccount()) return;
    try {
        const { data, error } = await supabaseClient
            .from("friend_messages")
            .select("sender_id")
            .eq("receiver_id", currentUser.id)
            .eq("is_read", false);

        if (!error && data) {
            unreadMessagesBySender = new Map();
            data.forEach(m => {
                const k = String(m.sender_id);
                unreadMessagesBySender.set(k, (unreadMessagesBySender.get(k) || 0) + 1);
            });
            updateSocialBadges();
        }
    } catch (e) {}
}

async function loadRecentChatSummaries() {
    if (!currentUser || !isNormalUserAccount()) return;
    try {
        const { data, error } = await supabaseClient
            .from("friend_messages")
            .select("*")
            .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
            .order("created_at", { ascending: false })
            .limit(100);

        if (!error && data) {
            lastChatMessageByFriend = new Map();
            data.forEach(m => {
                const otherId = String(m.sender_id) === String(currentUser.id)
                    ? String(m.receiver_id)
                    : String(m.sender_id);
                if (!lastChatMessageByFriend.has(otherId)) {
                    lastChatMessageByFriend.set(otherId, m);
                }
            });
            renderChatsTabContent();
        }
    } catch (e) {}
}

function renderChatsTabContent() {
    const container = $("chatsListContainer");
    if (!container) return;

    if (!window.friendsList.length) {
        container.innerHTML = `
            <div style="text-align:center; padding:24px 12px; color:var(--muted);">
                <p style="font-size:28px; margin:0 0 8px;">💬</p>
                <p style="margin:0 0 12px; font-size:13.5px;">Adiciona amigos para começares a conversar em tempo real!</p>
                <button type="button" class="btn-primary-sm" onclick="$('tabFriendsAdd').click()">Procurar amigos</button>
            </div>
        `;
        return;
    }

    const sortedFriends = [...window.friendsList].sort((a, b) => {
        const msgA = lastChatMessageByFriend.get(String(a.id));
        const msgB = lastChatMessageByFriend.get(String(b.id));
        const timeA = msgA ? new Date(msgA.created_at).getTime() : 0;
        const timeB = msgB ? new Date(msgB.created_at).getTime() : 0;
        return timeB - timeA;
    });

    container.innerHTML = sortedFriends.map(f => {
        const key = String(f.id);
        const lastMsg = lastChatMessageByFriend.get(key);
        const unread = unreadMessagesBySender.get(key) || 0;
        const isLive = onlineUserIds.has(key);

        let preview = `${f.status_emoji || "📍"} ${f.status_text || "Toca para iniciar conversa"}`;
        let timeLabel = "";

        if (lastMsg) {
            const prefix = String(lastMsg.sender_id) === String(currentUser.id) ? "Tu: " : "";
            preview = lastMsg.msg_type === "emoji_bomb"
                ? `${prefix}Chuva de ${lastMsg.content}`
                : `${prefix}${lastMsg.content}`;
            timeLabel = new Date(lastMsg.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
        }

        return `
            <div class="chat-thread-row${unread > 0 ? " unread" : ""}" onclick="window.openFriendChat('${f.id}')">
                <div class="friend-row-left" style="flex:1; min-width:0;">
                    ${renderAvatarChip(f, "")}
                    <div class="friend-row-info" style="flex:1; min-width:0;">
                        <strong>${escapeHTML(f.full_name)} ${isLive ? '<small style="color:#10b981;">●</small>' : ""}</strong>
                        <span style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(preview)}</span>
                    </div>
                </div>
                <div style="text-align:right; flex-shrink:0;">
                    ${timeLabel ? `<small style="display:block; font-size:10.5px; color:var(--muted); margin-bottom:4px;">${timeLabel}</small>` : ""}
                    ${unread > 0 ? `<span class="friends-req-badge">${unread}</span>` : `<span style="font-size:12px; color:var(--muted);">💬</span>`}
                </div>
            </div>
        `;
    }).join("");
}

async function loadSocialData({ animateInitialRequests = false, triggerAnimForSenderId = null } = {}) {
    if (!currentUser) return;

    if (!isNormalUserAccount()) {
        window.friendsList = [];
        if (typeof showFriendsOnMap === "function") {
            showFriendsOnMap(window.getMapSocialEntities());
        }
        return;
    }

    try {
        const { data: rows, error } = await supabaseClient
            .from("friendships")
            .select("*")
            .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`);

        if (error || !rows) return;

        const acceptedIds = new Set();
        const incomingRows = [];
        sentFriendRequestIds = new Set();
        friendshipRecords = new Map();

        rows.forEach(r => {
            if (r.status === "accepted") {
                const otherId = r.requester_id === currentUser.id ? r.addressee_id : r.requester_id;
                acceptedIds.add(otherId);
                friendshipRecords.set(String(otherId), r);
            } else if (r.status === "pending") {
                if (r.addressee_id === currentUser.id) {
                    incomingRows.push(r);
                } else {
                    sentFriendRequestIds.add(r.addressee_id);
                }
            }
        });

        const allNeededIds = [...new Set([...acceptedIds, ...incomingRows.map(r => r.requester_id)])];
        let profilesById = new Map();

        if (allNeededIds.length > 0) {
            const { data: profs } = await supabaseClient
                .from("profiles")
                .select("*")
                .in("id", allNeededIds);

            if (profs) {
                profilesById = new Map(profs.map(p => [p.id, p]));
            }
        }

        window.friendsList = [...acceptedIds]
            .map(id => {
                const prof = profilesById.get(id);
                if (!prof || prof.role !== "user") return null;
                const fRow = friendshipRecords.get(String(id));
                return {
                    ...prof,
                    bump_count: fRow?.bump_count || 0,
                    super_bump_count: fRow?.super_bump_count || 0
                };
            })
            .filter(Boolean)
            .sort((a, b) => (b.bump_count || 0) - (a.bump_count || 0));

        incomingFriendRequests = incomingRows
            .map(r => {
                const prof = profilesById.get(r.requester_id);
                if (!prof || prof.role !== "user") return null;
                return { friendshipId: r.id, user: prof };
            })
            .filter(Boolean);

        // Dispara animação com a foto do utilizador se houver pedido novo
        if (triggerAnimForSenderId) {
            const targetReq = incomingFriendRequests.find(r => String(r.user.id) === String(triggerAnimForSenderId));
            if (targetReq && !animatedIncomingFriendshipIds.has(String(targetReq.friendshipId))) {
                animatedIncomingFriendshipIds.add(String(targetReq.friendshipId));
                triggerFriendRequestAnimation(targetReq.user, targetReq.friendshipId);
            }
        } else if (animateInitialRequests && incomingFriendRequests.length > 0) {
            const firstReq = incomingFriendRequests[0];
            if (!animatedIncomingFriendshipIds.has(String(firstReq.friendshipId))) {
                animatedIncomingFriendshipIds.add(String(firstReq.friendshipId));
                setTimeout(() => {
                    triggerFriendRequestAnimation(firstReq.user, firstReq.friendshipId);
                }, 3300);
            }
        }

        updateSocialBadges();
        renderFriendsModalContent();
        renderChatsTabContent();
        if (typeof showFriendsOnMap === "function") {
            showFriendsOnMap(window.getMapSocialEntities());
        }
    } catch (e) {}
}

function updateSocialBadges() {
    let totalUnreadMsgs = 0;
    unreadMessagesBySender.forEach(v => { totalUnreadMsgs += v; });
    const badgeTotal = incomingFriendRequests.length + totalUnreadMsgs;

    const navBadge = $("friendsReqBadge");
    if (navBadge) {
        navBadge.textContent = badgeTotal;
        navBadge.classList.toggle("hidden", badgeTotal === 0);
    }
    const chatTabBadge = $("chatsTabUnreadBadge");
    if (chatTabBadge) {
        chatTabBadge.textContent = totalUnreadMsgs;
        chatTabBadge.classList.toggle("hidden", totalUnreadMsgs === 0);
    }
    if ($("friendsTabCount")) $("friendsTabCount").textContent = window.friendsList.length;
    if ($("requestsTabCount")) $("requestsTabCount").textContent = incomingFriendRequests.length;
}

function renderFriendsModalContent() {
    const container = $("friendsContainerList");
    const reqContainer = $("incomingRequestsSection");
    const podiumContainer = $("bumpLeaderboardSection");
    if (!container || !reqContainer) return;

    if (incomingFriendRequests.length > 0) {
        reqContainer.innerHTML = `
            <h4 style="margin:0 0 8px; font-size:13.5px; color:#f9a8d4;">🔔 Pedidos de Amizade (${incomingFriendRequests.length})</h4>
            ${incomingFriendRequests.map(req => `
                <div class="friend-row">
                    <div class="friend-row-left">
                        ${renderAvatarChip(req.user, "")}
                        <div class="friend-row-info">
                            <strong>${escapeHTML(req.user.full_name)}</strong>
                            <span>${escapeHTML(req.user.email || "")}</span>
                        </div>
                    </div>
                    <div class="friend-row-actions">
                        <button type="button" class="btn-primary-sm" onclick="window.acceptFriendRequest(${req.friendshipId}, '${req.user.id}')">Aceitar</button>
                        <button type="button" class="btn-logout" onclick="window.rejectFriendRequest(${req.friendshipId})">Recusar</button>
                    </div>
                </div>
            `).join("")}
        `;
    } else {
        reqContainer.innerHTML = "";
    }

    if (podiumContainer) {
        const topFriends = window.friendsList.filter(f => (f.bump_count || 0) > 0).slice(0, 3);
        if (topFriends.length > 0) {
            const medals = ["🥇", "🥈", "🥉"];
            podiumContainer.innerHTML = `
                <div class="bump-leaderboard-card">
                    <strong style="font-size:12.5px; color:#f9a8d4;">🏆 Pódio Top Bumps</strong>
                    <div class="bump-podium-row">
                        ${topFriends.map((f, idx) => `
                            <div class="bump-podium-item">
                                <div style="font-size:16px;">${medals[idx]}</div>
                                <strong style="display:block; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(f.full_name.split(" ")[0])}</strong>
                                <span style="color:#f59e0b; font-weight:800;">${f.bump_count} pts</span>
                                ${f.super_bump_count ? `<small style="display:block; color:#f9a8d4; font-size:10px;">⚡ ${f.super_bump_count} Super</small>` : ""}
                            </div>
                        `).join("")}
                    </div>
                </div>
            `;
        } else {
            podiumContainer.innerHTML = "";
        }
    }

    if (!window.friendsList.length) {
        container.innerHTML = `
            <div style="text-align:center; padding:24px 12px; color:var(--muted);">
                <p style="font-size:28px; margin:0 0 8px;">👊</p>
                <p style="margin:0 0 12px; font-size:13.5px;">Ainda não tens amigos adicionados.</p>
                <button type="button" class="btn-primary-sm" onclick="$('tabFriendsAdd').click()">Procurar amigos ou entidades</button>
            </div>
        `;
        return;
    }

    container.innerHTML = window.friendsList.map(f => {
        const isGhost = f.ghost_mode || f.privacy_mode === "ghost";
        const hasLocation = !isGhost && typeof f.last_lat === "number" && typeof f.last_lng === "number";
        const isLive = onlineUserIds.has(String(f.id));
        const batStr = typeof f.battery_level === "number" ? ` · ${f.is_charging ? "⚡" : "🔋"}${f.battery_level}%` : "";
        const statusStr = isGhost
            ? "👻 Modo Fantasma"
            : `${isLive ? "🟢 " : ""}${f.current_place ? "📍 " + escapeHTML(f.current_place) : (f.status_emoji || "📍") + " " + escapeHTML(f.status_text || "Online")}${batStr}`;
        const unread = unreadMessagesBySender.get(String(f.id)) || 0;
        const tier = window.getFriendshipTier(f.bump_count || 0);

        return `
            <div class="friend-row">
                <div class="friend-row-left" style="flex:1; min-width:0;">
                    ${renderAvatarChip(f, "")}
                    <div class="friend-row-info" style="flex:1; min-width:0;">
                        <strong>${escapeHTML(f.full_name)} <small style="color:#f9a8d4;">👊${f.bump_count || 0} pts</small></strong>
                        <span>${statusStr}</span>
                        <div style="margin-top:3px;">
                            <span class="friendship-tier-pill">${tier.badge}</span>
                            <div class="bump-progress-mini"><span style="width:${tier.pct}%;"></span></div>
                        </div>
                    </div>
                </div>
                <div class="friend-row-actions">
                    <button type="button" class="btn-bump" onclick="window.sendBump('${f.id}', '👊', 'Bump!')" title="Enviar Bump">👊</button>
                    <button type="button" class="btn-soft" onclick="window.sendWhereAreYouPing('${f.id}')" title="Perguntar onde está">👀</button>
                    <button type="button" class="btn-soft" onclick="window.openFriendChat('${f.id}')" title="Chat">💬${unread > 0 ? ` (${unread})` : ""}</button>
                    ${hasLocation ? `<button type="button" class="btn-soft" onclick="window.locateFriendOnMap('${f.id}')" title="Ver no mapa">📍</button>` : ""}
                    <button type="button" class="btn-logout" onclick="window.removeFriend('${f.id}', '${escapeHTML(f.full_name)}')" title="Remover">×</button>
                </div>
            </div>
        `;
    }).join("");
}

async function searchUsersAndEntities() {
    const query = $("friendSearchInput").value.trim();
    const resultsEl = $("friendSearchResults");
    if (!query || !currentUser) return;

    resultsEl.innerHTML = `<p class="muted" style="font-size:12.5px;">A procurar...</p>`;

    const { data, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .neq("id", currentUser.id)
        .neq("role", "admin")
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(18);

    if (error || !data || data.length === 0) {
        resultsEl.innerHTML = `<p class="muted" style="font-size:13px;">Nenhum resultado encontrado com "${escapeHTML(query)}".</p>`;
        return;
    }

    const friendIds = new Set(window.friendsList.map(f => String(f.id)));

    resultsEl.innerHTML = data.map(u => {
        const isBiz = u.role === "business";
        let actionBtn = "";

        if (isBiz) {
            const isFollowing = myFollowing.has(String(u.id));
            actionBtn = isFollowing
                ? `<button type="button" class="btn-soft" onclick="window.toggleFollowFromSearch('${u.id}', '${escapeHTML(u.full_name)}')">✓ A seguir</button>`
                : `<button type="button" class="btn-primary-sm" onclick="window.toggleFollowFromSearch('${u.id}', '${escapeHTML(u.full_name)}')">+ Seguir</button>`;
        } else {
            if (friendIds.has(String(u.id))) {
                actionBtn = `<button type="button" class="btn-soft" onclick="window.openFriendChat('${u.id}')">💬 Conversar</button>`;
            } else if (sentFriendRequestIds.has(u.id)) {
                actionBtn = `<span class="muted" style="font-size:12px;">✈️ Pedido enviado</span>`;
            } else {
                actionBtn = `<button type="button" class="btn-primary-sm" onclick="window.sendFriendRequest('${u.id}', '${escapeHTML(u.full_name)}')">👊 Adicionar Amigo</button>`;
            }
        }

        const subText = isBiz
            ? `🏛️ ${escapeHTML(u.business_type || "Empresa / Domínio Público")}`
            : `👤 Utilizador · ${escapeHTML(u.email)}`;

        return `
            <div class="friend-row">
                <div class="friend-row-left">
                    ${renderAvatarChip(u, "")}
                    <div class="friend-row-info">
                        <strong>${escapeHTML(u.full_name)}${verifiedBadgeHTML(u)}</strong>
                        <span>${subText}</span>
                    </div>
                </div>
                <div>${actionBtn}</div>
            </div>
        `;
    }).join("");
}

window.toggleFollowFromSearch = async (targetId, targetName) => {
    await toggleFollowOrganizer(targetId, targetName);
    await searchUsersAndEntities();
};

window.sendFriendRequest = async (targetId, targetName) => {
    if (!currentUser || !currentProfile) return;

    if (!isNormalUserAccount()) {
        showToast("Apenas utilizadores normais podem enviar pedidos de amizade.", "error");
        return;
    }

    const { data: targetProf } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", targetId)
        .maybeSingle();

    if (!targetProf || targetProf.role !== "user") {
        showToast("Empresas e entidades públicas não aceitam pedidos de amizade — clique em Seguir.", "error");
        return;
    }

    const { data: insertedRow, error } = await supabaseClient
        .from("friendships")
        .insert([{
            requester_id: currentUser.id,
            addressee_id: targetId,
            status: "pending"
        }])
        .select()
        .maybeSingle();

    if (error) {
        showToast("Pedido já enviado ou erro de ligação.", "error");
        return;
    }

    sentFriendRequestIds.add(targetId);

    // Dispara imediatamente a animação de envio com a foto do destinatário
    triggerFriendSentAnimation(targetProf);

    // Envia Broadcast imediato para que o destinatário veja a animação com a foto em tempo real
    if (bumpBroadcastChannel) {
        bumpBroadcastChannel.send({
            type: "broadcast",
            event: "friend_request_received",
            payload: {
                friendshipId: insertedRow?.id || null,
                sender: {
                    id: currentUser.id,
                    full_name: currentProfile.full_name,
                    avatar_url: currentProfile.avatar_url || null,
                    bio: currentProfile.bio || "",
                    status_emoji: currentProfile.status_emoji || "📍",
                    status_text: currentProfile.status_text || "No LocalSpot"
                },
                receiverId: targetId
            }
        });
    }

    await createNotification(
        targetId,
        null,
        "Novo pedido de amizade 👊",
        `${currentProfile.full_name} quer adicionar-te aos amigos no LocalSpot!`
    );

    if ($("friendSearchInput") && $("friendSearchInput").value.trim()) {
        searchUsersAndEntities();
    }
    if (!detailModal.classList.contains("hidden") && detailEventId) {
        const ev = events.find(x => String(x.id) === String(detailEventId));
        if (ev) updateDetailSocialButton(ev);
    }
};

window.acceptFriendRequest = async (friendshipId, requesterId) => {
    const { error } = await supabaseClient
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", friendshipId);

    if (error) {
        showToast("Erro ao aceitar pedido.", "error");
        return;
    }

    await createNotification(
        requesterId,
        null,
        "Pedido de amizade aceite! 🎉",
        `${currentProfile.full_name} aceitou o teu pedido. Já podem conversar e dar Bump!`
    );
    triggerBumpVisual("🎉", "Novo amigo adicionado! Já podem conversar 💬");
    await Promise.all([loadSocialData(), loadRecentChatSummaries()]);
    filterEvents();
};

window.rejectFriendRequest = async friendshipId => {
    await supabaseClient.from("friendships").delete().eq("id", friendshipId);
    showToast("Pedido recusado.");
    await loadSocialData();
};

window.removeFriend = async (friendId, friendName) => {
    if (!confirm(`Remover ${friendName} dos teus amigos?`)) return;
    await supabaseClient
        .from("friendships")
        .delete()
        .or(`and(requester_id.eq.${currentUser.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${currentUser.id})`);

    showToast(`${friendName} removido dos amigos.`);
    await Promise.all([loadSocialData(), loadRecentChatSummaries()]);
    renderProfileLists();
    filterEvents();
};

window.locateFriendOnMap = friendId => {
    closeModalEl($("friendsModal"));
    if (window.innerWidth <= 820) setMobileView("map");
    if (!focusFriendOnMap(friendId)) {
        showToast("Localização indisponível.");
    }
};

// ==========================================
// REDE INSTITUCIONAL (SEGUIDORES & A SEGUIR PARA ENTIDADES)
// ==========================================
async function loadMyFollowers() {
    if (!currentUser || !isBusinessAccount()) {
        myFollowersList = [];
        return;
    }
    try {
        const { data: rows, error } = await supabaseClient
            .from("follows")
            .select("follower_id")
            .eq("following_id", currentUser.id);

        if (error || !rows || rows.length === 0) {
            myFollowersList = [];
            if ($("headerFollowersCount")) $("headerFollowersCount").textContent = "0";
            return;
        }

        const followerIds = rows.map(r => r.follower_id).filter(Boolean);
        const { data: profs } = await supabaseClient
            .from("profiles")
            .select("*")
            .in("id", followerIds);

        myFollowersList = profs || [];
        if ($("headerFollowersCount")) $("headerFollowersCount").textContent = myFollowersList.length;
    } catch (e) {}
}

function renderEntityNetworkModal() {
    if ($("entFollowersTabCount")) $("entFollowersTabCount").textContent = myFollowersList.length;
    if ($("entFollowingTabCount")) $("entFollowingTabCount").textContent = myFollowingProfiles.length;

    const followersBox = $("entFollowersListContainer");
    if (followersBox) {
        followersBox.innerHTML = myFollowersList.length
            ? myFollowersList.map(u => {
                const isBiz = u.role === "business";
                return `
                    <div class="friend-row">
                        <div class="friend-row-left">
                            ${renderAvatarChip(u, "")}
                            <div class="friend-row-info">
                                <strong>${escapeHTML(u.full_name)}${verifiedBadgeHTML(u)}</strong>
                                <span>${isBiz ? "🏛️ " + escapeHTML(u.business_type || "Entidade") : "👤 Utilizador"}</span>
                            </div>
                        </div>
                        ${isBiz && String(u.id) !== String(currentUser.id)
                            ? `<div>
                                ${myFollowing.has(String(u.id))
                                    ? `<button type="button" class="btn-soft" onclick="window.toggleFollowEntityModal('${u.id}', '${escapeHTML(u.full_name)}')">✓ A seguir</button>`
                                    : `<button type="button" class="btn-primary-sm" onclick="window.toggleFollowEntityModal('${u.id}', '${escapeHTML(u.full_name)}')">+ Seguir</button>`
                                }
                               </div>`
                            : ""}
                    </div>
                `;
            }).join("")
            : `<p class="muted" style="font-size:13px; text-align:center; padding:18px;">Ainda sem seguidores.</p>`;
    }

    const followingBox = $("entFollowingListContainer");
    if (followingBox) {
        followingBox.innerHTML = myFollowingProfiles.length
            ? myFollowingProfiles.map(ent => `
                <div class="friend-row">
                    <div class="friend-row-left">
                        ${renderAvatarChip(ent, "")}
                        <div class="friend-row-info">
                            <strong>${escapeHTML(ent.full_name)}${verifiedBadgeHTML(ent)}</strong>
                            <span>🏛️ ${escapeHTML(ent.business_type || "Entidade Oficial")}</span>
                        </div>
                    </div>
                    <button type="button" class="btn-logout" onclick="window.toggleFollowEntityModal('${ent.id}', '${escapeHTML(ent.full_name)}')">Deixar de seguir</button>
                </div>
            `).join("")
            : `<p class="muted" style="font-size:13px; text-align:center; padding:18px;">Ainda não está a seguir nenhuma empresa ou entidade.</p>`;
    }
}

async function searchEntitiesToFollow() {
    const query = ($("entitySearchInput")?.value || "").trim();
    const resultsEl = $("entitySearchResults");
    if (!resultsEl || !currentUser) return;

    resultsEl.innerHTML = `<p class="muted" style="font-size:12.5px;">A carregar entidades...</p>`;

    let req = supabaseClient
        .from("profiles")
        .select("*")
        .eq("role", "business")
        .neq("id", currentUser.id)
        .limit(20);

    if (query) {
        req = req.ilike("full_name", `%${query}%`);
    }

    const { data, error } = await req;
    if (error || !data || data.length === 0) {
        resultsEl.innerHTML = `<p class="muted" style="font-size:13px;">Nenhuma empresa ou entidade encontrada.</p>`;
        return;
    }

    resultsEl.innerHTML = data.map(ent => {
        const isFollowing = myFollowing.has(String(ent.id));
        return `
            <div class="friend-row">
                <div class="friend-row-left">
                    ${renderAvatarChip(ent, "")}
                    <div class="friend-row-info">
                        <strong>${escapeHTML(ent.full_name)}${verifiedBadgeHTML(ent)}</strong>
                        <span>🏛️ ${escapeHTML(ent.business_type || "Entidade Oficial")}</span>
                    </div>
                </div>
                <div>
                    ${isFollowing
                        ? `<button type="button" class="btn-soft" onclick="window.toggleFollowEntityModal('${ent.id}', '${escapeHTML(ent.full_name)}')">✓ A seguir</button>`
                        : `<button type="button" class="btn-primary-sm" onclick="window.toggleFollowEntityModal('${ent.id}', '${escapeHTML(ent.full_name)}')">+ Seguir</button>`
                    }
                </div>
            </div>
        `;
    }).join("");
}

window.toggleFollowEntityModal = async (targetId, targetName) => {
    await toggleFollowOrganizer(targetId, targetName);
    renderEntityNetworkModal();
    if ($("panelEntDiscover") && !$("panelEntDiscover").classList.contains("hidden")) {
        await searchEntitiesToFollow();
    }
};

// ==========================================
// BUMP, SUPER BUMP, PINGS («ONDE ESTÁS?»), EMOJI BOMBS & CHAT DIRETO
// ==========================================
function triggerBumpVisual(emoji = "👊", text = "BUMP!", isSuper = false) {
    if (navigator.vibrate) {
        try {
            navigator.vibrate(isSuper ? [150, 60, 150, 60, 280] : [100, 50, 140]);
        } catch (e) {}
    }
    playBumpSound(isSuper);

    const existing = document.querySelector(".bump-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = `bump-overlay${isSuper ? " super-bump" : ""}`;
    overlay.innerHTML = `
        <div class="bump-burst">${isSuper ? "⚡" : emoji}</div>
        <div class="bump-banner-text">${escapeHTML(text)}</div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), isSuper ? 2200 : 1850);
}

function launchEmojiBombAnimation(emoji = "👊") {
    for (let i = 0; i < 14; i++) {
        setTimeout(() => {
            const el = document.createElement("div");
            el.className = "flying-emoji-bomb";
            el.textContent = emoji;
            el.style.left = `${8 + Math.random() * 84}vw`;
            el.style.fontSize = `${28 + Math.round(Math.random() * 22)}px`;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 2250);
        }, i * 75);
    }
}

window.sendBump = async (friendId, emoji = "👊", label = "Bump!") => {
    if (!currentUser || !currentProfile || !isNormalUserAccount()) return;
    const friend = window.friendsList.find(f => String(f.id) === String(friendId));
    if (!friend) return;

    const friendKey = String(friendId);
    const now = Date.now();
    const lastIncoming = recentIncomingBumpTs.get(friendKey) || 0;
    const isMutualSuper = (now - lastIncoming) <= 5000;

    if (!isMutualSuper) {
        const lastBumpTs = bumpCooldownMap.get(friendKey) || 0;
        const elapsedSec = Math.floor((now - lastBumpTs) / 1000);
        if (elapsedSec < 60) {
            showToast(`⏳ Aguarda ${60 - elapsedSec}s para novo Bump com ${friend.full_name.split(" ")[0]}.`);
            return;
        }
    }

    bumpCooldownMap.set(friendKey, now);
    if (isMutualSuper) recentIncomingBumpTs.delete(friendKey);

    const pointsToAdd = isMutualSuper ? 2 : 1;
    const fRow = friendshipRecords.get(friendKey);
    const nextCount = (fRow?.bump_count || friend.bump_count || 0) + pointsToAdd;
    const nextSuperCount = (fRow?.super_bump_count || friend.super_bump_count || 0) + (isMutualSuper ? 1 : 0);

    let finalScore = nextCount;
    try {
        const { data: rpcData, error: rpcErr } = await supabaseClient.rpc("registrar_bump", {
            p_receiver_id: friendId
        });
        if (!rpcErr && rpcData && typeof rpcData.total_bumps === "number") {
            finalScore = rpcData.total_bumps;
        } else if (fRow) {
            await supabaseClient
                .from("friendships")
                .update({ bump_count: nextCount })
                .eq("id", fRow.id);
        }
    } catch (e) {
        if (fRow) {
            await supabaseClient
                .from("friendships")
                .update({ bump_count: nextCount })
                .eq("id", fRow.id);
        }
    }

    if (fRow) fRow.bump_count = finalScore;
    friend.bump_count = finalScore;
    if (isMutualSuper) friend.super_bump_count = nextSuperCount;
    window.friendsList.sort((a, b) => (b.bump_count || 0) - (a.bump_count || 0));

    const bannerMsg = isMutualSuper
        ? `⚡ SUPER BUMP com ${friend.full_name}! (+2 pts · Total: ${finalScore})`
        : `${emoji} ${label} com ${friend.full_name}! (${finalScore} pts)`;

    triggerBumpVisual(isMutualSuper ? "⚡" : emoji, bannerMsg, isMutualSuper);
    renderFriendsModalContent();
    if (typeof showFriendsOnMap === "function") showFriendsOnMap(window.getMapSocialEntities());

    const waveLng = typeof friend.last_lng === "number" ? friend.last_lng : userPosition?.lng;
    const waveLat = typeof friend.last_lat === "number" ? friend.last_lat : userPosition?.lat;
    if (typeof waveLng === "number" && typeof waveLat === "number" && typeof triggerMapBumpShockwave === "function") {
        triggerMapBumpShockwave(waveLng, waveLat, isMutualSuper ? "⚡" : emoji, isMutualSuper);
    }

    if (bumpBroadcastChannel) {
        bumpBroadcastChannel.send({
            type: "broadcast",
            event: "bump_shockwave",
            payload: {
                senderId: currentUser.id,
                senderName: currentProfile.full_name,
                receiverId: friendId,
                lat: userPosition?.lat ?? waveLat,
                lng: userPosition?.lng ?? waveLng,
                emoji: isMutualSuper ? "⚡" : emoji,
                isSuper: isMutualSuper,
                totalScore: finalScore
            }
        });
    }

    await createNotification(
        friendId,
        null,
        isMutualSuper
            ? `⚡ SUPER BUMP com ${currentProfile.full_name}! (${finalScore} pts)`
            : `${emoji} ${currentProfile.full_name} fez Bump contigo! (${finalScore} pts)`,
        isMutualSuper
            ? "Vocês abanaram o telemóvel ao mesmo tempo! (+2 pts)"
            : `Abana também nos próximos 5s para ativar SUPER BUMP (+2 pts)!`
    );
};

window.sendWhereAreYouPing = async friendId => {
    if (!currentUser || !currentProfile || !isNormalUserAccount()) return;
    const friend = window.friendsList.find(f => String(f.id) === String(friendId));
    if (!friend) return;

    if (bumpBroadcastChannel) {
        bumpBroadcastChannel.send({
            type: "broadcast",
            event: "where_are_you_ping",
            payload: {
                senderId: currentUser.id,
                senderName: currentProfile.full_name,
                receiverId: friendId
            }
        });
    }

    await createNotification(
        friendId,
        null,
        `👀 ${currentProfile.full_name} perguntou: Onde estás?`,
        "Entra no mapa ou responde no chat!"
    );
    showToast(`Ping «👀 Onde estás?» enviado a ${friend.full_name}!`, "success");
};

function showIncomingPingCard(senderId, senderName) {
    if (navigator.vibrate) {
        try { navigator.vibrate([120, 60, 120]); } catch (e) {}
    }
    const existing = $("livePingToast");
    if (existing) existing.remove();

    const card = document.createElement("div");
    card.id = "livePingToast";
    card.className = "live-ping-toast";
    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:13.5px; color:#fbcfe8;">👀 ${escapeHTML(senderName)} perguntou:</strong>
            <button type="button" id="closeLivePingBtn" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;">&times;</button>
        </div>
        <p style="margin:4px 0 0; font-size:12.5px; color:var(--text);">«Onde estás agora?» — Responde num toque:</p>
        <div class="live-ping-replies">
            <button type="button" class="live-ping-reply-btn" data-reply="📍 Já cá estou!">📍 Já cá estou!</button>
            <button type="button" class="live-ping-reply-btn" data-reply="🏃 A caminho!">🏃 A caminho!</button>
            <button type="button" class="live-ping-reply-btn" data-reply="⏱️ Chego em 5 min!">⏱️ 5 min!</button>
            <button type="button" class="live-ping-reply-btn" data-reply="🏠 Ainda em casa">🏠 Em casa</button>
        </div>
    `;
    document.body.appendChild(card);

    $("closeLivePingBtn").onclick = () => card.remove();
    card.querySelectorAll(".live-ping-reply-btn").forEach(btn => {
        btn.onclick = async () => {
            const replyText = btn.dataset.reply;
            card.remove();
            await sendDirectMessage(senderId, replyText, "text");
            showToast(`Resposta enviada a ${senderName}: ${replyText}`, "success");
        };
    });

    setTimeout(() => { if (card.parentElement) card.remove(); }, 15000);
}

window.openFriendChat = async friendId => {
    const friend = window.friendsList.find(f => String(f.id) === String(friendId));
    if (!friend) return;

    activeChatFriendId = String(friend.id);
    closeModalEl($("friendsModal"));
    const tier = window.getFriendshipTier(friend.bump_count || 0);
    const isLive = onlineUserIds.has(String(friend.id));

    $("chatFriendHeader").innerHTML = `
        ${renderAvatarChip(friend, "")}
        <div>
            <strong style="display:block; font-size:15px;">${escapeHTML(friend.full_name)} ${isLive ? '<small style="color:#10b981;">● Online</small>' : ""}</strong>
            <span style="font-size:12px; color:#f9a8d4;">
                ${tier.badge} · 👊 ${friend.bump_count || 0} pts · ${escapeHTML(friend.status_emoji || "📍")} ${escapeHTML(friend.status_text || "Online")}
            </span>
        </div>
    `;
    if ($("chatTypingIndicator")) $("chatTypingIndicator").textContent = "";

    openModal($("friendChatModal"));
    await loadChatHistory(activeChatFriendId);
};

async function loadChatHistory(friendId) {
    const box = $("chatMessagesBox");
    box.innerHTML = `<p class="muted" style="font-size:12px; text-align:center;">A carregar mensagens...</p>`;

    const { data, error } = await supabaseClient
        .from("friend_messages")
        .select("*")
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`)
        .order("created_at", { ascending: true })
        .limit(60);

    if (error) {
        box.innerHTML = `<p class="muted" style="font-size:12px; text-align:center;">Sem mensagens disponíveis.</p>`;
        return;
    }

    await supabaseClient
        .from("friend_messages")
        .update({ is_read: true })
        .eq("sender_id", friendId)
        .eq("receiver_id", currentUser.id)
        .eq("is_read", false);

    unreadMessagesBySender.delete(String(friendId));
    updateSocialBadges();
    renderFriendsModalContent();
    renderChatsTabContent();

    if (!data || data.length === 0) {
        box.innerHTML = `<p class="muted" style="font-size:12.5px; text-align:center; margin-top:80px;">Envia a primeira mensagem! 💬</p>`;
        return;
    }

    lastChatMessageByFriend.set(String(friendId), data[data.length - 1]);
    renderChatsTabContent();

    box.innerHTML = data.map(m => {
        const isMine = String(m.sender_id) === String(currentUser.id);
        const timeStr = new Date(m.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
        const contentDisplay = m.msg_type === "emoji_bomb"
            ? `<span style="font-size:32px; line-height:1;">${escapeHTML(m.content)}</span>`
            : escapeHTML(m.content);
        return `
            <div class="chat-bubble ${isMine ? "mine" : "theirs"}">
                <div>${contentDisplay}</div>
                <small>${timeStr}</small>
            </div>
        `;
    }).join("");
    box.scrollTop = box.scrollHeight;
}

async function sendDirectMessage(receiverId, content, msgType = "text") {
    if (!currentUser) return;
    const { data } = await supabaseClient
        .from("friend_messages")
        .insert([{
            sender_id: currentUser.id,
            receiver_id: receiverId,
            content,
            msg_type: msgType
        }])
        .select()
        .maybeSingle();

    if (data) {
        lastChatMessageByFriend.set(String(receiverId), data);
        renderChatsTabContent();
    }

    if (String(activeChatFriendId) === String(receiverId)) {
        await loadChatHistory(receiverId);
    }
}

// ==========================================
// TELEMETRIA (BATERIA, CHECK-IN, PRIVACIDADE & REALTIME)
// ==========================================
async function getDeviceBatteryInfo() {
    if (!navigator.getBattery) return { level: null, charging: false };
    try {
        const bat = await navigator.getBattery();
        return {
            level: Math.round(bat.level * 100),
            charging: Boolean(bat.charging)
        };
    } catch (e) {
        return { level: null, charging: false };
    }
}

function applyPrivacyCoordinates(lat, lng, mode) {
    if (mode !== "blurred") return { lat, lng };
    const offsetLat = (Math.sin(lat * 1000) * 0.0032);
    const offsetLng = (Math.cos(lng * 1000) * 0.0038);
    return {
        lat: Number((lat + offsetLat).toFixed(5)),
        lng: Number((lng + offsetLng).toFixed(5))
    };
}

window.syncMyLiveLocation = async (lat, lng, speedKmh = 0) => {
    if (!currentUser || !currentProfile) return;
    if (isAdminAccount()) return;

    const mode = currentProfile.privacy_mode || "precise";
    if (mode === "ghost" || currentProfile.ghost_mode) return;

    const coords = applyPrivacyCoordinates(lat, lng, mode);
    const bat = isNormalUserAccount() ? await getDeviceBatteryInfo() : { level: null, charging: false };

    const updatePayload = {
        last_lat: coords.lat,
        last_lng: coords.lng,
        last_seen: new Date().toISOString()
    };

    if (isNormalUserAccount()) {
        updatePayload.speed_kmh = speedKmh;
        if (bat.level !== null) {
            updatePayload.battery_level = bat.level;
            updatePayload.is_charging = bat.charging;
        }
    }

    await supabaseClient
        .from("profiles")
        .update(updatePayload)
        .eq("id", currentUser.id);
};

async function cyclePrivacyMode() {
    if (!currentUser || !currentProfile || isAdminAccount()) return;

    if (isBusinessAccount()) {
        const next = currentProfile.privacy_mode === "ghost" ? "precise" : "ghost";
        const isGhost = next === "ghost";

        const updateData = { privacy_mode: next, ghost_mode: isGhost };
        if (!isGhost && userPosition) {
            updateData.last_lat = userPosition.lat;
            updateData.last_lng = userPosition.lng;
        }

        await supabaseClient.from("profiles").update(updateData).eq("id", currentUser.id);
        currentProfile.privacy_mode = next;
        currentProfile.ghost_mode = isGhost;
        applyRoleUI();

        if (!isGhost) {
            try { await locateUser(); } catch (e) {}
            showToast("🏢 Sede da entidade agora visível para os seguidores!", "success");
        } else {
            showToast("📅 Modo Apenas Eventos ativo (sede ocultada do mapa).");
        }
        return;
    }

    const order = ["precise", "blurred", "ghost"];
    const currentIdx = order.indexOf(currentProfile.privacy_mode || "precise");
    const next = order[(currentIdx + 1) % order.length];
    const isGhost = next === "ghost";

    await supabaseClient
        .from("profiles")
        .update({ privacy_mode: next, ghost_mode: isGhost })
        .eq("id", currentUser.id);

    currentProfile.privacy_mode = next;
    currentProfile.ghost_mode = isGhost;
    applyRoleUI();

    if (next === "precise") {
        if (userPosition) window.syncMyLiveLocation(userPosition.lat, userPosition.lng);
        showToast("📍 Localização Precisa ativada para amigos.");
    } else if (next === "blurred") {
        if (userPosition) window.syncMyLiveLocation(userPosition.lat, userPosition.lng);
        showToast("🌫️ Modo Borrão ativado (zona aproximada).");
    } else {
        showToast("👻 Modo Fantasma ativado (estás invisível no mapa).");
    }
}

async function doQuickCheckin() {
    if (!currentUser || !currentProfile || !isNormalUserAccount()) return;
    let pos = userPosition;
    if (!pos) {
        try {
            pos = await locateUser();
        } catch (err) {
            showToast(err.message, "error");
            return;
        }
    }

    let placeName = "Localização atual";
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pos.lat}&lon=${pos.lng}`);
        const data = await res.json();
        placeName = data.name || data.address?.amenity || data.address?.road || data.address?.town || data.address?.city || "Local atual";
    } catch (e) {}

    const customPlace = prompt("Onde estás agora? (Check-in para amigos)", placeName);
    if (customPlace === null) return;
    const finalPlace = customPlace.trim() || placeName;

    await supabaseClient
        .from("profiles")
        .update({
            current_place: finalPlace,
            last_lat: pos.lat,
            last_lng: pos.lng,
            last_seen: new Date().toISOString()
        })
        .eq("id", currentUser.id);

    currentProfile.current_place = finalPlace;
    triggerBumpVisual("📌", `Check-in em ${finalPlace}!`);
}

function startLiveSocialSync() {
    if (locationSyncInterval) clearInterval(locationSyncInterval);
    if (geoWatchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(geoWatchId);
    if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
    if (bumpBroadcastChannel) supabaseClient.removeChannel(bumpBroadcastChannel);

    if (navigator.geolocation && currentProfile?.privacy_mode !== "ghost" && !isAdminAccount()) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                userPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                window.recordExplorationPoint(userPosition.lat, userPosition.lng);
                window.syncMyLiveLocation(userPosition.lat, userPosition.lng, 0);
            },
            () => {},
            { enableHighAccuracy: true, timeout: 8000 }
        );

        if (isNormalUserAccount()) {
            geoWatchId = navigator.geolocation.watchPosition(
                pos => {
                    userPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    const speedKmh = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
                    window.recordExplorationPoint(userPosition.lat, userPosition.lng);
                    window.syncMyLiveLocation(userPosition.lat, userPosition.lng, speedKmh);
                },
                () => {},
                { enableHighAccuracy: true, maximumAge: 15000, timeout: 12000 }
            );
        }
    }

    locationSyncInterval = setInterval(() => {
        if (userPosition && currentProfile?.privacy_mode !== "ghost" && !isAdminAccount()) {
            window.syncMyLiveLocation(userPosition.lat, userPosition.lng);
        }
    }, 30000);

    bumpBroadcastChannel = supabaseClient.channel("localspot_bump_live", {
        config: { presence: { key: currentUser.id } }
    });

    bumpBroadcastChannel
        .on("presence", { event: "sync" }, () => {
            const stateObj = bumpBroadcastChannel.presenceState();
            onlineUserIds = new Set(Object.keys(stateObj));
            renderFriendsModalContent();
            renderChatsTabContent();
            if (typeof showFriendsOnMap === "function") {
                showFriendsOnMap(window.getMapSocialEntities());
            }
        })
        .on("broadcast", { event: "friend_request_received" }, ({ payload }) => {
            if (!payload || String(payload.receiverId) !== String(currentUser.id)) return;
            const fid = payload.friendshipId ? String(payload.friendshipId) : null;
            if (fid && animatedIncomingFriendshipIds.has(fid)) return;
            if (fid) animatedIncomingFriendshipIds.add(fid);

            triggerFriendRequestAnimation(payload.sender, payload.friendshipId);
            sendBackgroundBumpNotification(
                "👊 Novo pedido de amizade!",
                `${payload.sender?.full_name || "Alguém"} quer adicionar-te aos amigos no LocalSpot!`
            );
            loadSocialData();
        })
        .on("broadcast", { event: "bump_shockwave" }, ({ payload }) => {
            if (!payload || String(payload.receiverId) !== String(currentUser.id)) return;

            const senderKey = String(payload.senderId);
            const isSuper = Boolean(payload.isSuper);
            const senderName = payload.senderName || "Um amigo";

            if (!isSuper) {
                recentIncomingBumpTs.set(senderKey, Date.now());
            } else {
                recentIncomingBumpTs.delete(senderKey);
            }

            const msgText = isSuper
                ? `⚡ SUPER BUMP com ${senderName}! (+2 pts)`
                : `👊 ${senderName} fez Bump contigo! Abana em 5s para Super Bump!`;

            triggerBumpVisual(isSuper ? "⚡" : (payload.emoji || "👊"), msgText, isSuper);
            sendBackgroundBumpNotification(
                isSuper ? "⚡ SUPER BUMP no LocalSpot!" : "👊 Novo Bump no LocalSpot!",
                msgText
            );

            if (typeof payload.lng === "number" && typeof triggerMapBumpShockwave === "function") {
                triggerMapBumpShockwave(payload.lng, payload.lat, isSuper ? "⚡" : (payload.emoji || "👊"), isSuper);
            }
            loadSocialData();
        })
        .on("broadcast", { event: "where_are_you_ping" }, ({ payload }) => {
            if (!payload || String(payload.receiverId) !== String(currentUser.id)) return;
            showIncomingPingCard(payload.senderId, payload.senderName || "Um amigo");
        })
        .on("broadcast", { event: "live_status" }, ({ payload }) => {
            if (!payload) return;
            const f = window.friendsList.find(x => String(x.id) === String(payload.userId));
            if (f) {
                f.status_emoji = payload.emoji;
                f.status_text = payload.text;
                if (typeof showFriendsOnMap === "function") showFriendsOnMap(window.getMapSocialEntities());
                renderFriendsModalContent();
            }
        })
        .on("broadcast", { event: "typing_indicator" }, ({ payload }) => {
            if (!payload || String(payload.receiverId) !== String(currentUser.id)) return;
            if (String(activeChatFriendId) !== String(payload.senderId)) return;
            const ind = $("chatTypingIndicator");
            if (!ind) return;
            ind.textContent = "A escrever...";
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => { ind.textContent = ""; }, 2200);
        })
        .subscribe(async status => {
            if (status === "SUBSCRIBED") {
                await bumpBroadcastChannel.track({
                    user_id: currentUser.id,
                    online_at: new Date().toISOString()
                });
            }
        });

    realtimeChannel = supabaseClient
        .channel("localspot_realtime_social")
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, payload => {
            const updated = payload.new;
            const idx = window.friendsList.findIndex(f => f.id === updated.id);
            if (idx !== -1) {
                const keepBumps = window.friendsList[idx].bump_count || 0;
                const keepSuper = window.friendsList[idx].super_bump_count || 0;
                window.friendsList[idx] = { ...updated, bump_count: keepBumps, super_bump_count: keepSuper };
                if (typeof showFriendsOnMap === "function") showFriendsOnMap(window.getMapSocialEntities());
                renderFriendsModalContent();
            }
            const entIdx = myFollowingProfiles.findIndex(e => e.id === updated.id);
            if (entIdx !== -1) {
                myFollowingProfiles[entIdx] = updated;
                if (typeof showFriendsOnMap === "function") showFriendsOnMap(window.getMapSocialEntities());
            }
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "friendships" }, payload => {
            const row = payload.new;
            if (row && String(row.addressee_id) === String(currentUser.id) && row.status === "pending") {
                loadSocialData({ triggerAnimForSenderId: row.requester_id });
            } else {
                loadSocialData();
            }
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "friendships" }, () => {
            loadSocialData();
        })
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "friendships" }, () => {
            loadSocialData();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "follows" }, async () => {
            await Promise.all([loadMyFollowing(), loadMyFollowers()]);
            if (typeof showFriendsOnMap === "function") showFriendsOnMap(window.getMapSocialEntities());
            if ($("entityNetworkModal") && !$("entityNetworkModal").classList.contains("hidden")) {
                renderEntityNetworkModal();
            }
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, payload => {
            const notif = payload.new;
            if (notif && String(notif.user_id) === String(currentUser.id)) {
                loadNotifications();
                if (notif.title && notif.title.includes("Bump")) {
                    const isSuper = notif.title.includes("SUPER");
                    triggerBumpVisual(isSuper ? "⚡" : "👊", notif.title, isSuper);
                } else if (!notif.title?.includes("pedido de amizade")) {
                    showToast(notif.title || "Nova notificação!");
                }
            }
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "friend_messages" }, payload => {
            const msg = payload.new;
            if (!msg || String(msg.receiver_id) !== String(currentUser.id)) return;

            lastChatMessageByFriend.set(String(msg.sender_id), msg);

            if (msg.msg_type === "emoji_bomb") {
                launchEmojiBombAnimation(msg.content);
            }

            if (String(activeChatFriendId) === String(msg.sender_id)) {
                loadChatHistory(activeChatFriendId);
            } else {
                const sender = window.friendsList.find(f => String(f.id) === String(msg.sender_id));
                const senderName = sender ? sender.full_name : "Um amigo";
                unreadMessagesBySender.set(String(msg.sender_id), (unreadMessagesBySender.get(String(msg.sender_id)) || 0) + 1);
                updateSocialBadges();
                renderFriendsModalContent();
                renderChatsTabContent();
                showToast(`💬 ${senderName}: ${msg.content}`);
                sendBackgroundBumpNotification(`💬 Mensagem de ${senderName}`, msg.content);
            }
        })
        .subscribe();
}

// ---------- Amizade nos Eventos ----------
async function loadAllEnrollmentsSummary() {
    try {
        const { data, error } = await supabaseClient
            .from("enrollments")
            .select("event_id, user_id, user_name");
        if (!error && data) {
            allEnrollmentsMap = new Map();
            data.forEach(row => {
                const key = String(row.event_id);
                if (!allEnrollmentsMap.has(key)) allEnrollmentsMap.set(key, []);
                allEnrollmentsMap.get(key).push(row);
            });
        }
    } catch (e) {}
}

window.getFriendsGoingToEvent = eventId => {
    const attendees = allEnrollmentsMap.get(String(eventId)) || [];
    if (!attendees.length || !window.friendsList.length) return [];
    const friendById = new Map(window.friendsList.map(f => [String(f.id), f]));
    return attendees
        .map(a => friendById.get(String(a.user_id)))
        .filter(Boolean);
};

// ==========================================
// NOTIFICAÇÕES E SEGUIDORES DE ORGANIZADORES
// ==========================================
async function createNotification(targetUserId, eventId, title, message) {
    if (!targetUserId || String(targetUserId) === String(currentUser?.id)) return;
    try {
        await supabaseClient.from("notifications").insert([{
            user_id: targetUserId,
            event_id: eventId,
            title,
            message
        }]);
    } catch (e) {}
}

async function notifyFollowersOfNewEvent(eventObj) {
    if (!currentUser || !currentProfile) return;
    try {
        const { data: followers } = await supabaseClient
            .from("follows")
            .select("follower_id")
            .eq("following_id", currentUser.id);

        if (followers && followers.length > 0) {
            const rows = followers.map(f => ({
                user_id: f.follower_id,
                event_id: eventObj.id,
                title: `Novo evento de ${currentProfile.full_name}`,
                message: `${eventObj.name} · ${formatEventDate(eventObj)}`
            }));
            await supabaseClient.from("notifications").insert(rows);
        }
    } catch (e) {}
}

async function loadNotifications() {
    if (!currentUser) return;
    try {
        const { data, error } = await supabaseClient
            .from("notifications")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false })
            .limit(20);

        if (!error && data) {
            notifications = data;
            renderNotifications();
        }
    } catch (e) {}
}

function renderNotifications() {
    const unread = notifications.filter(n => !n.is_read).length;
    notifBadge.textContent = unread;
    notifBadge.classList.toggle("hidden", unread === 0);

    if (!notifications.length) {
        notifList.innerHTML = `<p style="padding:14px; font-size:12.5px; color:var(--muted); margin:0;">Sem notificações recentes.</p>`;
        return;
    }

    notifList.innerHTML = notifications.map(n => `
        <div class="notif-item${n.is_read ? "" : " unread"}" data-nid="${n.id}" data-eid="${n.event_id || ""}">
            <strong>${escapeHTML(n.title)}</strong>
            <p>${escapeHTML(n.message)}</p>
        </div>
    `).join("");
}

notifBtn.addEventListener("click", e => {
    e.stopPropagation();
    notifDropdown.classList.toggle("hidden");
});

document.addEventListener("click", e => {
    if (!notifDropdown.contains(e.target) && e.target !== notifBtn) {
        notifDropdown.classList.add("hidden");
    }
    const moodPop = $("quickMoodPopover");
    const moodBtn = $("quickMoodMapBtn");
    if (moodPop && !moodPop.contains(e.target) && e.target !== moodBtn) {
        moodPop.classList.add("hidden");
    }
});

notifList.addEventListener("click", async e => {
    const item = e.target.closest(".notif-item");
    if (!item) return;
    const nid = item.dataset.nid;
    const eid = item.dataset.eid;

    await supabaseClient.from("notifications").update({ is_read: true }).eq("id", nid);
    await loadNotifications();
    notifDropdown.classList.add("hidden");

    if (eid) {
        window.openEventDetails(eid);
    } else if (isNormalUserAccount()) {
        openModal($("friendsModal"));
        $("tabFriendsAdd").click();
        await loadSocialData();
    }
});

$("markAllReadBtn").addEventListener("click", async () => {
    if (!currentUser) return;
    await supabaseClient.from("notifications").update({ is_read: true }).eq("user_id", currentUser.id);
    await loadNotifications();
});

async function loadMyFollowing() {
    if (!currentUser) return;
    try {
        const { data, error } = await supabaseClient
            .from("follows")
            .select("following_id, following_name")
            .eq("follower_id", currentUser.id);

        if (!error && data) {
            myFollowing = new Map(data.map(r => [String(r.following_id), r.following_name]));
            const ids = data.map(r => r.following_id).filter(Boolean);
            if (ids.length > 0) {
                const { data: profs } = await supabaseClient.from("profiles").select("*").in("id", ids);
                myFollowingProfiles = profs || [];
            } else {
                myFollowingProfiles = [];
            }
            if (typeof showFriendsOnMap === "function") {
                showFriendsOnMap(window.getMapSocialEntities());
            }
        }
    } catch (e) {}
}

async function toggleFollowOrganizer(organizerId, organizerName) {
    if (!currentUser || !organizerId || String(organizerId) === String(currentUser.id)) return;
    const key = String(organizerId);

    if (myFollowing.has(key)) {
        await supabaseClient.from("follows").delete()
            .eq("follower_id", currentUser.id)
            .eq("following_id", organizerId);
        myFollowing.delete(key);
        myFollowingProfiles = myFollowingProfiles.filter(p => String(p.id) !== key);
        showToast(`Deixaste de seguir ${organizerName}.`);
    } else {
        const { data: targetProf } = await supabaseClient
            .from("profiles")
            .select("*")
            .eq("id", organizerId)
            .maybeSingle();

        if (!targetProf || targetProf.role !== "business") {
            showToast("Só é possível seguir empresas ou entidades de domínio público.", "error");
            return;
        }

        await supabaseClient.from("follows").insert([{
            follower_id: currentUser.id,
            following_id: organizerId,
            following_name: organizerName
        }]);
        myFollowing.set(key, organizerName);
        myFollowingProfiles.push(targetProf);
        await createNotification(
            organizerId,
            null,
            "Novo seguidor! 🏛️",
            `${currentProfile.full_name} começou a seguir a sua entidade.`
        );
        showToast(`A seguir ${organizerName}!`, "success");
    }

    if (typeof showFriendsOnMap === "function") showFriendsOnMap(window.getMapSocialEntities());
    filterEvents();
}

// ==========================================
// CARREGAMENTO DE EVENTOS E INSCRIÇÕES (SUPABASE)
// ==========================================
function mapDbEvent(row) {
    return {
        id: row.id,
        creatorId: row.creator_id || null,
        creatorName: row.creator_name || "Organizador LocalSpot",
        creatorType: row.creator_type || null,
        creatorRole: row.creator_role || (row.creator_type === "Utilizador" ? "user" : (row.creator_type === "Admin" ? "admin" : "business")),
        creatorVerified: row.creator_verified === true,
        name: row.name,
        category: row.category,
        distrito: row.distrito,
        date: row.date,
        time: row.time,
        location: row.location,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        maxParticipants: row.max_participants ? Number(row.max_participants) : null,
        enrolled: Number(row.enrolled || 0),
        price: row.price || "Gratuito",
        externalUrl: row.external_url || "",
        description: row.description || "",
        image: row.image || DEFAULT_IMAGE
    };
}

async function loadEventsFromSupabase() {
    try {
        const { data, error } = await supabaseClient
            .from("events")
            .select("*")
            .order("date", { ascending: true });

        if (!error && Array.isArray(data)) {
            events = data.map(mapDbEvent);
            filterEvents();
        }
    } catch (e) {
        showToast("Erro ao carregar eventos.", "error");
    }
}

async function loadMyEnrollments() {
    if (!currentUser) return;
    try {
        const { data, error } = await supabaseClient
            .from("enrollments")
            .select("event_id")
            .eq("user_id", currentUser.id);

        if (!error && data) {
            myEnrollments = new Set(data.map(row => String(row.event_id)));
        }
    } catch (e) {}
}

// ---------- Inscrição em Eventos ----------
window.toggleEnrollment = async id => {
    if (!currentUser || !currentProfile) {
        showToast("Inicia sessão para te inscreveres.", "error");
        return;
    }

    const ev = events.find(x => String(x.id) === String(id));
    if (!ev) return;

    const strId = String(id);
    const isEnrolled = myEnrollments.has(strId);

    try {
        if (isEnrolled) {
            const { error } = await supabaseClient
                .from("enrollments")
                .delete()
                .eq("event_id", ev.id)
                .eq("user_id", currentUser.id);

            if (error) throw error;

            myEnrollments.delete(strId);
            ev.enrolled = Math.max(0, (ev.enrolled || 1) - 1);
            await supabaseClient.from("events").update({ enrolled: ev.enrolled }).eq("id", ev.id);
            showToast(`Inscrição cancelada em "${ev.name}".`);
        } else {
            if (ev.maxParticipants && ev.enrolled >= ev.maxParticipants) {
                showToast("Este evento já atingiu a lotação máxima.", "error");
                return;
            }

            const { error } = await supabaseClient
                .from("enrollments")
                .insert([{
                    event_id: ev.id,
                    user_id: currentUser.id,
                    user_name: currentProfile.full_name
                }]);

            if (error) throw error;

            myEnrollments.add(strId);
            ev.enrolled = (ev.enrolled || 0) + 1;
            await supabaseClient.from("events").update({ enrolled: ev.enrolled }).eq("id", ev.id);

            await createNotification(
                ev.creatorId,
                ev.id,
                "Nova inscrição no teu evento",
                `${currentProfile.full_name} inscreveu-se em "${ev.name}".`
            );

            showToast(`Inscrição confirmada em "${ev.name}"! 🎉`, "success");
        }

        await loadAllEnrollmentsSummary();
        filterEvents();
        if (!detailModal.classList.contains("hidden") && String(detailEventId) === strId) {
            window.openEventDetails(ev.id);
        }
    } catch (err) {
        showToast("Erro ao atualizar inscrição.", "error");
    }
};

// ==========================================
// PERFIL DO UTILIZADOR (AVATAR, VIBE, PRIVACIDADE & DADOS)
// ==========================================
function switchProfileTab(activeTabId, activePanelId) {
    ["tabMyEnrollments", "tabMyCreated", "tabMyFriends", "tabMyFollowing"].forEach(id => {
        if ($(id)) $(id).classList.toggle("active", id === activeTabId);
    });
    ["profileEnrolledList", "profileCreatedList", "profileFriendsList", "profileFollowingList"].forEach(id => {
        if ($(id)) $(id).classList.toggle("hidden", id !== activePanelId);
    });
}

userBadge.addEventListener("click", async () => {
    if (!currentUser || !currentProfile) return;
    const isBiz = isBusinessAccount();
    const isUser = isNormalUserAccount();
    const isAdm = isAdminAccount();

    $("profileEmailDisplay").textContent = currentUser.email;
    $("profileNameInput").value = currentProfile.full_name || "";
    $("profileBioInput").value = currentProfile.bio || "";
    if ($("profileAvatarInput")) $("profileAvatarInput").value = "";

    if ($("profileAvatarLabel")) {
        $("profileAvatarLabel").textContent = isBiz ? "Logótipo da Entidade / Empresa" : "Foto de Perfil";
    }

    if ($("businessOnlyProfileFields")) $("businessOnlyProfileFields").classList.toggle("hidden", !isBiz);
    if ($("userOnlyProfileFields")) $("userOnlyProfileFields").classList.toggle("hidden", !isUser);

    if ($("tabMyFriends")) $("tabMyFriends").classList.toggle("hidden", !isUser);
    if ($("tabMyFollowing")) {
        $("tabMyFollowing").classList.toggle("hidden", isAdm);
        $("tabMyFollowing").textContent = isBiz ? "Rede Institucional" : "Entidades";
    }
    if ($("replayOnboardingBtn")) {
        $("replayOnboardingBtn").classList.toggle("hidden", isAdm);
    }

    const statsBar = $("profileStatsBar");
    if (statsBar) {
        if (isBiz) {
            const createdCount = events.filter(e => String(e.creatorId) === String(currentUser.id)).length;
            const isVer = isEntityVerified(currentProfile);
            statsBar.innerHTML = `
                <span class="${isVer ? "verified-pill" : "unverified-pill"}">
                    ${isVer ? "✅ Entidade Oficial Verificada" : "⏳ Aguarda Verificação do Admin"}
                </span>
                <span class="profile-stat-pill">👥 ${myFollowersList.length} Seguidores</span>
                <span class="profile-stat-pill">📅 ${createdCount} Eventos</span>
            `;
        } else if (isUser) {
            const totalBumps = window.friendsList.reduce((acc, f) => acc + (f.bump_count || 0), 0);
            const bInfo = getAgeAndZodiac(currentProfile.birth_date);
            statsBar.innerHTML = `
                <span class="profile-stat-pill">👊 ${window.friendsList.length} Amigos</span>
                <span class="profile-stat-pill">🔥 ${totalBumps} pts Bump</span>
                <span class="profile-stat-pill">🗺️ ${explorationData.zones.length} Zonas</span>
                ${bInfo ? `<span class="profile-stat-pill">${bInfo.sign.emoji} ${bInfo.age} anos</span>` : ""}
            `;
        } else {
            statsBar.innerHTML = `<span class="profile-stat-pill">🛡️ Conta Administrador</span>`;
        }
    }

    if ($("profileAvatarPreview")) {
        $("profileAvatarPreview").className = `avatar-circle lg${isBiz ? " business-avatar" : (isAdm ? " admin-avatar" : "")}`;
        $("profileAvatarPreview").innerHTML = currentProfile.avatar_url
            ? `<img src="${escapeHTML(currentProfile.avatar_url)}" alt="">`
            : escapeHTML((currentProfile.full_name || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join(""));
    }

    if (isBiz) {
        if ($("profileBusinessTypeSelect") && currentProfile.business_type) {
            $("profileBusinessTypeSelect").value = currentProfile.business_type;
        }
        const curMode = currentProfile.privacy_mode || "precise";
        document.querySelectorAll("#businessPrivacyGrid .privacy-opt-btn").forEach(b => {
            b.classList.toggle("active", b.dataset.mode === curMode);
        });
    } else if (isUser) {
        if ($("profileBirthDateInput")) $("profileBirthDateInput").value = currentProfile.birth_date || "";
        if ($("profileCustomEmoji")) $("profileCustomEmoji").value = currentProfile.status_emoji || "📍";
        if ($("profileCustomStatus")) $("profileCustomStatus").value = currentProfile.status_text || "No LocalSpot";

        const curMode = currentProfile.privacy_mode || "precise";
        document.querySelectorAll("#privacySelectorGrid .privacy-opt-btn").forEach(b => {
            b.classList.toggle("active", b.dataset.mode === curMode);
        });
    }

    switchProfileTab("tabMyEnrollments", "profileEnrolledList");
    await Promise.all([loadSocialData(), loadMyFollowers(), loadMyFollowing()]);
    renderProfileLists();
    openModal(profileModal);
});

$("closeProfile").addEventListener("click", () => closeModalEl(profileModal));
profileModal.addEventListener("mousedown", e => { if (e.target === profileModal) closeModalEl(profileModal); });

$("tabMyEnrollments").addEventListener("click", () => switchProfileTab("tabMyEnrollments", "profileEnrolledList"));
$("tabMyCreated").addEventListener("click", () => switchProfileTab("tabMyCreated", "profileCreatedList"));
$("tabMyFollowing").addEventListener("click", () => switchProfileTab("tabMyFollowing", "profileFollowingList"));

async function uploadAvatarImage(file) {
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `avatars/${currentUser.id}_${Date.now()}.${ext}`;
    const { error } = await supabaseClient.storage
        .from("event-images")
        .upload(fileName, file, { cacheControl: "3600", upsert: true });

    if (error) throw error;
    const { data } = supabaseClient.storage.from("event-images").getPublicUrl(fileName);
    return data.publicUrl;
}

$("profileUpdateForm").addEventListener("submit", async e => {
    e.preventDefault();
    const newName = $("profileNameInput").value.trim();
    const newBio = $("profileBioInput").value.trim();
    const avatarFile = $("profileAvatarInput")?.files[0];

    if (!newName) return;

    const isBiz = isBusinessAccount();
    const isUser = isNormalUserAccount();
    let avatarUrl = currentProfile.avatar_url || null;

    try {
        if (avatarFile) {
            avatarUrl = await uploadAvatarImage(avatarFile);
        }
    } catch (err) {
        showToast("Não foi possível carregar a imagem.", "error");
    }

    const updatePayload = {
        full_name: newName,
        bio: newBio,
        avatar_url: avatarUrl
    };

    if (isBiz) {
        const newBizType = $("profileBusinessTypeSelect")?.value || currentProfile.business_type || "Empresa / Comércio";
        const activeBizBtn = document.querySelector("#businessPrivacyGrid .privacy-opt-btn.active");
        const newPrivacy = activeBizBtn ? activeBizBtn.dataset.mode : (currentProfile.privacy_mode || "precise");
        updatePayload.business_type = newBizType;
        updatePayload.status_text = newBizType;
        updatePayload.privacy_mode = newPrivacy;
        updatePayload.ghost_mode = newPrivacy === "ghost";
    } else if (isUser) {
        const newBirthDate = $("profileBirthDateInput")?.value || null;
        const newEmoji = ($("profileCustomEmoji")?.value || "📍").trim() || "📍";
        const newStatus = ($("profileCustomStatus")?.value || "No LocalSpot").trim() || "No LocalSpot";
        const activePrivBtn = document.querySelector("#privacySelectorGrid .privacy-opt-btn.active");
        const newPrivacy = activePrivBtn ? activePrivBtn.dataset.mode : (currentProfile.privacy_mode || "precise");

        updatePayload.birth_date = newBirthDate;
        updatePayload.status_emoji = newEmoji;
        updatePayload.status_text = newStatus;
        updatePayload.privacy_mode = newPrivacy;
        updatePayload.ghost_mode = newPrivacy === "ghost";
    }

    const { error } = await supabaseClient
        .from("profiles")
        .update(updatePayload)
        .eq("id", currentUser.id);

    if (error) {
        showToast("Erro ao atualizar perfil.", "error");
        return;
    }

    Object.assign(currentProfile, updatePayload);
    applyRoleUI();

    if (userPosition && updatePayload.privacy_mode !== "ghost") {
        window.syncMyLiveLocation(userPosition.lat, userPosition.lng);
    }

    showToast("Perfil atualizado com sucesso!", "success");
    closeModalEl(profileModal);
});

function renderProfileLists() {
    const enrolledEvents = events.filter(e => myEnrollments.has(String(e.id)));
    const createdEvents = events.filter(e => String(e.creatorId) === String(currentUser.id));

    $("profileEnrolledList").innerHTML = enrolledEvents.length
        ? enrolledEvents.map(ev => `
            <div class="profile-event-item">
                <div>
                    <strong>${escapeHTML(ev.name)}</strong>
                    <span>📅 ${escapeHTML(formatEventDate(ev))} · 📍 ${escapeHTML(ev.location)}</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="btn-soft" onclick="closeModalEl(profileModal); window.openTicketModal('${ev.id}')">🎟️ Bilhete</button>
                    <button type="button" class="btn-soft" onclick="closeModalEl(profileModal); window.openEventDetails('${ev.id}')">Abrir</button>
                </div>
            </div>
        `).join("")
        : `<p class="muted" style="font-size:13px;">Ainda não estás inscrito em nenhum evento.</p>`;

    $("profileCreatedList").innerHTML = createdEvents.length
        ? createdEvents.map(ev => `
            <div class="profile-event-item">
                <div>
                    <strong>${escapeHTML(ev.name)}</strong>
                    <span>👥 ${ev.enrolled || 0} inscritos · 📅 ${escapeHTML(formatEventDate(ev))}</span>
                </div>
                <button type="button" class="btn-soft" onclick="closeModalEl(profileModal); window.openEventDetails('${ev.id}')">Gerir</button>
            </div>
        `).join("")
        : `<p class="muted" style="font-size:13px;">Ainda não criaste nenhum evento.</p>`;

    if ($("profileFriendsList") && isNormalUserAccount()) {
        $("profileFriendsList").innerHTML = window.friendsList.length
            ? window.friendsList.map(f => `
                <div class="profile-event-item">
                    <div>
                        <strong>${escapeHTML(f.full_name)} <small style="color:#f9a8d4;">👊${f.bump_count || 0} pts</small></strong>
                        <span>${escapeHTML(f.status_emoji || "📍")} ${escapeHTML(f.status_text || "Online")}</span>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button type="button" class="btn-bump" onclick="window.sendBump('${f.id}', '👊', 'Bump!')">👊</button>
                        <button type="button" class="btn-soft" onclick="closeModalEl(profileModal); window.openFriendChat('${f.id}')">💬</button>
                        <button type="button" class="btn-logout" onclick="window.removeFriend('${f.id}', '${escapeHTML(f.full_name)}')">Remover</button>
                    </div>
                </div>
            `).join("")
            : `<p class="muted" style="font-size:13px;">Ainda não tens amigos adicionados.</p>`;
    }

    const followingArr = Array.from(myFollowing.entries());
    $("profileFollowingList").innerHTML = followingArr.length
        ? followingArr.map(([id, name]) => `
            <div class="profile-event-item">
                <div>
                    <strong>🏛️ ${escapeHTML(name)}</strong>
                    <span>Entidade seguida</span>
                </div>
                <button type="button" class="btn-logout" onclick="toggleFollowOrganizer('${id}', '${escapeHTML(name)}').then(renderProfileLists)">Deixar de seguir</button>
            </div>
        `).join("")
        : `<p class="muted" style="font-size:13px;">Ainda não segues nenhuma empresa ou entidade.</p>`;
}

// ==========================================
// PAINEL DO ADMINISTRADOR (GERIR CONTAS & VERIFICAR ENTIDADES)
// ==========================================
adminPanelBtn.addEventListener("click", async () => {
    if (!isAdminAccount()) return;
    openModal(adminModal);
    await loadAdminDashboard();
});

$("closeAdmin").addEventListener("click", () => closeModalEl(adminModal));
adminModal.addEventListener("mousedown", e => { if (e.target === adminModal) closeModalEl(adminModal); });

async function loadAdminDashboard() {
    const listEl = $("adminUsersList");
    const statsEl = $("adminStatsGrid");
    listEl.innerHTML = `<p class="muted">A carregar contas...</p>`;

    const { data: profiles, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

    if (error || !profiles) {
        listEl.innerHTML = `<p class="form-error">Erro ao carregar utilizadores.</p>`;
        return;
    }

    const totalUsers = profiles.length;
    const totalBusinesses = profiles.filter(p => p.role === "business").length;
    const verifiedEntities = profiles.filter(p => isEntityVerified(p)).length;
    const totalEvents = events.length;

    statsEl.innerHTML = `
        <div class="admin-stat-card"><strong>${totalUsers}</strong><span>Contas</span></div>
        <div class="admin-stat-card"><strong>${totalBusinesses}</strong><span>Entidades</span></div>
        <div class="admin-stat-card"><strong>${verifiedEntities}</strong><span>Verificadas</span></div>
        <div class="admin-stat-card"><strong>${totalEvents}</strong><span>Eventos</span></div>
    `;

    listEl.innerHTML = profiles.map(p => {
        const isSelf = currentUser && p.id === currentUser.id;
        const isBiz = p.role === "business";
        const isVer = isEntityVerified(p);
        const typeLabel = isBiz
            ? `👔 ${escapeHTML(p.business_type || "Empresa / Domínio Público")}`
            : (p.role === "admin" ? "🛡️ Administrador" : "👤 Utilizador Normal");

        return `
            <div class="admin-user-row">
                <div class="admin-user-info">
                    <strong>${escapeHTML(p.full_name || "Sem nome")}${verifiedBadgeHTML(p)} ${isSelf ? "<small>(Tu)</small>" : ""}</strong>
                    <span>${escapeHTML(p.email)} · ${typeLabel}</span>
                </div>
                <div class="admin-row-controls">
                    ${isBiz ? `
                        <button type="button" class="${isVer ? "btn-unverify" : "btn-verify"}" onclick="window.toggleEntityVerification('${p.id}', ${isVer})">
                            ${isVer ? "✅ Verificada" : "Verificar"}
                        </button>
                    ` : ""}
                    <select class="admin-role-select" onchange="window.changeUserRole('${p.id}', this.value)" ${isSelf ? "disabled" : ""}>
                        <option value="user" ${p.role === "user" ? "selected" : ""}>Utilizador</option>
                        <option value="business" ${p.role === "business" ? "selected" : ""}>Empresa / Público</option>
                        <option value="admin" ${p.role === "admin" ? "selected" : ""}>Admin</option>
                    </select>
                </div>
            </div>
        `;
    }).join("");
}

window.toggleEntityVerification = async (userId, currentlyVerified) => {
    if (!isAdminAccount()) return;
    const nextVerified = !currentlyVerified;
    const nextEmoji = nextVerified ? "✅" : "🏢";

    let { error } = await supabaseClient
        .from("profiles")
        .update({ is_verified: nextVerified, status_emoji: nextEmoji })
        .eq("id", userId);

    if (error) {
        const fallback = await supabaseClient
            .from("profiles")
            .update({ status_emoji: nextEmoji })
            .eq("id", userId);
        error = fallback.error;
    }

    if (error) {
        showToast("Erro ao atualizar verificação.", "error");
        return;
    }

    await supabaseClient
        .from("events")
        .update({ creator_verified: nextVerified })
        .eq("creator_id", userId);

    await createNotification(
        userId,
        null,
        nextVerified ? "✅ Entidade Oficial Verificada!" : "Estado de verificação atualizado",
        nextVerified
            ? "A sua entidade recebeu o selo oficial de verificação no LocalSpot!"
            : "O selo de verificação da sua conta foi alterado pelo administrador."
    );

    showToast(nextVerified ? "Selo oficial atribuído!" : "Selo removido.", "success");
    await loadAdminDashboard();
    await loadEventsFromSupabase();
};

window.changeUserRole = async (userId, newRole) => {
    if (!isAdminAccount()) return;
    const businessType = newRole === "business" ? "Empresa / Domínio Público" : null;
    const { error } = await supabaseClient.from("profiles").update({ role: newRole, business_type: businessType }).eq("id", userId);

    if (error) {
        showToast("Erro ao atualizar tipo de conta.", "error");
        return;
    }

    showToast("Tipo de conta atualizado!", "success");
    await loadAdminDashboard();
};

// ==========================================
// FILTROS, PESQUISA E RENDERIZAÇÃO DA LISTA
// ==========================================
function populateDistricts() {
    DISTRITOS.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        districtFilter.appendChild(opt);
    });
}

function getFilteredEvents() {
    const query = state.search.trim().toLowerCase();

    return events
        .map(ev => ({
            ...ev,
            distance: userPosition
                ? distanceKm(userPosition.lat, userPosition.lng, ev.latitude, ev.longitude)
                : null
        }))
        .filter(ev => {
            if (state.category !== "all" && ev.category !== state.category) return false;
            if (state.district !== "all" && ev.distrito !== state.district) return false;
            if (state.onlyFavorites && !favorites.has(String(ev.id))) return false;
            if (state.onlyFree && !isEventFree(ev)) return false;
            if (state.onlyFollowing && (!ev.creatorId || !myFollowing.has(String(ev.creatorId)))) return false;

            if (state.period === "upcoming" && isEventPast(ev)) return false;
            if (state.period === "today" && !isEventToday(ev)) return false;
            if (state.period === "week" && !isEventThisWeek(ev)) return false;
            if (state.period === "past" && !isEventPast(ev)) return false;

            if (ev.distance !== null && state.radius < 300 && ev.distance > state.radius) return false;

            if (query) {
                const text = `${ev.name} ${ev.location} ${ev.distrito} ${ev.description} ${ev.category} ${ev.creatorName || ""}`.toLowerCase();
                if (!text.includes(query)) return false;
            }
            return true;
        })
        .sort((a, b) => {
            if (state.sort === "distance" && a.distance !== null && b.distance !== null) {
                return a.distance - b.distance;
            }
            if (state.sort === "popular") {
                return (b.enrolled || 0) - (a.enrolled || 0);
            }
            return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
        });
}

function canManageEvent(ev) {
    if (!currentUser || !currentProfile) return false;
    if (isAdminAccount()) return true;
    return ev.creatorId && String(ev.creatorId) === String(currentUser.id);
}

function renderList(list) {
    currentList = list;
    const total = list.length;
    eventCount.textContent = total === 1 ? "1 evento encontrado" : `${total} eventos encontrados`;
    emptyState.classList.toggle("hidden", total > 0);
    eventsList.innerHTML = "";

    list.forEach(ev => {
        const isFav = favorites.has(String(ev.id));
        const isRegistered = myEnrollments.has(String(ev.id));
        const past = isEventPast(ev);
        const full = ev.maxParticipants && ev.enrolled >= ev.maxParticipants;
        const canManage = canManageEvent(ev);
        const friendsGoing = window.getFriendsGoingToEvent(ev.id);

        const distText = ev.distance !== null
            ? ` · <strong>${ev.distance < 1 ? Math.round(ev.distance * 1000) + " m" : ev.distance.toFixed(1) + " km"}</strong>`
            : "";

        let regBtnText = "Inscrever-me";
        if (past) regBtnText = "Evento terminado";
        else if (isRegistered) regBtnText = "✓ Inscrito";
        else if (full) regBtnText = "Lotação esgotada";

        const isOrgBiz = ev.creatorRole === "business" || (ev.creatorType && ev.creatorType !== "Utilizador" && ev.creatorType !== "Admin");
        const isOrgAdm = ev.creatorRole === "admin" || ev.creatorType === "Admin";
        const orgTagClass = isOrgAdm ? "admin-tag" : (isOrgBiz ? "" : "user-tag");
        const orgPrefix = isOrgAdm ? "🛡️" : (isOrgBiz ? "🏛️" : "👤");
        const orgVerBadge = (isOrgBiz && ev.creatorVerified) ? `<span class="verified-check">✓</span>` : "";

        const card = document.createElement("article");
        card.className = "event-card" + (String(ev.id) === String(activeId) ? " active" : "");
        card.dataset.id = ev.id;
        card.innerHTML = `
            <div class="event-image-wrap">
                <img class="event-image" src="${escapeHTML(ev.image || DEFAULT_IMAGE)}" alt="${escapeHTML(ev.name)}" loading="lazy" onerror="this.src='${DEFAULT_IMAGE}'">
                ${past ? `<span class="badge-past">Terminado</span>` : ""}
                <span class="badge-price-card">${escapeHTML(ev.price || "Gratuito")}</span>
                <button class="fav-btn ${isFav ? "on" : ""}" data-fav="${ev.id}" title="Guardar favorito" aria-label="Guardar favorito">
                    ${isFav ? "★" : "☆"}
                </button>
            </div>
            <div class="event-meta">
                <span class="category" style="--cat:${getCategoryColor(ev.category)}">
                    ${getCategoryEmoji(ev.category)} ${escapeHTML(ev.category)}
                </span>
            </div>
            <h4>${escapeHTML(ev.name)}</h4>
            <div class="organizer-tag ${orgTagClass}">${orgPrefix} ${escapeHTML(ev.creatorName)}${orgVerBadge}</div>
            ${friendsGoing.length > 0 ? `<div class="friends-going-badge">👊 ${friendsGoing.map(f => escapeHTML(f.full_name.split(" ")[0])).join(", ")} vai</div>` : ""}
            <p>📅 ${escapeHTML(formatEventDate(ev))} às ${escapeHTML(ev.time)}</p>
            <p>📍 ${escapeHTML(ev.location)} · ${escapeHTML(ev.distrito)}${distText}</p>
            <div class="registration-info">
                👥 ${ev.enrolled || 0}${ev.maxParticipants ? " / " + ev.maxParticipants : ""} inscritos
            </div>
            <div class="card-actions-grid">
                <button type="button" class="register-btn ${isRegistered ? "registered" : ""}" onclick="event.stopPropagation(); window.toggleEnrollment('${ev.id}')" ${past || (!isRegistered && full) ? "disabled" : ""}>
                    ${regBtnText}
                </button>
                <button type="button" class="details-btn" onclick="event.stopPropagation(); window.openEventDetails('${ev.id}')">
                    Detalhes
                </button>
            </div>
            ${canManage ? `
                <div class="owner-card-bar">
                    <button type="button" class="edit-btn" onclick="event.stopPropagation(); window.openEditEvent('${ev.id}')">✏️ Editar</button>
                    <button type="button" class="delete-btn" onclick="event.stopPropagation(); window.deleteEvent('${ev.id}')">🗑️ Eliminar</button>
                </div>
            ` : ""}
        `;

        card.addEventListener("click", e => {
            if (e.target.closest("button")) return;
            selectEvent(ev.id);
            if (window.innerWidth <= 820) setMobileView("map");
        });

        eventsList.appendChild(card);
    });
}

function filterEvents() {
    const filtered = getFilteredEvents();
    renderList(filtered);
    showEventsOnMap(filtered);
}

function selectEvent(id, { scroll = false } = {}) {
    activeId = id;
    document.querySelectorAll(".event-card").forEach(c => {
        c.classList.toggle("active", String(c.dataset.id) === String(id));
    });
    focusEventOnMap(id);

    if (scroll) {
        const card = document.querySelector(`.event-card[data-id="${id}"]`);
        if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}

window.handleMarkerClick = id => {
    selectEvent(id, { scroll: true });
};

// ==========================================
// DETALHES DO EVENTO, BILHETE QR, PARTILHA, AVALIAÇÕES E COMENTÁRIOS
// ==========================================
function updateDetailSocialButton(ev) {
    const followBtn = $("detailFollowBtn");
    if (!followBtn) return;

    if (!ev.creatorId || !currentUser || String(ev.creatorId) === String(currentUser.id)) {
        followBtn.classList.add("hidden");
        return;
    }

    const isOrgBiz = ev.creatorRole === "business" || (ev.creatorType && ev.creatorType !== "Utilizador" && ev.creatorType !== "Admin");
    const isOrgUser = ev.creatorRole === "user" || ev.creatorType === "Utilizador";

    if (isOrgBiz) {
        followBtn.classList.remove("hidden");
        const isFollowing = myFollowing.has(String(ev.creatorId));
        followBtn.textContent = isFollowing ? "✓ A seguir" : "+ Seguir";
        followBtn.onclick = async () => {
            await toggleFollowOrganizer(ev.creatorId, ev.creatorName);
            updateDetailSocialButton(ev);
        };
    } else if (isOrgUser && isNormalUserAccount()) {
        followBtn.classList.remove("hidden");
        const isFriend = window.friendsList.some(f => String(f.id) === String(ev.creatorId));
        const isSent = sentFriendRequestIds.has(ev.creatorId);

        if (isFriend) {
            followBtn.textContent = "💬 Conversar";
            followBtn.onclick = () => {
                closeModalEl(detailModal);
                window.openFriendChat(ev.creatorId);
            };
        } else if (isSent) {
            followBtn.textContent = "✈️ Pedido enviado";
            followBtn.onclick = null;
        } else {
            followBtn.textContent = "👊 Adicionar Amigo";
            followBtn.onclick = () => window.sendFriendRequest(ev.creatorId, ev.creatorName);
        }
    } else {
        followBtn.classList.add("hidden");
    }
}

window.openEventDetails = async id => {
    const ev = events.find(x => String(x.id) === String(id));
    if (!ev) return;

    detailEventId = ev.id;
    const isRegistered = myEnrollments.has(String(ev.id));
    const isFav = favorites.has(String(ev.id));
    const past = isEventPast(ev);
    const full = ev.maxParticipants && ev.enrolled >= ev.maxParticipants;
    const canManage = canManageEvent(ev);

    $("detailHeroImg").src = ev.image || DEFAULT_IMAGE;
    $("detailHeroImg").onerror = () => { $("detailHeroImg").src = DEFAULT_IMAGE; };
    $("detailCategory").textContent = `${getCategoryEmoji(ev.category)} ${ev.category}`;
    $("detailPrice").textContent = ev.price || "Gratuito";

    const isOrgBiz = ev.creatorRole === "business" || (ev.creatorType && ev.creatorType !== "Utilizador" && ev.creatorType !== "Admin");
    const isOrgAdm = ev.creatorRole === "admin" || ev.creatorType === "Admin";
    const orgTagClass = isOrgAdm ? "admin-tag" : (isOrgBiz ? "" : "user-tag");
    const orgPrefix = isOrgAdm ? "🛡️" : (isOrgBiz ? "🏛️" : "👤");
    const orgVerBadge = (isOrgBiz && ev.creatorVerified) ? `<span class="verified-check">✓</span>` : "";

    $("detailOrganizer").className = `organizer-tag ${orgTagClass}`;
    $("detailOrganizer").innerHTML = `${orgPrefix} Organizado por ${escapeHTML(ev.creatorName)}${orgVerBadge}`;
    $("detailTitle").textContent = ev.name;
    $("detailDescription").textContent = ev.description || "Sem descrição adicional.";
    $("detailDateTime").textContent = `${formatEventDate(ev)} às ${ev.time}`;
    $("detailLocation").textContent = `${ev.location} (${ev.distrito})`;
    $("detailCapacity").textContent = `${ev.enrolled || 0}${ev.maxParticipants ? " / " + ev.maxParticipants : " inscritos"}`;

    updateDetailSocialButton(ev);

    const extLink = $("detailExternalLink");
    if (ev.externalUrl) {
        extLink.href = ev.externalUrl;
        extLink.classList.remove("hidden");
    } else {
        extLink.classList.add("hidden");
    }

    const regBtn = $("detailRegisterBtn");
    regBtn.className = `register-btn ${isRegistered ? "registered" : ""}`;
    regBtn.disabled = past || (!isRegistered && full);
    regBtn.textContent = past ? "Evento terminado" : (isRegistered ? "✓ Inscrito (Cancelar)" : (full ? "Lotação esgotada" : "Inscrever-me neste evento"));
    regBtn.onclick = () => window.toggleEnrollment(ev.id);

    const ticketBtn = $("detailTicketBtn");
    ticketBtn.classList.toggle("hidden", !isRegistered);
    ticketBtn.onclick = () => window.openTicketModal(ev.id);

    const favBtn = $("detailFavBtn");
    favBtn.textContent = isFav ? "★ Guardado" : "☆ Guardar";
    favBtn.onclick = () => {
        toggleFavorite(ev.id);
        favBtn.textContent = favorites.has(String(ev.id)) ? "★ Guardado" : "☆ Guardar";
    };

    $("detailDirectionsBtn").href = `https://www.google.com/maps/dir/?api=1&destination=${ev.latitude},${ev.longitude}`;
    $("detailCalendarBtn").onclick = () => downloadEventICS(ev);
    $("detailShareBtn").onclick = () => shareEventLink(ev);
    $("detailReportBtn").onclick = () => openReportModal(ev);

    const ownerBar = $("detailOwnerBar");
    ownerBar.classList.toggle("hidden", !canManage);
    $("detailEditBtn").onclick = () => { closeModalEl(detailModal); window.openEditEvent(ev.id); };
    $("detailDeleteBtn").onclick = () => { closeModalEl(detailModal); window.deleteEvent(ev.id); };

    $("reviewForm").classList.toggle("hidden", !past);

    openModal(detailModal);
    await Promise.all([
        loadEventAttendees(ev.id),
        loadEventComments(ev.id),
        loadEventReviews(ev.id)
    ]);
};

$("closeDetail").addEventListener("click", () => closeModalEl(detailModal));
detailModal.addEventListener("mousedown", e => { if (e.target === detailModal) closeModalEl(detailModal); });

window.openTicketModal = id => {
    const ev = events.find(x => String(x.id) === String(id));
    if (!ev || !currentUser || !currentProfile) return;

    const code = `LS-${String(ev.id).slice(0, 6).toUpperCase()}-${currentUser.id.slice(0, 6).toUpperCase()}`;
    const qrPayload = encodeURIComponent(`LocalSpot Ticket | ${code} | ${ev.name} | ${currentProfile.full_name}`);

    $("ticketEventTitle").textContent = ev.name;
    $("ticketEventMeta").textContent = `📅 ${formatEventDate(ev)} às ${ev.time} · 📍 ${ev.location}`;
    $("ticketQrImage").src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrPayload}`;
    $("ticketCodeText").textContent = code;
    $("ticketHolderName").textContent = `Participante: ${currentProfile.full_name}`;

    openModal(ticketModal);
};

$("closeTicket").addEventListener("click", () => closeModalEl(ticketModal));
ticketModal.addEventListener("mousedown", e => { if (e.target === ticketModal) closeModalEl(ticketModal); });

function downloadEventICS(ev) {
    const dtStart = `${ev.date.replace(/-/g, "")}T${ev.time.replace(":", "")}00`;
    const icsContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//LocalSpot//Eventos//PT",
        "BEGIN:VEVENT",
        `SUMMARY:${ev.name}`,
        `DTSTART:${dtStart}`,
        `LOCATION:${ev.location}, ${ev.distrito}`,
        `DESCRIPTION:${(ev.description || "").replace(/\n/g, " ")}`,
        "END:VEVENT",
        "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ev.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Ficheiro de calendário (.ics) transferido!", "success");
}

async function shareEventLink(ev) {
    const shareUrl = `${window.location.origin}${window.location.pathname}?event=${ev.id}`;
    if (navigator.share) {
        try {
            await navigator.share({ title: ev.name, text: `Vê este evento no LocalSpot: ${ev.name}`, url: shareUrl });
            return;
        } catch (e) {}
    }
    try {
        await navigator.clipboard.writeText(shareUrl);
        showToast("Link do evento copiado para a área de transferência!", "success");
    } catch (e) {
        showToast(`Link: ${shareUrl}`);
    }
}

function checkSharedEventUrl() {
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get("event");
    if (sharedId) {
        const exists = events.find(e => String(e.id) === String(sharedId));
        if (exists) {
            selectEvent(exists.id, { scroll: true });
            window.openEventDetails(exists.id);
        }
    }
}

function openReportModal(ev) {
    $("reportEventName").textContent = `A denunciar: ${ev.name}`;
    $("reportDetails").value = "";
    openModal(reportModal);
}

$("closeReport").addEventListener("click", () => closeModalEl(reportModal));
reportModal.addEventListener("mousedown", e => { if (e.target === reportModal) closeModalEl(reportModal); });

$("reportForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!currentUser || !detailEventId) return;

    const { error } = await supabaseClient.from("event_reports").insert([{
        event_id: detailEventId,
        reporter_id: currentUser.id,
        reason: $("reportReason").value,
        details: $("reportDetails").value.trim()
    }]);

    if (error) {
        showToast("Não foi possível registar a denúncia.", "error");
        return;
    }

    closeModalEl(reportModal);
    showToast("Denúncia enviada à equipa de moderação.", "success");
});

// Participantes, Comentários e Avaliações
async function loadEventAttendees(eventId) {
    const listEl = $("detailAttendeesList");
    listEl.innerHTML = `<span class="muted">A carregar participantes...</span>`;

    const { data, error } = await supabaseClient
        .from("enrollments")
        .select("user_id, user_name")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

    if (error || !data || data.length === 0) {
        listEl.innerHTML = `<span class="muted">Ainda sem inscritos. Sê o primeiro!</span>`;
        return;
    }

    const friendIds = new Set(window.friendsList.map(f => String(f.id)));

    listEl.innerHTML = data.map(row => {
        const isFriend = friendIds.has(String(row.user_id));
        return `<span class="attendee-pill ${isFriend ? "friend-attendee" : ""}">${isFriend ? "👊" : "👤"} ${escapeHTML(row.user_name || "Participante")}</span>`;
    }).join("");
}

async function loadEventComments(eventId) {
    const listEl = $("detailCommentsList");
    listEl.innerHTML = `<span class="muted">A carregar comentários...</span>`;

    const { data, error } = await supabaseClient
        .from("event_comments")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

    if (error || !data || data.length === 0) {
        listEl.innerHTML = `<p class="muted" style="font-size:13px;">Sem comentários ainda. Deixa a tua mensagem!</p>`;
        return;
    }

    listEl.innerHTML = data.map(c => {
        const canDel = currentUser && (String(c.user_id) === String(currentUser.id) || isAdminAccount());
        return `
            <div class="comment-item">
                <div class="comment-head">
                    <strong>${escapeHTML(c.user_name)}</strong>
                    ${canDel ? `<button type="button" class="btn-link small" onclick="window.deleteComment(${c.id})">Apagar</button>` : ""}
                </div>
                <p>${escapeHTML(c.content)}</p>
            </div>
        `;
    }).join("");
}

$("commentForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!currentUser || !currentProfile || !detailEventId) return;

    const input = $("commentInput");
    const content = input.value.trim();
    if (!content) return;

    const { error } = await supabaseClient.from("event_comments").insert([{
        event_id: detailEventId,
        user_id: currentUser.id,
        user_name: currentProfile.full_name,
        content
    }]);

    if (error) {
        showToast("Erro ao publicar comentário.", "error");
        return;
    }

    const ev = events.find(x => String(x.id) === String(detailEventId));
    if (ev) {
        await createNotification(
            ev.creatorId,
            ev.id,
            `Novo comentário em "${ev.name}"`,
            `${currentProfile.full_name}: "${content.slice(0, 60)}"`
        );
    }

    input.value = "";
    await loadEventComments(detailEventId);
    showToast("Comentário publicado!", "success");
});

window.deleteComment = async commentId => {
    await supabaseClient.from("event_comments").delete().eq("id", commentId);
    if (detailEventId) await loadEventComments(detailEventId);
};

async function loadEventReviews(eventId) {
    const listEl = $("detailReviewsList");
    const badgeEl = $("detailRatingBadge");

    const { data, error } = await supabaseClient
        .from("event_reviews")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) {
        badgeEl.classList.add("hidden");
        listEl.innerHTML = `<p class="muted" style="font-size:13px;">Ainda sem avaliações para este evento.</p>`;
        return;
    }

    const avg = (data.reduce((sum, r) => sum + Number(r.rating), 0) / data.length).toFixed(1);
    badgeEl.textContent = `⭐ ${avg} (${data.length})`;
    badgeEl.classList.remove("hidden");

    listEl.innerHTML = data.map(r => `
        <div class="comment-item">
            <div class="comment-head">
                <strong>${escapeHTML(r.user_name)} · ${"⭐".repeat(r.rating)}</strong>
            </div>
            ${r.comment ? `<p>${escapeHTML(r.comment)}</p>` : ""}
        </div>
    `).join("");
}

$("reviewForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!currentUser || !currentProfile || !detailEventId) return;

    const rating = Number($("reviewRating").value);
    const comment = $("reviewComment").value.trim();

    const { error } = await supabaseClient.from("event_reviews").upsert([{
        event_id: detailEventId,
        user_id: currentUser.id,
        user_name: currentProfile.full_name,
        rating,
        comment
    }], { onConflict: "event_id,user_id" });

    if (error) {
        showToast("Erro ao guardar avaliação.", "error");
        return;
    }

    $("reviewComment").value = "";
    await loadEventReviews(detailEventId);
    showToast("Avaliação registada! Obrigado.", "success");
});

// ==========================================
// CRIAR, EDITAR E ELIMINAR EVENTOS
// ==========================================
function openModal(el) {
    el.classList.remove("hidden");
    el.setAttribute("aria-hidden", "false");
}

function closeModalEl(el) {
    el.classList.add("hidden");
    el.setAttribute("aria-hidden", "true");
}

function updateCoordsDisplay() {
    if (pendingLocation) {
        coordsText.innerHTML = `<span class="ok">📍 ${pendingLocation.lat.toFixed(5)}, ${pendingLocation.lng.toFixed(5)}</span>`;
    } else {
        coordsText.textContent = "Localização ainda não selecionada";
    }
}

addEventButton.addEventListener("click", () => {
    if (!currentUser) return;
    editingEventId = null;
    $("eventModalTitle").textContent = "Novo Evento";
    $("submitEventBtn").textContent = "Publicar Evento";
    eventForm.reset();
    $("eventPrice").value = "Gratuito";
    imagePreview.classList.add("hidden");
    formError.classList.add("hidden");
    pendingLocation = null;
    updateCoordsDisplay();
    openModal(modal);
});

window.openEditEvent = id => {
    const ev = events.find(x => String(x.id) === String(id));
    if (!ev || !canManageEvent(ev)) return;

    editingEventId = ev.id;
    $("eventModalTitle").textContent = "Editar Evento";
    $("submitEventBtn").textContent = "Guardar Alterações";
    formError.classList.add("hidden");

    $("eventName").value = ev.name;
    $("eventCategory").value = ev.category;
    $("eventDistrito").value = ev.distrito;
    $("eventDate").value = ev.date;
    $("eventTime").value = ev.time;
    $("eventLocation").value = ev.location;
    $("eventMaxParticipants").value = ev.maxParticipants || "";
    $("eventPrice").value = ev.price || "Gratuito";
    $("eventExternalUrl").value = ev.externalUrl || "";
    $("eventDescription").value = ev.description || "";

    pendingLocation = { lat: ev.latitude, lng: ev.longitude };
    updateCoordsDisplay();

    if (ev.image) {
        imagePreview.src = ev.image;
        imagePreview.classList.remove("hidden");
    } else {
        imagePreview.classList.add("hidden");
    }

    openModal(modal);
};

window.deleteEvent = async id => {
    const ev = events.find(x => String(x.id) === String(id));
    if (!ev || !canManageEvent(ev)) return;
    if (!confirm(`Tens a certeza que queres eliminar "${ev.name}"?`)) return;

    const { error } = await supabaseClient.from("events").delete().eq("id", ev.id);
    if (error) {
        showToast("Erro ao eliminar evento.", "error");
        return;
    }

    events = events.filter(x => String(x.id) !== String(id));
    filterEvents();
    showToast("Evento eliminado com sucesso.");
};

closeModal.addEventListener("click", () => {
    closeModalEl(modal);
    stopLocationPicking();
});

modal.addEventListener("mousedown", e => {
    if (e.target === modal) {
        closeModalEl(modal);
        stopLocationPicking();
    }
});

changeLocationButton.addEventListener("click", () => {
    closeModalEl(modal);
    pickBanner.classList.remove("hidden");
    if (window.innerWidth <= 820) setMobileView("map");

    startLocationPicking(coords => {
        pendingLocation = coords;
        updateCoordsDisplay();
        pickBanner.classList.add("hidden");
        openModal(modal);
    });
});

$("cancelPickButton").addEventListener("click", () => {
    stopLocationPicking();
    pickBanner.classList.add("hidden");
    openModal(modal);
});

$("pickSearchBtn").addEventListener("click", async () => {
    const q = $("pickSearchInput").value.trim();
    if (!q) return;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=pt&limit=1&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        map.flyTo({ center: [lng, lat], zoom: 16 });
        showToast(`Mapa centrado em ${data[0].display_name.split(",")[0]}`);
    } else {
        showToast("Morada não encontrada.", "error");
    }
});

eventImageInput.addEventListener("change", () => {
    const file = eventImageInput.files[0];
    if (!file) {
        imagePreview.classList.add("hidden");
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        imagePreview.src = reader.result;
        imagePreview.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
});

async function uploadEventImage(file) {
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${currentUser.id}_${Date.now()}.${ext}`;
    const { error } = await supabaseClient.storage
        .from("event-images")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });

    if (error) throw error;
    const { data } = supabaseClient.storage.from("event-images").getPublicUrl(fileName);
    return data.publicUrl;
}

eventForm.addEventListener("submit", async e => {
    e.preventDefault();
    formError.classList.add("hidden");

    if (!pendingLocation) {
        formError.textContent = "Por favor, escolhe a localização do evento no mapa.";
        formError.classList.remove("hidden");
        return;
    }

    const submitBtn = $("submitEventBtn");
    submitBtn.disabled = true;
    submitBtn.textContent = "A guardar...";

    try {
        const existing = editingEventId ? events.find(x => String(x.id) === String(editingEventId)) : null;
        let imageUrl = existing ? existing.image : DEFAULT_IMAGE;

        const file = eventImageInput.files[0];
        if (file) {
            try {
                imageUrl = await uploadEventImage(file);
            } catch (uploadErr) {
                imageUrl = imagePreview.src || DEFAULT_IMAGE;
            }
        }

        const maxVal = $("eventMaxParticipants").value;
        const creatorType = isBusinessAccount()
            ? (currentProfile?.business_type || "Empresa / Domínio Público")
            : (isAdminAccount() ? "Admin" : "Utilizador");

        const payload = {
            name: $("eventName").value.trim(),
            category: $("eventCategory").value,
            distrito: $("eventDistrito").value,
            date: $("eventDate").value,
            time: $("eventTime").value,
            location: $("eventLocation").value.trim(),
            latitude: pendingLocation.lat,
            longitude: pendingLocation.lng,
            max_participants: maxVal ? parseInt(maxVal, 10) : null,
            price: $("eventPrice").value.trim() || "Gratuito",
            external_url: $("eventExternalUrl").value.trim() || null,
            description: $("eventDescription").value.trim(),
            image: imageUrl
        };

        if (editingEventId) {
            const { data, error } = await supabaseClient
                .from("events")
                .update(payload)
                .eq("id", editingEventId)
                .select()
                .single();

            if (error) throw error;
            const updated = mapDbEvent(data);
            const idx = events.findIndex(x => String(x.id) === String(editingEventId));
            if (idx !== -1) events[idx] = updated;
            showToast("Evento atualizado com sucesso!", "success");
        } else {
            payload.creator_id = currentUser.id;
            payload.creator_name = currentProfile?.full_name || "Organizador";
            payload.creator_type = creatorType;
            payload.creator_role = currentProfile?.role || "user";
            payload.creator_verified = isEntityVerified(currentProfile);
            payload.enrolled = 0;

            const { data, error } = await supabaseClient
                .from("events")
                .insert([payload])
                .select()
                .single();

            if (error) throw error;
            const created = mapDbEvent(data);
            events.push(created);
            await notifyFollowersOfNewEvent(created);
            showToast("Evento publicado no mapa!", "success");
        }

        closeModalEl(modal);
        stopLocationPicking();
        filterEvents();
    } catch (err) {
        formError.textContent = err.message || "Erro ao guardar evento.";
        formError.classList.remove("hidden");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = editingEventId ? "Guardar Alterações" : "Publicar Evento";
    }
});

// ==========================================
// FAVORITOS, EXPORTAÇÃO E EVENTOS DE INTERFACE
// ==========================================
function toggleFavorite(id) {
    const strId = String(id);
    if (favorites.has(strId)) {
        favorites.delete(strId);
        showToast("Removido dos favoritos.");
    } else {
        favorites.add(strId);
        showToast("Guardado nos favoritos ★");
    }
    saveJSON(STORAGE_FAVS, [...favorites]);
    filterEvents();
}

eventsList.addEventListener("click", e => {
    const favBtn = e.target.closest("[data-fav]");
    if (favBtn) {
        e.stopPropagation();
        toggleFavorite(favBtn.dataset.fav);
    }
});

searchInput.addEventListener("input", () => {
    state.search = searchInput.value;
    filterEvents();
});

categoryChips.addEventListener("click", e => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    categoryChips.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    state.category = chip.dataset.category;
    filterEvents();
});

districtFilter.addEventListener("change", () => {
    state.district = districtFilter.value;
    filterEvents();
});

periodFilter.addEventListener("change", () => {
    state.period = periodFilter.value;
    filterEvents();
});

radiusSlider.addEventListener("input", () => {
    state.radius = Number(radiusSlider.value);
    radiusValue.textContent = state.radius >= 300 ? "Todo o país" : `${state.radius} km`;
    filterEvents();
});

sortFilter.addEventListener("change", () => {
    state.sort = sortFilter.value;
    filterEvents();
});

favoritesToggle.addEventListener("click", () => {
    state.onlyFavorites = !state.onlyFavorites;
    favoritesToggle.classList.toggle("on", state.onlyFavorites);
    filterEvents();
});

freeOnlyToggle.addEventListener("click", () => {
    state.onlyFree = !state.onlyFree;
    freeOnlyToggle.classList.toggle("on", state.onlyFree);
    filterEvents();
});

followingOnlyToggle.addEventListener("click", () => {
    state.onlyFollowing = !state.onlyFollowing;
    followingOnlyToggle.classList.toggle("on", state.onlyFollowing);
    filterEvents();
});

resetFiltersBtn.addEventListener("click", () => {
    state.search = "";
    state.category = "all";
    state.district = "all";
    state.period = "all";
    state.radius = 100;
    state.sort = "date";
    state.onlyFavorites = false;
    state.onlyFree = false;
    state.onlyFollowing = false;

    searchInput.value = "";
    districtFilter.value = "all";
    periodFilter.value = "all";
    radiusSlider.value = 100;
    radiusValue.textContent = "100 km";
    sortFilter.value = "date";
    favoritesToggle.classList.remove("on");
    freeOnlyToggle.classList.remove("on");
    followingOnlyToggle.classList.remove("on");
    categoryChips.querySelectorAll(".chip").forEach(c => {
        c.classList.toggle("active", c.dataset.category === "all");
    });
    filterEvents();
});

locationButton.addEventListener("click", async () => {
    locationButton.disabled = true;
    locationButton.innerHTML = `<span>⏳</span> A localizar...`;
    try {
        await locateUser();
        sortFilter.value = "distance";
        state.sort = "distance";
        filterEvents();
        showToast("Localização obtida! Ordenado por distância.", "success");
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        locationButton.disabled = false;
        locationButton.innerHTML = `<span aria-hidden="true">📍</span> Perto de mim`;
    }
});

$("exportCsvBtn").addEventListener("click", () => {
    if (!currentList.length) {
        showToast("Não existem eventos visíveis para exportar.", "error");
        return;
    }

    const headers = ["Nome", "Categoria", "Organizador", "Distrito", "Local", "Data", "Hora", "Preço", "Inscritos"];
    const rows = currentList.map(ev => [
        `"${(ev.name || "").replace(/"/g, '""')}"`,
        `"${ev.category}"`,
        `"${(ev.creatorName || "").replace(/"/g, '""')}"`,
        `"${ev.distrito}"`,
        `"${(ev.location || "").replace(/"/g, '""')}"`,
        ev.date,
        ev.time,
        `"${ev.price || "Gratuito"}"`,
        ev.enrolled || 0
    ]);

    const csv = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `localspot-eventos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Lista exportada em CSV!", "success");
});

$("aboutButton").addEventListener("click", () => openModal(aboutModal));
$("closeAbout").addEventListener("click", () => closeModalEl(aboutModal));
aboutModal.addEventListener("mousedown", e => { if (e.target === aboutModal) closeModalEl(aboutModal); });

document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
        [modal, detailModal, ticketModal, reportModal, aboutModal, adminModal, profileModal].forEach(closeModalEl);
        if ($("friendsModal")) closeModalEl($("friendsModal"));
        if ($("entityNetworkModal")) closeModalEl($("entityNetworkModal"));
        if ($("friendChatModal")) {
            activeChatFriendId = null;
            closeModalEl($("friendChatModal"));
        }
        if ($("quickMoodPopover")) $("quickMoodPopover").classList.add("hidden");
        stopLocationPicking();
        pickBanner.classList.add("hidden");
    }
});

// Inicialização
populateDistricts();
initMap();
initAuth();
