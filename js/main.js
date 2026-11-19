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

// Estado Social estilo Bump
window.friendsList = [];
let incomingFriendRequests = [];
let sentFriendRequestIds = new Set();
let allEnrollmentsMap = new Map(); // event_id -> array of user_ids
let locationSyncInterval = null;
let realtimeChannel = null;

const BUMP_STATUSES = [
    { emoji: "📍", text: "No LocalSpot" },
    { emoji: "☕", text: "Num café" },
    { emoji: "🎉", text: "Pronto para sair" },
    { emoji: "📚", text: "A estudar" },
    { emoji: "🎧", text: "A ouvir música" },
    { emoji: "🏃", text: "A treinar" },
    { emoji: "🍔", text: "A almoçar/jantar" },
    { emoji: "🏠", text: "Em casa" }
];

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
// INJEÇÃO SEGURA DA UI SOCIAL (BUMP)
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

    // 2. Botão Modo Fantasma nos controlos do mapa
    const mapCtrls = document.querySelector(".map-floating-controls");
    if (mapCtrls && !$("ghostModeMapBtn")) {
        const ghostBtn = document.createElement("button");
        ghostBtn.type = "button";
        ghostBtn.id = "ghostModeMapBtn";
        ghostBtn.className = "map-ctrl-btn hidden";
        ghostBtn.textContent = "📍 Visível";
        mapCtrls.appendChild(ghostBtn);
    }

    // 3. Campos de Foto de Perfil, Estado/Mood e Modo Fantasma no Modal de Perfil
    const profileForm = $("profileUpdateForm");
    if (profileForm && !$("profileAvatarBox")) {
        const avatarSection = document.createElement("div");
        avatarSection.id = "profileAvatarBox";
        avatarSection.style.marginBottom = "12px";
        avatarSection.innerHTML = `
            <div style="display:flex; align-items:center; gap:14px; margin-bottom:12px;">
                <div id="profileAvatarPreview" class="avatar-circle lg">?</div>
                <div style="flex:1;">
                    <label for="profileAvatarInput" style="margin:0 0 6px;">Foto de Perfil</label>
                    <input type="file" id="profileAvatarInput" accept="image/*" style="padding:6px; font-size:12px;">
                </div>
            </div>
            <label>Estado atual (visível no mapa para amigos)</label>
            <div id="statusPillsContainer" class="status-pills-grid">
                ${BUMP_STATUSES.map(s => `<button type="button" class="status-pill-btn" data-emoji="${s.emoji}" data-text="${s.text}">${s.emoji} ${s.text}</button>`).join("")}
            </div>
            <div class="ghost-toggle-bar">
                <div>
                    <strong style="font-size:13px; display:block;">👻 Modo Fantasma</strong>
                    <span style="font-size:11.5px; color:var(--muted);">Oculta a tua localização ao vivo no mapa</span>
                </div>
                <input type="checkbox" id="profileGhostCheckbox" style="width:18px; height:18px; margin:0; cursor:pointer;">
            </div>
        `;
        profileForm.insertBefore(avatarSection, profileForm.firstChild);
    }

    // 4. Modal de Amigos & Social estilo Bump
    if (!$("friendsModal")) {
        const fModal = document.createElement("div");
        fModal.id = "friendsModal";
        fModal.className = "modal hidden";
        fModal.setAttribute("aria-hidden", "true");
        fModal.innerHTML = `
            <div class="modal-content">
                <button type="button" id="closeFriendsModal" class="close-button" aria-label="Fechar">&times;</button>
                <h2 style="margin:0 0 4px;">👊 Social & Amigos</h2>
                <p style="color:var(--muted); font-size:13px; margin:0 0 14px;">Vê onde estão os teus amigos, envia Bumps e descobre a que eventos vão.</p>
                
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

    const ghostMapBtn = $("ghostModeMapBtn");
    if (ghostMapBtn && !ghostMapBtn.dataset.bound) {
        ghostMapBtn.dataset.bound = "1";
        ghostMapBtn.addEventListener("click", () => toggleGhostMode());
    }

    const statusContainer = $("statusPillsContainer");
    if (statusContainer && !statusContainer.dataset.bound) {
        statusContainer.dataset.bound = "1";
        statusContainer.addEventListener("click", e => {
            const btn = e.target.closest(".status-pill-btn");
            if (!btn) return;
            statusContainer.querySelectorAll(".status-pill-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            if (currentProfile) {
                currentProfile.status_emoji = btn.dataset.emoji;
                currentProfile.status_text = btn.dataset.text;
            }
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
    regNameInput.placeholder = isBusiness ? "Ex: Café Central / Ginásio Fit" : "Ex: João Silva";
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
            await handleAuthenticatedSession(data.user);
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
                business_type: businessType
            });

            await handleAuthenticatedSession(data.user);
            showToast(`Bem-vindo ao LocalSpot, ${fullName}!`, "success");
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
    if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
    currentUser = null;
    currentProfile = null;
    myEnrollments.clear();
    myFollowing.clear();
    window.friendsList = [];
    if (typeof showFriendsOnMap === "function") showFriendsOnMap([]);
    if ($("friendsNavBtn")) $("friendsNavBtn").classList.add("hidden");
    if ($("ghostModeMapBtn")) $("ghostModeMapBtn").classList.add("hidden");
    notifBtn.classList.add("hidden");
    userBadge.classList.add("hidden");
    adminPanelBtn.classList.add("hidden");
    logoutButton.classList.add("hidden");
    authOverlay.classList.remove("hidden");
    showToast("Sessão terminada.");
});

async function handleAuthenticatedSession(user) {
    currentUser = user;
    const meta = user.user_metadata || {};
    let profile = null;

    try {
        const { data } = await supabaseClient.from("profiles").select("*").eq("id", user.id).maybeSingle();
        profile = data;
        if (!profile) {
            const newProfile = {
                id: user.id,
                email: user.email,
                full_name: meta.full_name || user.email.split("@")[0],
                role: meta.role || "user",
                business_type: meta.business_type || null
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
            business_type: meta.business_type || null
        };
    }

    currentProfile = profile;
    applyRoleUI();
    authOverlay.classList.add("hidden");
    if (typeof map !== "undefined") map.resize();

    await Promise.all([
        loadMyEnrollments(),
        loadAllEnrollmentsSummary(),
        loadMyFollowing(),
        loadNotifications(),
        loadSocialData()
    ]);
    await loadEventsFromSupabase();
    startLiveSocialSync();
    checkSharedEventUrl();
}

function renderAvatarChip(profile, sizeClass = "sm") {
    if (profile?.avatar_url) {
        return `<span class="avatar-circle ${sizeClass}"><img src="${escapeHTML(profile.avatar_url)}" alt="" onerror="this.remove()"></span>`;
    }
    const initials = (profile?.full_name || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join("");
    return `<span class="avatar-circle ${sizeClass}">${escapeHTML(initials)}</span>`;
}

function applyRoleUI() {
    if (!currentProfile) return;
    const { role, full_name, business_type, ghost_mode } = currentProfile;

    if ($("friendsNavBtn")) $("friendsNavBtn").classList.remove("hidden");
    if ($("ghostModeMapBtn")) {
        const gBtn = $("ghostModeMapBtn");
        gBtn.classList.remove("hidden");
        gBtn.classList.toggle("ghost-on", !!ghost_mode);
        gBtn.textContent = ghost_mode ? "👻 Modo Fantasma" : "📍 Visível";
    }

    notifBtn.classList.remove("hidden");
    logoutButton.classList.remove("hidden");
    userBadge.classList.remove("hidden");

    const avatarHtml = renderAvatarChip(currentProfile, "sm");

    if (role === "admin") {
        userBadge.innerHTML = `${avatarHtml} <span>🛡️ ${escapeHTML(full_name)}</span>`;
        adminPanelBtn.classList.remove("hidden");
    } else if (role === "business") {
        const tipo = business_type || "Empresa";
        userBadge.innerHTML = `${avatarHtml} <span>🏢 ${escapeHTML(tipo)} · ${escapeHTML(full_name)}</span>`;
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
            await handleAuthenticatedSession(session.user);
        } else {
            authOverlay.classList.remove("hidden");
        }
    } catch (e) {
        authOverlay.classList.remove("hidden");
    }
}

// ==========================================
// SISTEMA SOCIAL ESTILO BUMP (AMIGOS, LOCALIZAÇÃO AO VIVO, BUMPS)
// ==========================================
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

        rows.forEach(r => {
            if (r.status === "accepted") {
                const otherId = r.requester_id === currentUser.id ? r.addressee_id : r.requester_id;
                acceptedIds.add(otherId);
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
            .map(id => profilesById.get(id))
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
    const reqCount = incomingFriendRequests.length;
    const navBadge = $("friendsReqBadge");
    if (navBadge) {
        navBadge.textContent = reqCount;
        navBadge.classList.toggle("hidden", reqCount === 0);
    }
    if ($("friendsTabCount")) $("friendsTabCount").textContent = window.friendsList.length;
    if ($("requestsTabCount")) $("requestsTabCount").textContent = reqCount;
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
        const hasLocation = !f.ghost_mode && typeof f.last_lat === "number" && typeof f.last_lng === "number";
        const statusStr = f.ghost_mode
            ? "👻 Modo Fantasma"
            : `${f.status_emoji || "📍"} ${escapeHTML(f.status_text || "No LocalSpot")}`;

        return `
            <div class="friend-row">
                <div class="friend-row-left">
                    ${renderAvatarChip(f, "")}
                    <div class="friend-row-info">
                        <strong>${escapeHTML(f.full_name)}</strong>
                        <span>${statusStr}</span>
                    </div>
                </div>
                <div class="friend-row-actions">
                    <button type="button" class="btn-bump" onclick="window.sendBump('${f.id}', '👊', 'Bump!')" title="Enviar Bump">👊 Bump</button>
                    ${hasLocation ? `<button type="button" class="btn-soft" onclick="window.locateFriendOnMap('${f.id}')" title="Ver no mapa">📍</button>` : ""}
                    <button type="button" class="btn-logout" onclick="window.removeFriend('${f.id}', '${escapeHTML(f.full_name)}')" title="Remover amigo">×</button>
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
            actionBtn = `<span class="category">✓ Amigos</span>`;
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
                        <span>${escapeHTML(u.email)}</span>
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
        showToast("Localização do amigo indisponível.");
    }
};

