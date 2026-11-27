// ==========================================
// FALLBACKS DE SEGURANÇA
// ==========================================
if (typeof window.events === "undefined") window.events = [];
if (typeof window.DEFAULT_IMAGE === "undefined") {
    window.DEFAULT_IMAGE = "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=900&q=80";
}
if (typeof window.DISTRITOS === "undefined") {
    window.DISTRITOS = [
        "Aveiro", "Beja", "Braga", "Bragança", "Castelo Branco", "Coimbra",
        "Évora", "Faro", "Guarda", "Leiria", "Lisboa", "Portalegre",
        "Porto", "Santarém", "Setúbal", "Viana do Castelo", "Vila Real",
        "Viseu", "Açores", "Madeira"
    ];
}
if (typeof window.escapeHTML === "undefined") {
    window.escapeHTML = str => String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
if (typeof window.formatEventDate === "undefined") window.formatEventDate = ev => ev?.date || "";
if (typeof window.getCategoryEmoji === "undefined") {
    window.getCategoryEmoji = cat => ({
        "Música": "🎵", "Desporto": "⚽", "Cultura": "🎭",
        "Gastronomia": "🍽️", "Festa": "🎉", "Tecnologia": "💻"
    }[cat] || "📍");
}
if (typeof window.isEventFree === "undefined") {
    window.isEventFree = ev => !ev?.price || String(ev.price).toLowerCase().includes("gratuito") || String(ev.price).trim() === "0";
}
if (typeof window.isEventPast === "undefined") {
    window.isEventPast = ev => {
        if (!ev?.date) return false;
        const dt = new Date(`${ev.date}T${ev.time || "23:59"}`);
        return !isNaN(dt) && dt < new Date();
    };
}
if (typeof window.isEventToday === "undefined") window.isEventToday = ev => ev?.date === new Date().toISOString().slice(0, 10);
if (typeof window.isEventThisWeek === "undefined") {
    window.isEventThisWeek = ev => {
        if (!ev?.date) return false;
        const now = new Date();
        const dt = new Date(ev.date);
        const diffDays = (dt - now) / (1000 * 60 * 60 * 24);
        return diffDays >= -1 && diffDays <= 7;
    };
}
if (typeof window.distanceKm === "undefined") {
    window.distanceKm = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
}

// ==========================================
// CONFIGURAÇÃO SUPABASE
// ==========================================
const SUPABASE_URL = "https://ufzjexbihnwflqktpomm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmempleGJpaG53Zmxxa3Rwb21tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzMjU5NDUsImV4cCI6MjEwOTkwMTk0NX0.hy3x0RuyuKYwTOGvdAA2hYKH_02SEy49YRaZHoD2ufA";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);

const authOverlay = $("authOverlay");
const loginForm = $("loginForm");
const registerForm = $("registerForm");
const regAccountType = $("regAccountType");
const businessTypeGroup = $("businessTypeGroup");
const regNameLabel = $("regNameLabel");
const regNameInput = $("regName");

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

const state = {
    search: "",
    category: "all",
    district: "all",
    period: "all",
    radius: 300,
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

let explorationData = loadJSON(STORAGE_EXPLORATION, {
    date: new Date().toISOString().slice(0, 10),
    zones: [],
    trail: [],
    distanceKm: 0
});
let trailVisible = false;

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

function isBusinessAccount() { return currentProfile?.role === "business"; }
function isNormalUserAccount() { return !currentProfile || currentProfile.role === "user" || !currentProfile.role; }
function isAdminAccount() { return currentProfile?.role === "admin"; }
function isEntityVerified(profile) { return profile?.role === "business" && (profile?.is_verified === true || profile?.status_emoji === "✅"); }
function verifiedBadgeHTML(profile) {
    return isEntityVerified(profile) ? `<span class="verified-check" title="Entidade Oficial Verificada">✓</span>` : "";
}

window.isFriendLiveOnline = friendId => onlineUserIds.has(String(friendId));

window.getFriendshipTier = (bumpCount = 0) => {
    if (bumpCount >= 30) return { badge: "👑 BFF / Alma Gémea", next: 50, pct: 100 };
    if (bumpCount >= 15) return { badge: "🔥 Melhores Amigos", next: 30, pct: Math.round(((bumpCount - 15) / 15) * 100) };
    if (bumpCount >= 5) return { badge: "⚡ Bons Amigos", next: 15, pct: Math.round(((bumpCount - 5) / 10) * 100) };
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

// ---------- Sons & Animações ----------
function playBumpSound(isSuper = false) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = isSuper ? "triangle" : "sine";
        osc.frequency.setValueAtTime(isSuper ? 220 : 150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(isSuper ? 680 : 45, ctx.currentTime + (isSuper ? 0.35 : 0.2));
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
                ${avatarUrl ? `<img src="${escapeHTML(avatarUrl)}" alt="" onerror="this.remove()">` : escapeHTML(targetUser?.avatar_emoji || initials)}
            </div>
            <div class="friend-sent-plane">👊</div>
            <div class="friend-sent-pill">Pedido enviado para ${escapeHTML(name)}!</div>
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
            <span class="pill-tag">✨ NOVO PEDIDO DE AMIZADE</span>
            <div class="friend-req-photo-ring">
                <div class="friend-req-photo-inner">
                    ${avatarUrl ? `<img src="${escapeHTML(avatarUrl)}" alt="" onerror="this.remove()">` : escapeHTML(senderUser.avatar_emoji || initials)}
                </div>
                <div class="friend-req-badge-fist">👊</div>
            </div>
            <h2 style="margin:0 0 6px; font-size:21px;">${escapeHTML(name)}</h2>
            <p style="margin:0; font-size:13px; color:var(--muted);">${bioLine}</p>
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
            if (match) await window.acceptFriendRequest(match.friendshipId, senderUser.id);
        }
    };
}

let toastTimer;
function showToast(message, type = "info") {
    let toast = $("toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        document.body.appendChild(toast);
    }
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
    if (msg.includes("user already registered") || msg.includes("already been registered")) return "Este e-mail já está registado. Inicia sessão.";
    if (msg.includes("password should be at least")) return "A palavra-passe tem de ter pelo menos 6 caracteres.";
    if (msg.includes("rate limit") || msg.includes("too many requests")) return "Muitas tentativas seguidas. Aguarda alguns minutos.";
    return error.message;
}

