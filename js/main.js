// ==========================================
// CONFIGURAÇÃO SUPABASE E LÓGICA DA APLICAÇÃO
// ==========================================
const SUPABASE_URL = "https://TEU-PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "A-TUA-CHAVE-ANON-AQUI";

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
const normalUserNotice = $("normalUserNotice");
const adminModal = $("adminModal");

// Elementos de Filtros e Lista
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
let favorites = new Set(loadJSON(STORAGE_FAVS, []));
let myEnrollments = new Set();
let activeId = null;
let pendingLocation = null;
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

// ==========================================
// SISTEMA DE AUTENTICAÇÃO E PERFIS
// ==========================================

tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
});

tabRegister.addEventListener("click", () => {
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
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

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    btn.disabled = false;
    btn.textContent = "Entrar no LocalSpot";

    if (error) {
        errEl.textContent = "E-mail ou palavra-passe incorretos.";
        errEl.classList.remove("hidden");
        return;
    }

    await handleAuthenticatedSession(data.user);
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

    btn.disabled = false;
    btn.textContent = "Criar Perfil";

    if (error) {
        errEl.textContent = error.message || "Erro ao criar conta.";
        errEl.classList.remove("hidden");
        return;
    }

    if (data.user) {
        // Garante que o perfil existe na tabela profiles
        await supabaseClient.from("profiles").upsert({
            id: data.user.id,
            email: email,
            full_name: fullName,
            role: role,
            business_type: businessType
        });

        if (data.session) {
            await handleAuthenticatedSession(data.user);
            showToast(`Bem-vindo ao LocalSpot, ${fullName}!`, "success");
        } else {
            showToast("Conta criada! Verifica o teu e-mail ou inicia sessão.", "success");
            tabLogin.click();
        }
    }
});

// Terminar Sessão
logoutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    currentUser = null;
    currentProfile = null;
    userBadge.classList.add("hidden");
    adminPanelBtn.classList.add("hidden");
    logoutButton.classList.add("hidden");
    authOverlay.classList.remove("hidden");
    showToast("Sessão terminada.");
});

// Carregar Perfil e Aplicar Permissões
async function handleAuthenticatedSession(user) {
    currentUser = user;
    myEnrollments = new Set(loadJSON(`localspot_enrolled_${user.id}`, []));

    let { data: profile } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (!profile) {
        const meta = user.user_metadata || {};
        const fallbackProfile = {
            id: user.id,
            email: user.email,
            full_name: meta.full_name || user.email.split("@")[0],
            role: meta.role || "user",
            business_type: meta.business_type || null
        };
        await supabaseClient.from("profiles").upsert(fallbackProfile);
        profile = fallbackProfile;
    }

    currentProfile = profile;
    applyRoleUI();
    authOverlay.classList.add("hidden");
    await loadEventsFromSupabase();
}

function applyRoleUI() {
    if (!currentProfile) return;
    const { role, full_name, business_type } = currentProfile;

    logoutButton.classList.remove("hidden");
    userBadge.classList.remove("hidden");

    if (role === "admin") {
        userBadge.textContent = `🛡️ Admin · ${full_name}`;
        adminPanelBtn.classList.remove("hidden");
        addEventButton.classList.remove("hidden");
        normalUserNotice.classList.add("hidden");
    } else if (role === "business") {
        const tipo = business_type || "Domínio Público";
        userBadge.textContent = `🏢 ${tipo} · ${full_name}`;
        adminPanelBtn.classList.add("hidden");
        addEventButton.classList.remove("hidden");
        normalUserNotice.classList.add("hidden");
    } else {
        userBadge.textContent = `👤 ${full_name}`;
        adminPanelBtn.classList.add("hidden");
        addEventButton.classList.add("hidden");
        normalUserNotice.classList.remove("hidden");
    }
}

async function initAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && session.user) {
        await handleAuthenticatedSession(session.user);
    } else {
        authOverlay.classList.remove("hidden");
    }
}

// ==========================================
// PAINEL DE ADMINISTRAÇÃO
// ==========================================
adminPanelBtn.addEventListener("click", async () => {
    if (currentProfile?.role !== "admin") return;
    openModal(adminModal);
    await loadAdminDashboard();
});