// Animação e Envio de BUMP!
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

window.sendBump = async (friendId, emoji = "👊", label = "Bump!") => {
    if (!currentUser || !currentProfile) return;
    const friend = window.friendsList.find(f => String(f.id) === String(friendId));
    const targetName = friend ? friend.full_name : "amigo";

    triggerBumpVisual(emoji, `${emoji} ${label} para ${targetName}!`);

    await createNotification(
        friendId,
        null,
        `${emoji} ${currentProfile.full_name} enviou-te um ${label}`,
        `Abre o mapa para ver onde ${currentProfile.full_name} está agora!`
    );
};

// Sincronização de Localização ao Vivo & Modo Fantasma
window.syncMyLiveLocation = async (lat, lng) => {
    if (!currentUser || !currentProfile || currentProfile.ghost_mode) return;
    try {
        await supabaseClient.from("profiles").update({
            last_lat: lat,
            last_lng: lng,
            last_seen: new Date().toISOString()
        }).eq("id", currentUser.id);
    } catch (e) {}
};

async function toggleGhostMode(forceValue = null) {
    if (!currentUser || !currentProfile) return;
    const nextGhost = forceValue !== null ? forceValue : !currentProfile.ghost_mode;

    const updatePayload = { ghost_mode: nextGhost };
    if (nextGhost) {
        updatePayload.last_lat = null;
        updatePayload.last_lng = null;
    } else if (userPosition) {
        updatePayload.last_lat = userPosition.lat;
        updatePayload.last_lng = userPosition.lng;
        updatePayload.last_seen = new Date().toISOString();
    }

    const { error } = await supabaseClient.from("profiles").update(updatePayload).eq("id", currentUser.id);
    if (error) {
        showToast("Erro ao alterar Modo Fantasma.", "error");
        return;
    }

    currentProfile.ghost_mode = nextGhost;
    if ($("profileGhostCheckbox")) $("profileGhostCheckbox").checked = nextGhost;
    applyRoleUI();

    if (nextGhost) {
        showToast("👻 Modo Fantasma ativo — estás invisível no mapa.");
    } else {
        showToast("📍 Estás visível para os teus amigos!", "success");
        if (!userPosition) {
            try { await locateUser(); } catch (e) {}
        }
    }
}