// ==========================================
// EXPLORAÇÃO & PERCURSO DE HOJE
// ==========================================
function ensureTodayExplorationState() {
    const today = new Date().toISOString().slice(0, 10);
    if (explorationData.date !== today) {
        explorationData = { date: today, zones: explorationData.zones || [], trail: [], distanceKm: 0 };
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
    try {
        if (typeof setTodayTrailCoords === "function") setTodayTrailCoords(explorationData.trail, trailVisible);
    } catch (e) {}
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
// INJEÇÃO DA UI SOCIAL, AMIGOS & CHAT DIRETO
// ==========================================
function ensureSocialUI() {
    const nav = document.querySelector(".header nav, header nav, .nav-actions");

    if (nav && !$("friendsNavBtn")) {
        const friendsBtn = document.createElement("button");
        friendsBtn.type = "button";
        friendsBtn.id = "friendsNavBtn";
        friendsBtn.className = "btn-friends-nav hidden";
        friendsBtn.innerHTML = `👊 Amigos <span id="friendsReqBadge" class="friends-req-badge hidden">0</span>`;
        if (notifBtn && notifBtn.parentElement === nav) nav.insertBefore(friendsBtn, notifBtn);
        else nav.appendChild(friendsBtn);
    }

    if (nav && !$("directChatsNavBtn")) {
        const chatHeaderBtn = document.createElement("button");
        chatHeaderBtn.type = "button";
        chatHeaderBtn.id = "directChatsNavBtn";
        chatHeaderBtn.className = "btn-chat-nav hidden";
        chatHeaderBtn.innerHTML = `💬 Chat <span id="headerChatUnreadBadge" class="friends-req-badge hidden">0</span>`;
        if (notifBtn && notifBtn.parentElement === nav) nav.insertBefore(chatHeaderBtn, notifBtn);
        else nav.appendChild(chatHeaderBtn);
    }

    if (nav && !$("entityNetworkNavBtn")) {
        const entBtn = document.createElement("button");
        entBtn.type = "button";
        entBtn.id = "entityNetworkNavBtn";
        entBtn.className = "btn-entity-nav hidden";
        entBtn.innerHTML = `🏛️ Seguidores (<span id="headerFollowersCount">0</span>)`;
        if (notifBtn && notifBtn.parentElement === nav) nav.insertBefore(entBtn, notifBtn);
        else nav.appendChild(entBtn);
    }

    if (!$("floatingSocialDock")) {
        const dock = document.createElement("div");
        dock.id = "floatingSocialDock";
        dock.className = "floating-social-dock hidden";
        dock.innerHTML = `
            <button type="button" id="floatingChatBtn" class="floating-dock-btn primary-dock" title="Abrir Chat">
                💬 <span>Chat</span>
                <span id="floatingChatUnreadBadge" class="friends-req-badge hidden">0</span>
            </button>
            <button type="button" id="floatingFriendsBtn" class="floating-dock-btn" title="Amigos & Bump">
                👊 <span>Amigos</span>
                <span id="floatingReqBadge" class="friends-req-badge hidden">0</span>
            </button>
        `;
        document.body.appendChild(dock);
    }

    const mapCtrls = document.querySelector(".map-floating-controls");
    if (mapCtrls && !$("privacyMapBtn")) {
        const bumpRadarBtn = document.createElement("button");
        bumpRadarBtn.type = "button";
        bumpRadarBtn.id = "bumpShakeMapBtn";
        bumpRadarBtn.className = "map-ctrl-btn hidden";
        bumpRadarBtn.style.borderColor = "var(--bump)";
        bumpRadarBtn.textContent = "👊 Bump!";
        mapCtrls.appendChild(bumpRadarBtn);

        const iosPermBtn = document.createElement("button");
        iosPermBtn.type = "button";
        iosPermBtn.id = "iosShakePermMapBtn";
        iosPermBtn.className = "map-ctrl-btn ios-perm-btn hidden";
        iosPermBtn.textContent = "📳 Ativar Abanão (iPhone)";
        mapCtrls.appendChild(iosPermBtn);

        const quickMoodBtn = document.createElement("button");
        quickMoodBtn.type = "button";
        quickMoodBtn.id = "quickMoodMapBtn";
        quickMoodBtn.className = "map-ctrl-btn hidden";
        quickMoodBtn.textContent = "📍 Vibe";
        mapCtrls.appendChild(quickMoodBtn);

        const privacyBtn = document.createElement("button");
        privacyBtn.type = "button";
        privacyBtn.id = "privacyMapBtn";
        privacyBtn.className = "map-ctrl-btn hidden";
        privacyBtn.textContent = "📍 Precisa";
        mapCtrls.appendChild(privacyBtn);

        const checkinBtn = document.createElement("button");
        checkinBtn.type = "button";
        checkinBtn.id = "quickCheckinMapBtn";
        checkinBtn.className = "map-ctrl-btn hidden";
        checkinBtn.textContent = "📌 Check-in";
        mapCtrls.appendChild(checkinBtn);

        const expBtn = document.createElement("button");
        expBtn.type = "button";
        expBtn.id = "explorationMapBtn";
        expBtn.className = "map-ctrl-btn exploration-pill-btn hidden";
        expBtn.textContent = "🗺️ 0 zonas · 0,0 km";
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
        const editBox = profileForm.parentElement.querySelector(".profile-edit-box");
        if (editBox) profileForm.parentElement.insertBefore(statsBar, editBox);

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
                <label>Estado / Vibe atual</label>
                <div id="statusPillsContainer" class="status-pills-grid">
                    ${BUMP_STATUSES.map(s => `
                        <button type="button" class="status-pill-btn" data-emoji="${s.emoji}" data-text="${s.text}">${s.emoji} ${s.text}</button>
                    `).join("")}
                </div>
                <div style="display:grid; grid-template-columns: 64px 1fr; gap:8px; margin-bottom:12px;">
                    <input type="text" id="profileCustomEmoji" maxlength="4" placeholder="📍" style="text-align:center;">
                    <input type="text" id="profileCustomStatus" maxlength="40" placeholder="Estado personalizado...">
                </div>
                <label>Privacidade da localização no mapa</label>
                <div id="privacySelectorGrid" class="privacy-selector-grid">
                    <button type="button" class="privacy-opt-btn" data-mode="precise">📍 Precisa</button>
                    <button type="button" class="privacy-opt-btn" data-mode="blurred">🌫️ Borrão (~400m)</button>
                    <button type="button" class="privacy-opt-btn" data-mode="ghost">👻 Fantasma</button>
                </div>
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
        if ($("profileFollowingList")) {
            $("profileFollowingList").parentElement.insertBefore(friendsPanel, $("profileFollowingList"));
        }
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
                    <h2 style="margin:0;">👊 Amigos & Radar Bump</h2>
                    <button type="button" id="enableBgNotifBumpBtn" class="btn-soft" style="font-size:11.5px; padding:5px 9px;">🔔 Alertas</button>
                </div>
                <p id="myBumpCodeBanner" style="color:var(--primary); font-size:12px; font-weight:700; margin:0 0 12px;"></p>
                
                <div class="auth-tabs three-cols" style="margin-bottom:14px;">
                    <button type="button" id="tabFriendsChats" class="auth-tab active">💬 Conversas <span id="chatsTabUnreadBadge" class="friends-req-badge hidden">0</span></button>
                    <button type="button" id="tabFriendsList" class="auth-tab">👥 Amigos (<span id="friendsTabCount">0</span>)</button>
                    <button type="button" id="tabFriendsAdd" class="auth-tab">🔍 Adicionar (<span id="requestsTabCount">0</span>)</button>
                </div>

                <div id="panelFriendsChats">
                    <div id="chatsListContainer"></div>
                </div>

                <div id="panelFriendsList" class="hidden">
                    <div id="bumpLeaderboardSection"></div>
                    <div id="friendsContainerList"></div>
                </div>

                <div id="panelFriendsAdd" class="hidden">
                    <div id="incomingRequestsSection" style="margin-bottom:16px;"></div>

                    <!-- RADAR DE PROXIMIDADE ESTILO BUMP -->
                    <div style="background:linear-gradient(135deg, rgba(244,63,94,0.14), rgba(139,92,246,0.14)); border:1px solid rgba(244,63,94,0.35); border-radius:14px; padding:12px; margin-bottom:14px;">
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
                            <div>
                                <strong style="display:block; font-size:13px;">📡 Bump por Proximidade</strong>
                                <span style="font-size:11.5px; color:var(--muted);">Encontra pessoas com o LocalSpot aberto perto de ti</span>
                            </div>
                            <button type="button" id="scanNearbyBumpBtn" class="btn-bump" style="white-space:nowrap;">👊 Radar</button>
                        </div>
                        <div id="nearbyBumpResults" style="margin-top:8px;"></div>
                    </div>

                    <label for="friendSearchInput">Procurar por nome, @username, e-mail ou código LS-</label>
                    <div style="display:flex; gap:8px; margin-bottom:12px;">
                        <input type="text" id="friendSearchInput" placeholder="Ex: Miguel, LS-A92F, miguel@email.pt...">
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
                <p style="color:var(--muted); font-size:13px; margin:0 0 14px;">Gira os seguidores da sua entidade.</p>
                <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:6px; background:var(--bg); padding:4px; border-radius:10px; margin-bottom:14px;">
                    <button type="button" id="tabEntFollowers" class="auth-tab active">👥 Seguidores (<span id="entFollowersTabCount">0</span>)</button>
                    <button type="button" id="tabEntFollowing" class="auth-tab">🏛️ A Seguir (<span id="entFollowingTabCount">0</span>)</button>
                    <button type="button" id="tabEntDiscover" class="auth-tab">🔍 Seguir</button>
                </div>
                <div id="panelEntFollowers"><div id="entFollowersListContainer"></div></div>
                <div id="panelEntFollowing" class="hidden"><div id="entFollowingListContainer"></div></div>
                <div id="panelEntDiscover" class="hidden">
                    <div style="display:flex; gap:8px; margin-bottom:12px;">
                        <input type="text" id="entitySearchInput" placeholder="Procurar entidades...">
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
    if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
        if (iosBtn && isNormalUserAccount()) {
            iosBtn.classList.remove("hidden");
            iosBtn.onclick = async () => {
                try {
                    const perm = await DeviceMotionEvent.requestPermission();
                    if (perm === "granted") {
                        iosBtn.classList.add("hidden");
                        attachShakeSensorListener();
                        showToast("📳 Sensor ativado!", "success");
                    }
                } catch (e) {}
            };
        }
    } else {
        attachShakeSensorListener();
    }
}

function bindSocialEvents() {
    const friendsNavBtn = $("friendsNavBtn");
    const directChatsNavBtn = $("directChatsNavBtn");
    const floatingChatBtn = $("floatingChatBtn");
    const floatingFriendsBtn = $("floatingFriendsBtn");
    const friendsModal = $("friendsModal");

    const switchFriendsTab = (activeId) => {
        ["tabFriendsChats", "tabFriendsList", "tabFriendsAdd"].forEach(id => {
            if ($(id)) $(id).classList.toggle("active", id === activeId);
        });
        if ($("panelFriendsChats")) $("panelFriendsChats").classList.toggle("hidden", activeId !== "tabFriendsChats");
        if ($("panelFriendsList")) $("panelFriendsList").classList.toggle("hidden", activeId !== "tabFriendsList");
        if ($("panelFriendsAdd")) $("panelFriendsAdd").classList.toggle("hidden", activeId !== "tabFriendsAdd");
    };

    const openFriendsDrawer = async (tabId) => {
        if ($("myBumpCodeBanner") && currentProfile) {
            $("myBumpCodeBanner").textContent = `O teu código Bump: ${currentProfile.bump_code || "LS-ATIVO"} · Partilha para te adicionarem!`;
        }
        openModal(friendsModal);
        switchFriendsTab(tabId);
        await Promise.all([loadSocialData(), loadRecentChatSummaries()]);
        if (tabId === "tabFriendsAdd") searchUsersAndEntities();
    };

    if (friendsNavBtn && !friendsNavBtn.dataset.bound) {
        friendsNavBtn.dataset.bound = "1";
        friendsNavBtn.addEventListener("click", () => openFriendsDrawer("tabFriendsList"));
    }
    if (floatingFriendsBtn && !floatingFriendsBtn.dataset.bound) {
        floatingFriendsBtn.dataset.bound = "1";
        floatingFriendsBtn.addEventListener("click", () => openFriendsDrawer("tabFriendsList"));
    }
    if (directChatsNavBtn && !directChatsNavBtn.dataset.bound) {
        directChatsNavBtn.dataset.bound = "1";
        directChatsNavBtn.addEventListener("click", () => openFriendsDrawer("tabFriendsChats"));
    }
    if (floatingChatBtn && !floatingChatBtn.dataset.bound) {
        floatingChatBtn.dataset.bound = "1";
        floatingChatBtn.addEventListener("click", () => openFriendsDrawer("tabFriendsChats"));
    }

    const scanNearbyBtn = $("scanNearbyBumpBtn");
    if (scanNearbyBtn && !scanNearbyBtn.dataset.bound) {
        scanNearbyBtn.dataset.bound = "1";
        scanNearbyBtn.addEventListener("click", scanNearbyBumpUsers);
    }

    const bgNotifBtn = $("enableBgNotifBumpBtn");
    if (bgNotifBtn && !bgNotifBtn.dataset.bound) {
        bgNotifBtn.dataset.bound = "1";
        bgNotifBtn.addEventListener("click", async () => {
            if (!("Notification" in window)) return;
            const perm = await Notification.requestPermission();
            if (perm === "granted") showToast("🔔 Alertas ativados!", "success");
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
        $("tabEntDiscover").addEventListener("click", () => { switchEntTab("tabEntDiscover"); searchEntitiesToFollow(); });
        $("entitySearchBtn").addEventListener("click", searchEntitiesToFollow);
    }

    const closeChatBtn = $("closeFriendChatModal");
    const chatModal = $("friendChatModal");
    if (closeChatBtn && !closeChatBtn.dataset.bound) {
        closeChatBtn.dataset.bound = "1";
        closeChatBtn.addEventListener("click", () => { activeChatFriendId = null; closeModalEl(chatModal); });
        chatModal.addEventListener("mousedown", e => {
            if (e.target === chatModal) { activeChatFriendId = null; closeModalEl(chatModal); }
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
        tabList.addEventListener("click", () => switchFriendsTab("tabFriendsList"));
        tabChats.addEventListener("click", async () => {
            switchFriendsTab("tabFriendsChats");
            await loadRecentChatSummaries();
        });
        tabAdd.addEventListener("click", () => {
            switchFriendsTab("tabFriendsAdd");
            searchUsersAndEntities();
        });
    }

    const searchBtn = $("friendSearchBtn");
    const searchInp = $("friendSearchInput");
    if (searchBtn && !searchBtn.dataset.bound) {
        searchBtn.dataset.bound = "1";
        searchBtn.addEventListener("click", searchUsersAndEntities);
        searchInp.addEventListener("input", searchUsersAndEntities);
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
        quickMoodBtn.addEventListener("click", e => { e.stopPropagation(); moodPopover.classList.toggle("hidden"); });
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
            try {
                if (typeof setTodayTrailCoords === "function") setTodayTrailCoords(explorationData.trail, trailVisible);
            } catch (e) {}
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
            $("profileAvatarPreview").innerHTML = `<img src="${URL.createObjectURL(file)}" alt="">`;
        });
    }

    if ($("tabMyFriends") && !$("tabMyFriends").dataset.bound) {
        $("tabMyFriends").dataset.bound = "1";
        $("tabMyFriends").addEventListener("click", () => switchProfileTab("tabMyFriends", "profileFriendsList"));
    }

    setupMotionSensorWithIOSPermission();
}

// ==========================================
// BUMP POR PROXIMIDADE (ENCONTRAR PESSOAS PERTO)
// ==========================================
async function scanNearbyBumpUsers() {
    const box = $("nearbyBumpResults");
    const btn = $("scanNearbyBumpBtn");
    if (!box || !currentUser) return;

    btn.disabled = true;
    btn.textContent = "⏳ A procurar...";
    box.innerHTML = `<p class="muted" style="font-size:12px; margin:6px 0 0;">A ativar radar GPS...</p>`;

    try {
        let pos = window.userPosition;
        if (!pos && typeof window.locateUser === "function") {
            pos = await window.locateUser();
        }
        if (!pos) throw new Error("Ativa a localização GPS para usar o Bump por proximidade.");

        const { data: users } = await supabaseClient
            .from("profiles")
            .select("*")
            .neq("id", currentUser.id)
            .eq("role", "user")
            .neq("privacy_mode", "ghost")
            .not("last_lat", "is", null)
            .not("last_lng", "is", null)
            .limit(50);

        const nearby = (users || [])
            .map(u => ({
                ...u,
                distMeters: Math.round(distanceKm(pos.lat, pos.lng, u.last_lat, u.last_lng) * 1000)
            }))
            .filter(u => u.distMeters <= 500)
            .sort((a, b) => a.distMeters - b.distMeters);

        if (nearby.length === 0) {
            box.innerHTML = `<p class="muted" style="font-size:12px; margin:6px 0 0;">Ninguém detetado num raio de 500m agora. Usa a pesquisa abaixo ou partilha o teu código <strong>${escapeHTML(currentProfile?.bump_code || "")}</strong>!</p>`;
            return;
        }

        const friendIds = new Set(window.friendsList.map(f => String(f.id)));
        box.innerHTML = nearby.map(u => {
            const isFriend = friendIds.has(String(u.id));
            const isSent = sentFriendRequestIds.has(u.id);
            let action = "";
            if (isFriend) {
                action = `<button type="button" class="btn-bump" onclick="window.sendBump('${u.id}', '👊', 'Bump de proximidade!')">👊 Bump</button>`;
            } else if (isSent) {
                action = `<span class="muted" style="font-size:11.5px;">✈️ Enviado</span>`;
            } else {
                action = `<button type="button" class="btn-primary-sm" onclick="window.sendFriendRequest('${u.id}', '${escapeHTML(u.full_name)}')">+ Conectar</button>`;
            }

            return `
                <div class="friend-row" style="margin-top:6px; margin-bottom:0;">
                    <div class="friend-row-left">
                        ${renderAvatarChip(u, "")}
                        <div class="friend-row-info">
                            <strong>${escapeHTML(u.full_name)}</strong>
                            <span>📍 A ${u.distMeters}m de ti · ${escapeHTML(u.status_emoji || "📍")} ${escapeHTML(u.status_text || "")}</span>
                        </div>
                    </div>
                    <div>${action}</div>
                </div>
            `;
        }).join("");
    } catch (err) {
        box.innerHTML = `<p style="font-size:12px; color:#fda4af; margin:6px 0 0;">${escapeHTML(err.message)}</p>`;
    } finally {
        btn.disabled = false;
        btn.textContent = "👊 Radar";
    }
}

async function updateQuickUserMood(emoji, text) {
    if (!currentUser || !currentProfile) return;
    await supabaseClient
        .from("profiles")
        .update({ status_emoji: emoji, status_text: text, last_seen: new Date().toISOString() })
        .eq("id", currentUser.id);

    currentProfile.status_emoji = emoji;
    currentProfile.status_text = text;
    applyRoleUI();
    showToast(`Estado atualizado: ${emoji} ${text}`, "success");
}

async function performSmartBumpAction(fromShake = false) {
    if (!currentUser) return;

    if (!window.friendsList.length) {
        openModal($("friendsModal"));
        $("tabFriendsAdd").click();
        scanNearbyBumpUsers();
        return;
    }

    if (fromShake && typeof userPosition !== "undefined" && userPosition) {
        const nearbyFriends = window.friendsList.filter(f =>
            !f.ghost_mode &&
            typeof f.last_lat === "number" &&
            typeof f.last_lng === "number" &&
            distanceKm(userPosition.lat, userPosition.lng, f.last_lat, f.last_lng) <= 0.25
        );
        if (nearbyFriends.length > 0) {
            for (const friend of nearbyFriends) await window.sendBump(friend.id, "👊", "Shake Bump!");
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
if ($("mapStyleToggle")) {
    $("mapStyleToggle").addEventListener("click", () => {
        try {
            const mode = toggleMapStyleMode();
            $("mapStyleToggle").textContent = mode === "satellite" ? "🗺️ Mapa Noturno" : "🛰️ Satélite 3D";
        } catch (e) {}
    });
}

if ($("mapPitchToggle")) {
    $("mapPitchToggle").addEventListener("click", () => {
        try {
            const is3D = toggleMapPitchMode();
            $("mapPitchToggle").textContent = is3D ? "📐 Vista 2D" : "🧊 Vista 3D";
        } catch (e) {}
    });
}

function setMobileView(view) {
    if (!mainEl || !mobileViewToggle) return;
    mainEl.dataset.view = view;
    mobileViewToggle.textContent = view === "map" ? "📋 Ver Lista" : "🗺️ Ver Mapa";
    if (view === "map" && typeof map !== "undefined" && map?.resize) {
        setTimeout(() => map.resize(), 60);
    }
}

if (mobileViewToggle) {
    mobileViewToggle.addEventListener("click", () => {
        setMobileView(mainEl.dataset.view === "map" ? "list" : "map");
    });
}

// ==========================================
// SISTEMA DE AUTENTICAÇÃO E PERFIS
// ==========================================
if (regAccountType) {
    regAccountType.addEventListener("change", () => {
        const isBusiness = regAccountType.value === "business";
        if (businessTypeGroup) businessTypeGroup.classList.toggle("hidden", !isBusiness);
        if (regNameLabel) regNameLabel.textContent = isBusiness ? "Nome da Empresa / Estabelecimento *" : "Nome completo *";
        if (regNameInput) regNameInput.placeholder = isBusiness ? "Ex: Café Central / Câmara Municipal" : "Ex: João Silva";
    });
}

if (loginForm) {
    loginForm.addEventListener("submit", async e => {
        e.preventDefault();
        const errEl = $("loginError");
        if (errEl) errEl.classList.add("hidden");
        const btn = $("loginSubmitBtn");
        if (btn) { btn.disabled = true; btn.textContent = "A entrar..."; }

        const email = $("loginEmail").value.trim();
        const password = $("loginPassword").value;

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) {
                if (errEl) { errEl.textContent = translateAuthError(error); errEl.classList.remove("hidden"); }
                return;
            }
            if (data?.user) {
                await handleAuthenticatedSession(data.user);
                if (typeof window.triggerBumpImpactAnimation === "function") {
                    window.triggerBumpImpactAnimation("👊 Bem-vindo de volta!", "👊");
                }
            }
        } catch (err) {
            if (errEl) { errEl.textContent = "Falha de ligação ao servidor."; errEl.classList.remove("hidden"); }
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = "Entrar no Radar"; }
        }
    });
}

if (registerForm) {
    registerForm.addEventListener("submit", async e => {
        e.preventDefault();
        const errEl = $("registerError");
        if (errEl) errEl.classList.add("hidden");
        const btn = $("registerSubmitBtn");
        if (btn) { btn.disabled = true; btn.textContent = "A criar perfil..."; }

        const role = regAccountType ? regAccountType.value : "user";
        const businessType = role === "business" && $("regBusinessType") ? $("regBusinessType").value : null;
        const fullName = regNameInput.value.trim();
        const email = $("regEmail").value.trim();
        const password = $("regPassword").value;
        const onboardingPrefs = typeof window.getOnboardingSelections === "function"
            ? window.getOnboardingSelections()
            : { avatar_emoji: "😎", status_emoji: "🎉", status_text: "Pronto pra sair", privacy_mode: "precise" };

        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        role,
                        business_type: businessType,
                        ...onboardingPrefs
                    }
                }
            });

            if (error) {
                if (errEl) { errEl.textContent = translateAuthError(error); errEl.classList.remove("hidden"); }
                return;
            }

            if (data?.user) {
                if (!data.session) {
                    if (errEl) {
                        errEl.textContent = "Conta criada! Desativa «Confirm email» no Supabase para entrar de imediato.";
                        errEl.classList.remove("hidden");
                    }
                    return;
                }

                await supabaseClient.from("profiles").upsert({
                    id: data.user.id,
                    email: email.toLowerCase(),
                    full_name: fullName,
                    role,
                    business_type: businessType,
                    avatar_emoji: onboardingPrefs.avatar_emoji,
                    status_emoji: role === "business" ? "🏢" : onboardingPrefs.status_emoji,
                    status_text: role === "business" ? (businessType || "Entidade Oficial") : onboardingPrefs.status_text,
                    privacy_mode: onboardingPrefs.privacy_mode,
                    ghost_mode: onboardingPrefs.privacy_mode === "ghost",
                    onboarding_completed: true
                });

                await handleAuthenticatedSession(data.user);
                if (typeof window.triggerBumpImpactAnimation === "function") {
                    window.triggerBumpImpactAnimation(`👊 Bem-vindo, ${fullName.split(" ")[0]}!`, onboardingPrefs.avatar_emoji);
                }
            }
        } catch (err) {
            if (errEl) { errEl.textContent = "Falha de ligação ao criar conta."; errEl.classList.remove("hidden"); }
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = "👊 Entrar no Mapa!"; }
        }
    });
}

