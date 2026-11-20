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
let myFollowing = new Map();
let notifications = [];
let activeId = null;
let pendingLocation = null;
let editingEventId = null;
let detailEventId = null;
let currentList = [];

// Estado Social Completo estilo Bump
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
                    Divulgue iniciativas oficiais, alcance a comunidade local em tempo real e gira a presença institucional no mapa.
                </p>
                <div class="welcome-feature-pills">
                    <span class="welcome-feat-chip">🏛️ Perfil Institucional</span>
                    <span class="welcome-feat-chip">📅 Gestão de Eventos</span>
                    <span class="welcome-feat-chip">📊 Alcance Local</span>
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
                    Descobre eventos perto de ti, vê onde estão os teus amigos em tempo real e envia Bumps no mapa.
                </p>
                <div class="welcome-feature-pills">
                    <span class="welcome-feat-chip">🗺️ Mapa 3D ao vivo</span>
                    <span class="welcome-feat-chip">👊 Bumps & Amigos</span>
                    <span class="welcome-feat-chip">🎉 Eventos locais</span>
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
            if (currentUser && currentProfile && currentProfile.onboarding_completed === false) {
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
    onboardingData.statusEmoji = isBiz ? "🏢" : (currentProfile?.status_emoji || "📍");
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
        // ==========================================
        // FLUXO EXECUTIVO: EMPRESAS & DOMÍNIOS PÚBLICOS
        // ==========================================
        if (onboardingStep === 1) {
            stepBody = `
                <div class="onboarding-step-panel">
                    <div class="onboarding-step-emoji">👔</div>
                    <h2>Identidade Institucional</h2>
                    <p class="ob-sub">Configure o nome oficial da empresa ou organismo público que aparecerá como promotor dos eventos.</p>
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
                    <p class="ob-sub">Carregue o logótipo ou imagem representativa da entidade para destacar os seus eventos.</p>
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
                    <h2>Presença no Mapa</h2>
                    <p class="ob-sub">Defina como pretende que a sua entidade seja apresentada no mapa interativo.</p>
                    <div id="obPrivacyGrid" class="privacy-selector-grid two-cols">
                        <button type="button" class="privacy-opt-btn business-opt${onboardingData.privacyMode === "precise" ? " active" : ""}" data-mode="precise">🏢 Sede Visível no Mapa</button>
                        <button type="button" class="privacy-opt-btn business-opt${onboardingData.privacyMode === "ghost" ? " active" : ""}" data-mode="ghost">📅 Apenas Eventos Públicos</button>
                    </div>
                    <div style="background:var(--bg); border:1px solid var(--border); border-radius:12px; padding:12px; font-size:12.5px; color:var(--muted); margin-bottom:10px;">
                        💼 <strong>Nota Institucional:</strong> Independentemente desta escolha, todos os eventos que publicar ficarão visíveis para toda a comunidade.
                    </div>
                    <div class="onboarding-nav-row">
                        <button type="button" id="obBackBtn" class="ob-btn-back">← Voltar</button>
                        <button type="button" id="obFinishBtn" class="ob-btn-next">Concluir Configuração 🏛️</button>
                    </div>
                </div>
            `;
        }
    } else {
        // ==========================================
        // FLUXO PESSOAL: UTILIZADOR NORMAL
        // ==========================================
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
                    <p class="ob-sub">Tu controlas sempre quem vê a tua localização. Podes mudar isto a qualquer momento.</p>
                    <div id="obPrivacyGrid" class="privacy-selector-grid">
                        <button type="button" class="privacy-opt-btn${onboardingData.privacyMode === "precise" ? " active" : ""}" data-mode="precise">📍 Precisa</button>
                        <button type="button" class="privacy-opt-btn${onboardingData.privacyMode === "blurred" ? " active" : ""}" data-mode="blurred">🌫️ Borrão</button>
                        <button type="button" class="privacy-opt-btn${onboardingData.privacyMode === "ghost" ? " active" : ""}" data-mode="ghost">👻 Fantasma</button>
                    </div>
                    <div style="background:var(--bg); border:1px solid var(--border); border-radius:12px; padding:12px; font-size:12.5px; color:var(--muted); margin-bottom:10px;">
                        💡 <strong>Dica:</strong> No modo <strong>Precisa</strong>, os teus amigos veem a tua bateria, velocidade e distância exata para fazerem Bump!
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

    // Bindings comuns
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
            status_emoji: isBiz ? "🏢" : onboardingData.statusEmoji,
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
// INJEÇÃO DA UI SOCIAL COMPLETA (BUMP)
// ==========================================
function ensureSocialUI() {
    // 1. Botão Amigos no Header
    const nav = document.querySelector(".header nav");
    if (nav && !$("friendsNavBtn")) {
        const friendsBtn = document.createElement("button");
        friendsBtn.type = "button";
        friendsBtn.id = "friendsNavBtn";
        friendsBtn.className = "btn-friends-nav hidden";
        friendsBtn.innerHTML = `👊 Amigos <span id="friendsReqBadge" class="friends-req-badge hidden">0</span>`;
        nav.insertBefore(friendsBtn, notifBtn);
    }

    // 2. Controlos Sociais no Mapa (Privacidade + Check-in rápido)
    const mapCtrls = document.querySelector(".map-floating-controls");
    if (mapCtrls && !$("privacyMapBtn")) {
        const privacyBtn = document.createElement("button");
        privacyBtn.type = "button";
        privacyBtn.id = "privacyMapBtn";
        privacyBtn.className = "map-ctrl-btn hidden";
        privacyBtn.textContent = "📍 Precisa";
        privacyBtn.title = "Alternar privacidade no mapa";
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

    // 4. Campos no Modal de Perfil (Separados: Utilizador vs Empresa/Domínio Público)
    const profileForm = $("profileUpdateForm");
    if (profileForm && !$("profileAvatarBox")) {
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
                <label>Estado / Vibe atual (visível no mapa)</label>
                <div id="statusPillsContainer" class="status-pills-grid">
                    ${BUMP_STATUSES.map(s => `<button type="button" class="status-pill-btn" data-emoji="${s.emoji}" data-text="${s.text}">${s.emoji} ${s.text}</button>`).join("")}
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

    // 5. Modal de Amigos & Social estilo Bump
    if (!$("friendsModal")) {
        const fModal = document.createElement("div");
        fModal.id = "friendsModal";
        fModal.className = "modal hidden";
        fModal.setAttribute("aria-hidden", "true");
        fModal.innerHTML = `
            <div class="modal-content">
                <button type="button" id="closeFriendsModal" class="close-button" aria-label="Fechar">&times;</button>
                <h2 style="margin:0 0 4px;">👊 Social & Amigos</h2>
                <p style="color:var(--muted); font-size:13px; margin:0 0 14px;">Vê a bateria, velocidade e localização dos teus amigos, envia Bumps e abre o chat.</p>
                
                <div class="auth-tabs" style="margin-bottom:14px;">
                    <button type="button" id="tabFriendsList" class="auth-tab active">👥 Amigos (<span id="friendsTabCount">0</span>)</button>
                    <button type="button" id="tabFriendsAdd" class="auth-tab">➕ Adicionar / Pedidos (<span id="requestsTabCount">0</span>)</button>
                </div>

                <div id="panelFriendsList">
                    <div id="friendsContainerList"></div>
                </div>

                <div id="panelFriendsAdd" class="hidden">
                    <div id="incomingRequestsSection" style="margin-bottom:16px;"></div>
                    <label for="friendSearchInput">Procurar utilizadores por nome ou e-mail</label>
                    <div style="display:flex; gap:8px; margin-bottom:12px;">
                        <input type="text" id="friendSearchInput" placeholder="Ex: Maria, joao@email.com...">
                        <button type="button" id="friendSearchBtn" class="btn-primary-sm">Procurar</button>
                    </div>
                    <div id="friendSearchResults"></div>
                </div>
            </div>
        `;
        document.body.appendChild(fModal);
    }

    // 6. Modal de Chat Direto & Emoji Bombs (Bump Chat)
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
        searchBtn.addEventListener("click", searchUsersToAdd);
        searchInp.addEventListener("keydown", e => {
            if (e.key === "Enter") { e.preventDefault(); searchUsersToAdd(); }
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
    window.friendsList = [];
    if (typeof showFriendsOnMap === "function") showFriendsOnMap([]);
    if ($("friendsNavBtn")) $("friendsNavBtn").classList.add("hidden");
    if ($("privacyMapBtn")) $("privacyMapBtn").classList.add("hidden");
    if ($("quickCheckinMapBtn")) $("quickCheckinMapBtn").classList.add("hidden");
    if ($("hangoutBanner")) $("hangoutBanner").classList.add("hidden");
    notifBtn.classList.add("hidden");
    userBadge.classList.add("hidden");
    userBadge.classList.remove("business-badge");
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
    } else if (isNewSignup || currentProfile.onboarding_completed === false) {
        startOnboardingWizard();
    }

    applyRoleUI();
    authOverlay.classList.add("hidden");
    if (typeof map !== "undefined") map.resize();

    await Promise.all([
        loadMyEnrollments(),
        loadAllEnrollmentsSummary(),
        loadMyFollowing(),
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
    const extraClass = isBiz ? " business-avatar" : "";
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

    if ($("friendsNavBtn")) $("friendsNavBtn").classList.toggle("hidden", isBiz);
    if ($("quickCheckinMapBtn")) $("quickCheckinMapBtn").classList.toggle("hidden", isBiz);

    if ($("privacyMapBtn")) {
        const pBtn = $("privacyMapBtn");
        pBtn.classList.remove("hidden", "privacy-blurred", "privacy-ghost");
        if (isBiz) {
            if (privacy_mode === "ghost") {
                pBtn.classList.add("privacy-ghost");
                pBtn.textContent = "📅 Apenas Eventos";
            } else {
                pBtn.textContent = "🏢 Sede Visível";
            }
        } else {
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
    userBadge.classList.remove("hidden");
    userBadge.classList.toggle("business-badge", isBiz);

    const avatarHtml = renderAvatarChip(currentProfile, "sm");

    if (role === "admin") {
        userBadge.innerHTML = `${avatarHtml} <span>🛡️ ${escapeHTML(full_name)}</span>`;
        adminPanelBtn.classList.remove("hidden");
    } else if (isBiz) {
        const tipo = business_type || "Entidade";
        userBadge.innerHTML = `${avatarHtml} <span>👔 ${escapeHTML(tipo)} · ${escapeHTML(full_name)}</span>`;
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
// SISTEMA SOCIAL COMPLETO ESTILO BUMP
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

async function loadSocialData() {
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
                if (!prof) return null;
                const fRow = friendshipRecords.get(String(id));
                return { ...prof, bump_count: fRow?.bump_count || 0 };
            })
            .filter(Boolean);

        incomingFriendRequests = incomingRows.map(r => ({
            friendshipId: r.id,
            user: profilesById.get(r.requester_id) || { id: r.requester_id, full_name: "Utilizador", email: "" }
        }));

        updateSocialBadges();
        renderFriendsModalContent();
        if (typeof showFriendsOnMap === "function") {
            showFriendsOnMap(window.friendsList);
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
                <button type="button" class="btn-primary-sm" onclick="$('tabFriendsAdd').click()">Procurar amigos</button>
            </div>
        `;
        return;
    }

    container.innerHTML = window.friendsList.map(f => {
        const isBiz = f.role === "business";
        const isGhost = f.ghost_mode || f.privacy_mode === "ghost";
        const hasLocation = !isGhost && typeof f.last_lat === "number" && typeof f.last_lng === "number";
        const batStr = !isBiz && typeof f.battery_level === "number" ? ` · ${f.is_charging ? "⚡" : "🔋"}${f.battery_level}%` : "";
        const statusStr = isBiz
            ? `🏛️ ${escapeHTML(f.business_type || "Entidade Oficial")}`
            : (isGhost
                ? "👻 Modo Fantasma"
                : `${f.current_place ? "📍 " + escapeHTML(f.current_place) : (f.status_emoji || "📍") + " " + escapeHTML(f.status_text || "Online")}${batStr}`);
        const unread = unreadMessagesBySender.get(String(f.id)) || 0;

        return `
            <div class="friend-row">
                <div class="friend-row-left">
                    ${renderAvatarChip(f, "")}
                    <div class="friend-row-info">
                        <strong>${escapeHTML(f.full_name)} ${!isBiz ? `<small style="color:#f9a8d4;">👊${f.bump_count || 0}</small>` : ""}</strong>
                        <span>${statusStr}</span>
                    </div>
                </div>
                <div class="friend-row-actions">
                    ${!isBiz ? `<button type="button" class="btn-bump" onclick="window.sendBump('${f.id}', '👊', 'Bump!')" title="Enviar Bump">👊</button>` : ""}
                    <button type="button" class="btn-soft" onclick="window.openFriendChat('${f.id}')" title="Chat">💬${unread > 0 ? ` (${unread})` : ""}</button>
                    ${hasLocation ? `<button type="button" class="btn-soft" onclick="window.locateFriendOnMap('${f.id}')" title="Ver no mapa">📍</button>` : ""}
                    <button type="button" class="btn-logout" onclick="window.removeFriend('${f.id}', '${escapeHTML(f.full_name)}')" title="Remover">×</button>
                </div>
            </div>
        `;
    }).join("");
}

async function searchUsersToAdd() {
    const query = $("friendSearchInput").value.trim();
    const resultsEl = $("friendSearchResults");
    if (!query || !currentUser) return;

    resultsEl.innerHTML = `<p class="muted" style="font-size:12.5px;">A procurar...</p>`;

    const { data, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .neq("id", currentUser.id)
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(15);

    if (error || !data || data.length === 0) {
        resultsEl.innerHTML = `<p class="muted" style="font-size:13px;">Nenhum utilizador encontrado com "${escapeHTML(query)}".</p>`;
        return;
    }

    const friendIds = new Set(window.friendsList.map(f => f.id));

    resultsEl.innerHTML = data.map(u => {
        let actionBtn = "";
        if (friendIds.has(u.id)) {
            actionBtn = `<span class="category">✓ Adicionado</span>`;
        } else if (sentFriendRequestIds.has(u.id)) {
            actionBtn = `<span class="muted" style="font-size:12px;">Pedido enviado</span>`;
        } else {
            actionBtn = `<button type="button" class="btn-primary-sm" onclick="window.sendFriendRequest('${u.id}', '${escapeHTML(u.full_name)}')">+ Adicionar</button>`;
        }

        return `
            <div class="friend-row">
                <div class="friend-row-left">
                    ${renderAvatarChip(u, "")}
                    <div class="friend-row-info">
                        <strong>${escapeHTML(u.full_name)}</strong>
                        <span>${u.role === "business" ? "🏛️ " + escapeHTML(u.business_type || "Entidade") : escapeHTML(u.email)}</span>
                    </div>
                </div>
                <div>${actionBtn}</div>
            </div>
        `;
    }).join("");
}

window.sendFriendRequest = async (targetId, targetName) => {
    if (!currentUser || !currentProfile) return;
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
    showToast(`Pedido enviado a ${targetName}!`, "success");
    searchUsersToAdd();
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
        `${currentProfile.full_name} aceitou o teu pedido. Já podem ver-se no mapa!`
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
// BUMP, EMOJI BOMBS & CHAT DIRETO
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
    if (!currentUser || !currentProfile) return;
    const friend = window.friendsList.find(f => String(f.id) === String(friendId));
    const targetName = friend ? friend.full_name : "amigo";

    const fRow = friendshipRecords.get(String(friendId));
    const nextCount = (fRow?.bump_count || 0) + 1;
    if (fRow) {
        fRow.bump_count = nextCount;
        await supabaseClient.from("friendships").update({ bump_count: nextCount }).eq("id", fRow.id);
    }
    if (friend) friend.bump_count = nextCount;

    triggerBumpVisual(emoji, `${emoji} ${label} com ${targetName}! (#${nextCount})`);
    renderFriendsModalContent();
    if (typeof showFriendsOnMap === "function") showFriendsOnMap(window.friendsList);

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
    const isBiz = friend.role === "business";

    activeChatFriendId = String(friend.id);
    closeModalEl($("friendsModal"));

    $("chatFriendHeader").innerHTML = `
        ${renderAvatarChip(friend, "")}
        <div>
            <strong style="display:block; font-size:15px;">${escapeHTML(friend.full_name)}</strong>
            <span style="font-size:12px; color:${isBiz ? "#fcd34d" : "#f9a8d4"};">
                ${isBiz ? `🏛️ ${escapeHTML(friend.business_type || "Entidade Oficial")}` : `👊 ${friend.bump_count || 0} Bumps · ${escapeHTML(friend.status_emoji || "📍")} ${escapeHTML(friend.status_text || "Online")}`}
            </span>
        </div>
    `;

    const bombBar = document.querySelector(".emoji-bomb-bar");
    if (bombBar) bombBar.classList.toggle("hidden", isBiz);

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
        box.innerHTML = `<p class="muted" style="font-size:12px; text-align:center;">Executa o SQL no Supabase para ativar o chat direto.</p>`;
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
    if (!navigator.getBattery || isBusinessAccount()) return {};
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
    if (!currentUser || !currentProfile) return;
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
    if (!currentUser || !currentProfile) return;
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
            showToast("🏢 Sede Institucional visível no mapa!", "success");
            if (!userPosition) {
                try { await locateUser(); } catch (e) {}
            }
        }
    } else {
        if (next === "ghost") showToast("👻 Modo Fantasma — estás invisível no mapa.");
        else if (next === "blurred") showToast("🌫️ Modo Borrão — os amigos veem apenas a tua zona aproximada.");
        else {
            showToast("📍 Localização Precisa ativa!", "success");
            if (!userPosition) {
                try { await locateUser(); } catch (e) {}
            }
        }
    }
}

async function doQuickCheckin() {
    if (!currentUser || !currentProfile || isBusinessAccount()) return;
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

    if (!isBusinessAccount() && navigator.permissions && navigator.permissions.query) {
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
        await loadSocialData();
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
            if (!msg) return;
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
            loadSocialData();
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
    } else if ($("friendsModal") && !isBusinessAccount()) {
        openModal($("friendsModal"));
        await loadSocialData();
    }
});

$("markAllReadBtn").addEventListener("click", async () => {
    if (!currentUser) return;
    await supabaseClient.from("notifications").update({ is_read: true }).eq("user_id", currentUser.id);
    notifications.forEach(n => { n.is_read = true; });
    renderNotifications();
});

// ==========================================
// SEGUIR ORGANIZADORES
// ==========================================
async function loadMyFollowing() {
    if (!currentUser) return;
    try {
        const { data, error } = await supabaseClient
            .from("follows")
            .select("following_id, following_name")
            .eq("follower_id", currentUser.id);

        if (!error && data) {
            myFollowing = new Map(data.map(r => [String(r.following_id), r.following_name]));
        }
    } catch (e) {}
}

async function toggleFollowOrganizer(creatorId, creatorName) {
    if (!currentUser || !creatorId || creatorId === currentUser.id) return;
    const key = String(creatorId);

    if (myFollowing.has(key)) {
        await supabaseClient.from("follows").delete().eq("follower_id", currentUser.id).eq("following_id", creatorId);
        myFollowing.delete(key);
        showToast(`Deixaste de seguir ${creatorName}.`);
    } else {
        await supabaseClient.from("follows").insert([{
            follower_id: currentUser.id,
            following_id: creatorId,
            following_name: creatorName
        }]);
        myFollowing.set(key, creatorName);
        showToast(`Agora segues ${creatorName}!`, "success");
    }

    if (!detailModal.classList.contains("hidden") && detailEventId) {
        updateDetailFollowButton(creatorId);
    }
    if (state.onlyFollowing) filterEvents();
}

function updateDetailFollowButton(creatorId) {
    const btn = $("detailFollowBtn");
    if (!creatorId || !currentUser || String(creatorId) === String(currentUser.id)) {
        btn.classList.add("hidden");
        return;
    }
    const isFollowing = myFollowing.has(String(creatorId));
    btn.classList.remove("hidden");
    btn.classList.toggle("following", isFollowing);
    btn.textContent = isFollowing ? "✓ A seguir" : "+ Seguir";
}

// ==========================================
// MODAL DE PERFIL ("A MINHA CONTA" — SEPARADO PARA EMPRESAS VS UTILIZADORES)
// ==========================================
userBadge.addEventListener("click", () => {
    if (!currentProfile) return;
    ensureSocialUI();
    const isBiz = isBusinessAccount();

    $("profileEmailDisplay").textContent = currentProfile.email;
    $("profileNameInput").value = currentProfile.full_name;
    $("profileBioInput").value = currentProfile.bio || "";

    // Alterna entre campos institucionais e campos de utilizador normal (sem "a ouvir música" nas empresas)
    $("businessOnlyProfileFields").classList.toggle("hidden", !isBiz);
    $("userOnlyProfileFields").classList.toggle("hidden", isBiz);

    if ($("profileAvatarLabel")) {
        $("profileAvatarLabel").textContent = isBiz ? "Logótipo Oficial da Entidade / Empresa" : "Foto de Perfil";
    }

    const previewEl = $("profileAvatarPreview");
    if (previewEl) {
        previewEl.classList.toggle("business-avatar", isBiz);
        previewEl.innerHTML = currentProfile.avatar_url
            ? `<img src="${escapeHTML(currentProfile.avatar_url)}" alt="">`
            : escapeHTML((currentProfile.full_name || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join(""));
    }
    if ($("profileAvatarInput")) $("profileAvatarInput").value = "";

    const curMode = currentProfile.privacy_mode || (currentProfile.ghost_mode ? "ghost" : "precise");

    if (isBiz) {
        const bizSelect = $("profileBusinessTypeSelect");
        if (bizSelect) {
            const curSector = currentProfile.business_type || "Empresa / Comércio";
            if (![...bizSelect.options].some(o => o.value === curSector)) {
                const opt = document.createElement("option");
                opt.value = curSector;
                opt.textContent = `🏛️ ${curSector}`;
                bizSelect.appendChild(opt);
            }
            bizSelect.value = curSector;
        }
        if ($("businessPrivacyGrid")) {
            $("businessPrivacyGrid").querySelectorAll(".privacy-opt-btn").forEach(btn => {
                btn.classList.toggle("active", btn.dataset.mode === (curMode === "ghost" ? "ghost" : "precise"));
            });
        }
    } else {
        if ($("profileBirthDateInput")) $("profileBirthDateInput").value = currentProfile.birth_date || "";

        const curEmoji = currentProfile.status_emoji || "📍";
        const curText = currentProfile.status_text || "No LocalSpot";
        if ($("profileCustomEmoji")) $("profileCustomEmoji").value = curEmoji;
        if ($("profileCustomStatus")) $("profileCustomStatus").value = curText;

        if ($("statusPillsContainer")) {
            $("statusPillsContainer").querySelectorAll(".status-pill-btn").forEach(btn => {
                btn.classList.toggle("active", btn.dataset.emoji === curEmoji && btn.dataset.text === curText);
            });
        }

        if ($("privacySelectorGrid")) {
            $("privacySelectorGrid").querySelectorAll(".privacy-opt-btn").forEach(btn => {
                btn.classList.toggle("active", btn.dataset.mode === curMode);
            });
        }
    }

    renderProfileLists();
    openModal(profileModal);
});

$("closeProfile").addEventListener("click", () => closeModalEl(profileModal));
profileModal.addEventListener("mousedown", e => { if (e.target === profileModal) closeModalEl(profileModal); });

function switchProfileTab(activeTab, activePanel) {
    ["tabMyEnrollments", "tabMyCreated", "tabMyFollowing"].forEach(id => $(id).classList.toggle("active", id === activeTab));
    ["profileEnrolledList", "profileCreatedList", "profileFollowingList"].forEach(id => $(id).classList.toggle("hidden", id !== activePanel));
}

$("tabMyEnrollments").addEventListener("click", () => switchProfileTab("tabMyEnrollments", "profileEnrolledList"));
$("tabMyCreated").addEventListener("click", () => switchProfileTab("tabMyCreated", "profileCreatedList"));
$("tabMyFollowing").addEventListener("click", () => switchProfileTab("tabMyFollowing", "profileFollowingList"));

async function uploadAvatarImage(file) {
    const { blob, dataUrl } = await resizeImageToBlob(file, 400);
    const fileName = `${currentUser.id}/avatar_${Date.now()}.jpg`;

    for (const bucket of ["avatars", "event-images"]) {
        try {
            const { error } = await supabaseClient.storage
                .from(bucket)
                .upload(fileName, blob, { contentType: "image/jpeg", upsert: true });
            if (!error) {
                const { data } = supabaseClient.storage.from(bucket).getPublicUrl(fileName);
                if (data?.publicUrl) return data.publicUrl;
            }
        } catch (e) {}
    }
    return dataUrl;
}

$("profileUpdateForm").addEventListener("submit", async e => {
    e.preventDefault();
    const newName = $("profileNameInput").value.trim();
    const newBio = $("profileBioInput").value.trim();
    if (!newName || !currentProfile) return;

    const isBiz = isBusinessAccount();
    let avatarUrl = currentProfile.avatar_url || null;
    const avatarFile = $("profileAvatarInput")?.files?.[0];
    if (avatarFile) {
        avatarUrl = await uploadAvatarImage(avatarFile);
    }

    const privacyMode = currentProfile.privacy_mode || "precise";
    const ghostMode = privacyMode === "ghost";

    const updateObj = {
        full_name: newName,
        bio: newBio,
        avatar_url: avatarUrl,
        privacy_mode: privacyMode,
        ghost_mode: ghostMode
    };

    if (isBiz) {
        const selectedSector = $("profileBusinessTypeSelect")?.value || currentProfile.business_type || "Entidade Oficial";
        updateObj.business_type = selectedSector;
        updateObj.birth_date = null;
        updateObj.status_emoji = "🏢";
        updateObj.status_text = selectedSector;
    } else {
        updateObj.birth_date = $("profileBirthDateInput")?.value || null;
        updateObj.status_emoji = ($("profileCustomEmoji")?.value || "📍").trim() || "📍";
        updateObj.status_text = ($("profileCustomStatus")?.value || "No LocalSpot").trim() || "No LocalSpot";
    }

    if (ghostMode) {
        updateObj.last_lat = null;
        updateObj.last_lng = null;
    } else if (userPosition) {
        const coords = applyPrivacyOffset(userPosition.lat, userPosition.lng, privacyMode);
        updateObj.last_lat = coords.lat;
        updateObj.last_lng = coords.lng;
        updateObj.last_seen = new Date().toISOString();
    }

    const { error } = await supabaseClient
        .from("profiles")
        .update(updateObj)
        .eq("id", currentProfile.id);

    if (error) {
        showToast("Erro ao atualizar o perfil.", "error");
        return;
    }

    Object.assign(currentProfile, updateObj);
    applyRoleUI();
    showToast(isBiz ? "Perfil institucional atualizado!" : "Perfil atualizado com sucesso!", "success");
});

function renderProfileLists() {
    const enrolledEvents = events.filter(ev => myEnrollments.has(String(ev.id)));
    const createdEvents = events.filter(ev => ev.creatorId === currentProfile.id);

    $("profileEnrolledList").innerHTML = enrolledEvents.length
        ? enrolledEvents.map(ev => `
            <div class="profile-event-item">
                <div>
                    <strong>${escapeHTML(ev.name)}</strong>
                    <span>📅 ${escapeHTML(formatEventDate(ev))} · 📍 ${escapeHTML(ev.location)}</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="btn-ticket" onclick="closeModalEl(profileModal); window.openEventTicket('${ev.id}')">🎟️</button>
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
                    <span>👥 ${ev.enrolled || 0}${ev.maxParticipants ? "/" + ev.maxParticipants : ""} inscritos · ${escapeHTML(formatEventDate(ev))}</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="btn-soft" onclick="closeModalEl(profileModal); window.startEditEvent('${ev.id}')">✏️</button>
                    <button type="button" class="btn-soft" onclick="closeModalEl(profileModal); window.openEventDetails('${ev.id}')">Ver</button>
                </div>
            </div>
        `).join("")
        : `<p class="muted" style="font-size:13px;">Ainda não criaste nenhum evento.</p>`;

    const followingArr = [...myFollowing.entries()];
    $("profileFollowingList").innerHTML = followingArr.length
        ? followingArr.map(([id, name]) => `
            <div class="profile-event-item">
                <strong>🏢 ${escapeHTML(name)}</strong>
                <button type="button" class="btn-logout" onclick="window.unfollowFromProfile('${id}', '${escapeHTML(name)}')">Deixar de seguir</button>
            </div>
        `).join("")
        : `<p class="muted" style="font-size:13px;">Ainda não segues nenhum organizador.</p>`;
}

window.unfollowFromProfile = async (id, name) => {
    await toggleFollowOrganizer(id, name);
    renderProfileLists();
};

// ==========================================
// PAINEL DE ADMINISTRAÇÃO & MODERAÇÃO
// ==========================================
adminPanelBtn.addEventListener("click", async () => {
    if (currentProfile?.role !== "admin") return;
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
    const listEl = $("adminUsersList");
    const reportsEl = $("adminReportsList");
    listEl.innerHTML = `<p class="muted">A carregar utilizadores...</p>`;

    const [{ data: users }, { data: reports }] = await Promise.all([
        supabaseClient.from("profiles").select("*").order("created_at", { ascending: false }),
        supabaseClient.from("reports").select("*").eq("status", "pendente").order("created_at", { ascending: false })
    ]);

    if (users) {
        $("statTotalUsers").textContent = users.length;
        $("statBusinessUsers").textContent = users.filter(u => u.role === "business").length;
        $("statTotalEvents").textContent = events.length;

        listEl.innerHTML = users.map(u => {
            const typeLabel = u.role === "business" && u.business_type ? ` (${u.business_type})` : "";
            return `
                <div class="admin-user-row">
                    <div class="admin-user-info">
                        <strong>${escapeHTML(u.full_name)}${escapeHTML(typeLabel)}</strong>
                        <span>${escapeHTML(u.email)}</span>
                    </div>
                    <select data-user-id="${u.id}" class="admin-role-select">
                        <option value="user" ${u.role === "user" ? "selected" : ""}>👤 Utilizador</option>
                        <option value="business" ${u.role === "business" ? "selected" : ""}>🏢 Domínio Público</option>
                        <option value="admin" ${u.role === "admin" ? "selected" : ""}>🛡️ Admin</option>
                    </select>
                </div>
            `;
        }).join("");
    }

    const pendingReports = reports || [];
    $("statTotalReports").textContent = pendingReports.length;
    reportsEl.innerHTML = pendingReports.length
        ? pendingReports.map(r => `
            <div class="admin-user-row">
                <div class="admin-user-info">
                    <strong>🚩 ${escapeHTML(r.event_name)}</strong>
                    <span>Motivo: ${escapeHTML(r.reason)} · Por ${escapeHTML(r.reporter_name)}</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="btn-soft" onclick="closeModalEl(adminModal); window.openEventDetails('${r.event_id}')">Ver</button>
                    <button type="button" class="btn-logout" onclick="window.resolveReport(${r.id})">Arquivar</button>
                </div>
            </div>
        `).join("")
        : `<p class="muted" style="font-size:13px;">Nenhuma denúncia pendente.</p>`;
}

window.resolveReport = async reportId => {
    await supabaseClient.from("reports").update({ status: "resolvida" }).eq("id", reportId);
    showToast("Denúncia arquivada.");
    await loadAdminDashboard();
};

$("adminUsersList").addEventListener("change", async e => {
    const select = e.target.closest(".admin-role-select");
    if (!select) return;

    const userId = select.dataset.userId;
    const newRole = select.value;

    const { error } = await supabaseClient.from("profiles").update({ role: newRole }).eq("id", userId);
    if (error) {
        showToast("Erro ao atualizar cargo.", "error");
        return;
    }

    showToast("Permissões atualizadas!", "success");
    if (userId === currentProfile.id) {
        currentProfile.role = newRole;
        applyRoleUI();
    }
    await loadAdminDashboard();
});

// ==========================================
// SUPABASE: CARREGAR EVENTOS E INSCRIÇÕES
// ==========================================
function mapDbEvent(item, index = 0) {
    return {
        id: item.id ?? (index + 1),
        name: item.name,
        description: item.description,
        category: item.category,
        date: item.date,
        time: item.time,
        location: item.location,
        distrito: item.distrito,
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        image: item.image,
        maxParticipants: item.max_participants,
        enrolled: item.enrolled || 0,
        price: item.price || "Gratuito",
        externalUrl: item.external_url || "",
        creatorId: item.creator_id || null,
        creatorName: item.creator_name || null,
        creatorType: item.creator_type || null
    };
}

async function loadMyEnrollments() {
    if (!currentUser) return;
    try {
        const { data, error } = await supabaseClient
            .from("enrollments")
            .select("event_id")
            .eq("user_id", currentUser.id);

        if (!error && data) {
            myEnrollments = new Set(data.map(r => String(r.event_id)));
            saveJSON(`localspot_enrolled_${currentUser.id}`, [...myEnrollments]);
            return;
        }
    } catch (e) {}
    myEnrollments = new Set(loadJSON(`localspot_enrolled_${currentUser.id}`, []).map(String));
}

async function loadAllEnrollmentsSummary() {
    try {
        const { data, error } = await supabaseClient
            .from("enrollments")
            .select("event_id, user_id");

        if (!error && data) {
            allEnrollmentsMap = new Map();
            data.forEach(row => {
                const key = String(row.event_id);
                if (!allEnrollmentsMap.has(key)) allEnrollmentsMap.set(key, []);
                allEnrollmentsMap.get(key).push(String(row.user_id));
            });
        }
    } catch (e) {}
}

window.getFriendsGoingToEvent = eventId => {
    const enrolledUserIds = new Set(allEnrollmentsMap.get(String(eventId)) || []);
    if (!enrolledUserIds.size || !window.friendsList.length) return [];
    return window.friendsList.filter(f => enrolledUserIds.has(String(f.id)));
};

async function loadEventsFromSupabase() {
    let { data, error } = await supabaseClient.from("events").select("*");

    if (error) {
        events.length = 0;
        INITIAL_EVENTS.forEach((item, idx) => events.push(mapDbEvent(item, idx)));
        filterEvents({ fit: true });
        return;
    }

    if ((!data || data.length === 0) && INITIAL_EVENTS.length > 0 && !localStorage.getItem("localspot_seeded")) {
        localStorage.setItem("localspot_seeded", "1");
        const { data: seeded } = await supabaseClient.from("events").insert(INITIAL_EVENTS).select();
        if (seeded && seeded.length > 0) data = seeded;
    }

    events.length = 0;
    const sourceList = (data && data.length > 0) ? data : INITIAL_EVENTS;
    sourceList.forEach((item, idx) => events.push(mapDbEvent(item, idx)));

    filterEvents({ fit: true });
}

function checkSharedEventUrl() {
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get("evento");
    if (!sharedId) return;
    const ev = events.find(x => String(x.id) === String(sharedId));
    if (ev) {
        setActive(ev.id, true);
        focusEvent(ev.id);
        openEventDetails(ev.id);
    }
}

// ---------- Preencher controlos ----------
function setupControls() {
    districtFilter.innerHTML = `<option value="all">Todos os distritos</option>` +
        DISTRICTS.map(d => `<option value="${d.value}">${d.label}</option>`).join("");

    $("eventFormDistrict").innerHTML = `<option value="">Selecionar distrito</option>` +
        DISTRICTS.map(d => `<option value="${d.value}">${d.label}</option>`).join("");

    $("eventCategory").innerHTML = `<option value="">Selecionar categoria</option>` +
        Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}">${c.emoji} ${c.label}</option>`).join("");

    const chips = [["all", "Todas"], ...Object.entries(CATEGORIES).map(([k, c]) => [k, `${c.emoji} ${c.label}`])];
    categoryChips.innerHTML = chips.map(([key, label]) =>
        `<button type="button" class="chip${key === "all" ? " active" : ""}" data-category="${key}">${label}</button>`
    ).join("");

    const today = new Date().toISOString().slice(0, 10);
    $("eventDate").min = today;
}

// ---------- Inscrição Real em Atividades ----------
async function toggleEnrollment(id) {
    if (!currentUser || !currentProfile) return;
    const ev = events.find(x => String(x.id) === String(id));
    if (!ev) return;

    const idKey = String(ev.id);
    const isEnrolled = myEnrollments.has(idKey);
    let newEnrolledCount = ev.enrolled || 0;

    if (isEnrolled) {
        await supabaseClient.from("enrollments").delete().eq("event_id", ev.id).eq("user_id", currentUser.id);
        myEnrollments.delete(idKey);
        newEnrolledCount = Math.max(0, newEnrolledCount - 1);
    } else {
        const isFull = ev.maxParticipants && newEnrolledCount >= ev.maxParticipants;
        if (isFull) {
            showToast("Vagas esgotadas para este evento!", "error");
            return;
        }

        await supabaseClient.from("enrollments").insert([{
            event_id: ev.id,
            user_id: currentUser.id,
            user_name: currentProfile.full_name
        }]);

        myEnrollments.add(idKey);
        newEnrolledCount += 1;

        if (ev.creatorId) {
            await createNotification(
                ev.creatorId,
                ev.id,
                "Nova inscrição no teu evento!",
                `${currentProfile.full_name} inscreveu-se em "${ev.name}".`
            );
        }
    }

    const { error } = await supabaseClient.from("events").update({ enrolled: newEnrolledCount }).eq("id", ev.id);
    if (error) {
        showToast("Erro ao atualizar as vagas.", "error");
        return;
    }

    ev.enrolled = newEnrolledCount;
    saveJSON(`localspot_enrolled_${currentUser.id}`, [...myEnrollments]);
    await loadAllEnrollmentsSummary();

    if (isEnrolled) {
        showToast(`Cancelaste a tua inscrição em "${ev.name}".`);
    } else {
        showToast(`Inscrição confirmada! Bilhete QR disponível.`, "success");
    }

    filterEvents();
    if (!detailModal.classList.contains("hidden") && String(detailEventId) === idKey) {
        openEventDetails(ev.id);
    }
}

window.toggleEnrollment = toggleEnrollment;

// ---------- Filtros & Ordenação ----------
function isPast(ev) {
    return eventDateTime(ev) < new Date();
}

function matchesPeriod(ev) {
    if (state.period === "all") return true;
    const d = eventDateTime(ev);
    const now = new Date();
    if (d < now) return false;
    if (state.period === "upcoming") return true;
    const days = state.period === "week" ? 7 : 30;
    return d <= new Date(now.getTime() + days * 86400000);
}

function matchesRadius(ev) {
    if (state.radius >= 100) return true;
    const km = distanceOf(ev);
    if (km === null) return true;
    return km <= state.radius;
}

function distanceOf(ev) {
    if (!userPosition) return null;
    return distanceKm(userPosition.lat, userPosition.lng, ev.latitude, ev.longitude);
}

function sortEvents(list) {
    const sorted = [...list];
    if (state.sort === "name") {
        sorted.sort((a, b) => a.name.localeCompare(b.name, "pt"));
    } else if (state.sort === "popular") {
        sorted.sort((a, b) => (b.enrolled || 0) - (a.enrolled || 0));
    } else if (state.sort === "distance" && userPosition) {
        sorted.sort((a, b) => distanceOf(a) - distanceOf(b));
    } else {
        const upcoming = sorted.filter(e => !isPast(e)).sort((a, b) => eventDateTime(a) - eventDateTime(b));
        const past = sorted.filter(isPast).sort((a, b) => eventDateTime(b) - eventDateTime(a));
        return [...upcoming, ...past];
    }
    return sorted;
}

function getFilteredEvents() {
    const q = normalizeText(state.search.trim());
    const filtered = events.filter(ev => {
        const haystack = normalizeText(`${ev.name} ${ev.location} ${ev.description || ""} ${ev.creatorName || ""}`);
        return (!q || haystack.includes(q)) &&
            (state.category === "all" || ev.category === state.category) &&
            (state.district === "all" || ev.distrito === state.district) &&
            matchesPeriod(ev) &&
            matchesRadius(ev) &&
            (!state.onlyFavorites || favorites.has(String(ev.id))) &&
            (!state.onlyFree || isFreePrice(ev.price)) &&
            (!state.onlyFollowing || (ev.creatorId && myFollowing.has(String(ev.creatorId))));
    });
    return sortEvents(filtered);
}

function hasActiveFilters() {
    return state.search || state.category !== "all" || state.district !== "all" ||
        state.period !== "all" || state.radius < 100 || state.onlyFavorites ||
        state.onlyFree || state.onlyFollowing;
}

function filterEvents({ fit = false } = {}) {
    currentList = getFilteredEvents();
    displayEvents(currentList);
    showEventsOnMap(currentList);
    if (fit) fitToEvents(currentList);
    resetFiltersBtn.classList.toggle("hidden", !hasActiveFilters());
}

// ---------- Renderização da Lista ----------
function formatKm(km) {
    return km < 10 ? `${km.toFixed(1).replace(".", ",")} km` : `${Math.round(km)} km`;
}

function canManageEvent(ev) {
    return currentProfile && (
        currentProfile.role === "admin" ||
        (ev.creatorId && ev.creatorId === currentProfile.id)
    );
}

function displayEvents(list) {
    eventsList.innerHTML = "";
    eventCount.textContent = list.length;
    emptyState.classList.toggle("hidden", list.length > 0);

    const frag = document.createDocumentFragment();

    list.forEach(ev => {
        const cat = CATEGORIES[ev.category];
        const km = distanceOf(ev);
        const fav = favorites.has(String(ev.id));
        const enrolled = myEnrollments.has(String(ev.id));
        const past = isPast(ev);

        const currentEnrolled = ev.enrolled || 0;
        const max = ev.maxParticipants;
        const isFull = max && currentEnrolled >= max;

        let vagasLabel = max ? `${currentEnrolled}/${max} vagas` : `${currentEnrolled} inscritos`;
        if (isFull) vagasLabel += " (Esgotado)";

        let enrollBtnHtml = "";
        if (!past) {
            if (enrolled) {
                enrollBtnHtml = `<button type="button" class="register-btn registered" data-action="enroll">✓ Inscrito</button>`;
            } else if (isFull) {
                enrollBtnHtml = `<button type="button" class="register-btn" disabled>Esgotado</button>`;
            } else {
                enrollBtnHtml = `<button type="button" class="register-btn" data-action="enroll">✋ Inscrever-me</button>`;
            }
        } else {
            enrollBtnHtml = `<button type="button" class="register-btn" disabled>Terminado</button>`;
        }

        let organizerBadge = "";
        if (ev.creatorName) {
            const isNormalUser = ev.creatorType === "Utilizador";
            const badgeIcon = isNormalUser ? "👤" : "🏢";
            const prefix = !isNormalUser && ev.creatorType ? `${ev.creatorType} · ` : "";
            organizerBadge = `<div class="organizer-tag${isNormalUser ? " user-tag" : ""}">${badgeIcon} ${escapeHTML(prefix)}${escapeHTML(ev.creatorName)}</div>`;
        }

        const friendsGoing = window.getFriendsGoingToEvent(ev.id);
        const friendsBadge = friendsGoing.length
            ? `<div class="friends-going-badge">👊 ${friendsGoing.length === 1 ? escapeHTML(friendsGoing[0].full_name) + " vai" : friendsGoing.length + " amigos vão"}</div>`
            : "";

        const ownerBar = canManageEvent(ev)
            ? `<div class="owner-card-bar">
                    <button type="button" class="edit-btn" data-action="edit">✏️ Editar</button>
                    <button type="button" class="delete-btn" data-action="delete">🗑 Apagar</button>
               </div>`
            : "";

        const card = document.createElement("article");
        card.className = "event-card" + (past ? " past" : "") + (String(ev.id) === String(activeId) ? " active" : "");
        card.dataset.id = ev.id;
        card.tabIndex = 0;

        card.innerHTML = `
            <div class="event-image-wrap">
                <img src="${escapeHTML(ev.image || DEFAULT_IMAGE)}" alt="" class="event-image" loading="lazy"
                     onerror="this.onerror=null;this.src='${DEFAULT_IMAGE}'">
                ${past ? '<span class="badge-past">Terminado</span>' : ""}
                <span class="badge-price-card">${escapeHTML(ev.price || "Gratuito")}</span>
                <button type="button" class="fav-btn${fav ? " on" : ""}" data-action="fav">${fav ? "★" : "☆"}</button>
            </div>
            <div class="event-meta">
                <span class="category">${cat ? cat.emoji + " " + cat.label : escapeHTML(ev.category)}</span>
                ${km !== null ? `<span class="distance">${formatKm(km)}</span>` : ""}
            </div>
            <h4>${escapeHTML(ev.name)}</h4>
            ${organizerBadge}
            ${friendsBadge}
            <p>📅 ${escapeHTML(formatEventDate(ev))}</p>
            <p>📍 ${escapeHTML(ev.location)} · ${escapeHTML(districtLabel(ev.distrito))}</p>
            
            <div class="registration-info">👥 ${vagasLabel}</div>
            <div class="card-actions-grid">
                ${enrollBtnHtml}
                <button type="button" class="details-btn" data-action="details">Detalhes</button>
            </div>
            ${ownerBar}
        `;
        frag.appendChild(card);
    });

    eventsList.appendChild(frag);
}

function setActive(id, scroll = true) {
    activeId = id;
    highlightMarkerOnMap(id);
    eventsList.querySelectorAll(".event-card").forEach(c => {
        const on = String(c.dataset.id) === String(id);
        c.classList.toggle("active", on);
        if (on && scroll) c.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
}

function openEventOnMap(id) {
    setActive(id, false);
    if (window.innerWidth <= 820) setMobileView("map");
    focusEvent(id);
}

eventsList.addEventListener("click", e => {
    const card = e.target.closest(".event-card");
    if (!card) return;
    const id = card.dataset.id;
    const action = e.target.closest("[data-action]")?.dataset.action;

    if (action === "fav") toggleFavorite(id);
    else if (action === "enroll") toggleEnrollment(id);
    else if (action === "details") openEventDetails(id);
    else if (action === "edit") startEditEvent(id);
    else if (action === "delete") deleteEvent(id);
    else openEventOnMap(id);
});

eventsList.addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("event-card")) {
        e.preventDefault();
        openEventOnMap(e.target.dataset.id);
    }
});

window.onEventMarkerClick = id => setActive(id, true);

function toggleFavorite(id) {
    const key = String(id);
    if (favorites.has(key)) favorites.delete(key); else favorites.add(key);
    saveJSON(STORAGE_FAVS, [...favorites]);
    filterEvents();
}

window.toggleFavorite = toggleFavorite;

async function deleteEvent(id) {
    const ev = events.find(x => String(x.id) === String(id));
    if (!ev || !confirm(`Apagar o evento "${ev.name}"?`)) return;

    const { error } = await supabaseClient.from("events").delete().eq("id", ev.id);
    if (error) {
        showToast("Erro ao apagar o evento.", "error");
        return;
    }

    events.splice(events.indexOf(ev), 1);
    favorites.delete(String(ev.id));
    myEnrollments.delete(String(ev.id));
    saveJSON(STORAGE_FAVS, [...favorites]);
    if (currentUser) saveJSON(`localspot_enrolled_${currentUser.id}`, [...myEnrollments]);
    if (!detailModal.classList.contains("hidden")) closeModalEl(detailModal);
    filterEvents();
    showToast("Evento apagado com sucesso.");
}

// ==========================================
// MODAL DE DETALHES, BILHETE QR, AVALIAÇÕES E COMENTÁRIOS
// ==========================================
async function openEventDetails(id) {
    const ev = events.find(x => String(x.id) === String(id));
    if (!ev) return;

    detailEventId = ev.id;
    const cat = CATEGORIES[ev.category];
    const past = isPast(ev);
    const enrolled = myEnrollments.has(String(ev.id));
    const currentEnrolled = ev.enrolled || 0;
    const max = ev.maxParticipants;
    const isFull = max && currentEnrolled >= max;

    const imgEl = $("detailImage");
    imgEl.src = ev.image || DEFAULT_IMAGE;
    imgEl.onerror = () => { imgEl.src = DEFAULT_IMAGE; };

    $("detailCategory").textContent = cat ? `${cat.emoji} ${cat.label}` : ev.category;
    $("detailPriceBadge").textContent = `🎟️ ${ev.price || "Gratuito"}`;

    const orgEl = $("detailOrganizer");
    if (ev.creatorName) {
        const isNormal = ev.creatorType === "Utilizador";
        orgEl.textContent = `${isNormal ? "👤" : "🏢"} ${ev.creatorName}`;
        orgEl.classList.toggle("user-tag", isNormal);
        orgEl.classList.remove("hidden");
    } else {
        orgEl.classList.add("hidden");
    }

    updateDetailFollowButton(ev.creatorId);

    $("detailTitle").textContent = ev.name;
    $("detailDescription").textContent = ev.description || "Sem descrição adicional.";
    $("detailDateTime").textContent = formatEventDate(ev);
    $("detailLocation").textContent = `${ev.location} · ${districtLabel(ev.distrito)}`;
    $("detailVacancies").textContent = max ? `${currentEnrolled} / ${max} vagas` : `${currentEnrolled} inscritos (ilimitado)`;

    const extLink = $("detailExternalLink");
    const safeUrl = sanitizeUrl(ev.externalUrl);
    if (safeUrl) {
        extLink.href = safeUrl;
        extLink.classList.remove("hidden");
    } else {
        extLink.classList.add("hidden");
    }

    const enrollBtn = $("detailEnrollBtn");
    enrollBtn.disabled = false;
    enrollBtn.classList.remove("registered");
    if (past) {
        enrollBtn.textContent = "Evento terminado";
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

    $("detailTicketBtn").classList.toggle("hidden", !enrolled);
    $("detailCalendarBtn").href = buildGoogleCalendarUrl(ev);
    $("detailDirectionsBtn").href = `https://www.google.com/maps/dir/?api=1&destination=${ev.latitude},${ev.longitude}`;
    $("detailOwnerActions").classList.toggle("hidden", !canManageEvent(ev));

    const reviewsSection = $("detailReviewsSection");
    reviewsSection.classList.toggle("hidden", !past);
    $("reviewForm").classList.toggle("hidden", !past || !enrolled);

    openModal(detailModal);
    await Promise.all([
        loadEventAttendees(ev),
        loadEventComments(ev.id),
        loadEventReviews(ev.id)
    ]);
}

window.openEventDetails = openEventDetails;

$("closeDetail").addEventListener("click", () => closeModalEl(detailModal));
detailModal.addEventListener("mousedown", e => { if (e.target === detailModal) closeModalEl(detailModal); });

$("detailFollowBtn").addEventListener("click", () => {
    const ev = events.find(x => String(x.id) === String(detailEventId));
    if (ev && ev.creatorId) toggleFollowOrganizer(ev.creatorId, ev.creatorName);
});

$("detailEnrollBtn").addEventListener("click", () => {
    if (detailEventId) toggleEnrollment(detailEventId);
});

$("detailTicketBtn").addEventListener("click", () => {
    if (detailEventId) openEventTicket(detailEventId);
});

$("detailShareBtn").addEventListener("click", async () => {
    if (!detailEventId) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?evento=${detailEventId}`;
    try {
        await navigator.clipboard.writeText(shareUrl);
        showToast("Link do evento copiado!", "success");
    } catch (e) {
        showToast(shareUrl);
    }
});

$("detailIcsBtn").addEventListener("click", () => {
    const ev = events.find(x => String(x.id) === String(detailEventId));
    if (ev) downloadEventICS(ev);
});

$("detailReportBtn").addEventListener("click", () => {
    if (!detailEventId) return;
    $("reportForm").reset();
    openModal(reportModal);
});

$("detailEditBtn").addEventListener("click", () => {
    if (!detailEventId) return;
    closeModalEl(detailModal);
    startEditEvent(detailEventId);
});

$("detailDuplicateBtn").addEventListener("click", () => {
    if (!detailEventId) return;
    closeModalEl(detailModal);
    startDuplicateEvent(detailEventId);
});

$("detailDeleteBtn").addEventListener("click", () => {
    if (detailEventId) deleteEvent(detailEventId);
});

// ---------- Bilhete Digital / QR Code ----------
function drawDeterministicQR(canvas, seedText) {
    const ctx = canvas.getContext("2d");
    const size = canvas.width;
    const cells = 21;
    const cellSize = Math.floor(size / cells);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#0f172a";

    let hash = 0;
    for (let i = 0; i < seedText.length; i++) {
        hash = ((hash << 5) - hash + seedText.charCodeAt(i)) | 0;
    }

    const drawFinder = (ox, oy) => {
        ctx.fillRect(ox * cellSize, oy * cellSize, 7 * cellSize, 7 * cellSize);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect((ox + 1) * cellSize, (oy + 1) * cellSize, 5 * cellSize, 5 * cellSize);
        ctx.fillStyle = "#0f172a";
        ctx.fillRect((ox + 2) * cellSize, (oy + 2) * cellSize, 3 * cellSize, 3 * cellSize);
    };

    drawFinder(0, 0);
    drawFinder(cells - 7, 0);
    drawFinder(0, cells - 7);

    for (let r = 0; r < cells; r++) {
        for (let c = 0; c < cells; c++) {
            const inFinder = (r < 8 && c < 8) || (r < 8 && c >= cells - 8) || (r >= cells - 8 && c < 8);
            if (inFinder) continue;
            hash = (hash * 1664525 + 1013904223) | 0;
            if ((hash >>> 24) & 1) {
                ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
            }
        }
    }
}

function openEventTicket(id) {
    const ev = events.find(x => String(x.id) === String(id));
    if (!ev || !currentUser || !currentProfile) return;

    const code = `LS-${ev.id}-${currentUser.id.slice(0, 6).toUpperCase()}`;
    $("ticketEventName").textContent = ev.name;
    $("ticketDateTime").textContent = `📅 ${formatEventDate(ev)}`;
    $("ticketLocation").textContent = `📍 ${ev.location} · ${districtLabel(ev.distrito)}`;
    $("ticketCodeText").textContent = code;
    $("ticketUserName").textContent = `Participante: ${currentProfile.full_name}`;
    drawDeterministicQR($("ticketQrCanvas"), code);
    openModal(ticketModal);
}

window.openEventTicket = openEventTicket;

$("closeTicket").addEventListener("click", () => closeModalEl(ticketModal));
ticketModal.addEventListener("mousedown", e => { if (e.target === ticketModal) closeModalEl(ticketModal); });

// ---------- Denúncias ----------
$("closeReport").addEventListener("click", () => closeModalEl(reportModal));
reportModal.addEventListener("mousedown", e => { if (e.target === reportModal) closeModalEl(reportModal); });

$("reportForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!currentUser || !currentProfile || !detailEventId) return;
    const ev = events.find(x => String(x.id) === String(detailEventId));
    if (!ev) return;

    const reason = `${$("reportReason").value}${ $("reportDetails").value.trim() ? " — " + $("reportDetails").value.trim() : "" }`;
    const { error } = await supabaseClient.from("reports").insert([{
        event_id: ev.id,
        event_name: ev.name,
        reporter_id: currentUser.id,
        reporter_name: currentProfile.full_name,
        reason
    }]);

    if (error) {
        showToast("Erro ao enviar denúncia.", "error");
        return;
    }

    closeModalEl(reportModal);
    showToast("Denúncia enviada à equipa de moderação.", "success");
});

// ---------- Avaliações (Estrelas) ----------
async function loadEventReviews(eventId) {
    const ratingBadge = $("detailRatingBadge");
    const listEl = $("detailReviewsList");

    const { data, error } = await supabaseClient
        .from("reviews")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) {
        ratingBadge.classList.add("hidden");
        listEl.innerHTML = `<p class="muted" style="font-size:12.5px;">Ainda sem avaliações para este evento.</p>`;
        return;
    }

    const avg = (data.reduce((acc, r) => acc + r.rating, 0) / data.length).toFixed(1);
    ratingBadge.textContent = `⭐ ${avg} (${data.length})`;
    ratingBadge.classList.remove("hidden");

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
    const comment = $("reviewCommentInput").value.trim();

    const { error } = await supabaseClient.from("reviews").upsert({
        event_id: detailEventId,
        user_id: currentUser.id,
        user_name: currentProfile.full_name,
        rating,
        comment
    }, { onConflict: "event_id,user_id" });

    if (error) {
        showToast("Erro ao guardar avaliação.", "error");
        return;
    }

    $("reviewCommentInput").value = "";
    showToast("Avaliação registada!", "success");
    await loadEventReviews(detailEventId);
});

// ---------- Lista de Participantes ----------
async function loadEventAttendees(ev) {
    const box = $("detailAttendeesList");
    const exportBtn = $("exportCsvBtn");
    box.innerHTML = `<span class="muted" style="font-size:12.5px;">A carregar inscritos...</span>`;

    const { data, error } = await supabaseClient
        .from("enrollments")
        .select("user_id, user_name")
        .eq("event_id", ev.id)
        .order("created_at", { ascending: true });

    if (error || !data || data.length === 0) {
        box.innerHTML = `<span class="muted" style="font-size:12.5px;">Ainda ninguém se inscreveu. Sê o primeiro!</span>`;
        exportBtn.classList.add("hidden");
        return;
    }

    const friendIds = new Set(window.friendsList.map(f => String(f.id)));
    const attendeeIds = data.map(r => r.user_id).filter(Boolean);
    let avatarMap = new Map();
    if (attendeeIds.length > 0) {
        const { data: profs } = await supabaseClient
            .from("profiles")
            .select("id, avatar_url, full_name, role")
            .in("id", attendeeIds);
        if (profs) avatarMap = new Map(profs.map(p => [String(p.id), p]));
    }

    box.innerHTML = data.map(r => {
        const isFriend = friendIds.has(String(r.user_id));
        const prof = avatarMap.get(String(r.user_id)) || { full_name: r.user_name };
        const miniAvatar = renderAvatarChip(prof, "sm");
        return `<span class="attendee-pill${isFriend ? " friend-attendee" : ""}">${miniAvatar} ${escapeHTML(r.user_name)}${isFriend ? " (Amigo)" : ""}</span>`;
    }).join("");

    if (canManageEvent(ev)) {
        exportBtn.classList.remove("hidden");
        exportBtn.onclick = () => exportAttendeesCSV(ev, data);
    } else {
        exportBtn.classList.add("hidden");
    }
}

function exportAttendeesCSV(ev, rows) {
    const csv = "Nome do Participante\n" + rows.map(r => `"${r.user_name.replace(/"/g, '""')}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `inscritos_${normalizeText(ev.name).replace(/\s+/g, "_")}.csv`;
    link.click();
}

// ---------- Comentários & Perguntas ----------
async function loadEventComments(eventId) {
    const listEl = $("detailCommentsList");
    listEl.innerHTML = `<p class="muted" style="font-size:12.5px;">A carregar comentários...</p>`;

    const { data, error } = await supabaseClient
        .from("comments")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) {
        listEl.innerHTML = `<p class="muted" style="font-size:12.5px;">Ainda sem comentários.</p>`;
        return;
    }

    listEl.innerHTML = data.map(c => {
        const canDel = currentProfile && (currentProfile.role === "admin" || c.user_id === currentProfile.id);
        return `
            <div class="comment-item">
                <div class="comment-head">
                    <strong>${escapeHTML(c.user_name)}</strong>
                    ${canDel ? `<button type="button" class="delete-btn" onclick="window.deleteComment(${c.id})">Apagar</button>` : ""}
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

    const { error } = await supabaseClient.from("comments").insert([{
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
    if (ev && ev.creatorId) {
        await createNotification(
            ev.creatorId,
            ev.id,
            "Novo comentário no teu evento",
            `${currentProfile.full_name} comentou em "${ev.name}": "${content.slice(0, 50)}"`
        );
    }

    input.value = "";
    await loadEventComments(detailEventId);
});

window.deleteComment = async commentId => {
    await supabaseClient.from("comments").delete().eq("id", commentId);
    if (detailEventId) await loadEventComments(detailEventId);
};

// ---------- Controlos de Pesquisa & Filtros ----------
let searchDebounce;
searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => { state.search = searchInput.value; filterEvents(); }, 180);
});

categoryChips.addEventListener("click", e => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    categoryChips.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    state.category = chip.dataset.category;
    filterEvents();
});

districtFilter.addEventListener("change", () => { state.district = districtFilter.value; filterEvents(); });
periodFilter.addEventListener("change", () => { state.period = periodFilter.value; filterEvents(); });

radiusSlider.addEventListener("input", async () => {
    state.radius = Number(radiusSlider.value);
    radiusValue.textContent = state.radius >= 100 ? "Sem limite" : `${state.radius} km`;

    if (state.radius < 100 && !userPosition) {
        try {
            await locateUser();
            enableDistanceSort();
        } catch (e) {}
    }
    filterEvents();
});

sortFilter.addEventListener("change", () => { state.sort = sortFilter.value; filterEvents(); });

favoritesToggle.addEventListener("click", () => {
    state.onlyFavorites = !state.onlyFavorites;
    favoritesToggle.classList.toggle("on", state.onlyFavorites);
    favoritesToggle.setAttribute("aria-pressed", String(state.onlyFavorites));
    filterEvents();
});

freeOnlyToggle.addEventListener("click", () => {
    state.onlyFree = !state.onlyFree;
    freeOnlyToggle.classList.toggle("on", state.onlyFree);
    freeOnlyToggle.setAttribute("aria-pressed", String(state.onlyFree));
    filterEvents();
});

followingOnlyToggle.addEventListener("click", () => {
    state.onlyFollowing = !state.onlyFollowing;
    followingOnlyToggle.classList.toggle("on", state.onlyFollowing);
    followingOnlyToggle.setAttribute("aria-pressed", String(state.onlyFollowing));
    filterEvents();
});

resetFiltersBtn.addEventListener("click", () => {
    state.search = ""; state.category = "all"; state.district = "all";
    state.period = "all"; state.radius = 100; state.onlyFavorites = false;
    state.onlyFree = false; state.onlyFollowing = false;

    searchInput.value = ""; districtFilter.value = "all"; periodFilter.value = "all";
    radiusSlider.value = 100; radiusValue.textContent = "Sem limite";
    favoritesToggle.classList.remove("on");
    freeOnlyToggle.classList.remove("on");
    followingOnlyToggle.classList.remove("on");
    categoryChips.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c.dataset.category === "all"));
    filterEvents({ fit: true });
});

function enableDistanceSort() {
    const opt = sortFilter.querySelector('option[value="distance"]');
    if (opt) opt.disabled = false;
}

locationButton.addEventListener("click", async () => {
    locationButton.disabled = true;
    locationButton.textContent = "A localizar...";
    try {
        await locateUser();
        enableDistanceSort();
        if (window.innerWidth <= 820) setMobileView("map");
        showToast("Localização encontrada!");
        filterEvents();
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        locationButton.disabled = false;
        locationButton.textContent = "📍 Perto de mim";
    }
});

// ==========================================
// ESCOLHA DE LOCAL NO MAPA, CRIAÇÃO, EDIÇÃO E DUPLICAÇÃO
// ==========================================
function beginPickOnMap() {
    closeModalEl(modal);
    pickBanner.classList.remove("hidden");
    $("pickSearchInput").value = "";
    if (window.innerWidth <= 820) setMobileView("map");

    pickLocation(latlng => {
        pickBanner.classList.add("hidden");
        setPickedLocation(latlng);
        openModal(modal);
    });
}

$("cancelPickBtn").addEventListener("click", () => {
    cancelPick();
    pickBanner.classList.add("hidden");
});

$("pickSearchBtn").addEventListener("click", searchPlaceForPick);
$("pickSearchInput").addEventListener("keydown", e => {
    if (e.key === "Enter") {
        e.preventDefault();
        searchPlaceForPick();
    }
});

async function searchPlaceForPick() {
    const q = $("pickSearchInput").value.trim();
    if (!q) return;
    const btn = $("pickSearchBtn");
    btn.disabled = true;
    btn.textContent = "...";
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q + ", Portugal")}`);
        const data = await res.json();
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            flyToCoordinates(lng, lat, 15);
            showToast(`Mapa centrado em: ${data[0].display_name.split(",")[0]}`);
        } else {
            showToast("Local não encontrado.", "error");
        }
    } catch (e) {
        showToast("Erro ao pesquisar local.", "error");
    } finally {
        btn.disabled = false;
        btn.textContent = "Ir";
    }
}

addEventButton.addEventListener("click", () => {
    editingEventId = null;
    $("eventModalTitle").textContent = "Adicionar Novo Evento";
    $("eventSubmitBtn").textContent = "Publicar Evento";
    eventForm.reset();
    imagePreview.classList.add("hidden");
    imagePreview.removeAttribute("src");
    formError.classList.add("hidden");
    beginPickOnMap();
});

changeLocationButton.addEventListener("click", beginPickOnMap);

function startEditEvent(id) {
    const ev = events.find(x => String(x.id) === String(id));
    if (!ev) return;

    editingEventId = ev.id;
    $("eventModalTitle").textContent = "Editar Evento";
    $("eventSubmitBtn").textContent = "Guardar Alterações";
    fillEventFormFromObject(ev);
    openModal(modal);
}

function startDuplicateEvent(id) {
    const ev = events.find(x => String(x.id) === String(id));
    if (!ev) return;

    editingEventId = null;
    $("eventModalTitle").textContent = "Duplicar Evento";
    $("eventSubmitBtn").textContent = "Publicar Cópia";
    fillEventFormFromObject(ev, true);
    openModal(modal);
}

function fillEventFormFromObject(ev, isDuplicate = false) {
    $("eventName").value = isDuplicate ? `${ev.name} (Cópia)` : ev.name;
    $("eventCategory").value = ev.category;
    $("eventDate").value = ev.date;
    $("eventTime").value = ev.time;
    $("eventLocation").value = ev.location;
    $("eventFormDistrict").value = ev.distrito;
    $("eventMaxParticipants").value = ev.maxParticipants || "";
    $("eventPrice").value = ev.price || "Gratuito";
    $("eventExternalUrl").value = ev.externalUrl || "";
    $("eventDescription").value = ev.description || "";
    eventImageInput.value = "";
    formError.classList.add("hidden");

    if (ev.image) {
        imagePreview.src = ev.image;
        imagePreview.classList.remove("hidden");
    } else {
        imagePreview.classList.add("hidden");
    }

    setPickedLocation({ lat: ev.latitude, lng: ev.longitude });
}

window.startEditEvent = startEditEvent;

function setPickedLocation(latlng) {
    pendingLocation = latlng;
    setTempMarker(latlng);
    coordsText.textContent = `📍 ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    coordsText.classList.add("ok");
}

function closeEventModal() {
    closeModalEl(modal);
    clearTempMarker();
    pendingLocation = null;
    editingEventId = null;
}

closeModal.addEventListener("click", closeEventModal);
modal.addEventListener("mousedown", e => { if (e.target === modal) closeEventModal(); });

eventImageInput.addEventListener("change", () => {
    const file = eventImageInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        imagePreview.src = reader.result;
        imagePreview.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
});

async function uploadEventImage(file) {
    const { blob, dataUrl } = await resizeImageToBlob(file);
    try {
        const fileName = `${currentUser.id}/${Date.now()}.jpg`;
        const { error } = await supabaseClient.storage
            .from("event-images")
            .upload(fileName, blob, { contentType: "image/jpeg", upsert: true });

        if (!error) {
            const { data } = supabaseClient.storage.from("event-images").getPublicUrl(fileName);
            if (data?.publicUrl) return data.publicUrl;
        }
    } catch (e) {}
    return dataUrl;
}

function resizeImageToBlob(file, maxWidth = 900) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error("Ficheiro inválido."));
            img.onload = () => {
                const scale = Math.min(1, maxWidth / img.width);
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
                canvas.toBlob(blob => resolve({ blob, dataUrl }), "image/jpeg", 0.8);
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

eventForm.addEventListener("submit", async e => {
    e.preventDefault();
    formError.classList.add("hidden");

    const name = $("eventName").value.trim();
    const category = $("eventCategory").value;
    const date = $("eventDate").value;
    const time = $("eventTime").value;
    const location = $("eventLocation").value.trim();
    const distrito = $("eventFormDistrict").value;
    const description = $("eventDescription").value.trim();
    const rawMax = $("eventMaxParticipants").value;
    const maxParticipants = rawMax ? parseInt(rawMax, 10) : null;
    const price = $("eventPrice").value.trim() || "Gratuito";
    const externalUrl = sanitizeUrl($("eventExternalUrl").value);

    const errors = [];
    if (!name) errors.push("Indica o nome do evento.");
    if (!category) errors.push("Escolhe uma categoria.");
    if (!date) errors.push("Indica a data.");
    if (!time) errors.push("Indica a hora.");
    if (!location) errors.push("Indica a morada ou local.");
    if (!distrito) errors.push("Escolhe um distrito.");
    if (!pendingLocation) errors.push("Escolhe a localização no mapa.");

    if (errors.length) {
        formError.textContent = errors.join(" ");
        formError.classList.remove("hidden");
        return;
    }

    const submitBtn = $("eventSubmitBtn");
    submitBtn.disabled = true;
    submitBtn.textContent = "A guardar...";

    try {
        const existingEv = editingEventId ? events.find(x => String(x.id) === String(editingEventId)) : null;
        let image = existingEv ? existingEv.image : DEFAULT_IMAGE;

        const file = eventImageInput.files[0];
        if (file) {
            image = await uploadEventImage(file);
        }

        const payload = {
            name,
            category,
            date,
            time,
            location,
            distrito,
            description,
            image,
            latitude: pendingLocation.lat,
            longitude: pendingLocation.lng,
            max_participants: maxParticipants,
            price,
            external_url: externalUrl
        };

        if (editingEventId) {
            const { data, error } = await supabaseClient
                .from("events")
                .update(payload)
                .eq("id", editingEventId)
                .select()
                .single();

            if (error) throw error;
            const idx = events.findIndex(x => String(x.id) === String(editingEventId));
            if (idx !== -1) events[idx] = mapDbEvent(data);

            closeEventModal();
            filterEvents();
            showToast("Evento atualizado com sucesso!", "success");
        } else {
            payload.enrolled = 0;
            payload.creator_id = currentProfile ? currentProfile.id : null;
            payload.creator_name = currentProfile ? currentProfile.full_name : null;
            payload.creator_type = currentProfile
                ? (currentProfile.role === "business" ? (currentProfile.business_type || "Domínio Público") : "Utilizador")
                : null;

            const { data, error } = await supabaseClient
                .from("events")
                .insert([payload])
                .select()
                .single();

            if (error) throw error;
            const created = mapDbEvent(data);
            events.push(created);

            if (currentProfile) {
                const { data: followers } = await supabaseClient
                    .from("follows")
                    .select("follower_id")
                    .eq("following_id", currentProfile.id);

                if (followers && followers.length > 0) {
                    const notifs = followers.map(f => ({
                        user_id: f.follower_id,
                        event_id: created.id,
                        title: `Novo evento de ${currentProfile.full_name}`,
                        message: `${created.name} · ${formatEventDate(created)}`
                    }));
                    await supabaseClient.from("notifications").insert(notifs);
                }
            }

            closeEventModal();
            filterEvents();
            openEventOnMap(created.id);
            showToast("Evento publicado no mapa!", "success");
        }
    } catch (err) {
        formError.textContent = err.message || "Erro ao guardar evento.";
        formError.classList.remove("hidden");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = editingEventId ? "Guardar Alterações" : "Publicar Evento";
    }
});

// ---------- Controlo de Modais e Acertos de Início ----------
let lastFocused = null;
function openModal(el) {
    lastFocused = document.activeElement;
    el.classList.remove("hidden");
    el.setAttribute("aria-hidden", "false");
    const first = el.querySelector("input, select, textarea, button");
    if (first) first.focus();
}

function closeModalEl(el) {
    el.classList.add("hidden");
    el.setAttribute("aria-hidden", "true");
    if (lastFocused) lastFocused.focus();
}

$("aboutButton").addEventListener("click", () => openModal(aboutModal));
$("closeAbout").addEventListener("click", () => closeModalEl(aboutModal));
aboutModal.addEventListener("mousedown", e => { if (e.target === aboutModal) closeModalEl(aboutModal); });

document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!modal.classList.contains("hidden")) closeEventModal();
    if (!aboutModal.classList.contains("hidden")) closeModalEl(aboutModal);
    if (!adminModal.classList.contains("hidden")) closeModalEl(adminModal);
    if (!profileModal.classList.contains("hidden")) closeModalEl(profileModal);
    if (!detailModal.classList.contains("hidden")) closeModalEl(detailModal);
    if (!ticketModal.classList.contains("hidden")) closeModalEl(ticketModal);
    if (!reportModal.classList.contains("hidden")) closeModalEl(reportModal);
    if ($("friendsModal") && !$("friendsModal").classList.contains("hidden")) closeModalEl($("friendsModal"));
    if ($("friendChatModal") && !$("friendChatModal").classList.contains("hidden")) {
        activeChatFriendId = null;
        closeModalEl($("friendChatModal"));
    }
    if (!pickBanner.classList.contains("hidden")) {
        cancelPick();
        pickBanner.classList.add("hidden");
    }
});

setupControls();
initAuth();