function startLiveSocialSync() {
    if (locationSyncInterval) clearInterval(locationSyncInterval);

    if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: "geolocation" }).then(res => {
            if (res.state === "granted" && !currentProfile?.ghost_mode) {
                navigator.geolocation.getCurrentPosition(pos => {
                    userPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    window.syncMyLiveLocation(userPosition.lat, userPosition.lng);
                });
            }
        }).catch(() => {});
    }

    locationSyncInterval = setInterval(async () => {
        if (!currentUser) return;
        await loadSocialData();
        if (userPosition && !currentProfile?.ghost_mode) {
            await window.syncMyLiveLocation(userPosition.lat, userPosition.lng);
        }
    }, 30000);

    // Subscrição Realtime para receber Bumps e Pedidos na hora
    if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = supabaseClient
        .channel(`social_${currentUser.id}`)
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
                if (notif.title && (notif.title.includes("Bump") || notif.title.includes("Acenou"))) {
                    triggerBumpVisual("👊", notif.title);
                } else {
                    showToast(notif.title, "success");
                }
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
    } else if ($("friendsModal")) {
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
// MODAL DE PERFIL ("A MINHA CONTA" + FOTO + ESTADO + MODO FANTASMA)
// ==========================================
userBadge.addEventListener("click", () => {
    if (!currentProfile) return;
    ensureSocialUI();
    $("profileEmailDisplay").textContent = currentProfile.email;
    $("profileNameInput").value = currentProfile.full_name;
    $("profileBioInput").value = currentProfile.bio || "";

    if ($("profileAvatarPreview")) {
        $("profileAvatarPreview").innerHTML = currentProfile.avatar_url
            ? `<img src="${escapeHTML(currentProfile.avatar_url)}" alt="">`
            : escapeHTML((currentProfile.full_name || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join(""));
    }
    if ($("profileAvatarInput")) $("profileAvatarInput").value = "";
    if ($("profileGhostCheckbox")) $("profileGhostCheckbox").checked = !!currentProfile.ghost_mode;

    if ($("statusPillsContainer")) {
        const curEmoji = currentProfile.status_emoji || "📍";
        const curText = currentProfile.status_text || "No LocalSpot";
        $("statusPillsContainer").querySelectorAll(".status-pill-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.emoji === curEmoji && btn.dataset.text === curText);
        });
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

    let avatarUrl = currentProfile.avatar_url || null;
    const avatarFile = $("profileAvatarInput")?.files?.[0];
    if (avatarFile) {
        avatarUrl = await uploadAvatarImage(avatarFile);
    }

    const ghostMode = $("profileGhostCheckbox") ? $("profileGhostCheckbox").checked : !!currentProfile.ghost_mode;
    const statusEmoji = currentProfile.status_emoji || "📍";
    const statusText = currentProfile.status_text || "No LocalSpot";

    const updateObj = {
        full_name: newName,
        bio: newBio,
        avatar_url: avatarUrl,
        status_emoji: statusEmoji,
        status_text: statusText,
        ghost_mode: ghostMode
    };

    if (ghostMode) {
        updateObj.last_lat = null;
        updateObj.last_lng = null;
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
    showToast("Perfil atualizado com sucesso!", "success");
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
        listEl.innerHTML = `<p class="muted" style="font-size:12.5px;">Ainda sem avaliações.</p>`;
        return;
    }

    const avg = (data.reduce((s, r) => s + r.rating, 0) / data.length).toFixed(1);
    ratingBadge.textContent = `⭐ ${avg} (${data.length})`;
    ratingBadge.classList.remove("hidden");

    listEl.innerHTML = data.map(r => `
        <div class="comment-item">
            <div class="comment-head">
                <strong>${escapeHTML(r.user_name)}</strong>
                <span>${"⭐".repeat(r.rating)}</span>
            </div>
            ${r.comment ? `<p>${escapeHTML(r.comment)}</p>` : ""}
        </div>
    `).join("");
}

$("reviewForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!currentUser || !currentProfile || !detailEventId) return;

    const rating = Number($("reviewRating").value);
    const comment = $("reviewText").value.trim();

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

    $("reviewText").value = "";
    await loadEventReviews(detailEventId);
    showToast("Avaliação registada!", "success");
});

// ---------- Inscritos e Comentários (com destaque para Amigos) ----------
async function loadEventAttendees(ev) {
    const listEl = $("detailAttendeesList");
    const countEl = $("detailAttendeesCount");
    countEl.textContent = ev.enrolled || 0;
    listEl.innerHTML = `<span class="muted" style="font-size:12px;">A carregar inscritos...</span>`;

    const { data, error } = await supabaseClient
        .from("enrollments")
        .select("user_id, user_name")
        .eq("event_id", ev.id)
        .order("created_at", { ascending: true });

    if (error || !data || data.length === 0) {
        listEl.innerHTML = (ev.enrolled || 0) > 0
            ? `<span class="attendee-pill">👥 ${ev.enrolled} participantes confirmados</span>`
            : `<span class="muted" style="font-size:12.5px;">Sê o primeiro a inscrever-te neste evento.</span>`;
        return;
    }

    const friendMap = new Map(window.friendsList.map(f => [String(f.id), f]));
    countEl.textContent = Math.max(data.length, ev.enrolled || 0);

    listEl.innerHTML = data.map(row => {
        const friendObj = friendMap.get(String(row.user_id));
        if (friendObj) {
            return `<span class="attendee-pill friend-attendee">${renderAvatarChip(friendObj, "sm")} 👊 ${escapeHTML(row.user_name)} (Amigo)</span>`;
        }
        return `<span class="attendee-pill">👤 ${escapeHTML(row.user_name)}</span>`;
    }).join("");
}

async function loadEventComments(eventId) {
    const listEl = $("detailCommentsList");
    listEl.innerHTML = `<p class="muted" style="font-size:12px;">A carregar comentários...</p>`;

    const { data, error } = await supabaseClient
        .from("comments")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

    if (error || !data || data.length === 0) {
        listEl.innerHTML = `<p class="muted" style="font-size:12.5px;">Ainda ninguém comentou. Deixa a primeira mensagem!</p>`;
        return;
    }

    listEl.innerHTML = data.map(c => {
        const canDel = currentProfile && (currentProfile.role === "admin" || c.user_id === currentProfile.id);
        const dateStr = new Date(c.created_at).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
        return `
            <div class="comment-item">
                <div class="comment-head">
                    <strong>${escapeHTML(c.user_name)}</strong>
                    <span class="muted">${dateStr} ${canDel ? `<button type="button" class="delete-btn" style="margin:0 0 0 6px;" onclick="window.deleteComment(${c.id})">×</button>` : ""}</span>
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
        user_role: currentProfile.role,
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
            `Novo comentário em "${ev.name}"`,
            `${currentProfile.full_name}: ${content}`
        );
    }

    input.value = "";
    await loadEventComments(detailEventId);
    showToast("Comentário publicado!", "success");
});

window.deleteComment = async commentId => {
    const { error } = await supabaseClient.from("comments").delete().eq("id", commentId);
    if (!error && detailEventId) {
        await loadEventComments(detailEventId);
        showToast("Comentário removido.");
    }
};

// ---------- Event Listeners de Filtros ----------
let searchTimer;
searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.search = searchInput.value; filterEvents(); }, 150);
});

categoryChips.addEventListener("click", e => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    state.category = chip.dataset.category;
    categoryChips.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c === chip));
    filterEvents({ fit: true });
});

districtFilter.addEventListener("change", () => { state.district = districtFilter.value; filterEvents({ fit: true }); });
periodFilter.addEventListener("change", () => { state.period = periodFilter.value; filterEvents({ fit: true }); });

radiusSlider.addEventListener("input", async () => {
    const val = Number(radiusSlider.value);
    state.radius = val;
    radiusValue.textContent = val >= 100 ? "Sem limite" : `${val} km`;

    if (val < 100 && !userPosition) {
        try { await locateUser(); } catch (err) { showToast("Ativa a localização para usar o raio.", "error"); }
    }
    filterEvents({ fit: true });
});

sortFilter.addEventListener("change", async () => {
    state.sort = sortFilter.value;
    if (state.sort === "distance" && !userPosition) {
        try {
            await locateUser();
        } catch (err) {
            showToast(err.message, "error");
            state.sort = "date";
            sortFilter.value = "date";
        }
    }
    filterEvents();
});

favoritesToggle.addEventListener("click", () => {
    state.onlyFavorites = !state.onlyFavorites;
    favoritesToggle.setAttribute("aria-pressed", state.onlyFavorites);
    favoritesToggle.classList.toggle("on", state.onlyFavorites);
    favoritesToggle.textContent = state.onlyFavorites ? "★ Favoritos" : "☆ Favoritos";
    filterEvents({ fit: true });
});

freeOnlyToggle.addEventListener("click", () => {
    state.onlyFree = !state.onlyFree;
    freeOnlyToggle.setAttribute("aria-pressed", state.onlyFree);
    freeOnlyToggle.classList.toggle("on", state.onlyFree);
    filterEvents({ fit: true });
});

followingOnlyToggle.addEventListener("click", () => {
    state.onlyFollowing = !state.onlyFollowing;
    followingOnlyToggle.setAttribute("aria-pressed", state.onlyFollowing);
    followingOnlyToggle.classList.toggle("on", state.onlyFollowing);
    filterEvents({ fit: true });
});

resetFiltersBtn.addEventListener("click", () => {
    Object.assign(state, {
        search: "", category: "all", district: "all", period: "all",
        radius: 100, onlyFavorites: false, onlyFree: false, onlyFollowing: false
    });
    searchInput.value = "";
    districtFilter.value = "all";
    periodFilter.value = "all";
    radiusSlider.value = 100;
    radiusValue.textContent = "Sem limite";
    favoritesToggle.classList.remove("on");
    favoritesToggle.textContent = "☆ Favoritos";
    freeOnlyToggle.classList.remove("on");
    followingOnlyToggle.classList.remove("on");
    categoryChips.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c.dataset.category === "all"));
    filterEvents({ fit: true });
});

locationButton.addEventListener("click", async () => {
    locationButton.disabled = true;
    try {
        await locateUser();
        state.sort = "distance";
        sortFilter.value = "distance";
        filterEvents();
        showToast("Localização atualizada e eventos ordenados por distância.");
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        locationButton.disabled = false;
    }
});

// ==========================================
// MODAIS, CRIAÇÃO, EDIÇÃO E DUPLICAÇÃO DE EVENTOS
// ==========================================
function openModal(el) {
    el.classList.remove("hidden");
    el.setAttribute("aria-hidden", "false");
    const focusable = el.querySelector("input, select, textarea, button");
    if (focusable) setTimeout(() => focusable.focus(), 50);
}

function closeModalEl(el) {
    el.classList.add("hidden");
    el.setAttribute("aria-hidden", "true");
}

function closeEventModal() {
    closeModalEl(modal);
}

function resetEventForm() {
    eventForm.reset();
    editingEventId = null;
    $("eventModalTitle").textContent = "Adicionar evento";
    $("eventSubmitBtn").textContent = "Publicar evento";
    imagePreview.classList.add("hidden");
    imagePreview.removeAttribute("src");
    formError.classList.add("hidden");
    pendingLocation = null;
    clearTempMarker();
    coordsText.textContent = "📍 Nenhuma localização selecionada no mapa";
    coordsText.classList.remove("ok");
}

function populateEventForm(ev, isEdit) {
    editingEventId = isEdit ? ev.id : null;
    $("eventModalTitle").textContent = isEdit ? "Editar evento" : "Duplicar evento";
    $("eventSubmitBtn").textContent = isEdit ? "Guardar alterações" : "Publicar novo evento";

    $("eventName").value = ev.name;
    $("eventDescription").value = ev.description || "";
    $("eventCategory").value = ev.category;
    $("eventPrice").value = ev.price || "Gratuito";
    $("eventDate").value = isEdit ? ev.date : "";
    $("eventTime").value = ev.time;
    $("eventLocation").value = ev.location;
    $("eventFormDistrict").value = ev.distrito;
    $("eventLimit").value = ev.maxParticipants || "";
    $("eventExternalUrl").value = ev.externalUrl || "";

    pendingLocation = { lat: ev.latitude, lng: ev.longitude };
    setTempMarker(pendingLocation);
    coordsText.textContent = `📍 Local (${ev.latitude.toFixed(4)}, ${ev.longitude.toFixed(4)})`;
    coordsText.classList.add("ok");

    if (ev.image && ev.image !== DEFAULT_IMAGE) {
        imagePreview.src = ev.image;
        imagePreview.classList.remove("hidden");
    } else {
        imagePreview.classList.add("hidden");
    }

    formError.classList.add("hidden");
    openModal(modal);
}

function startEditEvent(id) {
    const ev = events.find(x => String(x.id) === String(id));
    if (ev && canManageEvent(ev)) populateEventForm(ev, true);
}

function startDuplicateEvent(id) {
    const ev = events.find(x => String(x.id) === String(id));
    if (ev) populateEventForm(ev, false);
}

window.startEditEvent = startEditEvent;

closeModal.addEventListener("click", () => { closeEventModal(); resetEventForm(); });
modal.addEventListener("mousedown", e => { if (e.target === modal) { closeEventModal(); resetEventForm(); } });

$("aboutButton").addEventListener("click", () => openModal(aboutModal));
$("closeAbout").addEventListener("click", () => closeModalEl(aboutModal));
aboutModal.addEventListener("mousedown", e => { if (e.target === aboutModal) closeModalEl(aboutModal); });

document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if ($("friendsModal") && !$("friendsModal").classList.contains("hidden")) closeModalEl($("friendsModal"));
    else if (!reportModal.classList.contains("hidden")) closeModalEl(reportModal);
    else if (!ticketModal.classList.contains("hidden")) closeModalEl(ticketModal);
    else if (!modal.classList.contains("hidden")) { closeEventModal(); resetEventForm(); }
    else if (!detailModal.classList.contains("hidden")) closeModalEl(detailModal);
    else if (!profileModal.classList.contains("hidden")) closeModalEl(profileModal);
    else if (!aboutModal.classList.contains("hidden")) closeModalEl(aboutModal);
    else if (!adminModal.classList.contains("hidden")) closeModalEl(adminModal);
    else if (!pickBanner.classList.contains("hidden")) stopPicking();
});

// Pesquisa de morada durante escolha no mapa
async function searchAddressOnMap() {
    const query = $("pickAddressInput").value.trim();
    if (!query) return;

    const btn = $("pickAddressBtn");
    btn.disabled = true;
    btn.textContent = "...";

    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=pt&limit=1&q=${encodeURIComponent(query)}`);
        const results = await res.json();
        if (results && results.length > 0) {
            flyToCoordinates(parseFloat(results[0].lon), parseFloat(results[0].lat), 16);
            showToast("Local encontrado! Clica no ponto exato do mapa.");
        } else {
            showToast("Morada não encontrada em Portugal.", "error");
        }
    } catch (e) {
        showToast("Erro ao pesquisar morada.", "error");
    } finally {
        btn.disabled = false;
        btn.textContent = "Ir";
    }
}

$("pickAddressBtn").addEventListener("click", searchAddressOnMap);
$("pickAddressInput").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); searchAddressOnMap(); }
});