if (logoutButton) {
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
        try { if (typeof showFriendsOnMap === "function") showFriendsOnMap([]); } catch (e) {}
        ["friendsNavBtn", "directChatsNavBtn", "floatingSocialDock", "entityNetworkNavBtn", "bumpShakeMapBtn", "iosShakePermMapBtn", "quickMoodMapBtn", "privacyMapBtn", "quickCheckinMapBtn", "explorationMapBtn", "hangoutBanner"].forEach(id => {
            if ($(id)) $(id).classList.add("hidden");
        });
        if (notifBtn) notifBtn.classList.add("hidden");
        if (userBadge) userBadge.classList.add("hidden");
        if (adminPanelBtn) adminPanelBtn.classList.add("hidden");
        logoutButton.classList.add("hidden");
        if (authOverlay) authOverlay.classList.remove("hidden");
        showToast("Sessão terminada.");
    });
}

async function handleAuthenticatedSession(user) {
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
                email: user.email.toLowerCase(),
                full_name: meta.full_name || user.email.split("@")[0],
                role: roleVal,
                business_type: meta.business_type || null,
                avatar_emoji: meta.avatar_emoji || "😎",
                status_emoji: roleVal === "business" ? "🏢" : (meta.status_emoji || "📍"),
                status_text: roleVal === "business" ? (meta.business_type || "Entidade Oficial") : (meta.status_text || "No LocalSpot"),
                privacy_mode: meta.privacy_mode || "precise",
                onboarding_completed: true
            };
            const { data: inserted } = await supabaseClient.from("profiles").upsert(newProfile).select().maybeSingle();
            profile = inserted || newProfile;
        }
    } catch (e) {
        profile = {
            id: user.id,
            email: user.email,
            full_name: meta.full_name || user.email.split("@")[0],
            role: meta.role || "user",
            avatar_emoji: meta.avatar_emoji || "😎"
        };
    }

    currentProfile = profile;
    if (!currentProfile.privacy_mode) {
        currentProfile.privacy_mode = currentProfile.ghost_mode ? "ghost" : "precise";
    }

    applyRoleUI();
    setupMotionSensorWithIOSPermission();
    if (authOverlay) authOverlay.classList.add("hidden");
    try { if (typeof map !== "undefined" && map?.resize) map.resize(); } catch (e) {}

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
    const fallback = profile?.avatar_emoji || (profile?.full_name || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join("");
    return `<span class="avatar-circle ${sizeClass}${extraClass}">${escapeHTML(fallback)}</span>`;
}

function applyRoleUI() {
    if (!currentProfile) return;
    const { role, full_name, business_type, privacy_mode } = currentProfile;
    const isBiz = role === "business";
    const isAdm = role === "admin";
    const isUser = !isBiz && !isAdm;

    if (addEventButton) addEventButton.classList.remove("hidden");
    if ($("friendsNavBtn")) $("friendsNavBtn").classList.remove("hidden");
    if ($("directChatsNavBtn")) $("directChatsNavBtn").classList.remove("hidden");
    if ($("floatingSocialDock")) $("floatingSocialDock").classList.remove("hidden");

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
            pBtn.textContent = privacy_mode === "ghost" ? "📅 Apenas Eventos" : "🏢 Sede Visível";
        } else if (isUser) {
            if (privacy_mode === "ghost") pBtn.textContent = "👻 Fantasma";
            else if (privacy_mode === "blurred") pBtn.textContent = "🌫️ Borrão";
            else pBtn.textContent = "📍 Precisa";
        }
    }

    if (notifBtn) notifBtn.classList.remove("hidden");
    if (logoutButton) logoutButton.classList.remove("hidden");
    if (userBadge) {
        userBadge.classList.remove("hidden");
        const avatarHtml = renderAvatarChip(currentProfile, "sm");
        if (isAdm) {
            userBadge.innerHTML = `${avatarHtml} <span>🛡️ Admin · ${escapeHTML(full_name)}</span>`;
            if (adminPanelBtn) adminPanelBtn.classList.remove("hidden");
        } else if (isBiz) {
            userBadge.innerHTML = `${avatarHtml} <span>👔 ${escapeHTML(business_type || "Entidade")} · ${escapeHTML(full_name)}</span>${verifiedBadgeHTML(currentProfile)}`;
            if (adminPanelBtn) adminPanelBtn.classList.add("hidden");
        } else {
            userBadge.innerHTML = `${avatarHtml} <span>${escapeHTML(full_name)}</span>`;
            if (adminPanelBtn) adminPanelBtn.classList.add("hidden");
        }
    }
}

async function initAuth() {
    ensureSocialUI();
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && session.user) {
            await handleAuthenticatedSession(session.user);
        } else if (authOverlay) {
            authOverlay.classList.remove("hidden");
        }
    } catch (e) {
        if (authOverlay) authOverlay.classList.remove("hidden");
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
    banner.onclick = () => { if (firstFriend && typeof focusFriendOnMap === "function") focusFriendOnMap(firstFriend.id); };
};

async function loadUnreadMessagesCount() {
    if (!currentUser) return;
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
    if (!currentUser) return;
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
                <p style="font-size:32px; margin:0 0 8px;">💬</p>
                <p style="margin:0 0 12px; font-size:13.5px;">Adiciona um amigo na aba <strong>Adicionar</strong> para começares a conversar em tempo real!</p>
                <button type="button" class="btn-primary-sm" onclick="$('tabFriendsAdd').click()">🔍 Procurar utilizadores</button>
            </div>
        `;
        return;
    }

    const sortedFriends = [...window.friendsList].sort((a, b) => {
        const msgA = lastChatMessageByFriend.get(String(a.id));
        const msgB = lastChatMessageByFriend.get(String(b.id));
        return (msgB ? new Date(msgB.created_at).getTime() : 0) - (msgA ? new Date(msgA.created_at).getTime() : 0);
    });

    container.innerHTML = sortedFriends.map(f => {
        const key = String(f.id);
        const lastMsg = lastChatMessageByFriend.get(key);
        const unread = unreadMessagesBySender.get(key) || 0;
        const isLive = onlineUserIds.has(key);

        let preview = `${f.status_emoji || "📍"} ${f.status_text || "Toca para abrir o chat"}`;
        let timeLabel = "";

        if (lastMsg) {
            const prefix = String(lastMsg.sender_id) === String(currentUser.id) ? "Tu: " : "";
            preview = lastMsg.msg_type === "emoji_bomb" ? `${prefix}Chuva de ${lastMsg.content}` : `${prefix}${lastMsg.content}`;
            timeLabel = new Date(lastMsg.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
        }

        return `
            <div class="chat-thread-row${unread > 0 ? " unread" : ""}" onclick="window.openFriendChat('${f.id}')">
                <div class="friend-row-left" style="flex:1; min-width:0;">
                    ${renderAvatarChip(f, "")}
                    <div class="friend-row-info" style="flex:1; min-width:0;">
                        <strong>${escapeHTML(f.full_name)} ${isLive ? '<small style="color:var(--primary);">●</small>' : ""}</strong>
                        <span style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(preview)}</span>
                    </div>
                </div>
                <div style="text-align:right; flex-shrink:0;">
                    ${timeLabel ? `<small style="display:block; font-size:10.5px; color:var(--muted); margin-bottom:4px;">${timeLabel}</small>` : ""}
                    ${unread > 0 ? `<span class="friends-req-badge">${unread}</span>` : `<span style="font-size:13px; color:var(--primary);">💬</span>`}
                </div>
            </div>
        `;
    }).join("");
}

async function loadSocialData({ animateInitialRequests = false, triggerAnimForSenderId = null } = {}) {
    if (!currentUser) return;

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
            const { data: profs } = await supabaseClient.from("profiles").select("*").in("id", allNeededIds);
            if (profs) profilesById = new Map(profs.map(p => [p.id, p]));
        }

        window.friendsList = [...acceptedIds]
            .map(id => {
                const prof = profilesById.get(id);
                if (!prof) return null;
                const fRow = friendshipRecords.get(String(id));
                return { ...prof, bump_count: fRow?.bump_count || 0, super_bump_count: fRow?.super_bump_count || 0 };
            })
            .filter(Boolean)
            .sort((a, b) => (b.bump_count || 0) - (a.bump_count || 0));

        incomingFriendRequests = incomingRows
            .map(r => {
                const prof = profilesById.get(r.requester_id);
                return prof ? { friendshipId: r.id, user: prof } : null;
            })
            .filter(Boolean);

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
                setTimeout(() => triggerFriendRequestAnimation(firstReq.user, firstReq.friendshipId), 600);
            }
        }

        updateSocialBadges();
        renderFriendsModalContent();
        renderChatsTabContent();
        try { if (typeof showFriendsOnMap === "function") showFriendsOnMap(window.getMapSocialEntities()); } catch (e) {}
    } catch (e) {}
}

function updateSocialBadges() {
    let totalUnreadMsgs = 0;
    unreadMessagesBySender.forEach(v => { totalUnreadMsgs += v; });

    ["friendsReqBadge", "floatingReqBadge"].forEach(id => {
        const el = $(id);
        if (el) {
            el.textContent = incomingFriendRequests.length;
            el.classList.toggle("hidden", incomingFriendRequests.length === 0);
        }
    });

    ["headerChatUnreadBadge", "chatsTabUnreadBadge", "floatingChatUnreadBadge"].forEach(id => {
        const el = $(id);
        if (el) {
            el.textContent = totalUnreadMsgs;
            el.classList.toggle("hidden", totalUnreadMsgs === 0);
        }
    });

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
            <h4 style="margin:0 0 8px; font-size:13.5px; color:var(--bump);">🔔 Pedidos de Amizade (${incomingFriendRequests.length})</h4>
            ${incomingFriendRequests.map(req => `
                <div class="friend-row">
                    <div class="friend-row-left">
                        ${renderAvatarChip(req.user, "")}
                        <div class="friend-row-info">
                            <strong>${escapeHTML(req.user.full_name)}</strong>
                            <span>${escapeHTML(req.user.bump_code || req.user.email || "")}</span>
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
                    <strong style="font-size:12.5px; color:var(--primary);">🏆 Pódio Top Bumps</strong>
                    <div class="bump-podium-row">
                        ${topFriends.map((f, idx) => `
                            <div class="bump-podium-item">
                                <div style="font-size:16px;">${medals[idx]}</div>
                                <strong style="display:block; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(f.full_name.split(" ")[0])}</strong>
                                <span style="color:var(--primary); font-weight:800;">${f.bump_count} pts</span>
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
                <button type="button" class="btn-primary-sm" onclick="$('tabFriendsAdd').click()">Procurar amigos</button>
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
                        <strong>${escapeHTML(f.full_name)} <small style="color:var(--bump);">👊${f.bump_count || 0} pts</small></strong>
                        <span>${statusStr}</span>
                        <div style="margin-top:3px;">
                            <span class="friendship-tier-pill">${tier.badge}</span>
                            <div class="bump-progress-mini"><span style="width:${tier.pct}%;"></span></div>
                        </div>
                    </div>
                </div>
                <div class="friend-row-actions">
                    <button type="button" class="btn-bump" onclick="window.sendBump('${f.id}', '👊', 'Bump!')" title="Enviar Bump">👊</button>
                    <button type="button" class="btn-soft" onclick="window.openFriendChat('${f.id}')" title="Chat">💬${unread > 0 ? ` (${unread})` : ""}</button>
                    ${hasLocation ? `<button type="button" class="btn-soft" onclick="window.locateFriendOnMap('${f.id}')" title="Ver no mapa">📍</button>` : ""}
                    <button type="button" class="btn-logout" onclick="window.removeFriend('${f.id}', '${escapeHTML(f.full_name)}')" title="Remover">×</button>
                </div>
            </div>
        `;
    }).join("");
}

