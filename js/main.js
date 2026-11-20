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
let myFollowing = new Map();       // Entidades que esta conta segue (apenas role === 'business')
let myFollowingProfiles = [];      // Perfis completos das entidades seguidas
let myFollowersList = [];          // Quem segue esta entidade (apenas quando currentProfile.role === 'business')
let notifications = [];
let activeId = null;
let pendingLocation = null;
let editingEventId = null;
let detailEventId = null;
let currentList = [];

// Estado Social (Amigos estritamente entre role === 'user')
window.friendsList = [];
let friendshipRecords = new Map();
let incomingFriendRequests = [];
let sentFriendRequestIds = new Set();
let allEnrollmentsMap = new Map();
let activeChatFriendId = null;
let unreadMessagesBySender = new Map();
let locationSyncInterval = null;
let geoWatchId = null;
let realtimeChannel = null;

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
    { emoji: "📚", text: "A estudar" },
    { emoji: "🎧", text: "A ouvir música" },
    { emoji: "🏃", text: "A treinar" },
    { emoji: "🍔", text: "A comer" },
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

// Verificação armazenada no campo status_emoji ("✅") sem precisar de alterar a BD
function isEntityVerified(profile) {
    return profile?.role === "business" && (profile?.is_verified === true || profile?.status_emoji === "✅");
}