function startPicking() {
    closeEventModal();
    if (window.innerWidth <= 820) setMobileView("map");
    pickBanner.classList.remove("hidden");
    $("pickAddressInput").focus();

    pickLocation(latlng => {
        pickBanner.classList.add("hidden");
        pendingLocation = { lat: latlng.lat, lng: latlng.lng };
        setTempMarker(latlng);
        coordsText.textContent = `📍 Local escolhido (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`;
        coordsText.classList.add("ok");
        const district = $("eventFormDistrict");
        if (!district.value) district.value = nearestDistrict(latlng.lat, latlng.lng);
        openModal(modal);
    });
}

function stopPicking() {
    cancelPick();
    pickBanner.classList.add("hidden");
}

addEventButton.addEventListener("click", () => {
    if (!currentProfile) return;
    resetEventForm();
    startPicking();
});

changeLocationButton.addEventListener("click", startPicking);
$("cancelPick").addEventListener("click", () => {
    stopPicking();
    if (pendingLocation || editingEventId) openModal(modal);
});

eventImageInput.addEventListener("change", () => {
    const file = eventImageInput.files[0];
    if (!file) { imagePreview.classList.add("hidden"); return; }
    imagePreview.src = URL.createObjectURL(file);
    imagePreview.classList.remove("hidden");
});

