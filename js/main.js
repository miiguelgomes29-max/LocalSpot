// ==========================================
// CONFIGURAÇÃO SUPABASE E LÓGICA DA APLICAÇÃO
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

// Elementos do Cabeçalho e Perfil
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
const resetFiltersBtn = $("resetFilters");
const eventsList = $("eventsList");
const eventCount = $("eventCount");
const emptyState = $("emptyState");
const locationButton = $("locationButton");

// Elementos dos Modais de Evento
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
const state = { search: "", category: "all", district: "all", period: "all", radius: 100, sort: "date", onlyFavorites: false };
let currentUser = null;
let currentProfile = null;
let favorites = new Set(loadJSON(STORAGE_FAVS, []).map(String));
let myEnrollments = new Set();
let activeId = null;
let pendingLocation = null;
let editingEventId = null;
let detailEventId = null;
let currentList = [];

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

    if (msg.includes("invalid login credentials")) {
        return "E-mail ou palavra-passe incorretos (ou a conta ainda não foi criada).";
    }
    if (msg.includes("email not confirmed")) {
        return "Conta criada, mas o e-mail ainda não foi confirmado. Desativa «Confirm email» no Supabase.";
    }
    if (msg.includes("user already registered") || msg.includes("already been registered")) {
        return "Este e-mail já está registado. Muda para o separador «Entrar».";
    }
    if (msg.includes("password should be at least")) {
        return "A palavra-passe tem de ter pelo menos 6 caracteres.";
    }
    if (msg.includes("rate limit") || msg.includes("too many requests")) {
        return "Muitas tentativas seguidas. Aguarda alguns minutos e tenta novamente.";
    }
    if (msg.includes("database error saving new user")) {
        return "Erro na tabela profiles do Supabase. Verifica o script SQL no SQL Editor.";
    }
    return error.message;
}

// ==========================================
// ALTERNAR VISTA MOBILE (LISTA / MAPA)
// ==========================================
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

// Login
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