function verifiedBadgeHTML(profile) {
    if (isEntityVerified(profile)) {
        return `<span class="verified-check" title="Entidade Oficial Verificada">✓</span>`;
    }
    return "";
}

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
            <div class="welcome-orb orb-1"></div>
            <div class="welcome-orb orb-2"></div>
            <div class="welcome-orb orb-3"></div>
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
            <div class="welcome-orb orb-1"></div>
            <div class="welcome-orb orb-2"></div>
            <div class="welcome-orb orb-3"></div>
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
                    <span class="welcome-feat-chip">🏛️ Entidades Locais</span>
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
                        💡 <strong>Dica:</strong> Adiciona outros utilizadores como <strong>Amigos</strong> e segue <strong>Empresas e Entidades Públicas</strong> para acompanhar os seus eventos!
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
// INJEÇÃO DA UI SOCIAL (AMIGOS PARA USERS / SEGUIDORES & VERIFICAÇÃO PARA ENTIDADES)
// ==========================================
function ensureSocialUI() {
    const nav = document.querySelector(".header nav");

    // 1A. Botão Amigos no Header (exclusivo para Utilizadores Normais)
    if (nav && !$("friendsNavBtn")) {
        const friendsBtn = document.createElement("button");
        friendsBtn.type = "button";
        friendsBtn.id = "friendsNavBtn";
        friendsBtn.className = "btn-friends-nav hidden";
        friendsBtn.innerHTML = `👊 Amigos <span id="friendsReqBadge" class="friends-req-badge hidden">0</span>`;
        nav.insertBefore(friendsBtn, notifBtn);
    }

    // 1B. Botão Rede / Seguidores no Header (exclusivo para Empresas / Domínios Públicos)
    if (nav && !$("entityNetworkNavBtn")) {
        const entBtn = document.createElement("button");
        entBtn.type = "button";
        entBtn.id = "entityNetworkNavBtn";
        entBtn.className = "btn-entity-nav hidden";
        entBtn.innerHTML = `🏛️ Seguidores (<span id="headerFollowersCount">0</span>)`;
        nav.insertBefore(entBtn, notifBtn);
    }

    // 2. Controlos Sociais no Mapa
    const mapCtrls = document.querySelector(".map-floating-controls");
    if (mapCtrls && !$("privacyMapBtn")) {
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
    }

    // 3. Banner de Hangout (Amigos Juntos) no Mapa
    const mapContainer = document.querySelector(".map-container");
    if (mapContainer && !$("hangoutBanner")) {
        const hBanner = document.createElement("div");
        hBanner.id = "hangoutBanner";
        hBanner.className = "hangout-banner hidden";
        mapContainer.appendChild(hBanner);
    }

    // 4. Campos e Estatísticas no Modal de Perfil ("A Minha Conta")
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

            <!-- Secção exclusiva para Empresas / Domínios Públicos -->
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

            <!-- Secção exclusiva para Utilizadores Normais -->
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

    // 4B. Aba extra "Amigos" no Modal de Perfil para utilizadores normais
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

    // 5A. Modal de Amigos & Pesquisa (Utilizadores Normais: Amigos com users, Seguir para Entidades)
    if (!$("friendsModal")) {
        const fModal = document.createElement("div");
        fModal.id = "friendsModal";
        fModal.className = "modal hidden";
        fModal.setAttribute("aria-hidden", "true");
        fModal.innerHTML = `
            <div class="modal-content">
                <button type="button" id="closeFriendsModal" class="close-button" aria-label="Fechar">&times;</button>
                <h2 style="margin:0 0 4px;">👊 Amigos & Comunidade</h2>
                <p style="color:var(--muted); font-size:13px; margin:0 0 14px;">Adiciona outros utilizadores como amigos ou segue empresas e entidades públicas.</p>
                
                <div class="auth-tabs" style="margin-bottom:14px;">
                    <button type="button" id="tabFriendsList" class="auth-tab active">👥 Meus Amigos (<span id="friendsTabCount">0</span>)</button>
                    <button type="button" id="tabFriendsAdd" class="auth-tab">🔍 Procurar / Pedidos (<span id="requestsTabCount">0</span>)</button>
                </div>

                <div id="panelFriendsList">
                    <div id="friendsContainerList"></div>
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

    // 5B. Modal de Seguidores & A Seguir (Empresas e Domínios Públicos)
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

    // 6. Modal de Chat Direto & Emoji Bombs (Apenas entre Amigos)
    if (!$("friendChatModal")) {
        const chatModal = document.createElement("div");
        chatModal.id = "friendChatModal";
        chatModal.className = "modal hidden";
        chatModal.setAttribute("aria-hidden", "true");
        chatModal.innerHTML = `
            <div class="modal-content" style="width:440px;">
                <button type="button" id="closeFriendChatModal" class="close-button" aria-label="Fechar">&times;</button>
                <div id="chatFriendHeader" style="display:flex; align-items:center; gap:10px; margin-bottom:12px;"></div>
                
                <div class="emoji-bomb-bar" title="Enviar chuva de emojis em tempo real!">
                    <button type="button" class="emoji-bomb-btn" data-bomb="👊">👊</button>
                    <button type="button" class="emoji-bomb-btn" data-bomb="🔥">🔥</button>
                    <button type="button" class="emoji-bomb-btn" data-bomb="❤️">❤️</button>
                    <button type="button" class="emoji-bomb-btn" data-bomb="😂">😂</button>
                    <button type="button" class="emoji-bomb-btn" data-bomb="🎉">🎉</button>
                    <button type="button" class="emoji-bomb-btn" data-bomb="👀">👀</button>
                </div>

                <div id="chatMessagesBox" class="chat-messages-box"></div>

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

function bindSocialEvents() {
    // Amigos (Utilizador Normal)
    const friendsNavBtn = $("friendsNavBtn");
    const friendsModal = $("friendsModal");
    if (friendsNavBtn && !friendsNavBtn.dataset.bound) {
        friendsNavBtn.dataset.bound = "1";
        friendsNavBtn.addEventListener("click", async () => {
            openModal(friendsModal);
            await loadSocialData();
        });
    }

    const closeFriendsBtn = $("closeFriendsModal");
    if (closeFriendsBtn && !closeFriendsBtn.dataset.bound) {
        closeFriendsBtn.dataset.bound = "1";
        closeFriendsBtn.addEventListener("click", () => closeModalEl(friendsModal));
        friendsModal.addEventListener("mousedown", e => { if (e.target === friendsModal) closeModalEl(friendsModal); });
    }

    // Rede Institucional (Empresa / Domínio Público)
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

    // Chat Direto
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

    // Tabs do Modal de Amigos
    const tabList = $("tabFriendsList");
    const tabAdd = $("tabFriendsAdd");
    if (tabList && !tabList.dataset.bound) {
        tabList.dataset.bound = "1";
        tabList.addEventListener("click", () => {
            tabList.classList.add("active");
            tabAdd.classList.remove("active");
            $("panelFriendsList").classList.remove("hidden");
            $("panelFriendsAdd").classList.add("hidden");
        });
        tabAdd.addEventListener("click", () => {
            tabAdd.classList.add("active");
            tabList.classList.remove("active");
            $("panelFriendsAdd").classList.remove("hidden");
            $("panelFriendsList").classList.add("hidden");
        });
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
    currentUser = null;
    currentProfile = null;
    myEnrollments.clear();
    myFollowing.clear();
    myFollowingProfiles = [];
    myFollowersList = [];
    window.friendsList = [];
    if (typeof showFriendsOnMap === "function") showFriendsOnMap([]);
    if ($("friendsNavBtn")) $("friendsNavBtn").classList.add("hidden");
    if ($("entityNetworkNavBtn")) $("entityNetworkNavBtn").classList.add("hidden");
    if ($("privacyMapBtn")) $("privacyMapBtn").classList.add("hidden");
    if ($("quickCheckinMapBtn")) $("quickCheckinMapBtn").classList.add("hidden");
    if ($("hangoutBanner")) $("hangoutBanner").classList.add("hidden");
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
    authOverlay.classList.add("hidden");
    if (typeof map !== "undefined") map.resize();

    await Promise.all([
        loadMyEnrollments(),
        loadAllEnrollmentsSummary(),
        loadMyFollowing(),
        loadMyFollowers(),
        loadNotifications(),
        loadUnreadMessagesCount(),
        loadSocialData()
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
    if ($("quickCheckinMapBtn")) $("quickCheckinMapBtn").classList.toggle("hidden", !isUser);

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
// SISTEMA DE AMIZADES (APENAS UTILIZADORES NORMAIS)
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

async function loadSocialData() {
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
                return { ...prof, bump_count: fRow?.bump_count || 0 };
            })
            .filter(Boolean);

        incomingFriendRequests = incomingRows
            .map(r => {
                const prof = profilesById.get(r.requester_id);
                if (!prof || prof.role !== "user") return null;
                return { friendshipId: r.id, user: prof };
            })
            .filter(Boolean);

        updateSocialBadges();
        renderFriendsModalContent();
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
    if ($("friendsTabCount")) $("friendsTabCount").textContent = window.friendsList.length;
    if ($("requestsTabCount")) $("requestsTabCount").textContent = incomingFriendRequests.length;
}

function renderFriendsModalContent() {
    const container = $("friendsContainerList");
    const reqContainer = $("incomingRequestsSection");
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
        const batStr = typeof f.battery_level === "number" ? ` · ${f.is_charging ? "⚡" : "🔋"}${f.battery_level}%` : "";
        const statusStr = isGhost
            ? "👻 Modo Fantasma"
            : `${f.current_place ? "📍 " + escapeHTML(f.current_place) : (f.status_emoji || "📍") + " " + escapeHTML(f.status_text || "Online")}${batStr}`;
        const unread = unreadMessagesBySender.get(String(f.id)) || 0;

        return `
            <div class="friend-row">
                <div class="friend-row-left">
                    ${renderAvatarChip(f, "")}
                    <div class="friend-row-info">
                        <strong>${escapeHTML(f.full_name)} <small style="color:#f9a8d4;">👊${f.bump_count || 0}</small></strong>
                        <span>${statusStr}</span>
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
                actionBtn = `<span class="category">✓ Amigos</span>`;
            } else if (sentFriendRequestIds.has(u.id)) {
                actionBtn = `<span class="muted" style="font-size:12px;">Pedido enviado</span>`;
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
        .select("role")
        .eq("id", targetId)
        .maybeSingle();

    if (!targetProf || targetProf.role !== "user") {
        showToast("Empresas e entidades públicas não aceitam pedidos de amizade — clique em Seguir.", "error");
        return;
    }

    const { error } = await supabaseClient.from("friendships").insert([{
        requester_id: currentUser.id,
        addressee_id: targetId,
        status: "pending"
    }]);

    if (error) {
        showToast("Pedido já enviado ou erro de ligação.", "error");
        return;
    }

    sentFriendRequestIds.add(targetId);
    await createNotification(
        targetId,
        null,
        "Novo pedido de amizade 👊",
        `${currentProfile.full_name} quer adicionar-te aos amigos no LocalSpot!`
    );
    showToast(`Pedido de amizade enviado a ${targetName}!`, "success");
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
        `${currentProfile.full_name} aceitou o teu pedido. Já são amigos!`
    );
    showToast("Novo amigo adicionado!", "success");
    await loadSocialData();
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
    await loadSocialData();
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
// BUMP, EMOJI BOMBS & CHAT DIRETO (ENTRE AMIGOS)
// ==========================================
function triggerBumpVisual(emoji = "👊", text = "BUMP!") {
    const existing = document.querySelector(".bump-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "bump-overlay";
    overlay.innerHTML = `
        <div class="bump-burst">${emoji}</div>
        <div class="bump-banner-text">${escapeHTML(text)}</div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 1850);
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

    const fRow = friendshipRecords.get(String(friendId));
    const nextCount = (fRow?.bump_count || 0) + 1;
    if (fRow) {
        fRow.bump_count = nextCount;
        await supabaseClient.from("friendships").update({ bump_count: nextCount }).eq("id", fRow.id);
    }
    friend.bump_count = nextCount;

    triggerBumpVisual(emoji, `${emoji} ${label} com ${friend.full_name}! (#${nextCount})`);
    renderFriendsModalContent();
    if (typeof showFriendsOnMap === "function") showFriendsOnMap(window.getMapSocialEntities());

    await createNotification(
        friendId,
        null,
        `${emoji} ${currentProfile.full_name} fez Bump contigo! (#${nextCount})`,
        `Abre o mapa para ver onde ${currentProfile.full_name} está agora!`
    );
};

window.openFriendChat = async friendId => {
    const friend = window.friendsList.find(f => String(f.id) === String(friendId));
    if (!friend) return;

    activeChatFriendId = String(friend.id);
    closeModalEl($("friendsModal"));

    $("chatFriendHeader").innerHTML = `
        ${renderAvatarChip(friend, "")}
        <div>
            <strong style="display:block; font-size:15px;">${escapeHTML(friend.full_name)}</strong>
            <span style="font-size:12px; color:#f9a8d4;">
                👊 ${friend.bump_count || 0} Bumps · ${escapeHTML(friend.status_emoji || "📍")} ${escapeHTML(friend.status_text || "Online")}
            </span>
        </div>
    `;

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
        .limit(50);

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

    if (!data || data.length === 0) {
        box.innerHTML = `<p class="muted" style="font-size:12.5px; text-align:center; margin-top:80px;">Envia a primeira mensagem! 💬</p>`;
        return;
    }

    box.innerHTML = data.map(m => {
        const isMine = String(m.sender_id) === String(currentUser.id);
        const timeStr = new Date(m.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
        const contentDisplay = m.msg_type === "emoji_bomb"
            ? `<span style="font-size:24px;">${escapeHTML(m.content)}</span> <small style="display:inline;">Emoji Bomb!</small>`
            : escapeHTML(m.content);

        return `
            <div class="chat-bubble ${isMine ? "mine" : "theirs"}">
                ${contentDisplay}
                <small>${timeStr}</small>
            </div>
        `;
    }).join("");

    box.scrollTop = box.scrollHeight;
}

async function sendDirectMessage(receiverId, content, msgType = "text") {
    if (!currentUser) return;
    const { error } = await supabaseClient.from("friend_messages").insert([{
        sender_id: currentUser.id,
        receiver_id: receiverId,
        content,
        msg_type: msgType
    }]);

    if (error) {
        showToast("Erro ao enviar mensagem.", "error");
        return;
    }

    if (String(activeChatFriendId) === String(receiverId)) {
        await loadChatHistory(receiverId);
    }
}

// ==========================================
// TELEMETRIA: BATERIA, VELOCIDADE, PRIVACIDADE & CHECK-IN
// ==========================================
async function getDeviceBatteryTelemetry() {
    if (!navigator.getBattery || !isNormalUserAccount()) return {};
    try {
        const bat = await navigator.getBattery();
        return {
            battery_level: Math.round(bat.level * 100),
            is_charging: !!bat.charging
        };
    } catch (e) {
        return {};
    }
}

function applyPrivacyOffset(lat, lng, mode) {
    if (mode !== "blurred") return { lat, lng };
    const seed = currentUser ? currentUser.id.charCodeAt(0) : 7;
    const angle = (seed % 360) * (Math.PI / 180);
    const offsetDeg = 0.0035;
    return {
        lat: lat + Math.cos(angle) * offsetDeg,
        lng: lng + Math.sin(angle) * offsetDeg
    };
}

window.syncMyLiveLocation = async (lat, lng, speedKmh = 0) => {
    if (!currentUser || !currentProfile || isAdminAccount()) return;
    const mode = currentProfile.privacy_mode || (currentProfile.ghost_mode ? "ghost" : "precise");
    if (mode === "ghost") return;

    const coords = applyPrivacyOffset(lat, lng, mode);
    const batInfo = await getDeviceBatteryTelemetry();

    try {
        await supabaseClient.from("profiles").update({
            last_lat: coords.lat,
            last_lng: coords.lng,
            speed_kmh: isBusinessAccount() ? 0 : speedKmh,
            last_seen: new Date().toISOString(),
            ...batInfo
        }).eq("id", currentUser.id);
    } catch (e) {}
};

async function cyclePrivacyMode() {
    if (!currentUser || !currentProfile || isAdminAccount()) return;
    const isBiz = isBusinessAccount();
    const order = isBiz ? ["precise", "ghost"] : ["precise", "blurred", "ghost"];
    const current = currentProfile.privacy_mode || "precise";
    const next = order[(order.indexOf(current) + 1) % order.length];

    const isGhost = next === "ghost";
    const updatePayload = { privacy_mode: next, ghost_mode: isGhost };

    if (isGhost) {
        updatePayload.last_lat = null;
        updatePayload.last_lng = null;
    } else if (userPosition) {
        const coords = applyPrivacyOffset(userPosition.lat, userPosition.lng, next);
        updatePayload.last_lat = coords.lat;
        updatePayload.last_lng = coords.lng;
        updatePayload.last_seen = new Date().toISOString();
    }

    const { error } = await supabaseClient.from("profiles").update(updatePayload).eq("id", currentUser.id);
    if (error) {
        showToast("Erro ao atualizar visibilidade no mapa.", "error");
        return;
    }

    Object.assign(currentProfile, updatePayload);
    applyRoleUI();

    if (isBiz) {
        if (next === "ghost") showToast("📅 Apenas Eventos Públicos visíveis no mapa.");
        else {
            showToast("🏢 Sede Institucional visível aos seus seguidores no mapa!", "success");
            if (!userPosition) {
                try { await locateUser(); } catch (e) {}
            }
        }
    } else {
        if (next === "ghost") showToast("👻 Modo Fantasma — estás invisível no mapa.");
        else if (next === "blurred") showToast("🌫️ Modo Borrão — os teus amigos veem apenas a tua zona aproximada.");
        else {
            showToast("📍 Localização Precisa ativa para os teus amigos!", "success");
            if (!userPosition) {
                try { await locateUser(); } catch (e) {}
            }
        }
    }
}

async function doQuickCheckin() {
    if (!currentUser || !currentProfile || !isNormalUserAccount()) return;
    if (!userPosition) {
        try { await locateUser(); } catch (e) {}
    }

    let suggestedName = currentProfile.current_place || "";
    if (userPosition && events.length > 0) {
        const nearby = events.find(ev => distanceKm(userPosition.lat, userPosition.lng, ev.latitude, ev.longitude) <= 0.5);
        if (nearby) suggestedName = nearby.name;
    }

    const place = prompt("Onde estás agora? (Deixa vazio para limpar o Check-in)", suggestedName);
    if (place === null) return;

    const cleanPlace = place.trim() || null;
    const { error } = await supabaseClient
        .from("profiles")
        .update({ current_place: cleanPlace, last_seen: new Date().toISOString() })
        .eq("id", currentUser.id);

    if (error) {
        showToast("Erro ao guardar Check-in.", "error");
        return;
    }

    currentProfile.current_place = cleanPlace;
    if (cleanPlace) {
        showToast(`📌 Check-in feito em "${cleanPlace}"!`, "success");
        for (const f of window.friendsList) {
            await createNotification(
                f.id,
                null,
                `📌 ${currentProfile.full_name} fez Check-in`,
                `Está agora em: ${cleanPlace}`
            );
        }
    } else {
        showToast("Check-in removido.");
    }
}

function startLiveSocialSync() {
    if (locationSyncInterval) clearInterval(locationSyncInterval);
    if (geoWatchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(geoWatchId);

    if (isNormalUserAccount() && navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: "geolocation" }).then(res => {
            if (res.state === "granted" && navigator.geolocation) {
                geoWatchId = navigator.geolocation.watchPosition(pos => {
                    userPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    const speedKmh = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
                    window.syncMyLiveLocation(userPosition.lat, userPosition.lng, speedKmh);
                }, () => {}, { enableHighAccuracy: true, maximumAge: 15000 });
            }
        }).catch(() => {});
    }

    locationSyncInterval = setInterval(async () => {
        if (!currentUser) return;
        await Promise.all([loadSocialData(), loadMyFollowing(), loadMyFollowers()]);
        if (userPosition && currentProfile?.privacy_mode !== "ghost") {
            await window.syncMyLiveLocation(userPosition.lat, userPosition.lng, 0);
        }
    }, 25000);

    if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = supabaseClient
        .channel(`bump_live_${currentUser.id}`)
        .on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${currentUser.id}`
        }, payload => {
            const notif = payload.new;
            if (notif) {
                notifications.unshift(notif);
                renderNotifications();
                if (notif.title && notif.title.includes("Bump")) {
                    triggerBumpVisual("👊", notif.title);
                    loadSocialData();
                } else {
                    showToast(notif.title, "success");
                }
            }
        })
        .on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "friend_messages",
            filter: `receiver_id=eq.${currentUser.id}`
        }, async payload => {
            const msg = payload.new;
            if (!msg || !isNormalUserAccount()) return;
            if (msg.msg_type === "emoji_bomb") {
                launchEmojiBombAnimation(msg.content);
            }
            if (String(activeChatFriendId) === String(msg.sender_id)) {
                await loadChatHistory(msg.sender_id);
            } else {
                const senderId = String(msg.sender_id);
                unreadMessagesBySender.set(senderId, (unreadMessagesBySender.get(senderId) || 0) + 1);
                updateSocialBadges();
                renderFriendsModalContent();
                const sender = window.friendsList.find(f => String(f.id) === senderId);
                showToast(`💬 ${sender ? sender.full_name : "Mensagem"}: ${msg.content}`, "success");
            }
        })
        .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "friendships"
        }, () => {
            if (isNormalUserAccount()) loadSocialData();
        })
        .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "follows"
        }, async () => {
            await Promise.all([loadMyFollowing(), loadMyFollowers()]);
            applyRoleUI();
        })
        .subscribe();
}

// ==========================================
// CENTRO DE NOTIFICAÇÕES
// ==========================================
async function createNotification(targetUserId, eventId, title, message) {
    if (!targetUserId || (currentUser && targetUserId === currentUser.id)) return;
    try {
        await supabaseClient.from("notifications").insert([{
            user_id: targetUserId,
            event_id: eventId,
            title,
            message
        }]);
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
    const unreadCount = notifications.filter(n => !n.is_read).length;
    notifBadge.textContent = unreadCount;
    notifBadge.classList.toggle("hidden", unreadCount === 0);

    if (!notifications.length) {
        notifList.innerHTML = `<p class="muted" style="padding:14px; font-size:12.5px; margin:0;">Sem notificações recentes.</p>`;
        return;
    }

    notifList.innerHTML = notifications.map(n => `
        <div class="notif-item${n.is_read ? "" : " unread"}" data-notif-id="${n.id}" data-event-id="${n.event_id || ""}">
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
    if (!e.target.closest(".notif-wrap")) notifDropdown.classList.add("hidden");
});

notifList.addEventListener("click", async e => {
    const item = e.target.closest(".notif-item");
    if (!item) return;
    const notifId = item.dataset.notifId;
    const eventId = item.dataset.eventId;

    await supabaseClient.from("notifications").update({ is_read: true }).eq("id", notifId);
    const nObj = notifications.find(x => String(x.id) === String(notifId));
    if (nObj) nObj.is_read = true;
    renderNotifications();
    notifDropdown.classList.add("hidden");

    if (eventId) {
        openEventDetails(eventId);
    } else if ($("friendsModal") && isNormalUserAccount()) {
        openModal($("friendsModal"));
        await loadSocialData();
    } else if ($("entityNetworkModal") && isBusinessAccount()) {
        openModal($("entityNetworkModal"));
        await Promise.all([loadMyFollowers(), loadMyFollowing()]);
        renderEntityNetworkModal();
    }
});

$("markAllReadBtn").addEventListener("click", async () => {
    if (!currentUser) return;
    await supabaseClient.from("notifications").update({ is_read: true }).eq("user_id", currentUser.id);
    notifications.forEach(n => { n.is_read = true; });
    renderNotifications();
});

// ==========================================
// SEGUIR EMPRESAS & ENTIDADES PÚBLICAS (UNIDIRECIONAL)
// ==========================================
async function loadMyFollowing() {
    if (!currentUser) return;
    try {
        const { data, error } = await supabaseClient
            .from("follows")
            .select("following_id, following_name")
            .eq("follower_id", currentUser.id);

        if (!error && data) {
            const ids = data.map(r => r.following_id).filter(Boolean);
            let validBusinesses = [];

            if (ids.length > 0) {
                const { data: profs } = await supabaseClient
                    .from("profiles")
                    .select("*")
                    .in("id", ids)
                    .eq("role", "business");
                validBusinesses = profs || [];
            }

            myFollowingProfiles = validBusinesses;
            myFollowing = new Map(validBusinesses.map(b => [String(b.id), b.full_name]));

            if (typeof showFriendsOnMap === "function") {
                showFriendsOnMap(window.getMapSocialEntities());
            }
        }
    } catch (e) {}
}

async function toggleFollowOrganizer(creatorId, creatorName) {
    if (!currentUser || !creatorId || String(creatorId) === String(currentUser.id)) return;
    const key = String(creatorId);

    if (myFollowing.has(key)) {
        await supabaseClient.from("follows").delete().eq("follower_id", currentUser.id).eq("following_id", creatorId);
        myFollowing.delete(key);
        myFollowingProfiles = myFollowingProfiles.filter(p => String(p.id) !== key);
        showToast(`Deixaste de seguir ${creatorName}.`);
    } else {
        const { data: targetProf } = await supabaseClient
            .from("profiles")
            .select("*")
            .eq("id", creatorId)
            .maybeSingle();

        if (!targetProf || targetProf.role !== "business") {
            showToast("Apenas empresas e entidades públicas podem ser seguidas. Envia um pedido de amizade aos utilizadores.", "error");
            return;
        }

        await supabaseClient.from("follows").insert([{
            follower_id: currentUser.id,
            following_id: creatorId,
            following_name: targetProf.full_name || creatorName
        }]);
        myFollowing.set(key, targetProf.full_name || creatorName);
        myFollowingProfiles.push(targetProf);

        await createNotification(
            creatorId,
            null,
            "Novo seguidor! 🏛️",
            `${currentProfile.full_name} começou a seguir a sua página.`
        );
        showToast(`Agora segues ${targetProf.full_name || creatorName}!`, "success");
    }

    if (typeof showFriendsOnMap === "function") {
        showFriendsOnMap(window.getMapSocialEntities());
    }
    if (!detailModal.classList.contains("hidden") && detailEventId) {
        const ev = events.find(x => String(x.id) === String(detailEventId));
        if (ev) updateDetailSocialButton(ev);
    }
    if (state.onlyFollowing) filterEvents();
}

window.toggleFollowFromList = async (id, name) => {
    await toggleFollowOrganizer(id, name);
};

function updateDetailSocialButton(ev) {
    const btn = $("detailFollowBtn");
    const creatorId = ev?.creatorId;
    if (!creatorId || !currentUser || String(creatorId) === String(currentUser.id)) {
        btn.classList.add("hidden");
        return;
    }

    const creatorRole = ev.creatorRole || (ev.creatorType === "Utilizador" ? "user" : "business");
    btn.classList.remove("hidden", "following", "friend-action");

    if (creatorRole === "business") {
        const isFollowing = myFollowing.has(String(creatorId));
        btn.classList.toggle("following", isFollowing);
        btn.textContent = isFollowing ? "✓ A seguir" : "+ Seguir";
        btn.onclick = () => toggleFollowOrganizer(creatorId, ev.creatorName);
    } else if (creatorRole === "user" && isNormalUserAccount()) {
        btn.classList.add("friend-action");
        const isFriend = window.friendsList.some(f => String(f.id) === String(creatorId));
        const isPending = sentFriendRequestIds.has(creatorId);

        if (isFriend) {
            btn.classList.add("following");
            btn.textContent = "✓ Amigos";
            btn.onclick = () => {
                closeModalEl(detailModal);
                openFriendChat(creatorId);
            };
        } else if (isPending) {
            btn.textContent = "⏳ Pedido enviado";
            btn.onclick = null;
        } else {
            btn.textContent = "👊 Adicionar Amigo";
            btn.onclick = () => window.sendFriendRequest(creatorId, ev.creatorName);
        }
    } else {
        btn.classList.add("hidden");
    }
}

// ==========================================
// MODAL DE PERFIL ("A MINHA CONTA" — SEPARADO POR CLASSE)
// ==========================================
userBadge.addEventListener("click", async () => {
    if (!currentProfile) return;
    ensureSocialUI();
    const isBiz = isBusinessAccount();
    const isAdm = isAdminAccount();

    await Promise.all([loadMyFollowing(), loadMyFollowers(), loadSocialData()]);

    $("profileEmailDisplay").textContent = `${currentProfile.email} · ${isAdm ? "🛡️ Administrador" : (isBiz ? "👔 Empresa / Domínio Público" : "👤 Utilizador")}`;
    $("profileNameInput").value = currentProfile.full_name || "";
    $("profileBioInput").value = currentProfile.bio || "";

    const nameLabel = document.querySelector("label[for='profileNameInput']");
    const bioLabel = document.querySelector("label[for='profileBioInput']");
    const avatarLabel = $("profileAvatarLabel");
    if (nameLabel) nameLabel.textContent = isBiz ? "Nome da Empresa / Entidade *" : "Nome de exibição *";
    if (bioLabel) bioLabel.textContent = isBiz ? "Apresentação Institucional / Missão" : "Bio / Sobre mim";
    if (avatarLabel) avatarLabel.textContent = isBiz ? "Logótipo da Entidade" : "Foto de Perfil";

    if ($("businessOnlyProfileFields")) $("businessOnlyProfileFields").classList.toggle("hidden", !isBiz);
    if ($("userOnlyProfileFields")) $("userOnlyProfileFields").classList.toggle("hidden", isBiz || isAdm);

    const statsBar = $("profileStatsBar");
    if (statsBar) {
        if (isBiz) {
            const verifBadge = isEntityVerified(currentProfile)
                ? `<span class="verified-pill">✅ Entidade Verificada</span>`
                : `<span class="unverified-pill">⏳ A aguardar verificação pelo Admin</span>`;
            statsBar.innerHTML = `
                ${verifBadge}
                <span class="profile-stat-pill">👥 ${myFollowersList.length} Seguidores</span>
                <span class="profile-stat-pill">🏛️ ${myFollowingProfiles.length} A Seguir</span>
            `;
        } else if (isAdm) {
            statsBar.innerHTML = `
                <span class="verified-pill">🛡️ Administrador da Plataforma</span>
                <button type="button" class="btn-admin" onclick="closeModalEl(profileModal); openModal(adminModal); loadAdminDashboard();">Abrir Painel Admin</button>
            `;
        } else {
            statsBar.innerHTML = `
                <span class="profile-stat-pill">👊 ${window.friendsList.length} Amigos</span>
                <span class="profile-stat-pill">🏛️ ${myFollowingProfiles.length} Entidades a seguir</span>
            `;
        }
    }

    const preview = $("profileAvatarPreview");
    if (preview) {
        preview.classList.toggle("business-avatar", isBiz);
        preview.classList.toggle("admin-avatar", isAdm);
        if (currentProfile.avatar_url) {
            preview.innerHTML = `<img src="${escapeHTML(currentProfile.avatar_url)}" alt="">`;
        } else {
            const initials = (currentProfile.full_name || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join("");
            preview.textContent = initials;
        }
    }

    const curMode = currentProfile.privacy_mode || "precise";

    if (isBiz) {
        if ($("profileBusinessTypeSelect")) {
            $("profileBusinessTypeSelect").value = currentProfile.business_type || "Empresa / Comércio";
        }
        if ($("businessPrivacyGrid")) {
            $("businessPrivacyGrid").querySelectorAll(".privacy-opt-btn").forEach(btn => {
                btn.classList.toggle("active", btn.dataset.mode === (curMode === "ghost" ? "ghost" : "precise"));
            });
        }
    } else if (!isAdm) {
        if ($("profileBirthDateInput")) {
            $("profileBirthDateInput").value = currentProfile.birth_date || "";
        }
        if ($("profileCustomEmoji")) $("profileCustomEmoji").value = currentProfile.status_emoji || "📍";
        if ($("profileCustomStatus")) $("profileCustomStatus").value = currentProfile.status_text || "";

        if ($("privacySelectorGrid")) {
            $("privacySelectorGrid").querySelectorAll(".privacy-opt-btn").forEach(btn => {
                btn.classList.toggle("active", btn.dataset.mode === curMode);
            });
        }
    }

    if ($("tabMyFriends")) {
        $("tabMyFriends").classList.toggle("hidden", isBiz || isAdm);
    }
    if (isBiz) {
        $("tabMyEnrollments").textContent = `Seguidores (${myFollowersList.length})`;
        $("tabMyFollowing").textContent = `A Seguir (${myFollowingProfiles.length})`;
    } else {
        $("tabMyEnrollments").textContent = "Minhas Inscrições";
        if ($("tabMyFriends")) $("tabMyFriends").textContent = `Amigos (${window.friendsList.length})`;
        $("tabMyFollowing").textContent = `A Seguir (${myFollowingProfiles.length})`;
    }

    renderProfileLists();
    openModal(profileModal);
});

async function uploadAvatarImage(file) {
    if (!file || !currentUser) return null;
    try {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `avatars/${currentUser.id}-${Date.now()}.${ext}`;
        const { error } = await supabaseClient.storage.from("event-images").upload(path, file, { upsert: true });
        if (error) return null;
        const { data } = supabaseClient.storage.from("event-images").getPublicUrl(path);
        return data?.publicUrl || null;
    } catch (e) {
        return null;
    }
}

$("profileUpdateForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!currentUser) return;
    const isBiz = isBusinessAccount();
    const fullName = $("profileNameInput").value.trim();
    const bio = $("profileBioInput").value.trim();
    if (!fullName) return;

    let avatarUrl = currentProfile.avatar_url || null;
    const avatarFile = $("profileAvatarInput")?.files?.[0];
    if (avatarFile) {
        const uploaded = await uploadAvatarImage(avatarFile);
        if (uploaded) avatarUrl = uploaded;
    }

    const privacyMode = currentProfile.privacy_mode || "precise";
    const isGhost = privacyMode === "ghost";

    let updatePayload = {
        full_name: fullName,
        bio,
        avatar_url: avatarUrl,
        privacy_mode: privacyMode,
        ghost_mode: isGhost
    };

    if (isBiz) {
        const bizSector = $("profileBusinessTypeSelect")?.value || currentProfile.business_type || "Empresa / Comércio";
        updatePayload.business_type = bizSector;
        updatePayload.status_emoji = isEntityVerified(currentProfile) ? "✅" : "🏢";
        updatePayload.status_text = bizSector;
        updatePayload.birth_date = null;
    } else if (!isAdminAccount()) {
        const birthDate = $("profileBirthDateInput")?.value || null;
        const statusEmoji = ($("profileCustomEmoji")?.value || "📍").trim() || "📍";
        const statusText = ($("profileCustomStatus")?.value || "No LocalSpot").trim() || "No LocalSpot";
        updatePayload.birth_date = birthDate;
        updatePayload.status_emoji = statusEmoji;
        updatePayload.status_text = statusText;
    }

    if (isGhost) {
        updatePayload.last_lat = null;
        updatePayload.last_lng = null;
    }

    const { error } = await supabaseClient.from("profiles").update(updatePayload).eq("id", currentUser.id);

    if (error) {
        showToast("Erro ao guardar perfil.", "error");
        return;
    }

    Object.assign(currentProfile, updatePayload);
    applyRoleUI();
    showToast("Perfil atualizado com sucesso!", "success");
});

$("closeProfile").addEventListener("click", () => closeModalEl(profileModal));
profileModal.addEventListener("mousedown", e => { if (e.target === profileModal) closeModalEl(profileModal); });

function switchProfileTab(activeTabId, activePanelId) {
    ["tabMyEnrollments", "tabMyCreated", "tabMyFriends", "tabMyFollowing"].forEach(id => {
        if ($(id)) $(id).classList.toggle("active", id === activeTabId);
    });
    ["profileEnrolledList", "profileCreatedList", "profileFriendsList", "profileFollowingList"].forEach(id => {
        if ($(id)) $(id).classList.toggle("hidden", id !== activePanelId);
    });
}

$("tabMyEnrollments").addEventListener("click", () => switchProfileTab("tabMyEnrollments", "profileEnrolledList"));
$("tabMyCreated").addEventListener("click", () => switchProfileTab("tabMyCreated", "profileCreatedList"));
$("tabMyFollowing").addEventListener("click", () => switchProfileTab("tabMyFollowing", "profileFollowingList"));

function renderProfileLists() {
    const isBiz = isBusinessAccount();
    const enrolledList = $("profileEnrolledList");
    const createdList = $("profileCreatedList");
    const friendsListEl = $("profileFriendsList");
    const followingList = $("profileFollowingList");

    if (isBiz) {
        enrolledList.innerHTML = myFollowersList.length
            ? myFollowersList.map(u => `
                <div class="profile-event-item">
                    <div style="display:flex; align-items:center; gap:10px;">
                        ${renderAvatarChip(u, "")}
                        <div>
                            <strong>${escapeHTML(u.full_name)}${verifiedBadgeHTML(u)}</strong>
                            <span>${u.role === "business" ? "🏛️ " + escapeHTML(u.business_type || "Entidade") : "👤 Utilizador"}</span>
                        </div>
                    </div>
                </div>
            `).join("")
            : `<p class="muted" style="font-size:13px;">Ainda não tem seguidores.</p>`;
    } else {
        const enrolledEvents = events.filter(e => myEnrollments.has(String(e.id)));
        enrolledList.innerHTML = enrolledEvents.length
            ? enrolledEvents.map(ev => `
                <div class="profile-event-item">
                    <div>
                        <strong>${escapeHTML(ev.name)}</strong>
                        <span>📅 ${escapeHTML(formatEventDate(ev))} · 📍 ${escapeHTML(ev.location)}</span>
                    </div>
                    <button type="button" class="btn-soft" onclick="closeModalEl(profileModal); openEventDetails('${ev.id}')">Ver</button>
                </div>
            `).join("")
            : `<p class="muted" style="font-size:13px;">Ainda não estás inscrito em nenhum evento.</p>`;
    }

    const createdEvents = events.filter(e => currentUser && String(e.creatorId) === String(currentUser.id));
    createdList.innerHTML = createdEvents.length
        ? createdEvents.map(ev => `
            <div class="profile-event-item">
                <div>
                    <strong>${escapeHTML(ev.name)}</strong>
                    <span>👥 ${ev.enrolled || 0} inscritos · 📅 ${escapeHTML(formatEventDate(ev))}</span>
                </div>
                <button type="button" class="btn-soft" onclick="closeModalEl(profileModal); openEventDetails('${ev.id}')">Gerir</button>
            </div>
        `).join("")
        : `<p class="muted" style="font-size:13px;">Ainda não publicaste nenhum evento.</p>`;

    if (friendsListEl && !isBiz) {
        friendsListEl.innerHTML = window.friendsList.length
            ? window.friendsList.map(f => `
                <div class="profile-event-item">
                    <div style="display:flex; align-items:center; gap:10px;">
                        ${renderAvatarChip(f, "")}
                        <div>
                            <strong>${escapeHTML(f.full_name)}</strong>
                            <span>👊 ${f.bump_count || 0} Bumps · ${escapeHTML(f.status_emoji || "📍")} ${escapeHTML(f.status_text || "Online")}</span>
                        </div>
                    </div>
                    <button type="button" class="btn-soft" onclick="closeModalEl(profileModal); openFriendChat('${f.id}')">💬 Chat</button>
                </div>
            `).join("")
            : `<p class="muted" style="font-size:13px;">Ainda não tens amigos adicionados.</p>`;
    }

    followingList.innerHTML = myFollowingProfiles.length
        ? myFollowingProfiles.map(ent => `
            <div class="profile-event-item">
                <div style="display:flex; align-items:center; gap:10px;">
                    ${renderAvatarChip(ent, "")}
                    <div>
                        <strong>${escapeHTML(ent.full_name)}${verifiedBadgeHTML(ent)}</strong>
                        <span>🏛️ ${escapeHTML(ent.business_type || "Entidade Oficial")}</span>
                    </div>
                </div>
                <button type="button" class="btn-logout" onclick="toggleFollowFromList('${ent.id}', '${escapeHTML(ent.full_name)}'); renderProfileLists();">Deixar de seguir</button>
            </div>
        `).join("")
        : `<p class="muted" style="font-size:13px;">Ainda não estás a seguir nenhuma empresa ou entidade pública.</p>`;
}

// ==========================================
// PAINEL DE ADMINISTRAÇÃO (CLASSE ADMIN & VERIFICAÇÃO DE ENTIDADES)
// ==========================================
adminPanelBtn.addEventListener("click", async () => {
    openModal(adminModal);
    await loadAdminDashboard();
});

$("closeAdmin").addEventListener("click", () => closeModalEl(adminModal));
adminModal.addEventListener("mousedown", e => { if (e.target === adminModal) closeModalEl(adminModal); });

$("tabAdminUsers").addEventListener("click", () => {
    $("tabAdminUsers").classList.add("active");
    $("tabAdminReports").classList.remove("active");
    $("adminUsersList").classList.remove("hidden");
    $("adminReportsList").classList.add("hidden");
});

$("tabAdminReports").addEventListener("click", () => {
    $("tabAdminReports").classList.add("active");
    $("tabAdminUsers").classList.remove("active");
    $("adminReportsList").classList.remove("hidden");
    $("adminUsersList").classList.add("hidden");
});

async function loadAdminDashboard() {
    if (!isAdminAccount()) return;

    const { data: users } = await supabaseClient.from("profiles").select("*").order("created_at", { ascending: false });
    const { data: reports } = await supabaseClient.from("event_reports").select("*").order("created_at", { ascending: false });

    const allUsers = users || [];
    const bizAccounts = allUsers.filter(u => u.role === "business");
    const verifiedBizCount = bizAccounts.filter(u => isEntityVerified(u)).length;
    const allReports = reports || [];

    $("statTotalUsers").textContent = allUsers.length;
    $("statBusinessUsers").textContent = `${bizAccounts.length} (${verifiedBizCount}✓)`;
    $("statTotalEvents").textContent = events.length;
    $("statTotalReports").textContent = allReports.length;

    const usersContainer = $("adminUsersList");
    if (!allUsers.length) {
        usersContainer.innerHTML = `<p class="muted">Nenhum utilizador encontrado.</p>`;
    } else {
        usersContainer.innerHTML = allUsers.map(u => {
            const isBiz = u.role === "business";
            const verified = isEntityVerified(u);
            const verifyActionBtn = isBiz
                ? (verified
                    ? `<button type="button" class="btn-unverify" onclick="window.toggleVerifyEntity('${u.id}', false)" title="Remover selo de verificação">✓ Verificada</button>`
                    : `<button type="button" class="btn-verify" onclick="window.toggleVerifyEntity('${u.id}', true)" title="Verificar esta empresa ou entidade">✅ Verificar</button>`)
                : "";

            return `
                <div class="admin-user-row">
                    <div class="admin-user-info">
                        <strong>${escapeHTML(u.full_name || "Sem nome")}${verifiedBadgeHTML(u)}</strong>
                        <span>${escapeHTML(u.email)} ${u.business_type ? `· ${escapeHTML(u.business_type)}` : ""}</span>
                    </div>
                    <div class="admin-row-controls">
                        ${verifyActionBtn}
                        <select onchange="window.changeUserRole('${u.id}', this.value)" aria-label="Classe da conta">
                            <option value="user" ${u.role === "user" ? "selected" : ""}>👤 Utilizador</option>
                            <option value="business" ${u.role === "business" ? "selected" : ""}>🏢 Empresa / Entidade</option>
                            <option value="admin" ${u.role === "admin" ? "selected" : ""}>🛡️ Admin</option>
                        </select>
                    </div>
                </div>
            `;
        }).join("");
    }

    const reportsContainer = $("adminReportsList");
    if (!allReports.length) {
        reportsContainer.innerHTML = `<p class="muted" style="font-size:13px;">Nenhuma denúncia pendente.</p>`;
    } else {
        reportsContainer.innerHTML = allReports.map(r => `
            <div class="admin-user-row">
                <div class="admin-user-info">
                    <strong>🚩 ${escapeHTML(r.reason)} — ${escapeHTML(r.event_name || "Evento")}</strong>
                    <span>${escapeHTML(r.details || "Sem detalhes adicionais")}</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="btn-soft" onclick="closeModalEl(adminModal); openEventDetails('${r.event_id}')">Ver</button>
                    <button type="button" class="btn-logout" onclick="window.dismissReport(${r.id})">Arquivar</button>
                </div>
            </div>
        `).join("");
    }
}

// Ação exclusiva dos Admins: Verificar ou remover verificação usando o campo status_emoji existente
window.toggleVerifyEntity = async (userId, verifyState) => {
    if (!isAdminAccount()) {
        showToast("Apenas administradores podem verificar entidades.", "error");
        return;
    }

    const nextEmoji = verifyState ? "✅" : "🏢";
    const { error } = await supabaseClient
        .from("profiles")
        .update({ status_emoji: nextEmoji })
        .eq("id", userId);

    if (error) {
        showToast("Erro ao atualizar verificação.", "error");
        return;
    }

    if (verifyState) {
        await createNotification(
            userId,
            null,
            "Conta Oficial Verificada! ✅",
            "Um Administrador validou a sua entidade. O selo de verificação já está ativo no seu perfil e eventos."
        );
        showToast("Entidade verificada com sucesso! ✅", "success");
    } else {
        showToast("Verificação removida.");
    }

    await loadAdminDashboard();
    await loadEventsFromSupabase();
};

window.changeUserRole = async (userId, newRole) => {
    if (!isAdminAccount()) return;
    const updateData = {
        role: newRole,
        status_emoji: newRole === "business" ? "🏢" : (newRole === "admin" ? "🛡️" : "📍")
    };
    const { error } = await supabaseClient.from("profiles").update(updateData).eq("id", userId);
    if (error) {
        showToast("Erro ao atualizar classe da conta.", "error");
        return;
    }
    showToast("Classe da conta atualizada!", "success");
    await loadAdminDashboard();
};

window.dismissReport = async reportId => {
    if (!isAdminAccount()) return;
    await supabaseClient.from("event_reports").delete().eq("id", reportId);
    showToast("Denúncia arquivada.");
    loadAdminDashboard();
};

// ==========================================
// CARREGAMENTO DE EVENTOS E INSCRIÇÕES (SUPABASE)
// ==========================================
function mapDbEvent(row, creatorProfilesMap = new Map()) {
    const creatorProf = row.creator_id ? creatorProfilesMap.get(String(row.creator_id)) : null;
    const creatorRole = creatorProf?.role || (row.creator_type === "Utilizador" ? "user" : (row.creator_type === "Admin" ? "admin" : "business"));

    return {
        id: row.id,
        name: row.name,
        category: row.category,
        distrito: row.distrito,
        date: row.date,
        time: row.time ? String(row.time).slice(0, 5) : "18:00",
        location: row.location,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        description: row.description || "",
        image: row.image || "",
        maxParticipants: row.max_participants ? Number(row.max_participants) : null,
        enrolled: Number(row.enrolled || 0),
        creatorId: row.creator_id || null,
        creatorName: creatorProf?.full_name || row.creator_name || "",
        creatorType: creatorProf?.business_type || row.creator_type || "",
        creatorRole,
        creatorVerified: Boolean(creatorProf && isEntityVerified(creatorProf)),
        price: row.price || "Gratuito",
        externalUrl: row.external_url || ""
    };
}

async function loadEventsFromSupabase() {
    try {
        const { data, error } = await supabaseClient
            .from("events")
            .select("*")
            .order("date", { ascending: true });

        if (!error && data) {
            const creatorIds = [...new Set(data.map(r => r.creator_id).filter(Boolean))];
            let creatorProfilesMap = new Map();

            if (creatorIds.length > 0) {
                const { data: profs } = await supabaseClient
                    .from("profiles")
                    .select("id, full_name, role, business_type, status_emoji")
                    .in("id", creatorIds);

                if (profs) {
                    creatorProfilesMap = new Map(profs.map(p => [String(p.id), p]));
                }
            }

            events = data.map(r => mapDbEvent(r, creatorProfilesMap));
        }
    } catch (e) {}
    filterEvents();
    if (!detailModal.classList.contains("hidden") && detailEventId) {
        const updated = events.find(x => String(x.id) === String(detailEventId));
        if (updated) renderEventDetailsData(updated);
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

async function loadAllEnrollmentsSummary() {
    try {
        const { data, error } = await supabaseClient
            .from("enrollments")
            .select("event_id, user_id");

        if (!error && data) {
            allEnrollmentsMap = new Map();
            data.forEach(row => {
                const k = String(row.event_id);
                if (!allEnrollmentsMap.has(k)) allEnrollmentsMap.set(k, new Set());
                allEnrollmentsMap.get(k).add(String(row.user_id));
            });
        }
    } catch (e) {}
}

window.getFriendsGoingToEvent = eventId => {
    const enrolledIds = allEnrollmentsMap.get(String(eventId));
    if (!enrolledIds || !window.friendsList.length) return [];
    return window.friendsList.filter(f => enrolledIds.has(String(f.id)));
};

window.toggleEnrollment = async id => {
    if (!currentUser || !currentProfile) return;
    const ev = events.find(x => String(x.id) === String(id));
    if (!ev) return;

    const key = String(id);
    const alreadyEnrolled = myEnrollments.has(key);

    if (alreadyEnrolled) {
        const { error } = await supabaseClient
            .from("enrollments")
            .delete()
            .eq("event_id", ev.id)
            .eq("user_id", currentUser.id);

        if (error) {
            showToast("Erro ao cancelar inscrição.", "error");
            return;
        }

        myEnrollments.delete(key);
        if (allEnrollmentsMap.has(key)) allEnrollmentsMap.get(key).delete(String(currentUser.id));
        const newCount = Math.max(0, (ev.enrolled || 1) - 1);
        ev.enrolled = newCount;
        await supabaseClient.from("events").update({ enrolled: newCount }).eq("id", ev.id);
        showToast("Inscrição cancelada.");
    } else {
        if (ev.maxParticipants && (ev.enrolled || 0) >= ev.maxParticipants) {
            showToast("Este evento já esgotou as vagas.", "error");
            return;
        }

        const { error } = await supabaseClient
            .from("enrollments")
            .insert([{
                event_id: ev.id,
                user_id: currentUser.id,
                user_name: currentProfile.full_name,
                user_email: currentProfile.email
            }]);

        if (error) {
            showToast("Não foi possível concluir a inscrição.", "error");
            return;
        }

        myEnrollments.add(key);
        if (!allEnrollmentsMap.has(key)) allEnrollmentsMap.set(key, new Set());
        allEnrollmentsMap.get(key).add(String(currentUser.id));
        const newCount = (ev.enrolled || 0) + 1;
        ev.enrolled = newCount;
        await supabaseClient.from("events").update({ enrolled: newCount }).eq("id", ev.id);

        await createNotification(
            ev.creatorId,
            ev.id,
            "Nova inscrição no teu evento! 🎉",
            `${currentProfile.full_name} inscreveu-se em "${ev.name}".`
        );

        if (isNormalUserAccount()) {
            for (const f of window.friendsList) {
                await createNotification(
                    f.id,
                    ev.id,
                    `👊 ${currentProfile.full_name} vai a um evento!`,
                    `Inscreveu-se em "${ev.name}" (${ev.location}).`
                );
            }
        }

        showToast("Inscrição confirmada!", "success");
    }

    filterEvents();
    if (!detailModal.classList.contains("hidden") && String(detailEventId) === key) {
        renderEventDetailsData(ev);
    }
};

// ---------- Favoritos ----------
window.toggleFavorite = id => {
    const key = String(id);
    favorites.has(key) ? favorites.delete(key) : favorites.add(key);
    saveJSON(STORAGE_FAVS, [...favorites]);
    filterEvents();
};

// ---------- Distritos & Categorias ----------
function populateDistricts() {
    const districts = Object.keys(DISTRICTS).sort((a, b) => DISTRICTS[a].localeCompare(DISTRICTS[b], "pt"));
    const options = districts.map(k => `<option value="${k}">${DISTRICTS[k]}</option>`).join("");
    districtFilter.insertAdjacentHTML("beforeend", options);
    $("eventFormDistrict").insertAdjacentHTML("beforeend", options);
}

function buildCategoryChips() {
    categoryChips.innerHTML = `<button type="button" class="chip active" data-category="all">Todos</button>` +
        Object.entries(CATEGORIES)
            .map(([k, c]) => `<button type="button" class="chip" data-category="${k}">${c.emoji} ${c.label}</button>`)
            .join("");

    $("eventCategory").innerHTML = Object.entries(CATEGORIES)
        .map(([k, c]) => `<option value="${k}">${c.emoji} ${c.label}</option>`)
        .join("");
}

function isPast(ev) {
    return eventDateTime(ev) < new Date();
}

function matchesPeriod(ev) {
    if (state.period === "all") return true;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dt = eventDateTime(ev);

    if (state.period === "today") {
        const end = new Date(startOfToday);
        end.setDate(end.getDate() + 1);
        return dt >= startOfToday && dt < end;
    }
    if (state.period === "week") {
        const end = new Date(startOfToday);
        end.setDate(end.getDate() + 7);
        return dt >= startOfToday && dt < end;
    }
    if (state.period === "weekend") {
        if (dt < startOfToday) return false;
        const day = dt.getDay();
        const diffDays = (dt - startOfToday) / 86400000;
        return (day === 0 || day === 6) && diffDays <= 7;
    }
    return true;
}

function isFreeEvent(ev) {
    const p = (ev.price || "").toLowerCase().trim();
    return !p || p === "gratuito" || p === "grátis" || p === "0" || p === "0€";
}

function filterEvents() {
    const q = state.search.trim().toLowerCase();

    let list = events.filter(ev => {
        if (state.category !== "all" && ev.category !== state.category) return false;
        if (state.district !== "all" && ev.distrito !== state.district) return false;
        if (state.onlyFavorites && !favorites.has(String(ev.id))) return false;
        if (state.onlyFree && !isFreeEvent(ev)) return false;
        if (state.onlyFollowing && (!ev.creatorId || !myFollowing.has(String(ev.creatorId)))) return false;
        if (!matchesPeriod(ev)) return false;
        if (userPosition && state.radius < 100) {
            if (distanceKm(userPosition.lat, userPosition.lng, ev.latitude, ev.longitude) > state.radius) return false;
        }
        if (q) {
            const hay = `${ev.name} ${ev.location} ${districtLabel(ev.distrito)} ${ev.description} ${ev.creatorName}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    list.sort((a, b) => {
        const aPast = isPast(a), bPast = isPast(b);
        if (aPast !== bPast) return aPast ? 1 : -1;
        if (state.sort === "distance" && userPosition) {
            return distanceKm(userPosition.lat, userPosition.lng, a.latitude, a.longitude) -
                   distanceKm(userPosition.lat, userPosition.lng, b.latitude, b.longitude);
        }
        if (state.sort === "name") return a.name.localeCompare(b.name, "pt");
        return eventDateTime(a) - eventDateTime(b);
    });

    currentList = list;
    renderEvents(list);
    showEventsOnMap(list);
}

function renderEvents(list) {
    eventCount.textContent = list.length;
    emptyState.classList.toggle("hidden", list.length > 0);

    eventsList.innerHTML = list.map(ev => {
        const cat = CATEGORIES[ev.category];
        const fav = favorites.has(String(ev.id));
        const past = isPast(ev);
        const enrolled = myEnrollments.has(String(ev.id));
        const isOwner = currentUser && (String(ev.creatorId) === String(currentUser.id) || isAdminAccount());

        const currentEnrolled = ev.enrolled || 0;
        const max = ev.maxParticipants;
        const isFull = max && currentEnrolled >= max;

        let vagasLabel = max ? `${currentEnrolled}/${max} vagas` : `${currentEnrolled} inscritos`;
        if (isFull) vagasLabel += " (Esgotado)";

        let dist = "";
        if (userPosition) {
            const km = distanceKm(userPosition.lat, userPosition.lng, ev.latitude, ev.longitude);
            dist = ` · ${km < 1 ? Math.round(km * 1000) + " m" : km.toFixed(1).replace(".", ",") + " km"}`;
        }

        let enrollBtnHtml = "";
        if (!past) {
            if (enrolled) {
                enrollBtnHtml = `<button type="button" class="register-btn registered" onclick="event.stopPropagation(); window.toggleEnrollment('${ev.id}')">✓ Inscrito</button>`;
            } else if (isFull) {
                enrollBtnHtml = `<button type="button" class="register-btn" disabled onclick="event.stopPropagation()">Esgotado</button>`;
            } else {
                enrollBtnHtml = `<button type="button" class="register-btn" onclick="event.stopPropagation(); window.toggleEnrollment('${ev.id}')">✋ Inscrever-me</button>`;
            }
        } else {
            enrollBtnHtml = `<button type="button" class="register-btn" disabled onclick="event.stopPropagation()">Terminado</button>`;
        }

        let organizerBadge = "";
        if (ev.creatorName) {
            const isNormalUser = ev.creatorRole === "user" || ev.creatorType === "Utilizador";
            const isAdmin = ev.creatorRole === "admin" || ev.creatorType === "Admin";
            const badgeIcon = isAdmin ? "🛡️" : (isNormalUser ? "👤" : "🏢");
            const prefix = !isNormalUser && !isAdmin && ev.creatorType ? `${ev.creatorType} · ` : "";
            const verifiedHtml = !isNormalUser && !isAdmin && ev.creatorVerified
                ? `<span class="verified-check" title="Entidade Verificada">✓</span>`
                : "";
            const tagClass = isAdmin ? " admin-tag" : (isNormalUser ? " user-tag" : "");
            organizerBadge = `<div class="organizer-tag${tagClass}">${badgeIcon} ${escapeHTML(prefix)}${escapeHTML(ev.creatorName)}${verifiedHtml}</div>`;
        }

        const friendsGoing = window.getFriendsGoingToEvent(ev.id);
        const friendsBadge = friendsGoing.length
            ? `<div class="friends-going-badge">👊 ${friendsGoing.length === 1 ? escapeHTML(friendsGoing[0].full_name) + " vai" : friendsGoing.length + " amigos vão"}</div>`
            : "";

        return `
            <article class="event-card${String(ev.id) === String(activeId) ? " active" : ""}" data-id="${ev.id}">
                <div class="event-image-wrap">
                    <img src="${escapeHTML(ev.image || DEFAULT_IMAGE)}" alt="${escapeHTML(ev.name)}" class="event-image"
                         onerror="this.onerror=null;this.src='${DEFAULT_IMAGE}'">
                    ${past ? '<span class="badge-past">Terminado</span>' : ""}
                    <span class="badge-price-card">${escapeHTML(ev.price || "Gratuito")}</span>
                    <button type="button" class="fav-btn${fav ? " on" : ""}" onclick="event.stopPropagation(); window.toggleFavorite('${ev.id}')" title="Favorito">${fav ? "★" : "☆"}</button>
                </div>
                <div class="event-meta">
                    <span class="category">${cat ? cat.emoji + " " + cat.label : escapeHTML(ev.category)}</span>
                </div>
                <h4>${escapeHTML(ev.name)}</h4>
                ${organizerBadge}
                ${friendsBadge}
                <p>📅 ${escapeHTML(formatEventDate(ev))}</p>
                <p>📍 ${escapeHTML(ev.location)} · ${escapeHTML(districtLabel(ev.distrito))}${dist}</p>
                <div class="registration-info">👥 ${vagasLabel}</div>
                <div class="card-actions-grid">
                    ${enrollBtnHtml}
                    <button type="button" class="details-btn" onclick="event.stopPropagation(); window.openEventDetails('${ev.id}')">Detalhes</button>
                </div>
                ${isOwner ? `
                    <div class="owner-card-bar">
                        <button type="button" class="edit-btn" onclick="event.stopPropagation(); window.openEditEventModal('${ev.id}')">✏️ Editar</button>
                        <button type="button" class="delete-btn" onclick="event.stopPropagation(); window.deleteEvent('${ev.id}')">🗑️ Eliminar</button>
                    </div>
                ` : ""}
            </article>`;
    }).join("");
}

function selectEventCard(id) {
    activeId = id;
    eventsList.querySelectorAll(".event-card").forEach(c => c.classList.toggle("active", c.dataset.id === String(id)));
    const card = eventsList.querySelector(`.event-card[data-id="${id}"]`);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

window.onEventMarkerClick = id => selectEventCard(id);

eventsList.addEventListener("click", e => {
    const card = e.target.closest(".event-card");
    if (!card) return;
    selectEventCard(card.dataset.id);
    if (window.innerWidth <= 820) setMobileView("map");
    focusEvent(card.dataset.id);
});

// ==========================================
// CRIAR / EDITAR / DUPLICAR / ELIMINAR EVENTO
// ==========================================
function openModal(el) {
    el.classList.remove("hidden");
    el.setAttribute("aria-hidden", "false");
}

function closeModalEl(el) {
    el.classList.add("hidden");
    el.setAttribute("aria-hidden", "true");
}

function setCoordinates(latlng) {
    pendingLocation = latlng;
    coordsText.textContent = `Coordenadas: ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    coordsText.classList.add("ok");
}

function startPickingLocation(latlngToCenter = null) {
    closeModalEl(modal);
    pickBanner.classList.remove("hidden");
    if (window.innerWidth <= 820) setMobileView("map");

    if (latlngToCenter) {
        flyToCoordinates(latlngToCenter.lng, latlngToCenter.lat, 15);
    }

    pickLocation(latlng => {
        pickBanner.classList.add("hidden");
        setTempMarker(latlng);
        setCoordinates(latlng);
        openModal(modal);
    });
}

$("cancelPickBtn").addEventListener("click", () => {
    cancelPick();
    pickBanner.classList.add("hidden");
    openModal(modal);
});

async function searchAddressOnMap() {
    const query = $("pickSearchInput").value.trim();
    if (!query) return;
    const btn = $("pickSearchBtn");
    btn.disabled = true;
    btn.textContent = "...";

    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=pt&limit=1&q=${encodeURIComponent(query)}`);
        const results = await res.json();
        if (results && results.length > 0) {
            const lat = parseFloat(results[0].lat);
            const lng = parseFloat(results[0].lon);
            flyToCoordinates(lng, lat, 16);
            showToast(`Mapa centrado em: ${results[0].display_name.split(",")[0]}`, "success");
        } else {
            showToast("Morada não encontrada. Tenta outro termo.", "error");
        }
    } catch (e) {
        showToast("Erro ao pesquisar morada.", "error");
    } finally {
        btn.disabled = false;
        btn.textContent = "Ir";
    }
}

$("pickSearchBtn").addEventListener("click", searchAddressOnMap);
$("pickSearchInput").addEventListener("keydown", e => {
    if (e.key === "Enter") {
        e.preventDefault();
        searchAddressOnMap();
    }
});

addEventButton.addEventListener("click", () => {
    editingEventId = null;
    eventForm.reset();
    imagePreview.classList.add("hidden");
    formError.classList.add("hidden");
    pendingLocation = null;
    coordsText.textContent = "Nenhum local escolhido no mapa.";
    coordsText.classList.remove("ok");
    $("eventModalTitle").textContent = "Criar Novo Evento";
    $("eventSubmitBtn").textContent = "Publicar Evento no Mapa";

    if (state.district !== "all") $("eventFormDistrict").value = state.district;
    $("eventDate").value = new Date().toISOString().slice(0, 10);
    $("eventTime").value = "18:00";

    startPickingLocation();
});

window.openEditEventModal = id => {
    const ev = events.find(x => String(x.id) === String(id));
    if (!ev) return;

    editingEventId = ev.id;
    formError.classList.add("hidden");
    $("eventModalTitle").textContent = "Editar Evento";
    $("eventSubmitBtn").textContent = "Guardar Alterações";

    $("eventName").value = ev.name;
    $("eventCategory").value = ev.category;
    $("eventFormDistrict").value = ev.distrito;
    $("eventDate").value = ev.date;
    $("eventTime").value = ev.time;
    $("eventLocation").value = ev.location;
    $("eventMaxParticipants").value = ev.maxParticipants || "";
    $("eventPrice").value = ev.price || "";
    $("eventExternalUrl").value = ev.externalUrl || "";
    $("eventDescription").value = ev.description || "";
    eventImageInput.value = "";

    if (ev.image) {
        imagePreview.src = ev.image;
        imagePreview.classList.remove("hidden");
    } else {
        imagePreview.classList.add("hidden");
    }

    setCoordinates({ lat: ev.latitude, lng: ev.longitude });
    closeModalEl(detailModal);
    openModal(modal);
};

window.duplicateEvent = id => {
    const ev = events.find(x => String(x.id) === String(id));
    if (!ev) return;

    editingEventId = null;
    formError.classList.add("hidden");
    $("eventModalTitle").textContent = "Duplicar Evento";
    $("eventSubmitBtn").textContent = "Publicar Cópia do Evento";

    $("eventName").value = `${ev.name} (Nova Edição)`;
    $("eventCategory").value = ev.category;
    $("eventFormDistrict").value = ev.distrito;
    $("eventDate").value = new Date().toISOString().slice(0, 10);
    $("eventTime").value = ev.time;
    $("eventLocation").value = ev.location;
    $("eventMaxParticipants").value = ev.maxParticipants || "";
    $("eventPrice").value = ev.price || "";
    $("eventExternalUrl").value = ev.externalUrl || "";
    $("eventDescription").value = ev.description || "";
    eventImageInput.value = "";

    if (ev.image) {
        imagePreview.src = ev.image;
        imagePreview.classList.remove("hidden");
    } else {
        imagePreview.classList.add("hidden");
    }

    setCoordinates({ lat: ev.latitude, lng: ev.longitude });
    closeModalEl(detailModal);
    openModal(modal);
};

changeLocationButton.addEventListener("click", () => {
    startPickingLocation(pendingLocation);
});

closeModal.addEventListener("click", () => {
    cancelPick();
    clearTempMarker();
    closeModalEl(modal);
});
modal.addEventListener("mousedown", e => {
    if (e.target === modal) {
        cancelPick();
        clearTempMarker();
        closeModalEl(modal);
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
    if (!file) return null;
    try {
        const ext = file.name.split(".").pop() || "jpg";
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabaseClient.storage.from("event-images").upload(fileName, file);
        if (error) return null;
        const { data } = supabaseClient.storage.from("event-images").getPublicUrl(fileName);
        return data?.publicUrl || null;
    } catch (e) {
        return null;
    }
}

eventForm.addEventListener("submit", async e => {
    e.preventDefault();
    formError.classList.add("hidden");
    const submitBtn = $("eventSubmitBtn");

    if (!pendingLocation) {
        formError.textContent = "Escolhe primeiro o local do evento no mapa.";
        formError.classList.remove("hidden");
        return;
    }

    const name = $("eventName").value.trim();
    const location = $("eventLocation").value.trim();
    if (!name || !location) {
        formError.textContent = "Preenche o nome e a morada do evento.";
        formError.classList.remove("hidden");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "A guardar evento...";

    const maxPartVal = $("eventMaxParticipants").value;
    const maxParticipants = maxPartVal ? parseInt(maxPartVal, 10) : null;
    const priceVal = $("eventPrice").value.trim() || "Gratuito";
    const externalUrlVal = $("eventExternalUrl").value.trim();
    const file = eventImageInput.files[0];

    try {
        let imageUrl = null;
        if (file) {
            imageUrl = await uploadEventImage(file);
        } else if (!imagePreview.classList.contains("hidden") && imagePreview.src) {
            imageUrl = imagePreview.src;
        }

        const payload = {
            name,
            category: $("eventCategory").value,
            distrito: $("eventFormDistrict").value,
            date: $("eventDate").value,
            time: $("eventTime").value || "18:00",
            location,
            latitude: pendingLocation.lat,
            longitude: pendingLocation.lng,
            description: $("eventDescription").value.trim() || "Evento publicado pela comunidade.",
            image: imageUrl || "",
            max_participants: maxParticipants,
            price: priceVal,
            external_url: externalUrlVal
        };

        if (editingEventId) {
            const { error } = await supabaseClient.from("events").update(payload).eq("id", editingEventId);
            if (error) throw error;
            showToast("Evento atualizado com sucesso!", "success");
        } else {
            payload.enrolled = 0;
            payload.creator_id = currentUser ? currentUser.id : null;
            payload.creator_name = currentProfile ? currentProfile.full_name : "Utilizador";
            payload.creator_type = isAdminAccount()
                ? "Admin"
                : (isBusinessAccount() ? (currentProfile.business_type || "Entidade") : "Utilizador");

            const { data: createdRows, error } = await supabaseClient.from("events").insert([payload]).select();
            if (error) throw error;
            const createdEv = createdRows?.[0];
            if (createdEv) {
                activeId = createdEv.id;
                if (isNormalUserAccount()) {
                    for (const f of window.friendsList) {
                        await createNotification(
                            f.id,
                            createdEv.id,
                            `🎉 ${currentProfile.full_name} criou um evento!`,
                            `"${name}" em ${location}`
                        );
                    }
                }
            }
            showToast("Evento publicado no mapa!", "success");
        }

        clearTempMarker();
        closeModalEl(modal);
        await loadEventsFromSupabase();
        if (activeId) focusEvent(activeId);
    } catch (err) {
        formError.textContent = "Erro ao guardar evento: " + (err.message || "tenta novamente.");
        formError.classList.remove("hidden");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = editingEventId ? "Guardar Alterações" : "Publicar Evento no Mapa";
    }
});

window.deleteEvent = async id => {
    if (!confirm("Tens a certeza que queres eliminar este evento?")) return;
    const { error } = await supabaseClient.from("events").delete().eq("id", id);
    if (error) {
        showToast("Erro ao eliminar evento.", "error");
        return;
    }
    closeModalEl(detailModal);
    showToast("Evento eliminado.");
    await loadEventsFromSupabase();
};

// ==========================================
// MODAL DE DETALHES, BILHETE QR, PARTILHA, REVIEWS E COMENTÁRIOS
// ==========================================
window.openEventDetails = async id => {
    const ev = events.find(x => String(x.id) === String(id));
    if (!ev) return;
    detailEventId = ev.id;
    renderEventDetailsData(ev);
    openModal(detailModal);
    await Promise.all([loadEventAttendees(ev.id), loadEventComments(ev.id), loadEventReviews(ev.id)]);
};

function renderEventDetailsData(ev) {
    const cat = CATEGORIES[ev.category];
    const enrolled = myEnrollments.has(String(ev.id));
    const past = isPast(ev);
    const isOwner = currentUser && (String(ev.creatorId) === String(currentUser.id) || isAdminAccount());

    $("detailImage").src = ev.image || DEFAULT_IMAGE;
    $("detailImage").onerror = function() { this.onerror = null; this.src = DEFAULT_IMAGE; };
    $("detailCategory").textContent = cat ? `${cat.emoji} ${cat.label}` : ev.category;
    $("detailPriceBadge").textContent = `💶 ${ev.price || "Gratuito"}`;

    const isNormalUser = ev.creatorRole === "user" || ev.creatorType === "Utilizador";
    const isAdmin = ev.creatorRole === "admin" || ev.creatorType === "Admin";
    const badgeIcon = isAdmin ? "🛡️" : (isNormalUser ? "👤" : "🏢");
    const prefix = !isNormalUser && !isAdmin && ev.creatorType ? `${ev.creatorType} · ` : "";
    const verifiedHtml = !isNormalUser && !isAdmin && ev.creatorVerified
        ? `<span class="verified-check" title="Entidade Verificada">✓</span>`
        : "";

    $("detailOrganizer").className = `organizer-tag${isAdmin ? " admin-tag" : (isNormalUser ? " user-tag" : "")}`;
    $("detailOrganizer").innerHTML = `${badgeIcon} ${escapeHTML(prefix)}${escapeHTML(ev.creatorName || "Comunidade")}${verifiedHtml}`;

    updateDetailSocialButton(ev);

    $("detailTitle").textContent = ev.name;
    $("detailDescription").textContent = ev.description || "Sem descrição.";
    $("detailDateTime").textContent = formatEventDate(ev);
    $("detailLocation").textContent = `${ev.location}, ${districtLabel(ev.distrito)}`;

    const currentEnrolled = ev.enrolled || 0;
    const max = ev.maxParticipants;
    const isFull = max && currentEnrolled >= max;
    $("detailVacancies").textContent = max ? `${currentEnrolled}/${max} vagas` : `${currentEnrolled} inscritos`;

    const extBanner = $("detailExternalLink");
    if (ev.externalUrl) {
        extBanner.href = ev.externalUrl.startsWith("http") ? ev.externalUrl : `https://${ev.externalUrl}`;
        extBanner.classList.remove("hidden");
    } else {
        extBanner.classList.add("hidden");
    }

    const enrollBtn = $("detailEnrollBtn");
    enrollBtn.className = "register-btn";
    enrollBtn.disabled = false;

    if (past) {
        enrollBtn.textContent = "Terminado";
        enrollBtn.disabled = true;
    } else if (enrolled) {
        enrollBtn.textContent = "✓ Inscrito (Cancelar)";
        enrollBtn.classList.add("registered");
    } else if (isFull) {
        enrollBtn.textContent = "Esgotado";
        enrollBtn.disabled = true;
    } else {
        enrollBtn.textContent = "✋ Inscrever-me";
    }
    enrollBtn.onclick = () => window.toggleEnrollment(ev.id);

    const ticketBtn = $("detailTicketBtn");
    ticketBtn.classList.toggle("hidden", !enrolled);
    ticketBtn.onclick = () => openTicketModal(ev);

    $("detailCalendarBtn").href = buildGoogleCalendarUrl(ev);
    $("detailDirectionsBtn").href = `https://www.google.com/maps/dir/?api=1&destination=${ev.latitude},${ev.longitude}`;

    $("detailOwnerActions").classList.toggle("hidden", !isOwner);
    $("detailReviewsSection").classList.toggle("hidden", !past);
    $("reviewForm").classList.toggle("hidden", !enrolled);
}

$("detailShareBtn").addEventListener("click", async () => {
    const ev = events.find(x => String(x.id) === String(detailEventId));
    if (!ev) return;
    const url = `${window.location.origin}${window.location.pathname}?event=${ev.id}`;
    if (navigator.share) {
        try {
            await navigator.share({ title: ev.name, text: `Vê este evento no LocalSpot: ${ev.name}`, url });
            return;
        } catch (e) {}
    }
    try {
        await navigator.clipboard.writeText(url);
        showToast("Link do evento copiado!", "success");
    } catch (e) {
        showToast(url);
    }
});

$("detailIcsBtn").addEventListener("click", () => {
    const ev = events.find(x => String(x.id) === String(detailEventId));
    if (!ev) return;
    const start = eventDateTime(ev);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const fmt = d => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    const ics = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//LocalSpot//Eventos//PT",
        "BEGIN:VEVENT",
        `UID:localspot-${ev.id}@localspot.pt`,
        `DTSTAMP:${fmt(new Date())}`,
        `DTSTART:${fmt(start)}`,
        `DTEND:${fmt(end)}`,
        `SUMMARY:${ev.name}`,
        `DESCRIPTION:${(ev.description || "").replace(/\n/g, " ")}`,
        `LOCATION:${ev.location}, ${districtLabel(ev.distrito)}`,
        "END:VEVENT",
        "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${ev.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
    a.click();
});

$("detailReportBtn").addEventListener("click", () => {
    $("reportDetails").value = "";
    openModal(reportModal);
});

$("closeReport").addEventListener("click", () => closeModalEl(reportModal));
reportModal.addEventListener("mousedown", e => { if (e.target === reportModal) closeModalEl(reportModal); });

$("reportForm").addEventListener("submit", async e => {
    e.preventDefault();
    const ev = events.find(x => String(x.id) === String(detailEventId));
    if (!ev || !currentUser) return;

    await supabaseClient.from("event_reports").insert([{
        event_id: ev.id,
        event_name: ev.name,
        reporter_id: currentUser.id,
        reason: $("reportReason").value,
        details: $("reportDetails").value.trim()
    }]);

    closeModalEl(reportModal);
    showToast("Denúncia enviada à moderação.", "success");
});

$("detailEditBtn").addEventListener("click", () => { if (detailEventId) window.openEditEventModal(detailEventId); });
$("detailDuplicateBtn").addEventListener("click", () => { if (detailEventId) window.duplicateEvent(detailEventId); });
$("detailDeleteBtn").addEventListener("click", () => { if (detailEventId) window.deleteEvent(detailEventId); });

function openTicketModal(ev) {
    const code = `LS-${String(ev.id).slice(0, 4).toUpperCase()}-${currentUser.id.slice(0, 6).toUpperCase()}`;
    $("ticketEventName").textContent = ev.name;
    $("ticketDateTime").textContent = `📅 ${formatEventDate(ev)}`;
    $("ticketLocation").textContent = `📍 ${ev.location} · ${districtLabel(ev.distrito)}`;
    $("ticketCodeText").textContent = code;
    $("ticketUserName").textContent = `Titular: ${currentProfile.full_name}`;

    const qrData = encodeURIComponent(`LOCALSPOT|${code}|${ev.name}|${currentProfile.full_name}`);
    $("ticketQrCanvas").innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${qrData}" alt="QR Code Bilhete" width="160" height="160">`;

    openModal(ticketModal);
}

$("closeTicket").addEventListener("click", () => closeModalEl(ticketModal));
ticketModal.addEventListener("mousedown", e => { if (e.target === ticketModal) closeModalEl(ticketModal); });

function buildGoogleCalendarUrl(ev) {
    const start = eventDateTime(ev);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const fmt = d => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: ev.name,
        dates: `${fmt(start)}/${fmt(end)}`,
        details: ev.description || "",
        location: `${ev.location}, ${districtLabel(ev.distrito)}`
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

async function loadEventAttendees(eventId) {
    const listEl = $("detailAttendeesList");
    const exportBtn = $("exportCsvBtn");
    listEl.innerHTML = `<span class="muted" style="font-size:12px;">A carregar participantes...</span>`;
    exportBtn.classList.add("hidden");

    const { data, error } = await supabaseClient
        .from("enrollments")
        .select("user_id, user_name, user_email")
        .eq("event_id", eventId);

    if (error || !data || data.length === 0) {
        listEl.innerHTML = `<span class="muted" style="font-size:12.5px;">Ainda sem inscritos. Sê o primeiro!</span>`;
        return;
    }

    const ev = events.find(x => String(x.id) === String(eventId));
    const isOwner = currentUser && ev && (String(ev.creatorId) === String(currentUser.id) || isAdminAccount());

    if (isOwner) {
        exportBtn.classList.remove("hidden");
        exportBtn.onclick = () => exportAttendeesCsv(ev.name, data);
    }

    const friendIdSet = new Set(window.friendsList.map(f => String(f.id)));
    listEl.innerHTML = data.map(row => {
        const isFriend = friendIdSet.has(String(row.user_id));
        return `<span class="attendee-pill${isFriend ? " friend-attendee" : ""}">${isFriend ? "👊" : "👤"} ${escapeHTML(row.user_name || "Participante")}</span>`;
    }).join("");
}

function exportAttendeesCsv(eventName, rows) {
    const csv = ["Nome,Email", ...rows.map(r => `"${(r.user_name || "").replace(/"/g, '""')}","${r.user_email || ""}"`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `inscritos-${eventName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    a.click();
}

async function loadEventReviews(eventId) {
    const listEl = $("detailReviewsList");
    const badgeEl = $("detailRatingBadge");
    badgeEl.classList.add("hidden");

    const { data, error } = await supabaseClient
        .from("event_reviews")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) {
        listEl.innerHTML = `<p class="muted" style="font-size:12.5px;">Ainda sem avaliações.</p>`;
        return;
    }

    const avg = (data.reduce((s, r) => s + r.rating, 0) / data.length).toFixed(1);
    badgeEl.textContent = `⭐ ${avg} (${data.length})`;
    badgeEl.classList.remove("hidden");

    listEl.innerHTML = data.map(r => `
        <div class="comment-item">
            <div class="comment-head">
                <strong>${escapeHTML(r.user_name)}</strong>
                <span>${"⭐".repeat(r.rating)}</span>
            </div>
            <p>${escapeHTML(r.comment || "")}</p>
        </div>
    `).join("");
}

$("reviewForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!detailEventId || !currentUser) return;
    const rating = parseInt($("reviewRating").value, 10);
    const comment = $("reviewCommentInput").value.trim();

    await supabaseClient.from("event_reviews").insert([{
        event_id: detailEventId,
        user_id: currentUser.id,
        user_name: currentProfile.full_name,
        rating,
        comment
    }]);

    $("reviewCommentInput").value = "";
    showToast("Avaliação enviada!", "success");
    await loadEventReviews(detailEventId);
});

async function loadEventComments(eventId) {
    const listEl = $("detailCommentsList");
    listEl.innerHTML = `<p class="muted" style="font-size:12px;">A carregar comentários...</p>`;

    const { data, error } = await supabaseClient
        .from("event_comments")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

    if (error || !data || data.length === 0) {
        listEl.innerHTML = `<p class="muted" style="font-size:12.5px;">Ainda sem comentários. Deixa uma dúvida ou sugestão!</p>`;
        return;
    }

    listEl.innerHTML = data.map(c => {
        const canDel = currentUser && (String(c.user_id) === String(currentUser.id) || isAdminAccount());
        return `
            <div class="comment-item">
                <div class="comment-head">
                    <strong>${escapeHTML(c.user_name || "Utilizador")}</strong>
                    ${canDel ? `<button type="button" class="delete-btn" onclick="window.deleteComment(${c.id})">Apagar</button>` : ""}
                </div>
                <p>${escapeHTML(c.comment)}</p>
            </div>
        `;
    }).join("");
}

$("commentForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!detailEventId || !currentUser || !currentProfile) return;
    const input = $("commentInput");
    const text = input.value.trim();
    if (!text) return;

    const { error } = await supabaseClient.from("event_comments").insert([{
        event_id: detailEventId,
        user_id: currentUser.id,
        user_name: currentProfile.full_name,
        comment: text
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
            "Novo comentário no teu evento 💬",
            `${currentProfile.full_name}: "${text.slice(0, 60)}"`
        );
    }

    input.value = "";
    await loadEventComments(detailEventId);
});

window.deleteComment = async commentId => {
    await supabaseClient.from("event_comments").delete().eq("id", commentId);
    if (detailEventId) await loadEventComments(detailEventId);
};

$("closeDetail").addEventListener("click", () => {
    detailEventId = null;
    closeModalEl(detailModal);
});
detailModal.addEventListener("mousedown", e => {
    if (e.target === detailModal) {
        detailEventId = null;
        closeModalEl(detailModal);
    }
});

// ==========================================
// FILTROS E CONTROLOS GERAIS
// ==========================================
searchInput.addEventListener("input", () => { state.search = searchInput.value; filterEvents(); });

categoryChips.addEventListener("click", e => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    categoryChips.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    state.category = btn.dataset.category;
    filterEvents();
});

districtFilter.addEventListener("change", () => { state.district = districtFilter.value; filterEvents(); });
periodFilter.addEventListener("change", () => { state.period = periodFilter.value; filterEvents(); });
sortFilter.addEventListener("change", () => { state.sort = sortFilter.value; filterEvents(); });

radiusSlider.addEventListener("input", () => {
    state.radius = Number(radiusSlider.value);
    radiusValue.textContent = state.radius >= 100 ? "Sem limite" : `${state.radius} km`;
    filterEvents();
});

favoritesToggle.addEventListener("click", () => {
    state.onlyFavorites = !state.onlyFavorites;
    favoritesToggle.classList.toggle("on", state.onlyFavorites);
    favoritesToggle.textContent = state.onlyFavorites ? "★ Favoritos" : "☆ Favoritos";
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
    sortFilter.value = "date";
    radiusSlider.value = "100";
    radiusValue.textContent = "Sem limite";
    favoritesToggle.classList.remove("on");
    favoritesToggle.textContent = "☆ Favoritos";
    freeOnlyToggle.classList.remove("on");
    followingOnlyToggle.classList.remove("on");
    categoryChips.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c.dataset.category === "all"));

    filterEvents();
});

locationButton.addEventListener("click", async () => {
    const labelSpan = locationButton.querySelector("span");
    locationButton.disabled = true;
    if (labelSpan) labelSpan.textContent = "A localizar...";
    try {
        await locateUser();
        sortFilter.value = "distance";
        state.sort = "distance";
        filterEvents();
        showToast("Localização atualizada!", "success");
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        locationButton.disabled = false;
        if (labelSpan) labelSpan.textContent = "Perto de mim";
    }
});

// Sobre
$("aboutButton").addEventListener("click", () => openModal(aboutModal));
$("closeAbout").addEventListener("click", () => closeModalEl(aboutModal));
aboutModal.addEventListener("mousedown", e => { if (e.target === aboutModal) closeModalEl(aboutModal); });

function checkSharedEventUrl() {
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get("event");
    if (sharedId) {
        const ev = events.find(x => String(x.id) === String(sharedId));
        if (ev) {
            focusEvent(ev.id);
            openEventDetails(ev.id);
        }
    }
}

document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    [modal, aboutModal, detailModal, adminModal, profileModal, ticketModal, reportModal, $("friendsModal"), $("entityNetworkModal"), $("friendChatModal")].forEach(m => {
        if (m && !m.classList.contains("hidden")) closeModalEl(m);
    });
    activeChatFriendId = null;
    cancelPick();
    pickBanner.classList.add("hidden");
});

// ---------- Arranque ----------
populateDistricts();
buildCategoryChips();
initAuth();