function resizeImageToBlob(file, maxSize = 900) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error("Ficheiro de imagem inválido."));
            img.onload = () => {
                const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
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

async function uploadOrEncodeEventImage(file) {
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

function showFormError(message) {
    formError.textContent = message;
    formError.classList.remove("hidden");
}

eventForm.addEventListener("submit", async e => {
    e.preventDefault();
    formError.classList.add("hidden");

    if (!currentProfile) {
        showFormError("Inicia sessão para publicar eventos.");
        return;
    }
    if (!pendingLocation) {
        showFormError("Escolhe primeiro a localização no mapa.");
        return;
    }
    if (!eventForm.checkValidity()) {
        eventForm.reportValidity();
        return;
    }

    const submitBtn = $("eventSubmitBtn");
    submitBtn.disabled = true;
    submitBtn.textContent = "A guardar...";

    try {
        const existingEvent = editingEventId
            ? events.find(x => String(x.id) === String(editingEventId))
            : null;

        let image = existingEvent ? existingEvent.image : DEFAULT_IMAGE;
        const file = eventImageInput.files[0];
        if (file) {
            image = await uploadOrEncodeEventImage(file);
        }

        const maxPInput = $("eventLimit").value;
        const maxParticipants = maxPInput ? parseInt(maxPInput, 10) : null;
        const priceVal = $("eventPrice").value.trim() || "Gratuito";
        const extUrlVal = sanitizeUrl($("eventExternalUrl").value);

        if (editingEventId) {
            const updatedData = {
                name: $("eventName").value.trim(),
                description: $("eventDescription").value.trim(),
                category: $("eventCategory").value,
                date: $("eventDate").value,
                time: $("eventTime").value,
                location: $("eventLocation").value.trim(),
                distrito: $("eventFormDistrict").value,
                latitude: pendingLocation.lat,
                longitude: pendingLocation.lng,
                image,
                max_participants: maxParticipants,
                price: priceVal,
                external_url: extUrlVal
            };

            const { error } = await supabaseClient.from("events").update(updatedData).eq("id", editingEventId);
            if (error) {
                showFormError("Erro ao guardar alterações do evento.");
                return;
            }

            const editedId = editingEventId;
            closeEventModal();
            resetEventForm();
            await loadEventsFromSupabase();
            setActive(editedId);
            focusEvent(editedId);
            showToast("Evento atualizado com sucesso!", "success");
            return;
        }

        const creatorType = currentProfile.role === "admin"
            ? "Admin"
            : (currentProfile.role === "business" ? (currentProfile.business_type || "Empresa") : "Utilizador");

        const newEventData = {
            name: $("eventName").value.trim(),
            description: $("eventDescription").value.trim(),
            category: $("eventCategory").value,
            date: $("eventDate").value,
            time: $("eventTime").value,
            location: $("eventLocation").value.trim(),
            distrito: $("eventFormDistrict").value,
            latitude: pendingLocation.lat,
            longitude: pendingLocation.lng,
            image,
            max_participants: maxParticipants,
            enrolled: 0,
            price: priceVal,
            external_url: extUrlVal,
            creator_id: currentProfile.id,
            creator_name: currentProfile.full_name,
            creator_type: creatorType
        };

        const { data, error } = await supabaseClient.from("events").insert([newEventData]).select();
        if (error) {
            showFormError("Erro ao publicar o evento na base de dados.");
            return;
        }

        closeEventModal();
        resetEventForm();
        await loadEventsFromSupabase();

        if (data && data[0]) {
            setActive(data[0].id);
            focusEvent(data[0].id);
        }
        showToast("Evento publicado com sucesso!", "success");
    } catch (err) {
        showFormError(err.message || "Erro inesperado ao processar o evento.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = editingEventId ? "Guardar alterações" : "Publicar evento";
    }
});

// Arranque
setupControls();
initAuth();