async function searchUsersAndEntities() {
    const query = ($("friendSearchInput")?.value || "").trim();
    const resultsEl = $("friendSearchResults");
    if (!resultsEl || !currentUser) return;

    let req = supabaseClient
        .from("profiles")
        .select("*")
        .neq("id", currentUser.id)
        .order("updated_at", { ascending: false })
        .limit(20);

    if (query) {
        req = req.or(`full_name.ilike.%${query}%,email.ilike.%${query}%,username.ilike.%${query}%,bump_code.ilike.%${query}%`);
    }

    const { data, error } = await req;

    if (error || !data || data.length === 0) {
        resultsEl.innerHTML = `<p class="muted" style="font-size:13px;">Nenhum utilizador encontrado.</p>`;
        return;
    }

    const friendIds = new Set(window.friendsList.map(f => String(f.id)));
    const incomingMap = new Map(incomingFriendRequests.map(r => [String(r.user.id), r.friendshipId]));

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
            } else if (incomingMap.has(String(u.id))) {
                const fId = incomingMap.get(String(u.id));
                actionBtn = `<button type="button" class="btn-bump" onclick="window.acceptFriendRequest(${fId}, '${u.id}')">✅ Aceitar</button>`;
            } else if (sentFriendRequestIds.has(u.id)) {
                actionBtn = `<span class="muted" style="font-size:12px;">✈️ Pedido enviado</span>`;
            } else {
                actionBtn = `<button type="button" class="btn-primary-sm" onclick="window.sendFriendRequest('${u.id}', '${escapeHTML(u.full_name)}')">👊 Adicionar</button>`;
            }
        }

        const subText = isBiz
            ? `🏛️ ${escapeHTML(u.business_type || "Entidade Oficial")}`
            : `${escapeHTML(u.status_emoji || "📍")} ${escapeHTML(u.status_text || "No LocalSpot")} · ${escapeHTML(u.bump_code || "")}`;

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

    const { data: targetProf } = await supabaseClient.from("profiles").select("*").eq("id", targetId).maybeSingle();
    if (targetProf && targetProf.role === "business") {
        showToast("Empresas não aceitam pedidos de amizade — clica em Seguir.", "error");
        return;
    }

    const { data: insertedRow, error } = await supabaseClient
        .from("friendships")
        .insert([{ requester_id: currentUser.id, addressee_id: targetId, status: "pending" }])
        .select()
        .maybeSingle();

    if (error) {
        showToast("Pedido já enviado ou erro de ligação.", "error");
        return;
    }

    sentFriendRequestIds.add(targetId);
    triggerFriendSentAnimation(targetProf || { full_name: targetName });

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
                    avatar_emoji: currentProfile.avatar_emoji || "😎",
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

    searchUsersAndEntities();
};

window.acceptFriendRequest = async (friendshipId, requesterId) => {
    const { error } = await supabaseClient
        .from("friendships")
        .update({ status: "accepted", updated_at: new Date().toISOString() })
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
    searchUsersAndEntities();
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
    if (typeof focusFriendOnMap !== "function" || !focusFriendOnMap(friendId)) {
        showToast("Localização indisponível.");
    }
};

// ==========================================
// REDE INSTITUCIONAL
// ==========================================
async function loadMyFollowers() {
    if (!currentUser || !isBusinessAccount()) { myFollowersList = []; return; }
    try {
        const { data: rows } = await supabaseClient.from("follows").select("follower_id").eq("following_id", currentUser.id);
        const followerIds = (rows || []).map(r => r.follower_id).filter(Boolean);
        if (followerIds.length > 0) {
            const { data: profs } = await supabaseClient.from("profiles").select("*").in("id", followerIds);
            myFollowersList = profs || [];
        } else {
            myFollowersList = [];
        }
        if ($("headerFollowersCount")) $("headerFollowersCount").textContent = myFollowersList.length;
    } catch (e) {}
}

function renderEntityNetworkModal() {
    if ($("entFollowersTabCount")) $("entFollowersTabCount").textContent = myFollowersList.length;
    if ($("entFollowingTabCount")) $("entFollowingTabCount").textContent = myFollowingProfiles.length;

    const followersBox = $("entFollowersListContainer");
    if (followersBox) {
        followersBox.innerHTML = myFollowersList.length
            ? myFollowersList.map(u => `
                <div class="friend-row">
                    <div class="friend-row-left">
                        ${renderAvatarChip(u, "")}
                        <div class="friend-row-info">
                            <strong>${escapeHTML(u.full_name)}${verifiedBadgeHTML(u)}</strong>
                            <span>${u.role === "business" ? "🏛️ " + escapeHTML(u.business_type || "Entidade") : "👤 Utilizador"}</span>
                        </div>
                    </div>
                </div>
            `).join("")
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
            : `<p class="muted" style="font-size:13px; text-align:center; padding:18px;">Ainda não está a seguir nenhuma entidade.</p>`;
    }
}