$("closeAdmin").addEventListener("click", () => {
    adminModal.classList.add("hidden");
    adminModal.setAttribute("aria-hidden", "true");
});

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
// SUPABASE: CARREGAR EVENTOS
// ==========================================
async function loadEventsFromSupabase() {
    const { data, error } = await supabaseClient
        .from('events')
        .select('*');

    if (error) {
        showToast("Erro ao carregar eventos da base de dados.", "error");
        console.error(error);
        return;
    }

    events.length = 0;
    data.forEach(item => {
        events.push({
            id: item.id,
            name: item.name,
            description: item.description,
            category: item.category,
            date: item.date,
            time: item.time,
            location: item.location,
            distrito: item.distrito,
            latitude: item.latitude,
            longitude: item.longitude,
            image: item.image,
            maxParticipants: item.max_participants,
            enrolled: item.enrolled || 0,
            creatorId: item.creator_id,
            creatorName: item.creator_name,
            creatorType: item.creator_type
        });
    });

    filterEvents({ fit: true });
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

// ---------- Inscrição em Atividades ----------
async function toggleEnrollment(id) {
    if (!currentUser) return;
    const ev = events.find(x => x.id === id);
    if (!ev) return;

    const isEnrolled = myEnrollments.has(id);
    let newEnrolledCount = ev.enrolled || 0;

    if (isEnrolled) {
        myEnrollments.delete(id);
        newEnrolledCount = Math.max(0, newEnrolledCount - 1);
    } else {
        const isFull = ev.maxParticipants && newEnrolledCount >= ev.maxParticipants;
        if (isFull) {
            showToast("Vagas esgotadas para este evento!", "error");
            return;
        }
        myEnrollments.add(id);
        newEnrolledCount += 1;
    }

    const { error } = await supabaseClient
        .from('events')
        .update({ enrolled: newEnrolledCount })
        .eq('id', id);

    if (error) {
        showToast("Erro ao atualizar a inscrição na base de dados.", "error");
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
            (!state.onlyFavorites || favorites.has(ev.id));
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

function displayEvents(list) {
    eventsList.innerHTML = "";
    eventCount.textContent = list.length;
    emptyState.classList.toggle("hidden", list.length > 0);

    const frag = document.createDocumentFragment();

    list.forEach(ev => {
        const cat = CATEGORIES[ev.category];
        const km = distanceOf(ev);
        const fav = favorites.has(ev.id);
        const enrolled = myEnrollments.has(ev.id);
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
        }

        const canDelete = currentProfile && (
            currentProfile.role === "admin" ||
            (ev.creatorId && ev.creatorId === currentProfile.id)
        );

        const organizerBadge = ev.creatorName
            ? `<div class="organizer-tag">🏢 ${escapeHTML(ev.creatorType ? ev.creatorType + " · " : "")}${escapeHTML(ev.creatorName)}</div>`
            : "";

        const card = document.createElement("article");
        card.className = "event-card" + (past ? " past" : "") + (ev.id === activeId ? " active" : "");
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
                <span class="category" style="--pin:${cat ? cat.color : "#3b82f6"}">${cat ? cat.emoji + " " + cat.label : escapeHTML(ev.category)}</span>
                ${km !== null ? `<span class="distance">${formatKm(km)}</span>` : ""}
            </div>
            <h4>${escapeHTML(ev.name)}</h4>
            ${organizerBadge}
            <p>📅 ${escapeHTML(formatEventDate(ev))}</p>
            <p>📍 ${escapeHTML(ev.location)} · ${escapeHTML(districtLabel(ev.distrito))}</p>
            
            <div class="registration-info">👥 ${vagasLabel}</div>
            ${enrollBtnHtml}

            ${canDelete ? `<button type="button" class="delete-btn" data-action="delete">🗑 Apagar evento</button>` : ""}
        `;
        frag.appendChild(card);
    });

    eventsList.appendChild(frag);
}

function setActive(id, scroll = true) {
    activeId = id;
    eventsList.querySelectorAll(".event-card").forEach(c => {
        const on = Number(c.dataset.id) === id;
        c.classList.toggle("active", on);
        if (on && scroll) c.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
}

function openEventOnMap(id) {
    setActive(id, false);
    focusEvent(id);
}

eventsList.addEventListener("click", e => {
    const card = e.target.closest(".event-card");
    if (!card) return;
    const id = Number(card.dataset.id);
    const action = e.target.closest("[data-action]")?.dataset.action;

    if (action === "fav") {
        toggleFavorite(id);
    } else if (action === "enroll") {
        toggleEnrollment(id);
    } else if (action === "delete") {
        deleteEvent(id);
    } else {
        openEventOnMap(id);
    }
});

eventsList.addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("event-card")) {
        e.preventDefault();
        openEventOnMap(Number(e.target.dataset.id));
    }
});

window.onEventMarkerClick = id => setActive(id, true);

function toggleFavorite(id) {
    if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
    saveJSON(STORAGE_FAVS, [...favorites]);
    filterEvents();
}

async function deleteEvent(id) {
    const ev = events.find(x => x.id === id);
    if (!ev || !confirm(`Apagar o evento "${ev.name}"?`)) return;

    const { error } = await supabaseClient
        .from('events')
        .delete()
        .eq('id', id);

    if (error) {
        showToast("Erro ao apagar o evento da base de dados.", "error");
        return;
    }

    events.splice(events.indexOf(ev), 1);
    favorites.delete(id);
    myEnrollments.delete(id);
    saveJSON(STORAGE_FAVS, [...favorites]);
    if (currentUser) saveJSON(`localspot_enrolled_${currentUser.id}`, [...myEnrollments]);
    filterEvents();
    showToast("Evento apagado com sucesso.");
}

// ---------- Event Listeners ----------
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

// ---------- Modais ----------
function openModal(el) {
    el.classList.remove("hidden");
    el.setAttribute("aria-hidden", "false");
    const focusable = el.querySelector("input, select, textarea, button");
    if (focusable) setTimeout(() => focusable.focus(), 50);
}

function closeEventModal() {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
}

function resetEventForm() {
    eventForm.reset();
    imagePreview.classList.add("hidden");
    imagePreview.removeAttribute("src");
    formError.classList.add("hidden");
    pendingLocation = null;
    clearTempMarker();
    coordsText.textContent = "📍 Nenhuma localização selecionada no mapa";
    coordsText.classList.remove("ok");
}

closeModal.addEventListener("click", () => { closeEventModal(); resetEventForm(); });
modal.addEventListener("mousedown", e => { if (e.target === modal) { closeEventModal(); resetEventForm(); } });

$("aboutButton").addEventListener("click", () => openModal(aboutModal));
$("closeAbout").addEventListener("click", () => {
    aboutModal.classList.add("hidden");
    aboutModal.setAttribute("aria-hidden", "true");
});
aboutModal.addEventListener("mousedown", e => {
    if (e.target === aboutModal) {
        aboutModal.classList.add("hidden");
        aboutModal.setAttribute("aria-hidden", "true");
    }
});

document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!modal.classList.contains("hidden")) { closeEventModal(); resetEventForm(); }
    else if (!aboutModal.classList.contains("hidden")) {
        aboutModal.classList.add("hidden");
        aboutModal.setAttribute("aria-hidden", "true");
    }
    else if (!adminModal.classList.contains("hidden")) {
        adminModal.classList.add("hidden");
        adminModal.setAttribute("aria-hidden", "true");
    }
    else if (!pickBanner.classList.contains("hidden")) stopPicking();
});

function startPicking() {
    closeEventModal();
    pickBanner.classList.remove("hidden");
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
    if (currentProfile?.role === "user") {
        showToast("Apenas contas de Domínio Público ou Admin podem criar eventos.", "error");
        return;
    }
    if (pendingLocation) openModal(modal); else startPicking();
});
changeLocationButton.addEventListener("click", startPicking);
$("cancelPick").addEventListener("click", () => {
    stopPicking();
    if (pendingLocation) openModal(modal);
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

    if (!currentProfile || currentProfile.role === "user") {
        showFormError("Sem permissão para publicar eventos.");
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

    let image = DEFAULT_IMAGE;
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
        creator_type: currentProfile.role === "admin" ? "Admin" : (currentProfile.business_type || "Empresa")
    };

    const { data, error } = await supabaseClient
        .from('events')
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
    showToast("Evento publicado no Supabase com sucesso!", "success");
});

// Arranque
setupControls();
initAuth();