// Registo
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
            options: {
                data: {
                    full_name: fullName,
                    role: role,
                    business_type: businessType
                }
            }
        });

        if (error) {
            errEl.textContent = translateAuthError(error);
            errEl.classList.remove("hidden");
            return;
        }

        if (data?.user) {
            if (!data.session) {
                errEl.textContent = "Conta criada! Desativa «Confirm email» em Authentication > Sign In / Providers no Supabase para entrar de imediato.";
                errEl.classList.remove("hidden");
                return;
            }

            await supabaseClient.from("profiles").upsert({
                id: data.user.id,
                email: email,
                full_name: fullName,
                role: role,
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

// Terminar Sessão
logoutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    currentUser = null;
    currentProfile = null;
    myEnrollments.clear();
    userBadge.classList.add("hidden");
    adminPanelBtn.classList.add("hidden");
    logoutButton.classList.add("hidden");
    authOverlay.classList.remove("hidden");
    showToast("Sessão terminada.");
});

// Carregar Perfil e Permissões
async function handleAuthenticatedSession(user) {
    currentUser = user;
    const meta = user.user_metadata || {};
    let profile = null;

    try {
        const { data } = await supabaseClient
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

        profile = data;

        if (!profile) {
            const newProfile = {
                id: user.id,
                email: user.email,
                full_name: meta.full_name || user.email.split("@")[0],
                role: meta.role || "user",
                business_type: meta.business_type || null
            };
            const { data: inserted } = await supabaseClient
                .from("profiles")
                .upsert(newProfile)
                .select()
                .maybeSingle();

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

    await loadMyEnrollments();
    await loadEventsFromSupabase();
    checkSharedEventUrl();
}

function applyRoleUI() {
    if (!currentProfile) return;
    const { role, full_name, business_type } = currentProfile;

    logoutButton.classList.remove("hidden");
    userBadge.classList.remove("hidden");

    if (role === "admin") {
        userBadge.textContent = `🛡️ ${full_name}`;
        adminPanelBtn.classList.remove("hidden");
    } else if (role === "business") {
        const tipo = business_type || "Empresa";
        userBadge.textContent = `🏢 ${tipo} · ${full_name}`;
        adminPanelBtn.classList.add("hidden");
    } else {
        userBadge.textContent = `👤 ${full_name}`;
        adminPanelBtn.classList.add("hidden");
    }
}

async function initAuth() {
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
// MODAL DE PERFIL ("A MINHA CONTA")
// ==========================================
userBadge.addEventListener("click", () => {
    if (!currentProfile) return;
    $("profileEmailDisplay").textContent = currentProfile.email;
    $("profileNameInput").value = currentProfile.full_name;
    renderProfileLists();
    openModal(profileModal);
});

$("closeProfile").addEventListener("click", () => closeModalEl(profileModal));
profileModal.addEventListener("mousedown", e => { if (e.target === profileModal) closeModalEl(profileModal); });

$("tabMyEnrollments").addEventListener("click", () => {
    $("tabMyEnrollments").classList.add("active");
    $("tabMyCreated").classList.remove("active");
    $("profileEnrolledList").classList.remove("hidden");
    $("profileCreatedList").classList.add("hidden");
});

$("tabMyCreated").addEventListener("click", () => {
    $("tabMyCreated").classList.add("active");
    $("tabMyEnrollments").classList.remove("active");
    $("profileCreatedList").classList.remove("hidden");
    $("profileEnrolledList").classList.add("hidden");
});

$("profileUpdateForm").addEventListener("submit", async e => {
    e.preventDefault();
    const newName = $("profileNameInput").value.trim();
    if (!newName || !currentProfile) return;

    const { error } = await supabaseClient
        .from("profiles")
        .update({ full_name: newName })
        .eq("id", currentProfile.id);

    if (error) {
        showToast("Erro ao atualizar o nome do perfil.", "error");
        return;
    }

    currentProfile.full_name = newName;
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
                <button type="button" class="btn-soft" onclick="closeModalEl(profileModal); window.openEventDetails('${ev.id}')">Abrir</button>
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
}

// ==========================================
// PAINEL DE ADMINISTRAÇÃO
// ==========================================
adminPanelBtn.addEventListener("click", async () => {
    if (currentProfile?.role !== "admin") return;
    openModal(adminModal);
    await loadAdminDashboard();
});

$("closeAdmin").addEventListener("click", () => closeModalEl(adminModal));
adminModal.addEventListener("mousedown", e => { if (e.target === adminModal) closeModalEl(adminModal); });

async function loadAdminDashboard() {
    const listEl = $("adminUsersList");
    listEl.innerHTML = `<p class="muted">A carregar utilizadores...</p>`;

    const { data: users, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        listEl.innerHTML = `<p class="form-error">Erro ao carregar utilizadores.</p>`;
        return;
    }

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

$("adminUsersList").addEventListener("change", async e => {
    const select = e.target.closest(".admin-role-select");
    if (!select) return;

    const userId = select.dataset.userId;
    const newRole = select.value;

    const { error } = await supabaseClient
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);

    if (error) {
        showToast("Erro ao atualizar cargo do utilizador.", "error");
        return;
    }

    showToast("Permissões atualizadas com sucesso!", "success");
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

async function loadEventsFromSupabase() {
    let { data, error } = await supabaseClient
        .from("events")
        .select("*");

    if (error) {
        console.error(error);
        events.length = 0;
        INITIAL_EVENTS.forEach((item, idx) => events.push(mapDbEvent(item, idx)));
        filterEvents({ fit: true });
        return;
    }

    if ((!data || data.length === 0) && INITIAL_EVENTS.length > 0 && !localStorage.getItem("localspot_seeded")) {
        localStorage.setItem("localspot_seeded", "1");
        const { data: seeded } = await supabaseClient
            .from("events")
            .insert(INITIAL_EVENTS)
            .select();
        if (seeded && seeded.length > 0) {
            data = seeded;
        }
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
        const { error: delErr } = await supabaseClient
            .from("enrollments")
            .delete()
            .eq("event_id", ev.id)
            .eq("user_id", currentUser.id);

        if (delErr) {
            console.warn("Tabela enrollments:", delErr.message);
        }

        myEnrollments.delete(idKey);
        newEnrolledCount = Math.max(0, newEnrolledCount - 1);
    } else {
        const isFull = ev.maxParticipants && newEnrolledCount >= ev.maxParticipants;
        if (isFull) {
            showToast("Vagas esgotadas para este evento!", "error");
            return;
        }

        const { error: insErr } = await supabaseClient
            .from("enrollments")
            .insert([{
                event_id: ev.id,
                user_id: currentUser.id,
                user_name: currentProfile.full_name
            }]);

        if (insErr) {
            console.warn("Tabela enrollments:", insErr.message);
        }

        myEnrollments.add(idKey);
        newEnrolledCount += 1;
    }

    const { error } = await supabaseClient
        .from("events")
        .update({ enrolled: newEnrolledCount })
        .eq("id", ev.id);

    if (error) {
        showToast("Erro ao atualizar as vagas na base de dados.", "error");
        return;
    }

    ev.enrolled = newEnrolledCount;
    saveJSON(`localspot_enrolled_${currentUser.id}`, [...myEnrollments]);

    if (isEnrolled) {
        showToast(`Cancelaste a tua inscrição em "${ev.name}".`);
    } else {
        showToast(`Inscrição confirmada em "${ev.name}"!`, "success");
    }

    filterEvents();
    if (!detailModal.classList.contains("hidden") && String(detailEventId) === idKey) {
        openEventDetails(ev.id);
    }
}

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
            (!state.onlyFavorites || favorites.has(String(ev.id)));
    });
    return sortEvents(filtered);
}

function hasActiveFilters() {
    return state.search || state.category !== "all" || state.district !== "all" ||
        state.period !== "all" || state.radius < 100 || state.onlyFavorites;
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
                <button type="button" class="fav-btn${fav ? " on" : ""}" data-action="fav">${fav ? "★" : "☆"}</button>
            </div>
            <div class="event-meta">
                <span class="category">${cat ? cat.emoji + " " + cat.label : escapeHTML(ev.category)}</span>
                ${km !== null ? `<span class="distance">${formatKm(km)}</span>` : ""}
            </div>
            <h4>${escapeHTML(ev.name)}</h4>
            ${organizerBadge}
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

    if (action === "fav") {
        toggleFavorite(id);
    } else if (action === "enroll") {
        toggleEnrollment(id);
    } else if (action === "details") {
        openEventDetails(id);
    } else if (action === "edit") {
        startEditEvent(id);
    } else if (action === "delete") {
        deleteEvent(id);
    } else {
        openEventOnMap(id);
    }
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

async function deleteEvent(id) {
    const ev = events.find(x => String(x.id) === String(id));
    if (!ev || !confirm(`Apagar o evento "${ev.name}"?`)) return;

    const { error } = await supabaseClient
        .from("events")
        .delete()
        .eq("id", ev.id);

    if (error) {
        showToast("Erro ao apagar o evento da base de dados.", "error");
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
// MODAL DE DETALHES, INSCRITOS E COMENTÁRIOS
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

    const orgEl = $("detailOrganizer");
    if (ev.creatorName) {
        const isNormal = ev.creatorType === "Utilizador";
        orgEl.textContent = `${isNormal ? "👤" : "🏢"} ${ev.creatorName}`;
        orgEl.classList.toggle("user-tag", isNormal);
        orgEl.classList.remove("hidden");
    } else {
        orgEl.classList.add("hidden");
    }

    $("detailTitle").textContent = ev.name;
    $("detailDescription").textContent = ev.description || "Sem descrição adicional.";
    $("detailDateTime").textContent = formatEventDate(ev);
    $("detailLocation").textContent = `${ev.location} · ${districtLabel(ev.distrito)}`;
    $("detailVacancies").textContent = max ? `${currentEnrolled} / ${max} vagas` : `${currentEnrolled} inscritos (ilimitado)`;

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

    $("detailCalendarBtn").href = buildGoogleCalendarUrl(ev);
    $("detailDirectionsBtn").href = `https://www.google.com/maps/dir/?api=1&destination=${ev.latitude},${ev.longitude}`;

    const ownerActions = $("detailOwnerActions");
    ownerActions.classList.toggle("hidden", !canManageEvent(ev));

    openModal(detailModal);
    await Promise.all([loadEventAttendees(ev), loadEventComments(ev.id)]);
}

window.openEventDetails = openEventDetails;

$("closeDetail").addEventListener("click", () => closeModalEl(detailModal));
detailModal.addEventListener("mousedown", e => { if (e.target === detailModal) closeModalEl(detailModal); });

$("detailEnrollBtn").addEventListener("click", () => {
    if (detailEventId) toggleEnrollment(detailEventId);
});

$("detailShareBtn").addEventListener("click", async () => {
    if (!detailEventId) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?evento=${detailEventId}`;
    try {
        await navigator.clipboard.writeText(shareUrl);
        showToast("Link do evento copiado para a área de transferência!", "success");
    } catch (e) {
        showToast(shareUrl);
    }
});

$("detailEditBtn").addEventListener("click", () => {
    if (!detailEventId) return;
    closeModalEl(detailModal);
    startEditEvent(detailEventId);
});

$("detailDeleteBtn").addEventListener("click", () => {
    if (detailEventId) deleteEvent(detailEventId);
});

async function loadEventAttendees(ev) {
    const listEl = $("detailAttendeesList");
    const countEl = $("detailAttendeesCount");
    countEl.textContent = ev.enrolled || 0;
    listEl.innerHTML = `<span class="muted" style="font-size:12px;">A carregar inscritos...</span>`;

    const { data, error } = await supabaseClient
        .from("enrollments")
        .select("user_name")
        .eq("event_id", ev.id)
        .order("created_at", { ascending: true });

    if (error || !data || data.length === 0) {
        listEl.innerHTML = (ev.enrolled || 0) > 0
            ? `<span class="attendee-pill">👥 ${ev.enrolled} participantes confirmados</span>`
            : `<span class="muted" style="font-size:12.5px;">Sê o primeiro a inscrever-te neste evento.</span>`;
        return;
    }

    countEl.textContent = Math.max(data.length, ev.enrolled || 0);
    listEl.innerHTML = data.map(row => `<span class="attendee-pill">👤 ${escapeHTML(row.user_name)}</span>`).join("");
}

async function loadEventComments(eventId) {
    const listEl = $("detailCommentsList");
    listEl.innerHTML = `<p class="muted" style="font-size:12px;">A carregar comentários...</p>`;

    const { data, error } = await supabaseClient
        .from("comments")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

    if (error) {
        listEl.innerHTML = `<p class="muted" style="font-size:12.5px;">Ainda sem comentários.</p>`;
        return;
    }

    if (!data || data.length === 0) {
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

    const { error } = await supabaseClient
        .from("comments")
        .insert([{
            event_id: detailEventId,
            user_id: currentUser.id,
            user_name: currentProfile.full_name,
            user_role: currentProfile.role,
            content
        }]);

    if (error) {
        showToast("Erro ao publicar comentário. Verifica se a tabela comments foi criada.", "error");
        return;
    }

    input.value = "";
    await loadEventComments(detailEventId);
    showToast("Comentário publicado!", "success");
});

window.deleteComment = async commentId => {
    const { error } = await supabaseClient
        .from("comments")
        .delete()
        .eq("id", commentId);

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
    categoryChips.querySelectorAll(".chip").forEach(c => {
        c.classList.toggle("active", c === chip);
    });
    filterEvents({ fit: true });
});

districtFilter.addEventListener("change", () => { state.district = districtFilter.value; filterEvents({ fit: true }); });
periodFilter.addEventListener("change", () => { state.period = periodFilter.value; filterEvents({ fit: true }); });

radiusSlider.addEventListener("input", async () => {
    const val = Number(radiusSlider.value);
    state.radius = val;
    radiusValue.textContent = val >= 100 ? "Sem limite" : `${val} km`;

    if (val < 100 && !userPosition) {
        try {
            await locateUser();
        } catch (err) {
            showToast("Ativa a localização para usar o filtro por raio.", "error");
        }
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
    favoritesToggle.textContent = state.onlyFavorites ? "★ Só favoritos" : "☆ Só favoritos";
    filterEvents({ fit: true });
});

resetFiltersBtn.addEventListener("click", () => {
    Object.assign(state, { search: "", category: "all", district: "all", period: "all", radius: 100, onlyFavorites: false });
    searchInput.value = "";
    districtFilter.value = "all";
    periodFilter.value = "all";
    radiusSlider.value = 100;
    radiusValue.textContent = "Sem limite";
    favoritesToggle.setAttribute("aria-pressed", "false");
    favoritesToggle.classList.remove("on");
    favoritesToggle.textContent = "☆ Só favoritos";
    categoryChips.querySelectorAll(".chip").forEach(c => {
        c.classList.toggle("active", c.dataset.category === "all");
    });
    filterEvents({ fit: true });
});

locationButton.addEventListener("click", async () => {
    locationButton.disabled = true;
    try {
        await locateUser();
        state.sort = "distance";
        sortFilter.value = "distance";
        filterEvents();
        showToast("Eventos ordenados pela distância a ti.");
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        locationButton.disabled = false;
    }
});

// ==========================================
// MODAIS, CRIAÇÃO E EDIÇÃO DE EVENTOS
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

function startEditEvent(id) {
    const ev = events.find(x => String(x.id) === String(id));
    if (!ev || !canManageEvent(ev)) return;

    editingEventId = ev.id;
    $("eventModalTitle").textContent = "Editar evento";
    $("eventSubmitBtn").textContent = "Guardar alterações";

    $("eventName").value = ev.name;
    $("eventDescription").value = ev.description || "";
    $("eventCategory").value = ev.category;
    $("eventDate").value = ev.date;
    $("eventTime").value = ev.time;
    $("eventLocation").value = ev.location;
    $("eventFormDistrict").value = ev.distrito;
    $("eventLimit").value = ev.maxParticipants || "";

    pendingLocation = { lat: ev.latitude, lng: ev.longitude };
    setTempMarker(pendingLocation);
    coordsText.textContent = `📍 Local atual (${ev.latitude.toFixed(4)}, ${ev.longitude.toFixed(4)})`;
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

window.startEditEvent = startEditEvent;

closeModal.addEventListener("click", () => { closeEventModal(); resetEventForm(); });
modal.addEventListener("mousedown", e => { if (e.target === modal) { closeEventModal(); resetEventForm(); } });

$("aboutButton").addEventListener("click", () => openModal(aboutModal));
$("closeAbout").addEventListener("click", () => closeModalEl(aboutModal));
aboutModal.addEventListener("mousedown", e => { if (e.target === aboutModal) closeModalEl(aboutModal); });

document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!modal.classList.contains("hidden")) { closeEventModal(); resetEventForm(); }
    else if (!detailModal.classList.contains("hidden")) closeModalEl(detailModal);
    else if (!profileModal.classList.contains("hidden")) closeModalEl(profileModal);
    else if (!aboutModal.classList.contains("hidden")) closeModalEl(aboutModal);
    else if (!adminModal.classList.contains("hidden")) closeModalEl(adminModal);
    else if (!pickBanner.classList.contains("hidden")) stopPicking();
});

// Pesquisa de morada durante escolha no mapa (Nominatim OpenStreetMap)
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
            const lat = parseFloat(results[0].lat);
            const lng = parseFloat(results[0].lon);
            flyToCoordinates(lng, lat, 16);
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
    if (e.key === "Enter") {
        e.preventDefault();
        searchAddressOnMap();
    }
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

function resizeImage(file, maxSize = 800) {
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
                resolve(canvas.toDataURL("image/jpeg", 0.78));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
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
        showFormError("Escolhe primeiro a localização no mapa (botão «Alterar no mapa»).");
        return;
    }
    if (!eventForm.checkValidity()) {
        eventForm.reportValidity();
        return;
    }

    const existingEvent = editingEventId
        ? events.find(x => String(x.id) === String(editingEventId))
        : null;

    let image = existingEvent ? existingEvent.image : DEFAULT_IMAGE;
    const file = eventImageInput.files[0];
    if (file) {
        try {
            image = await resizeImage(file);
        } catch (err) {
            showFormError(err.message);
            return;
        }
    }

    const maxPInput = $("eventLimit").value;
    const maxParticipants = maxPInput ? parseInt(maxPInput, 10) : null;

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
            image: image,
            max_participants: maxParticipants
        };

        const { error } = await supabaseClient
            .from("events")
            .update(updatedData)
            .eq("id", editingEventId);

        if (error) {
            showFormError("Erro ao guardar alterações do evento.");
            console.error(error);
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
        image: image,
        max_participants: maxParticipants,
        enrolled: 0,
        creator_id: currentProfile.id,
        creator_name: currentProfile.full_name,
        creator_type: creatorType
    };

    const { data, error } = await supabaseClient
        .from("events")
        .insert([newEventData])
        .select();

    if (error) {
        showFormError("Erro ao publicar o evento na base de dados.");
        console.error(error);
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
});

// Arranque
setupControls();
initAuth();