async function searchEntitiesToFollow() {
    const query = ($("entitySearchInput")?.value || "").trim();
    const resultsEl = $("entitySearchResults");
    if (!resultsEl || !currentUser) return;

    let req = supabaseClient.from("profiles").select("*").eq("role", "business").neq("id", currentUser.id).limit(20);
    if (query) req = req.ilike("full_name", `%${query}%`);

    const { data } = await req;
    if (!data || data.length === 0) {
        resultsEl.innerHTML = `<p class="muted" style="font-size:13px;">Nenhuma entidade encontrada.</p>`;
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
    if ($("panelEntDiscover") && !$("panelEntDiscover").classList.contains("hidden")) await searchEntitiesToFollow();
};

// ==========================================
// BUMP, EMOJI BOMBS & CHAT DIRETO
// ==========================================
function triggerBumpVisual(emoji = "👊", text = "BUMP!", isSuper = false) {
    if (navigator.vibrate) {
        try { navigator.vibrate(isSuper ? [150, 60, 150, 60, 280] : [100, 50, 140]); } catch (e) {}
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
    if (!currentUser || !currentProfile) return;
    const friend = window.friendsList.find(f => String(f.id) === String(friendId));
    if (!friend) return;

    const friendKey = String(friendId);
    const now = Date.now();
    const lastIncoming = recentIncomingBumpTs.get(friendKey) || 0;
    const isMutualSuper = (now - lastIncoming) <= 5000;

    if (!isMutualSuper) {
        const lastBumpTs = bumpCooldownMap.get(friendKey) || 0;
        const elapsedSec = Math.floor((now - lastBumpTs) / 1000);
        if (elapsedSec < 30) {
            showToast(`⏳ Aguarda ${30 - elapsedSec}s para novo Bump com ${friend.full_name.split(" ")[0]}.`);
            return;
        }
    }

    bumpCooldownMap.set(friendKey, now);
    if (isMutualSuper) recentIncomingBumpTs.delete(friendKey);

    const pointsToAdd = isMutualSuper ? 2 : 1;
    const fRow = friendshipRecords.get(friendKey);
    const nextCount = (fRow?.bump_count || friend.bump_count || 0) + pointsToAdd;

    let finalScore = nextCount;
    try {
        const { data: rpcData, error: rpcErr } = await supabaseClient.rpc("registrar_bump", { p_receiver_id: friendId });
        if (!rpcErr && rpcData && typeof rpcData.total_bumps === "number") {
            finalScore = rpcData.total_bumps;
        } else if (fRow) {
            await supabaseClient.from("friendships").update({ bump_count: nextCount }).eq("id", fRow.id);
        }
    } catch (e) {
        if (fRow) await supabaseClient.from("friendships").update({ bump_count: nextCount }).eq("id", fRow.id);
    }

    if (fRow) fRow.bump_count = finalScore;
    friend.bump_count = finalScore;
    window.friendsList.sort((a, b) => (b.bump_count || 0) - (a.bump_count || 0));

    const bannerMsg = isMutualSuper
        ? `⚡ SUPER BUMP com ${friend.full_name}! (+2 pts · Total: ${finalScore})`
        : `${emoji} ${label} com ${friend.full_name}! (${finalScore} pts)`;

    triggerBumpVisual(isMutualSuper ? "⚡" : emoji, bannerMsg, isMutualSuper);
    renderFriendsModalContent();
    try { if (typeof showFriendsOnMap === "function") showFriendsOnMap(window.getMapSocialEntities()); } catch (e) {}

    if (bumpBroadcastChannel) {
        bumpBroadcastChannel.send({
            type: "broadcast",
            event: "bump_shockwave",
            payload: {
                senderId: currentUser.id,
                senderName: currentProfile.full_name,
                receiverId: friendId,
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
        `Abana também nos próximos 5s para ativar SUPER BUMP!`
    );
};

window.sendWhereAreYouPing = async friendId => {
    if (!currentUser || !currentProfile) return;
    const friend = window.friendsList.find(f => String(f.id) === String(friendId));
    if (!friend) return;

    if (bumpBroadcastChannel) {
        bumpBroadcastChannel.send({
            type: "broadcast",
            event: "where_are_you_ping",
            payload: { senderId: currentUser.id, senderName: currentProfile.full_name, receiverId: friendId }
        });
    }
    showToast(`Ping «👀 Onde estás?» enviado a ${friend.full_name}!`, "success");
};

function showIncomingPingCard(senderId, senderName) {
    const existing = $("livePingToast");
    if (existing) existing.remove();

    const card = document.createElement("div");
    card.id = "livePingToast";
    card.className = "live-ping-toast";
    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:13.5px; color:var(--bump);">👀 ${escapeHTML(senderName)} perguntou:</strong>
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
            <strong style="display:block; font-size:15px;">${escapeHTML(friend.full_name)} ${isLive ? '<small style="color:var(--primary);">● Online</small>' : ""}</strong>
            <span style="font-size:12px; color:var(--muted);">
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
        box.innerHTML = `<p class="muted" style="font-size:12px; text-align:center;">Sem mensagens ainda.</p>`;
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
    const { data, error } = await supabaseClient
        .from("friend_messages")
        .insert([{ sender_id: currentUser.id, receiver_id: receiverId, content, msg_type: msgType }])
        .select()
        .maybeSingle();

    if (error) {
        showToast("Erro ao enviar mensagem: " + error.message, "error");
        return;
    }

    if (data) {
        lastChatMessageByFriend.set(String(receiverId), data);
        renderChatsTabContent();
    }

    if (String(activeChatFriendId) === String(receiverId)) {
        await loadChatHistory(receiverId);
    }
}

// ==========================================
// TELEMETRIA & REALTIME
// ==========================================
async function getDeviceBatteryInfo() {
    if (!navigator.getBattery) return { level: null, charging: false };
    try {
        const bat = await navigator.getBattery();
        return { level: Math.round(bat.level * 100), charging: Boolean(bat.charging) };
    } catch (e) {
        return { level: null, charging: false };
    }
}

function applyPrivacyCoordinates(lat, lng, mode) {
    if (mode !== "blurred") return { lat, lng };
    const offsetLat = (Math.sin(lat * 1000) * 0.0032);
    const offsetLng = (Math.cos(lng * 1000) * 0.0038);
    return { lat: Number((lat + offsetLat).toFixed(5)), lng: Number((lng + offsetLng).toFixed(5)) };
}

window.syncMyLiveLocation = async (lat, lng, speedKmh = 0) => {
    if (!currentUser || !currentProfile || isAdminAccount()) return;
    const mode = currentProfile.privacy_mode || "precise";
    if (mode === "ghost" || currentProfile.ghost_mode) return;

    const coords = applyPrivacyCoordinates(lat, lng, mode);
    const bat = isNormalUserAccount() ? await getDeviceBatteryInfo() : { level: null, charging: false };

    const updatePayload = { last_lat: coords.lat, last_lng: coords.lng, last_seen: new Date().toISOString(), updated_at: new Date().toISOString() };
    if (isNormalUserAccount()) {
        updatePayload.speed_kmh = speedKmh;
        if (bat.level !== null) {
            updatePayload.battery_level = bat.level;
            updatePayload.is_charging = bat.charging;
        }
    }

    await supabaseClient.from("profiles").update(updatePayload).eq("id", currentUser.id);
};

async function cyclePrivacyMode() {
    if (!currentUser || !currentProfile || isAdminAccount()) return;

    if (isBusinessAccount()) {
        const next = currentProfile.privacy_mode === "ghost" ? "precise" : "ghost";
        const isGhost = next === "ghost";
        await supabaseClient.from("profiles").update({ privacy_mode: next, ghost_mode: isGhost }).eq("id", currentUser.id);
        currentProfile.privacy_mode = next;
        currentProfile.ghost_mode = isGhost;
        applyRoleUI();
        showToast(isGhost ? "📅 Modo Apenas Eventos ativo." : "🏢 Sede visível no mapa!", "success");
        return;
    }

    const order = ["precise", "blurred", "ghost"];
    const next = order[(order.indexOf(currentProfile.privacy_mode || "precise") + 1) % order.length];
    const isGhost = next === "ghost";

    await supabaseClient.from("profiles").update({ privacy_mode: next, ghost_mode: isGhost }).eq("id", currentUser.id);
    currentProfile.privacy_mode = next;
    currentProfile.ghost_mode = isGhost;
    applyRoleUI();

    if (next !== "ghost" && typeof userPosition !== "undefined" && userPosition) {
        window.syncMyLiveLocation(userPosition.lat, userPosition.lng);
    }
    showToast(next === "precise" ? "📍 Localização Precisa" : (next === "blurred" ? "🌫️ Modo Borrão" : "👻 Modo Fantasma"));
}

async function doQuickCheckin() {
    if (!currentUser || !currentProfile) return;
    let pos = typeof userPosition !== "undefined" ? userPosition : null;
    if (!pos && typeof locateUser === "function") {
        try { pos = await locateUser(); } catch (err) { showToast(err.message, "error"); return; }
    }
    if (!pos) return;

    let placeName = "Localização atual";
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pos.lat}&lon=${pos.lng}`);
        const data = await res.json();
        placeName = data.name || data.address?.amenity || data.address?.road || data.address?.town || data.address?.city || "Local atual";
    } catch (e) {}

    const customPlace = prompt("Onde estás agora? (Check-in para amigos)", placeName);
    if (customPlace === null) return;
    const finalPlace = customPlace.trim() || placeName;

    await supabaseClient.from("profiles").update({
        current_place: finalPlace,
        last_lat: pos.lat,
        last_lng: pos.lng,
        last_seen: new Date().toISOString()
    }).eq("id", currentUser.id);

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
                window.userPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                window.recordExplorationPoint(window.userPosition.lat, window.userPosition.lng);
                window.syncMyLiveLocation(window.userPosition.lat, window.userPosition.lng, 0);
            },
            () => {},
            { enableHighAccuracy: true, timeout: 8000 }
        );
    }

    bumpBroadcastChannel = supabaseClient.channel("localspot_bump_live", {
        config: { presence: { key: currentUser.id } }
    });

    bumpBroadcastChannel
        .on("presence", { event: "sync" }, () => {
            const stateObj = bumpBroadcastChannel.presenceState();
            onlineUserIds = new Set(Object.keys(stateObj));
            renderFriendsModalContent();
            renderChatsTabContent();
            try { if (typeof showFriendsOnMap === "function") showFriendsOnMap(window.getMapSocialEntities()); } catch (e) {}
        })
        .on("broadcast", { event: "friend_request_received" }, ({ payload }) => {
            if (!payload || String(payload.receiverId) !== String(currentUser.id)) return;
            const fid = payload.friendshipId ? String(payload.friendshipId) : null;
            if (fid && animatedIncomingFriendshipIds.has(fid)) return;
            if (fid) animatedIncomingFriendshipIds.add(fid);

            triggerFriendRequestAnimation(payload.sender, payload.friendshipId);
            loadSocialData();
        })
        .on("broadcast", { event: "bump_shockwave" }, ({ payload }) => {
            if (!payload || String(payload.receiverId) !== String(currentUser.id)) return;
            const isSuper = Boolean(payload.isSuper);
            if (!isSuper) recentIncomingBumpTs.set(String(payload.senderId), Date.now());
            const msgText = isSuper
                ? `⚡ SUPER BUMP com ${payload.senderName || "um amigo"}! (+2 pts)`
                : `👊 ${payload.senderName || "Um amigo"} fez Bump contigo!`;
            triggerBumpVisual(isSuper ? "⚡" : (payload.emoji || "👊"), msgText, isSuper);
            loadSocialData();
        })
        .on("broadcast", { event: "where_are_you_ping" }, ({ payload }) => {
            if (!payload || String(payload.receiverId) !== String(currentUser.id)) return;
            showIncomingPingCard(payload.senderId, payload.senderName || "Um amigo");
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
                await bumpBroadcastChannel.track({ user_id: currentUser.id, online_at: new Date().toISOString() });
            }
        });

    realtimeChannel = supabaseClient
        .channel("localspot_realtime_social")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "friendships" }, payload => {
            const row = payload.new;
            if (row && String(row.addressee_id) === String(currentUser.id) && row.status === "pending") {
                loadSocialData({ triggerAnimForSenderId: row.requester_id });
            } else {
                loadSocialData();
            }
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "friendships" }, () => loadSocialData())
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "friendships" }, () => loadSocialData())
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => loadSocialData())
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "friend_messages" }, payload => {
            const msg = payload.new;
            if (!msg || String(msg.receiver_id) !== String(currentUser.id)) return;

            lastChatMessageByFriend.set(String(msg.sender_id), msg);
            if (msg.msg_type === "emoji_bomb") launchEmojiBombAnimation(msg.content);

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
            }
        })
        .subscribe();
}

// ---------- Amizade nos Eventos ----------
async function loadAllEnrollmentsSummary() {
    try {
        const { data } = await supabaseClient.from("enrollments").select("event_id, user_id, user_name");
        if (data) {
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
    return attendees.map(a => friendById.get(String(a.user_id))).filter(Boolean);
};

// ==========================================
// NOTIFICAÇÕES E SEGUIDORES
// ==========================================
async function createNotification(targetUserId, eventId, title, message) {
    if (!targetUserId || String(targetUserId) === String(currentUser?.id)) return;
    try {
        await supabaseClient.from("notifications").insert([{ user_id: targetUserId, event_id: eventId, title, message }]);
    } catch (e) {}
}

async function notifyFollowersOfNewEvent(eventObj) {
    if (!currentUser || !currentProfile) return;
    try {
        const { data: followers } = await supabaseClient.from("follows").select("follower_id").eq("following_id", currentUser.id);
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
        const { data } = await supabaseClient
            .from("notifications")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false })
            .limit(20);
        if (data) { notifications = data; renderNotifications(); }
    } catch (e) {}
}

function renderNotifications() {
    if (!notifBadge || !notifList) return;
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

if (notifBtn && notifDropdown) {
    notifBtn.addEventListener("click", e => { e.stopPropagation(); notifDropdown.classList.toggle("hidden"); });
}

document.addEventListener("click", e => {
    if (notifDropdown && !notifDropdown.contains(e.target) && e.target !== notifBtn) notifDropdown.classList.add("hidden");
    const moodPop = $("quickMoodPopover");
    const moodBtn = $("quickMoodMapBtn");
    if (moodPop && !moodPop.contains(e.target) && e.target !== moodBtn) moodPop.classList.add("hidden");
});

if (notifList) {
    notifList.addEventListener("click", async e => {
        const item = e.target.closest(".notif-item");
        if (!item) return;
        await supabaseClient.from("notifications").update({ is_read: true }).eq("id", item.dataset.nid);
        await loadNotifications();
        notifDropdown.classList.add("hidden");
        if (item.dataset.eid) window.openEventDetails(item.dataset.eid);
    });
}

if ($("markAllReadBtn")) {
    $("markAllReadBtn").addEventListener("click", async () => {
        if (!currentUser) return;
        await supabaseClient.from("notifications").update({ is_read: true }).eq("user_id", currentUser.id);
        await loadNotifications();
    });
}

async function loadMyFollowing() {
    if (!currentUser) return;
    try {
        const { data } = await supabaseClient.from("follows").select("following_id, following_name").eq("follower_id", currentUser.id);
        if (data) {
            myFollowing = new Map(data.map(r => [String(r.following_id), r.following_name]));
            const ids = data.map(r => r.following_id).filter(Boolean);
            if (ids.length > 0) {
                const { data: profs } = await supabaseClient.from("profiles").select("*").in("id", ids);
                myFollowingProfiles = profs || [];
            } else {
                myFollowingProfiles = [];
            }
        }
    } catch (e) {}
}

async function toggleFollowOrganizer(organizerId, organizerName) {
    if (!currentUser || !organizerId || String(organizerId) === String(currentUser.id)) return;
    const key = String(organizerId);

    if (myFollowing.has(key)) {
        await supabaseClient.from("follows").delete().eq("follower_id", currentUser.id).eq("following_id", organizerId);
        myFollowing.delete(key);
        myFollowingProfiles = myFollowingProfiles.filter(p => String(p.id) !== key);
        showToast(`Deixaste de seguir ${organizerName}.`);
    } else {
        await supabaseClient.from("follows").insert([{ follower_id: currentUser.id, following_id: organizerId, following_name: organizerName }]);
        myFollowing.set(key, organizerName);
        showToast(`A seguir ${organizerName}!`, "success");
    }
    filterEvents();
}

// ==========================================
// CARREGAMENTO DE EVENTOS E INSCRIÇÕES
// ==========================================
function mapDbEvent(row) {
    return {
        id: row.id,
        creatorId: row.creator_id || null,
        creatorName: row.creator_name || "Organizador LocalSpot",
        creatorType: row.creator_type || null,
        creatorRole: row.creator_role || "user",
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
        const { data, error } = await supabaseClient.from("events").select("*").order("date", { ascending: true });
        if (!error && Array.isArray(data) && data.length > 0) {
            events = data.map(mapDbEvent);
        }
        filterEvents();
    } catch (e) {
        filterEvents();
    }
}

async function loadMyEnrollments() {
    if (!currentUser) return;
    try {
        const { data } = await supabaseClient.from("enrollments").select("event_id").eq("user_id", currentUser.id);
        if (data) myEnrollments = new Set(data.map(row => String(row.event_id)));
    } catch (e) {}
}

window.toggleEnrollment = async id => {
    if (!currentUser || !currentProfile) return;
    const ev = events.find(x => String(x.id) === String(id));
    if (!ev) return;

    const strId = String(id);
    const isEnrolled = myEnrollments.has(strId);

    try {
        if (isEnrolled) {
            await supabaseClient.from("enrollments").delete().eq("event_id", ev.id).eq("user_id", currentUser.id);
            myEnrollments.delete(strId);
            ev.enrolled = Math.max(0, (ev.enrolled || 1) - 1);
            await supabaseClient.from("events").update({ enrolled: ev.enrolled }).eq("id", ev.id);
            showToast(`Inscrição cancelada em "${ev.name}".`);
        } else {
            if (ev.maxParticipants && ev.enrolled >= ev.maxParticipants) {
                showToast("Lotação máxima atingida.", "error");
                return;
            }
            await supabaseClient.from("enrollments").insert([{ event_id: ev.id, user_id: currentUser.id, user_name: currentProfile.full_name }]);
            myEnrollments.add(strId);
            ev.enrolled = (ev.enrolled || 0) + 1;
            await supabaseClient.from("events").update({ enrolled: ev.enrolled }).eq("id", ev.id);
            showToast(`Inscrição confirmada em "${ev.name}"! 🎉`, "success");
        }

        await loadAllEnrollmentsSummary();
        filterEvents();
        if (detailModal && !detailModal.classList.contains("hidden") && String(detailEventId) === strId) {
            window.openEventDetails(ev.id);
        }
    } catch (err) {
        showToast("Erro ao atualizar inscrição.", "error");
    }
};

// ==========================================
// PERFIL DO UTILIZADOR
// ==========================================
function switchProfileTab(activeTabId, activePanelId) {
    ["tabMyEnrollments", "tabMyCreated", "tabMyFriends", "tabMyFollowing"].forEach(id => {
        if ($(id)) $(id).classList.toggle("active", id === activeTabId);
    });
    ["profileEnrolledList", "profileCreatedList", "profileFriendsList", "profileFollowingList"].forEach(id => {
        if ($(id)) $(id).classList.toggle("hidden", id !== activePanelId);
    });
}

if (userBadge) {
    userBadge.addEventListener("click", async () => {
        if (!currentUser || !currentProfile) return;
        const isBiz = isBusinessAccount();
        const isUser = isNormalUserAccount();
        const isAdm = isAdminAccount();

        if ($("profileEmailDisplay")) $("profileEmailDisplay").textContent = currentUser.email;
        if ($("profileBumpCodeBadge")) $("profileBumpCodeBadge").textContent = `Código Bump: ${currentProfile.bump_code || "LS-ATIVO"}`;
        if ($("profileNameInput")) $("profileNameInput").value = currentProfile.full_name || "";
        if ($("profileBioInput")) $("profileBioInput").value = currentProfile.bio || "";
        if ($("profileAvatarInput")) $("profileAvatarInput").value = "";

        if ($("businessOnlyProfileFields")) $("businessOnlyProfileFields").classList.toggle("hidden", !isBiz);
        if ($("userOnlyProfileFields")) $("userOnlyProfileFields").classList.toggle("hidden", !isUser);
        if ($("tabMyFriends")) $("tabMyFriends").classList.toggle("hidden", !isUser);
        if ($("tabMyFollowing")) $("tabMyFollowing").classList.toggle("hidden", isAdm);

        if ($("profileAvatarPreview")) {
            $("profileAvatarPreview").className = `avatar-circle lg${isBiz ? " business-avatar" : (isAdm ? " admin-avatar" : "")}`;
            $("profileAvatarPreview").innerHTML = currentProfile.avatar_url
                ? `<img src="${escapeHTML(currentProfile.avatar_url)}" alt="">`
                : escapeHTML(currentProfile.avatar_emoji || (currentProfile.full_name || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join(""));
        }

        if (isUser) {
            if ($("profileBirthDateInput")) $("profileBirthDateInput").value = currentProfile.birth_date || "";
            if ($("profileCustomEmoji")) $("profileCustomEmoji").value = currentProfile.status_emoji || "📍";
            if ($("profileCustomStatus")) $("profileCustomStatus").value = currentProfile.status_text || "No LocalSpot";
        }

        switchProfileTab("tabMyEnrollments", "profileEnrolledList");
        await Promise.all([loadSocialData(), loadMyFollowers(), loadMyFollowing()]);
        renderProfileLists();
        openModal(profileModal);
    });
}

if ($("closeProfile")) $("closeProfile").addEventListener("click", () => closeModalEl(profileModal));
if (profileModal) profileModal.addEventListener("mousedown", e => { if (e.target === profileModal) closeModalEl(profileModal); });
if ($("tabMyEnrollments")) $("tabMyEnrollments").addEventListener("click", () => switchProfileTab("tabMyEnrollments", "profileEnrolledList"));
if ($("tabMyCreated")) $("tabMyCreated").addEventListener("click", () => switchProfileTab("tabMyCreated", "profileCreatedList"));
if ($("tabMyFollowing")) $("tabMyFollowing").addEventListener("click", () => switchProfileTab("tabMyFollowing", "profileFollowingList"));

async function uploadAvatarImage(file) {
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `avatars/${currentUser.id}_${Date.now()}.${ext}`;
    const { error } = await supabaseClient.storage.from("event-images").upload(fileName, file, { cacheControl: "3600", upsert: true });
    if (error) throw error;
    const { data } = supabaseClient.storage.from("event-images").getPublicUrl(fileName);
    return data.publicUrl;
}

if ($("profileUpdateForm")) {
    $("profileUpdateForm").addEventListener("submit", async e => {
        e.preventDefault();
        const newName = $("profileNameInput").value.trim();
        const newBio = $("profileBioInput").value.trim();
        const avatarFile = $("profileAvatarInput")?.files[0];
        if (!newName) return;

        let avatarUrl = currentProfile.avatar_url || null;
        try {
            if (avatarFile) avatarUrl = await uploadAvatarImage(avatarFile);
        } catch (err) {}

        const updatePayload = { full_name: newName, bio: newBio, avatar_url: avatarUrl };
        if (isNormalUserAccount()) {
            updatePayload.birth_date = $("profileBirthDateInput")?.value || null;
            updatePayload.status_emoji = ($("profileCustomEmoji")?.value || "📍").trim() || "📍";
            updatePayload.status_text = ($("profileCustomStatus")?.value || "No LocalSpot").trim() || "No LocalSpot";
        }

        await supabaseClient.from("profiles").update(updatePayload).eq("id", currentUser.id);
        Object.assign(currentProfile, updatePayload);
        applyRoleUI();
        showToast("Perfil atualizado!", "success");
        closeModalEl(profileModal);
    });
}

function renderProfileLists() {
    const enrolledEvents = events.filter(e => myEnrollments.has(String(e.id)));
    const createdEvents = events.filter(e => String(e.creatorId) === String(currentUser.id));

    if ($("profileEnrolledList")) {
        $("profileEnrolledList").innerHTML = enrolledEvents.length
            ? enrolledEvents.map(ev => `
                <div class="profile-event-item">
                    <div><strong>${escapeHTML(ev.name)}</strong><span>📅 ${escapeHTML(formatEventDate(ev))}</span></div>
                    <button type="button" class="btn-soft" onclick="closeModalEl(profileModal); window.openEventDetails('${ev.id}')">Abrir</button>
                </div>
            `).join("")
            : `<p class="muted" style="font-size:13px;">Ainda não estás inscrito em nenhum evento.</p>`;
    }

    if ($("profileCreatedList")) {
        $("profileCreatedList").innerHTML = createdEvents.length
            ? createdEvents.map(ev => `
                <div class="profile-event-item">
                    <div><strong>${escapeHTML(ev.name)}</strong><span>👥 ${ev.enrolled || 0} inscritos</span></div>
                    <button type="button" class="btn-soft" onclick="closeModalEl(profileModal); window.openEventDetails('${ev.id}')">Gerir</button>
                </div>
            `).join("")
            : `<p class="muted" style="font-size:13px;">Ainda não criaste nenhum evento.</p>`;
    }

    if ($("profileFriendsList")) {
        $("profileFriendsList").innerHTML = window.friendsList.length
            ? window.friendsList.map(f => `
                <div class="profile-event-item">
                    <div><strong>${escapeHTML(f.full_name)}</strong><span>${escapeHTML(f.status_emoji || "📍")} ${escapeHTML(f.status_text || "Online")}</span></div>
                    <button type="button" class="btn-soft" onclick="closeModalEl(profileModal); window.openFriendChat('${f.id}')">💬 Chat</button>
                </div>
            `).join("")
            : `<p class="muted" style="font-size:13px;">Ainda não tens amigos adicionados.</p>`;
    }

    if ($("profileFollowingList")) {
        const followingArr = Array.from(myFollowing.entries());
        $("profileFollowingList").innerHTML = followingArr.length
            ? followingArr.map(([id, name]) => `
                <div class="profile-event-item">
                    <div><strong>🏛️ ${escapeHTML(name)}</strong></div>
                    <button type="button" class="btn-logout" onclick="toggleFollowOrganizer('${id}', '${escapeHTML(name)}').then(renderProfileLists)">Deixar de seguir</button>
                </div>
            `).join("")
            : `<p class="muted" style="font-size:13px;">Ainda não segues nenhuma entidade.</p>`;
    }
}

// ==========================================
// PAINEL DO ADMINISTRADOR
// ==========================================
if (adminPanelBtn) {
    adminPanelBtn.addEventListener("click", async () => {
        if (!isAdminAccount()) return;
        openModal(adminModal);
        await loadAdminDashboard();
    });
}
if ($("closeAdmin")) $("closeAdmin").addEventListener("click", () => closeModalEl(adminModal));
if (adminModal) adminModal.addEventListener("mousedown", e => { if (e.target === adminModal) closeModalEl(adminModal); });

async function loadAdminDashboard() {
    const listEl = $("adminUsersList");
    const statsEl = $("adminStatsGrid");
    const { data: profiles } = await supabaseClient.from("profiles").select("*").order("created_at", { ascending: false });
    if (!profiles) return;

    if (statsEl) {
        statsEl.innerHTML = `
            <div class="admin-stat-card"><strong>${profiles.length}</strong><span>Contas</span></div>
            <div class="admin-stat-card"><strong>${profiles.filter(p => p.role === "business").length}</strong><span>Entidades</span></div>
            <div class="admin-stat-card"><strong>${profiles.filter(p => isEntityVerified(p)).length}</strong><span>Verificadas</span></div>
            <div class="admin-stat-card"><strong>${events.length}</strong><span>Eventos</span></div>
        `;
    }

    if (listEl) {
        listEl.innerHTML = profiles.map(p => `
            <div class="admin-user-row">
                <div class="admin-user-info">
                    <strong>${escapeHTML(p.full_name || "Sem nome")}</strong>
                    <span>${escapeHTML(p.email)} · ${escapeHTML(p.role || "user")}</span>
                </div>
            </div>
        `).join("");
    }
}

// ==========================================
// FILTROS, PESQUISA E RENDERIZAÇÃO DA LISTA
// ==========================================
function populateDistricts() {
    if (!districtFilter) return;
    DISTRITOS.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        districtFilter.appendChild(opt);
    });
}

function getFilteredEvents() {
    const query = state.search.trim().toLowerCase();
    const pos = typeof userPosition !== "undefined" ? userPosition : null;
    return events
        .map(ev => ({
            ...ev,
            distance: pos ? distanceKm(pos.lat, pos.lng, ev.latitude, ev.longitude) : null
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
            if (state.sort === "distance" && a.distance !== null && b.distance !== null) return a.distance - b.distance;
            if (state.sort === "popular") return (b.enrolled || 0) - (a.enrolled || 0);
            return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
        });
}

function canManageEvent(ev) {
    if (!currentUser) return false;
    if (isAdminAccount()) return true;
    return ev.creatorId && String(ev.creatorId) === String(currentUser.id);
}

function renderList(list) {
    currentList = list;
    const total = list.length;
    if (eventCount) eventCount.textContent = total === 1 ? "1 evento encontrado" : `${total} eventos encontrados`;
    if (emptyState) emptyState.classList.toggle("hidden", total > 0);
    if (!eventsList) return;
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

        const card = document.createElement("article");
        card.className = "event-card" + (String(ev.id) === String(activeId) ? " active" : "");
        card.dataset.id = ev.id;
        card.innerHTML = `
            <div class="event-image-wrap">
                <img class="event-image" src="${escapeHTML(ev.image || DEFAULT_IMAGE)}" alt="${escapeHTML(ev.name)}" loading="lazy" onerror="this.src='${DEFAULT_IMAGE}'">
                ${past ? `<span class="badge-past">Terminado</span>` : ""}
                <span class="badge-price-card">${escapeHTML(ev.price || "Gratuito")}</span>
                <button class="fav-btn ${isFav ? "on" : ""}" data-fav="${ev.id}">${isFav ? "★" : "☆"}</button>
            </div>
            <div class="event-meta">
                <span class="category">${getCategoryEmoji(ev.category)} ${escapeHTML(ev.category)}</span>
            </div>
            <h4>${escapeHTML(ev.name)}</h4>
            <div class="organizer-tag user-tag">👤 ${escapeHTML(ev.creatorName)}</div>
            ${friendsGoing.length > 0 ? `<div class="friends-going-badge">👊 ${friendsGoing.map(f => escapeHTML(f.full_name.split(" ")[0])).join(", ")} vai</div>` : ""}
            <p>📅 ${escapeHTML(formatEventDate(ev))} às ${escapeHTML(ev.time)}</p>
            <p>📍 ${escapeHTML(ev.location)} · ${escapeHTML(ev.distrito)}${distText}</p>
            <div class="registration-info">👥 ${ev.enrolled || 0}${ev.maxParticipants ? " / " + ev.maxParticipants : ""} inscritos</div>
            <div class="card-actions-grid">
                <button type="button" class="register-btn ${isRegistered ? "registered" : ""}" onclick="event.stopPropagation(); window.toggleEnrollment('${ev.id}')" ${past || (!isRegistered && full) ? "disabled" : ""}>${regBtnText}</button>
                <button type="button" class="details-btn" onclick="event.stopPropagation(); window.openEventDetails('${ev.id}')">Detalhes</button>
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
    try { if (typeof showEventsOnMap === "function") showEventsOnMap(filtered); } catch (e) {}
}

function selectEvent(id, { scroll = false } = {}) {
    activeId = id;
    document.querySelectorAll(".event-card").forEach(c => c.classList.toggle("active", String(c.dataset.id) === String(id)));
    try { if (typeof focusEventOnMap === "function") focusEventOnMap(id); } catch (e) {}
    if (scroll) {
        const card = document.querySelector(`.event-card[data-id="${id}"]`);
        if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}

window.handleMarkerClick = id => selectEvent(id, { scroll: true });

// ==========================================
// DETALHES DO EVENTO
// ==========================================
function updateDetailSocialButton(ev) {
    const followBtn = $("detailFollowBtn");
    if (!followBtn) return;

    if (!ev.creatorId || !currentUser || String(ev.creatorId) === String(currentUser.id)) {
        followBtn.classList.add("hidden");
        return;
    }

    const isOrgBiz = ev.creatorRole === "business";
    if (isOrgBiz) {
        followBtn.classList.remove("hidden");
        followBtn.textContent = myFollowing.has(String(ev.creatorId)) ? "✓ A seguir" : "+ Seguir";
        followBtn.onclick = async () => { await toggleFollowOrganizer(ev.creatorId, ev.creatorName); updateDetailSocialButton(ev); };
    } else {
        followBtn.classList.remove("hidden");
        const isFriend = window.friendsList.some(f => String(f.id) === String(ev.creatorId));
        const isSent = sentFriendRequestIds.has(ev.creatorId);
        if (isFriend) {
            followBtn.textContent = "💬 Conversar";
            followBtn.onclick = () => { closeModalEl(detailModal); window.openFriendChat(ev.creatorId); };
        } else if (isSent) {
            followBtn.textContent = "✈️ Pedido enviado";
            followBtn.onclick = null;
        } else {
            followBtn.textContent = "👊 Adicionar Amigo";
            followBtn.onclick = () => window.sendFriendRequest(ev.creatorId, ev.creatorName);
        }
    }
}

window.openEventDetails = async id => {
    const ev = events.find(x => String(x.id) === String(id));
    if (!ev || !detailModal) return;

    detailEventId = ev.id;
    const isRegistered = myEnrollments.has(String(ev.id));
    const isFav = favorites.has(String(ev.id));
    const past = isEventPast(ev);
    const full = ev.maxParticipants && ev.enrolled >= ev.maxParticipants;
    const canManage = canManageEvent(ev);

    if ($("detailHeroImg")) $("detailHeroImg").src = ev.image || DEFAULT_IMAGE;
    if ($("detailCategory")) $("detailCategory").textContent = `${getCategoryEmoji(ev.category)} ${ev.category}`;
    if ($("detailPrice")) $("detailPrice").textContent = ev.price || "Gratuito";
    if ($("detailOrganizer")) $("detailOrganizer").innerHTML = `👤 Organizado por ${escapeHTML(ev.creatorName)}`;
    if ($("detailTitle")) $("detailTitle").textContent = ev.name;
    if ($("detailDescription")) $("detailDescription").textContent = ev.description || "Sem descrição adicional.";
    if ($("detailDateTime")) $("detailDateTime").textContent = `${formatEventDate(ev)} às ${ev.time}`;
    if ($("detailLocation")) $("detailLocation").textContent = `${ev.location} (${ev.distrito})`;
    if ($("detailCapacity")) $("detailCapacity").textContent = `${ev.enrolled || 0}${ev.maxParticipants ? " / " + ev.maxParticipants : " inscritos"}`;

    updateDetailSocialButton(ev);

    const extLink = $("detailExternalLink");
    if (extLink) {
        if (ev.externalUrl) { extLink.href = ev.externalUrl; extLink.classList.remove("hidden"); }
        else extLink.classList.add("hidden");
    }

    const regBtn = $("detailRegisterBtn");
    if (regBtn) {
        regBtn.className = `register-btn ${isRegistered ? "registered" : ""}`;
        regBtn.disabled = past || (!isRegistered && full);
        regBtn.textContent = past ? "Evento terminado" : (isRegistered ? "✓ Inscrito (Cancelar)" : (full ? "Lotação esgotada" : "Inscrever-me neste evento"));
        regBtn.onclick = () => window.toggleEnrollment(ev.id);
    }

    const ticketBtn = $("detailTicketBtn");
    if (ticketBtn) {
        ticketBtn.classList.toggle("hidden", !isRegistered);
        ticketBtn.onclick = () => window.openTicketModal(ev.id);
    }

    const favBtn = $("detailFavBtn");
    if (favBtn) {
        favBtn.textContent = isFav ? "★ Guardado" : "☆ Guardar";
        favBtn.onclick = () => { toggleFavorite(ev.id); favBtn.textContent = favorites.has(String(ev.id)) ? "★ Guardado" : "☆ Guardar"; };
    }

    if ($("detailDirectionsBtn")) $("detailDirectionsBtn").href = `https://www.google.com/maps/dir/?api=1&destination=${ev.latitude},${ev.longitude}`;
    if ($("detailCalendarBtn")) $("detailCalendarBtn").onclick = () => downloadEventICS(ev);
    if ($("detailShareBtn")) $("detailShareBtn").onclick = () => shareEventLink(ev);
    if ($("detailReportBtn")) $("detailReportBtn").onclick = () => openReportModal(ev);

    const ownerBar = $("detailOwnerBar");
    if (ownerBar) ownerBar.classList.toggle("hidden", !canManage);
    if ($("detailEditBtn")) $("detailEditBtn").onclick = () => { closeModalEl(detailModal); window.openEditEvent(ev.id); };
    if ($("detailDeleteBtn")) $("detailDeleteBtn").onclick = () => { closeModalEl(detailModal); window.deleteEvent(ev.id); };

    if ($("reviewForm")) $("reviewForm").classList.toggle("hidden", !past);
    openModal(detailModal);
    await Promise.all([loadEventAttendees(ev.id), loadEventComments(ev.id), loadEventReviews(ev.id)]);
};

if ($("closeDetail")) $("closeDetail").addEventListener("click", () => closeModalEl(detailModal));
if (detailModal) detailModal.addEventListener("mousedown", e => { if (e.target === detailModal) closeModalEl(detailModal); });

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

if ($("closeTicket")) $("closeTicket").addEventListener("click", () => closeModalEl(ticketModal));
if (ticketModal) ticketModal.addEventListener("mousedown", e => { if (e.target === ticketModal) closeModalEl(ticketModal); });

function downloadEventICS(ev) {
    const dtStart = `${ev.date.replace(/-/g, "")}T${ev.time.replace(":", "")}00`;
    const icsContent = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LocalSpot//Eventos//PT", "BEGIN:VEVENT",
        `SUMMARY:${ev.name}`, `DTSTART:${dtStart}`, `LOCATION:${ev.location}, ${ev.distrito}`,
        `DESCRIPTION:${(ev.description || "").replace(/\n/g, " ")}`, "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ev.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
    a.click();
    URL.revokeObjectURL(url);
}

async function shareEventLink(ev) {
    const shareUrl = `${window.location.origin}${window.location.pathname}?event=${ev.id}`;
    try { await navigator.clipboard.writeText(shareUrl); showToast("Link copiado!", "success"); } catch (e) {}
}

function checkSharedEventUrl() {
    const sharedId = new URLSearchParams(window.location.search).get("event");
    if (sharedId) {
        const exists = events.find(e => String(e.id) === String(sharedId));
        if (exists) { selectEvent(exists.id, { scroll: true }); window.openEventDetails(exists.id); }
    }
}

function openReportModal(ev) { $("reportEventName").textContent = `A denunciar: ${ev.name}`; $("reportDetails").value = ""; openModal(reportModal); }
if ($("closeReport")) $("closeReport").addEventListener("click", () => closeModalEl(reportModal));
if (reportModal) reportModal.addEventListener("mousedown", e => { if (e.target === reportModal) closeModalEl(reportModal); });
if ($("reportForm")) {
    $("reportForm").addEventListener("submit", async e => {
        e.preventDefault();
        if (!currentUser || !detailEventId) return;
        await supabaseClient.from("event_reports").insert([{ event_id: detailEventId, reporter_id: currentUser.id, reason: $("reportReason").value, details: $("reportDetails").value.trim() }]);
        closeModalEl(reportModal);
        showToast("Denúncia enviada.", "success");
    });
}

async function loadEventAttendees(eventId) {
    const listEl = $("detailAttendeesList");
    if (!listEl) return;
    const { data } = await supabaseClient.from("enrollments").select("user_id, user_name").eq("event_id", eventId);
    if (!data || data.length === 0) { listEl.innerHTML = `<span class="muted">Ainda sem inscritos.</span>`; return; }
    listEl.innerHTML = data.map(row => `<span class="attendee-pill">👤 ${escapeHTML(row.user_name || "Participante")}</span>`).join("");
}

async function loadEventComments(eventId) {
    const listEl = $("detailCommentsList");
    if (!listEl) return;
    const { data } = await supabaseClient.from("event_comments").select("*").eq("event_id", eventId).order("created_at", { ascending: true });
    if (!data || data.length === 0) { listEl.innerHTML = `<p class="muted" style="font-size:13px;">Sem comentários ainda.</p>`; return; }
    listEl.innerHTML = data.map(c => `<div class="comment-item"><div class="comment-head"><strong>${escapeHTML(c.user_name)}</strong></div><p>${escapeHTML(c.content)}</p></div>`).join("");
}

if ($("commentForm")) {
    $("commentForm").addEventListener("submit", async e => {
        e.preventDefault();
        if (!currentUser || !currentProfile || !detailEventId) return;
        const input = $("commentInput");
        const content = input.value.trim();
        if (!content) return;
        await supabaseClient.from("event_comments").insert([{ event_id: detailEventId, user_id: currentUser.id, user_name: currentProfile.full_name, content }]);
        input.value = "";
        await loadEventComments(detailEventId);
    });
}

async function loadEventReviews(eventId) {
    const listEl = $("detailReviewsList");
    const badgeEl = $("detailRatingBadge");
    if (!listEl || !badgeEl) return;
    const { data } = await supabaseClient.from("event_reviews").select("*").eq("event_id", eventId);
    if (!data || data.length === 0) { badgeEl.classList.add("hidden"); listEl.innerHTML = `<p class="muted" style="font-size:13px;">Sem avaliações.</p>`; return; }
    const avg = (data.reduce((sum, r) => sum + Number(r.rating), 0) / data.length).toFixed(1);
    badgeEl.textContent = `⭐ ${avg} (${data.length})`;
    badgeEl.classList.remove("hidden");
    listEl.innerHTML = data.map(r => `<div class="comment-item"><div class="comment-head"><strong>${escapeHTML(r.user_name)} · ${"⭐".repeat(r.rating)}</strong></div>${r.comment ? `<p>${escapeHTML(r.comment)}</p>` : ""}</div>`).join("");
}

if ($("reviewForm")) {
    $("reviewForm").addEventListener("submit", async e => {
        e.preventDefault();
        if (!currentUser || !currentProfile || !detailEventId) return;
        await supabaseClient.from("event_reviews").upsert([{ event_id: detailEventId, user_id: currentUser.id, user_name: currentProfile.full_name, rating: Number($("reviewRating").value), comment: $("reviewComment").value.trim() }], { onConflict: "event_id,user_id" });
        $("reviewComment").value = "";
        await loadEventReviews(detailEventId);
    });
}

// ==========================================
// CRIAR, EDITAR E ELIMINAR EVENTOS
// ==========================================
function openModal(el) {
    if (!el) return;
    el.classList.remove("hidden");
    el.setAttribute("aria-hidden", "false");
}

function closeModalEl(el) {
    if (!el) return;
    el.classList.add("hidden");
    el.setAttribute("aria-hidden", "true");
}

function getDefaultEventCoords() {
    if (typeof userPosition !== "undefined" && userPosition && typeof userPosition.lat === "number") {
        return { lat: userPosition.lat, lng: userPosition.lng };
    }
    try {
        if (typeof map !== "undefined" && map && typeof map.getCenter === "function") {
            const c = map.getCenter();
            if (c && typeof c.lat === "number") return { lat: c.lat, lng: c.lng };
        }
    } catch (e) {}
    return { lat: 40.3465, lng: -8.5944 };
}

function updateCoordsDisplay() {
    if (!coordsText) return;
    if (pendingLocation) {
        coordsText.innerHTML = `<span class="ok">📍 ${pendingLocation.lat.toFixed(5)}, ${pendingLocation.lng.toFixed(5)}</span>`;
    } else {
        coordsText.textContent = "Localização ainda não selecionada";
    }
}

if (addEventButton) {
    addEventButton.addEventListener("click", () => {
        if (!currentUser) {
            showToast("Inicia sessão primeiro para criar um evento.", "error");
            if (authOverlay) authOverlay.classList.remove("hidden");
            return;
        }
        editingEventId = null;
        if ($("eventModalTitle")) $("eventModalTitle").textContent = "Novo Evento";
        if ($("submitEventBtn")) $("submitEventBtn").textContent = "Publicar Evento";
        if (eventForm) eventForm.reset();
        if ($("eventPrice")) $("eventPrice").value = "Gratuito";
        if (imagePreview) imagePreview.classList.add("hidden");
        if (formError) formError.classList.add("hidden");

        pendingLocation = getDefaultEventCoords();
        updateCoordsDisplay();
        openModal(modal);
    });
}

window.openEditEvent = id => {
    const ev = events.find(x => String(x.id) === String(id));
    if (!ev || !canManageEvent(ev)) return;

    editingEventId = ev.id;
    if ($("eventModalTitle")) $("eventModalTitle").textContent = "Editar Evento";
    if ($("submitEventBtn")) $("submitEventBtn").textContent = "Guardar Alterações";
    if (formError) formError.classList.add("hidden");

    if ($("eventName")) $("eventName").value = ev.name;
    if ($("eventCategory")) $("eventCategory").value = ev.category;
    if ($("eventDistrito")) $("eventDistrito").value = ev.distrito;
    if ($("eventDate")) $("eventDate").value = ev.date;
    if ($("eventTime")) $("eventTime").value = ev.time;
    if ($("eventLocation")) $("eventLocation").value = ev.location;
    if ($("eventMaxParticipants")) $("eventMaxParticipants").value = ev.maxParticipants || "";
    if ($("eventPrice")) $("eventPrice").value = ev.price || "Gratuito";
    if ($("eventExternalUrl")) $("eventExternalUrl").value = ev.externalUrl || "";
    if ($("eventDescription")) $("eventDescription").value = ev.description || "";

    pendingLocation = { lat: ev.latitude, lng: ev.longitude };
    updateCoordsDisplay();

    if (imagePreview) {
        if (ev.image) {
            imagePreview.src = ev.image;
            imagePreview.classList.remove("hidden");
        } else {
            imagePreview.classList.add("hidden");
        }
    }
    openModal(modal);
};

window.deleteEvent = async id => {
    const ev = events.find(x => String(x.id) === String(id));
    if (!ev || !canManageEvent(ev)) return;
    if (!confirm(`Tens a certeza que queres eliminar "${ev.name}"?`)) return;

    const { error } = await supabaseClient.from("events").delete().eq("id", ev.id);
    if (error) { showToast("Erro ao eliminar evento.", "error"); return; }

    events = events.filter(x => String(x.id) !== String(id));
    filterEvents();
    showToast("Evento eliminado com sucesso.");
};

if (closeModal) {
    closeModal.addEventListener("click", () => {
        closeModalEl(modal);
        try { if (typeof stopLocationPicking === "function") stopLocationPicking(); } catch (e) {}
    });
}
if (modal) {
    modal.addEventListener("mousedown", e => {
        if (e.target === modal) {
            closeModalEl(modal);
            try { if (typeof stopLocationPicking === "function") stopLocationPicking(); } catch (e) {}
        }
    });
}

if (changeLocationButton) {
    changeLocationButton.addEventListener("click", () => {
        closeModalEl(modal);
        if (pickBanner) pickBanner.classList.remove("hidden");
        if (window.innerWidth <= 820) setMobileView("map");

        if (typeof startLocationPicking === "function") {
            startLocationPicking(coords => {
                pendingLocation = coords;
                updateCoordsDisplay();
                if (pickBanner) pickBanner.classList.add("hidden");
                openModal(modal);
            });
        } else {
            if (pickBanner) pickBanner.classList.add("hidden");
            openModal(modal);
        }
    });
}

if ($("cancelPickButton")) {
    $("cancelPickButton").addEventListener("click", () => {
        try { if (typeof stopLocationPicking === "function") stopLocationPicking(); } catch (e) {}
        if (pickBanner) pickBanner.classList.add("hidden");
        openModal(modal);
    });
}

if ($("pickSearchBtn")) {
    $("pickSearchBtn").addEventListener("click", async () => {
        const q = $("pickSearchInput").value.trim();
        if (!q) return;
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=pt&limit=1&q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            pendingLocation = { lat, lng };
            updateCoordsDisplay();
            try { if (typeof map !== "undefined" && map?.flyTo) map.flyTo({ center: [lng, lat], zoom: 16 }); } catch (e) {}
            showToast(`Localização marcada em ${data[0].display_name.split(",")[0]}`, "success");
        } else {
            showToast("Morada não encontrada.", "error");
        }
    });
}

if (eventImageInput) {
    eventImageInput.addEventListener("change", () => {
        const file = eventImageInput.files[0];
        if (!file) { if (imagePreview) imagePreview.classList.add("hidden"); return; }
        const reader = new FileReader();
        reader.onload = () => {
            if (imagePreview) {
                imagePreview.src = reader.result;
                imagePreview.classList.remove("hidden");
            }
        };
        reader.readAsDataURL(file);
    });
}

async function uploadEventImage(file) {
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${currentUser.id}_${Date.now()}.${ext}`;
    const { error } = await supabaseClient.storage.from("event-images").upload(fileName, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    const { data } = supabaseClient.storage.from("event-images").getPublicUrl(fileName);
    return data.publicUrl;
}

if (eventForm) {
    eventForm.addEventListener("submit", async e => {
        e.preventDefault();
        if (formError) formError.classList.add("hidden");

        if (!pendingLocation) pendingLocation = getDefaultEventCoords();

        const submitBtn = $("submitEventBtn");
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "A guardar..."; }

        try {
            const existing = editingEventId ? events.find(x => String(x.id) === String(editingEventId)) : null;
            let imageUrl = existing ? existing.image : DEFAULT_IMAGE;

            const file = eventImageInput?.files?.[0];
            if (file) {
                try { imageUrl = await uploadEventImage(file); } catch (uploadErr) { imageUrl = DEFAULT_IMAGE; }
            }

            const maxVal = $("eventMaxParticipants")?.value;
            const basePayload = {
                name: $("eventName").value.trim(),
                category: $("eventCategory").value,
                distrito: $("eventDistrito").value,
                date: $("eventDate").value,
                time: $("eventTime").value,
                location: $("eventLocation").value.trim(),
                latitude: pendingLocation.lat,
                longitude: pendingLocation.lng,
                max_participants: maxVal ? parseInt(maxVal, 10) : null,
                price: ($("eventPrice")?.value || "").trim() || "Gratuito",
                description: ($("eventDescription")?.value || "").trim(),
                image: imageUrl
            };

            if (editingEventId) {
                const { data, error } = await supabaseClient.from("events").update(basePayload).eq("id", editingEventId).select().single();
                if (error) throw error;
                const updated = mapDbEvent(data);
                const idx = events.findIndex(x => String(x.id) === String(editingEventId));
                if (idx !== -1) events[idx] = updated;
                showToast("Evento atualizado com sucesso!", "success");
            } else {
                const fullPayload = {
                    ...basePayload,
                    creator_id: currentUser.id,
                    creator_name: currentProfile?.full_name || currentUser.email.split("@")[0],
                    creator_type: isBusinessAccount() ? (currentProfile?.business_type || "Entidade") : "Utilizador",
                    creator_role: currentProfile?.role || "user",
                    creator_verified: isEntityVerified(currentProfile),
                    external_url: ($("eventExternalUrl")?.value || "").trim() || null,
                    enrolled: 0
                };

                const { data, error } = await supabaseClient.from("events").insert([fullPayload]).select().single();
                if (error) throw error;
                const created = mapDbEvent(data);
                events.push(created);
                await notifyFollowersOfNewEvent(created);
                showToast("Evento publicado no mapa! 🎉", "success");
            }

            closeModalEl(modal);
            try { if (typeof stopLocationPicking === "function") stopLocationPicking(); } catch (e) {}
            filterEvents();
        } catch (err) {
            if (formError) {
                formError.textContent = err.message || "Erro ao guardar evento.";
                formError.classList.remove("hidden");
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = editingEventId ? "Guardar Alterações" : "Publicar Evento";
            }
        }
    });
}

// ==========================================
// FAVORITOS, EXPORTAÇÃO E EVENTOS DE INTERFACE
// ==========================================
function toggleFavorite(id) {
    const strId = String(id);
    if (favorites.has(strId)) { favorites.delete(strId); showToast("Removido dos favoritos."); }
    else { favorites.add(strId); showToast("Guardado nos favoritos ★"); }
    saveJSON(STORAGE_FAVS, [...favorites]);
    filterEvents();
}

if (eventsList) {
    eventsList.addEventListener("click", e => {
        const favBtn = e.target.closest("[data-fav]");
        if (favBtn) { e.stopPropagation(); toggleFavorite(favBtn.dataset.fav); }
    });
}

if (searchInput) searchInput.addEventListener("input", () => { state.search = searchInput.value; filterEvents(); });

if (categoryChips) {
    categoryChips.addEventListener("click", e => {
        const chip = e.target.closest(".chip");
        if (!chip) return;
        categoryChips.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        state.category = chip.dataset.category;
        filterEvents();
    });
}

if (districtFilter) districtFilter.addEventListener("change", () => { state.district = districtFilter.value; filterEvents(); });
if (periodFilter) periodFilter.addEventListener("change", () => { state.period = periodFilter.value; filterEvents(); });

if (radiusSlider) {
    radiusSlider.addEventListener("input", () => {
        state.radius = Number(radiusSlider.value);
        if (radiusValue) radiusValue.textContent = state.radius >= 300 ? "Todo o país" : `${state.radius} km`;
        filterEvents();
    });
}

if (sortFilter) sortFilter.addEventListener("change", () => { state.sort = sortFilter.value; filterEvents(); });

if (favoritesToggle) {
    favoritesToggle.addEventListener("click", () => {
        state.onlyFavorites = !state.onlyFavorites;
        favoritesToggle.classList.toggle("on", state.onlyFavorites);
        filterEvents();
    });
}

if (freeOnlyToggle) {
    freeOnlyToggle.addEventListener("click", () => {
        state.onlyFree = !state.onlyFree;
        freeOnlyToggle.classList.toggle("on", state.onlyFree);
        filterEvents();
    });
}

if (followingOnlyToggle) {
    followingOnlyToggle.addEventListener("click", () => {
        state.onlyFollowing = !state.onlyFollowing;
        followingOnlyToggle.classList.toggle("on", state.onlyFollowing);
        filterEvents();
    });
}

if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener("click", () => {
        state.search = ""; state.category = "all"; state.district = "all"; state.period = "all";
        state.radius = 300; state.sort = "date"; state.onlyFavorites = false; state.onlyFree = false; state.onlyFollowing = false;
        if (searchInput) searchInput.value = "";
        if (districtFilter) districtFilter.value = "all";
        if (periodFilter) periodFilter.value = "all";
        if (radiusSlider) radiusSlider.value = 300;
        if (radiusValue) radiusValue.textContent = "Todo o país";
        if (sortFilter) sortFilter.value = "date";
        if (favoritesToggle) favoritesToggle.classList.remove("on");
        if (freeOnlyToggle) freeOnlyToggle.classList.remove("on");
        if (followingOnlyToggle) followingOnlyToggle.classList.remove("on");
        if (categoryChips) categoryChips.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c.dataset.category === "all"));
        filterEvents();
    });
}

if (locationButton) {
    locationButton.addEventListener("click", async () => {
        locationButton.disabled = true;
        locationButton.innerHTML = `<span>⏳</span> A localizar...`;
        try {
            if (typeof locateUser === "function") await locateUser();
            if (sortFilter) sortFilter.value = "distance";
            state.sort = "distance";
            filterEvents();
            showToast("Localização obtida! Ordenado por distância.", "success");
        } catch (err) {
            showToast(err.message || "Não foi possível obter localização.", "error");
        } finally {
            locationButton.disabled = false;
            locationButton.innerHTML = `<span aria-hidden="true">📍</span> Perto de mim`;
        }
    });
}

if ($("exportCsvBtn")) {
    $("exportCsvBtn").addEventListener("click", () => {
        if (!currentList.length) { showToast("Não existem eventos visíveis para exportar.", "error"); return; }
        const headers = ["Nome", "Categoria", "Organizador", "Distrito", "Local", "Data", "Hora", "Preço", "Inscritos"];
        const rows = currentList.map(ev => [
            `"${(ev.name || "").replace(/"/g, '""')}"`, `"${ev.category}"`, `"${(ev.creatorName || "").replace(/"/g, '""')}"`,
            `"${ev.distrito}"`, `"${(ev.location || "").replace(/"/g, '""')}"`, ev.date, ev.time, `"${ev.price || "Gratuito"}"`, ev.enrolled || 0
        ]);
        const csv = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `localspot-eventos-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });
}

if ($("aboutButton")) $("aboutButton").addEventListener("click", () => openModal(aboutModal));
if ($("closeAbout")) $("closeAbout").addEventListener("click", () => closeModalEl(aboutModal));
if (aboutModal) aboutModal.addEventListener("mousedown", e => { if (e.target === aboutModal) closeModalEl(aboutModal); });

document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
        [modal, detailModal, ticketModal, reportModal, aboutModal, adminModal, profileModal].forEach(closeModalEl);
        if ($("friendsModal")) closeModalEl($("friendsModal"));
        if ($("entityNetworkModal")) closeModalEl($("entityNetworkModal"));
        if ($("friendChatModal")) { activeChatFriendId = null; closeModalEl($("friendChatModal")); }
        if ($("quickMoodPopover")) $("quickMoodPopover").classList.add("hidden");
        try { if (typeof stopLocationPicking === "function") stopLocationPicking(); } catch (err) {}
        if (pickBanner) pickBanner.classList.add("hidden");
    }
});

populateDistricts();
try { if (typeof initMap === "function") initMap(); } catch (err) {}
initAuth();
