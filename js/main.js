// ==========================================
// LÓGICA DA APLICAÇÃO
// ==========================================
const $ = id => document.getElementById(id);

const searchInput = $("searchInput");
const categoryChips = $("categoryChips");
const districtFilter = $("districtFilter");
const periodFilter = $("periodFilter");
const sortFilter = $("sortFilter");
const favoritesToggle = $("favoritesToggle");
const resetFiltersBtn = $("resetFilters");
const eventsList = $("eventsList");
const eventCount = $("eventCount");
const emptyState = $("emptyState");
const locationButton = $("locationButton");
const addEventButton = $("addEventButton");

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
const mainEl = $("main");

// Elementos de Autenticação
const authModal = $("authModal");
const authForm = $("authForm");
const authError = $("authError");
const toggleAuthMode = $("toggleAuthMode");
const usernameField = $("usernameField");
const authTitle = $("authTitle");
const authSubmitBtn = $("authSubmitBtn");

// Elementos de Detalhes
const detailsModal = $("detailsModal");
const detailsImage = $("detailsImage");
const detailsTitle = $("detailsTitle");
const detailsMeta = $("detailsMeta");
const detailsDesc = $("detailsDesc");
const detailsLikeBtn = $("detailsLikeBtn");
const detailsLikeCount = $("detailsLikeCount");
const detailsCheckinBtn = $("detailsCheckinBtn");
const commentsList = $("commentsList");
const commentForm = $("commentForm");
const commentInput = $("commentInput");

// ---------- Estado ----------
const state = { search: "", category: "all", district: "all", period: "all", sort: "date", onlyFavorites: false };
let favorites = new Set();
let activeId = null;
let pendingLocation = null;
let currentList = [];
let currentUser = null;
let currentDetailsEventId = null;
let isRegisterMode = false;

// ---------- Inicialização Assíncrona ----------
async function init() {
    setupControls();
    
    // Verificar sessão atual
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        updateAuthUI(true);
        favorites = await dbLoadFavorites();
    }

    // Carregar eventos da BD
    events = await dbLoadEvents();
    
    filterEvents({ fit: true });
}

// ---------- Mensagens (toast) ----------
let toastTimer;
function showToast(message, type = "info") {
    const toast = $("toast");
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3500);
}

// ---------- Preencher selects e categorias ----------
function setupControls() {
    districtFilter.innerHTML = `<option value="all">Todos os distritos</option>` +
        DISTRICTS.map(d => `<option value="${d.value}">${d.label}</option>`).join("");

    $("eventFormDistrict").innerHTML = `<option value="">Selecionar distrito</option>` +
        DISTRICTS.map(d => `<option value="${d.value}">${d.label}</option>`).join("");

    $("eventCategory").innerHTML = `<option value="">Selecionar categoria</option>` +
        Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}">${c.emoji} ${c.label}</option>`).join("");

    const chips = [["all", "Todas"], ...Object.entries(CATEGORIES).map(([k, c]) => [k, `${c.emoji} ${c.label}`])];
    categoryChips.innerHTML = chips.map(([key, label]) =>
        `<button type="button" class="chip${key === "all" ? " active" : ""}" data-category="${key}" aria-pressed="${key === "all"}">${label}</button>`
    ).join("");

    const today = new Date().toISOString().slice(0, 10);
    $("eventDate").min = today;
}

// ---------- Filtros ----------
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
        const haystack = normalizeText(`${ev.name} ${ev.location} ${ev.description || ""}`);
        return (!q || haystack.includes(q)) &&
            (state.category === "all" || ev.category === state.category) &&
            (state.district === "all" || ev.district === state.district) &&
            matchesPeriod(ev) &&
            (!state.onlyFavorites || favorites.has(ev.id));
    });
    return sortEvents(filtered);
}

function hasActiveFilters() {
    return state.search || state.category !== "all" || state.district !== "all" ||
        state.period !== "all" || state.onlyFavorites;
}

function filterEvents({ fit = false } = {}) {
    currentList = getFilteredEvents();
    displayEvents(currentList);
    showEventsOnMap(currentList);
    if (fit) fitToEvents(currentList);
    resetFiltersBtn.classList.toggle("hidden", !hasActiveFilters());
}

// ---------- Lista lateral ----------
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
        const past = isPast(ev);

        const card = document.createElement("article");
        card.className = "event-card" + (past ? " past" : "") + (ev.id === activeId ? " active" : "");
        card.dataset.id = ev.id;
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", `${ev.name}, ver detalhes`);

        card.innerHTML = `
            <div class="event-image-wrap">
                <img src="${escapeHTML(ev.image || DEFAULT_IMAGE)}" alt="" class="event-image" loading="lazy"
                     onerror="this.onerror=null;this.src='${DEFAULT_IMAGE}'">
                ${past ? '<span class="badge-past">Terminado</span>' : ""}
                <button type="button" class="fav-btn${fav ? " on" : ""}" data-action="fav"
                        aria-label="${fav ? "Remover dos favoritos" : "Adicionar aos favoritos"}" aria-pressed="${fav}">${fav ? "★" : "☆"}</button>
            </div>
            <div class="event-meta">
                <span class="category" style="--pin:${cat ? cat.color : "#2563eb"}">${cat ? cat.emoji + " " + cat.label : escapeHTML(ev.category)}</span>
                ${km !== null ? `<span class="distance">${formatKm(km)}</span>` : ""}
            </div>
            <h4>${escapeHTML(ev.name)}</h4>
            <p>📅 ${escapeHTML(formatEventDate(ev))}</p>
            <p>📍 ${escapeHTML(ev.location)} · ${escapeHTML(districtLabel(ev.district))}</p>
            ${ev.custom && currentUser && ev.created_by === currentUser.id ? `<button type="button" class="delete-btn" data-action="delete">🗑 Apagar evento</button>` : ""}
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

// Ao clicar no card, abre os detalhes
eventsList.addEventListener("click", e => {
    const card = e.target.closest(".event-card");
    if (!card) return;
    const id = card.dataset.id;
    const action = e.target.closest("[data-action]")?.dataset.action;

    if (action === "fav") {
        e.stopPropagation();
        handleToggleFav(id);
    } else if (action === "delete") {
        e.stopPropagation();
        handleDeleteEvent(id);
    } else {
        openEventDetails(id);
    }
});

// ---------- Favoritos e Deleção ----------
async function handleToggleFav(id) {
    if (!currentUser) {
        showToast("Inicia sessão para guardar favoritos.", "error");
        openAuthModal();
        return;
    }
    try {
        const isFav = await dbToggleFavorite(id);
        if (isFav) favorites.add(id); else favorites.delete(id);
        filterEvents();
    } catch (err) {
        showToast(err.message, "error");
    }
}

async function handleDeleteEvent(id) {
    const ev = events.find(x => x.id === id);
    if (!ev || !confirm(`Apagar o evento "${ev.name}"?`)) return;
    
    try {
        await dbDeleteEvent(id);
        events = events.filter(e => e.id !== id);
        filterEvents();
        showToast("Evento apagado.", "success");
    } catch (err) {
        showToast("Erro ao apagar: " + err.message, "error");
    }
}

// ---------- Detalhes do Evento (Bump-style) ----------
async function openEventDetails(id) {
    currentDetailsEventId = id;
    const ev = events.find(e => e.id === id);
    if (!ev) return;

    detailsImage.src = ev.image || DEFAULT_IMAGE;
    detailsImage.style.display = 'block';
    detailsTitle.textContent = ev.name;
    detailsMeta.textContent = `📅 ${formatEventDate(ev)} · 📍 ${ev.location} (${districtLabel(ev.district)})`;
    detailsDesc.textContent = ev.description || "Sem descrição.";
    
    openModal(detailsModal);
    await refreshEventDetails();
}

async function refreshEventDetails() {
    if (!currentDetailsEventId) return;
    
    const { likeCount, hasLiked, comments } = await dbGetEventDetails(currentDetailsEventId);
    
    detailsLikeCount.textContent = likeCount;
    detailsLikeBtn.style.color = hasLiked ? 'var(--danger)' : 'var(--primary)';
    
    commentsList.innerHTML = comments.map(c => `
        <div style="border-bottom: 1px solid #eee; padding: 8px 0; font-size: 13px;">
            <strong>${escapeHTML(c.profiles?.username || "Utilizador")}</strong>: ${escapeHTML(c.content)}
        </div>
    `).join("") || '<p class="muted" style="font-size:13px;">Ainda não há comentários.</p>';
}

detailsLikeBtn.addEventListener('click', async () => {
    if (!currentUser) return openAuthModal();
    try {
        await dbToggleLike(currentDetailsEventId);
        await refreshEventDetails();
    } catch (err) { showToast(err.message, "error"); }
});

detailsCheckinBtn.addEventListener('click', async () => {
    if (!currentUser) return openAuthModal();
    try {
        await dbCheckIn(currentDetailsEventId);
        showToast("Check-in realizado com sucesso!", "success");
    } catch (err) { showToast("Erro no check-in: " + err.message, "error"); }
});

commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return openAuthModal();
    const txt = commentInput.value.trim();
    if (!txt) return;
    try {
        await dbAddComment(currentDetailsEventId, txt);
        commentInput.value = "";
        await refreshEventDetails();
    } catch (err) { showToast(err.message, "error"); }
});

$("closeDetails").addEventListener('click', () => {
    detailsModal.classList.add("hidden");
    detailsModal.setAttribute("aria-hidden", "true");
    currentDetailsEventId = null;
});

// ---------- Listeners de filtros ----------
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
        const on = c === chip;
        c.classList.toggle("active", on);
        c.setAttribute("aria-pressed", on);
    });
    filterEvents({ fit: true });
});

districtFilter.addEventListener("change", () => { state.district = districtFilter.value; filterEvents({ fit: true }); });
periodFilter.addEventListener("change", () => { state.period = periodFilter.value; filterEvents({ fit: true }); });

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
    if (!currentUser) return openAuthModal();
    state.onlyFavorites = !state.onlyFavorites;
    favoritesToggle.setAttribute("aria-pressed", state.onlyFavorites);
    favoritesToggle.classList.toggle("on", state.onlyFavorites);
    favoritesToggle.textContent = state.onlyFavorites ? "★ Só favoritos" : "☆ Só favoritos";
    filterEvents({ fit: true });
});

resetFiltersBtn.addEventListener("click", () => {
    Object.assign(state, { search: "", category: "all", district: "all", period: "all", onlyFavorites: false });
    searchInput.value = "";
    districtFilter.value = "all";
    periodFilter.value = "all";
    favoritesToggle.setAttribute("aria-pressed", "false");
    favoritesToggle.classList.remove("on");
    favoritesToggle.textContent = "☆ Só favoritos";
    categoryChips.querySelectorAll(".chip").forEach(c => {
        const on = c.dataset.category === "all";
        c.classList.toggle("active", on);
        c.setAttribute("aria-pressed", on);
    });
    filterEvents({ fit: true });
});

// ---------- Localização ----------
locationButton.addEventListener("click", async () => {
    locationButton.disabled = true;
    try {
        await locateUser();
        state.sort = "distance";
        sortFilter.value = "distance";
        filterEvents();
        setView("map");
        showToast("Eventos ordenados pela distância a ti.");
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        locationButton.disabled = false;
    }
});

// ---------- Vista (telemóvel) ----------
function setView(view) {
    mainEl.dataset.view = view;
    $("tabList").classList.toggle("active", view === "list");
    $("tabMap").classList.toggle("active", view === "map");
    $("tabList").setAttribute("aria-selected", view === "list");
    $("tabMap").setAttribute("aria-selected", view === "map");
    setTimeout(() => {
        if (typeof map !== "undefined" && map) map.resize();
    }, 50);
}

$("tabList").addEventListener("click", () => setView("list"));
$("tabMap").addEventListener("click", () => setView("map"));

// ---------- Modais Genéricos ----------
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

// ---------- Adicionar evento ----------
function startPicking() {
    closeEventModal();
    setView("map");
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
    if (!currentUser) return openAuthModal();
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

function showFormError(message) {
    formError.textContent = message;
    formError.classList.remove("hidden");
}

eventForm.addEventListener("submit", async e => {
    e.preventDefault();
    formError.classList.add("hidden");
    const submitBtn = $("submitEventBtn");

    if (!pendingLocation) {
        return showFormError("Escolhe primeiro a localização no mapa (botão «Alterar no mapa»).");
    }
    if (!eventForm.checkValidity()) {
        eventForm.reportValidity();
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "A publicar...";

    try {
        const eventData = {
            name: $("eventName").value.trim(),
            description: $("eventDescription").value.trim(),
            category: $("eventCategory").value,
            date: $("eventDate").value,
            time: $("eventTime").value,
            location: $("eventLocation").value.trim(),
            distrito: $("eventFormDistrict").value,
            latitude: pendingLocation.lat,
            longitude: pendingLocation.lng
        };

        const newEvent = await dbCreateEvent(eventData, eventImageInput.files[0]);
        
        // Recarregar eventos da BD para garantir consistência
        events = await dbLoadEvents();
        
        closeEventModal();
        resetEventForm();
        filterEvents();
        
        if (!getFilteredEvents().some(ev => ev.id === newEvent.id)) resetFiltersBtn.click();
        
        showToast("Evento adicionado com sucesso!", "success");
    } catch (err) {
        showFormError(err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Publicar evento";
    }
});

// ---------- AUTENTICAÇÃO ----------
function updateAuthUI(isLoggedIn) {
    const authArea = $("authArea");
    if (isLoggedIn) {
        authArea.innerHTML = `
            <button type="button" id="logoutButton" class="btn-soft">Sair (${currentUser.user_metadata?.username || 'User'})</button>
        `;
        $("logoutButton").addEventListener("click", async () => {
            await supabase.auth.signOut();
            currentUser = null;
            favorites = new Set();
            updateAuthUI(false);
            filterEvents();
            showToast("Sessão terminada.");
        });
    } else {
        authArea.innerHTML = `<button type="button" id="loginButton" class="btn-soft">Entrar</button>`;
        $("loginButton").addEventListener("click", openAuthModal);
    }
}

function openAuthModal() {
    authModal.classList.remove("hidden");
    authModal.setAttribute("aria-hidden", "false");
}

$("closeAuth").addEventListener("click", () => {
    authModal.classList.add("hidden");
    authModal.setAttribute("aria-hidden", "true");
});

toggleAuthMode.addEventListener("click", (e) => {
    e.preventDefault();
    isRegisterMode = !isRegisterMode;
    authTitle.textContent = isRegisterMode ? "Criar Conta" : "Entrar";
    authSubmitBtn.textContent = isRegisterMode ? "Registar" : "Entrar";
    toggleAuthMode.textContent = isRegisterMode ? "Já tens conta? Entra" : "Não tens conta? Regista-te";
    usernameField.classList.toggle("hidden", !isRegisterMode);
    authError.classList.add("hidden");
});

authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    authError.classList.add("hidden");
    authSubmitBtn.disabled = true;
    authSubmitBtn.textContent = "A processar...";

    const email = $("authEmail").value;
    const password = $("authPassword").value;
    const username = $("authUsername").value;

    try {
        if (isRegisterMode) {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { username: username || 'user_' + Date.now() } }
            });
            if (error) throw error;
            showToast("Registo efetuado! Já podes entrar.", "success");
            // Mudar para modo login
            toggleAuthMode.click();
        } else {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            
            currentUser = data.user;
            favorites = await dbLoadFavorites();
            updateAuthUI(true);
            authModal.classList.add("hidden");
            authModal.setAttribute("aria-hidden", "true");
            filterEvents();
            showToast("Bem-vindo de volta!", "success");
        }
    } catch (err) {
        authError.textContent = err.message;
        authError.classList.remove("hidden");
    } finally {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = isRegisterMode ? "Registar" : "Entrar";
    }
});

// ---------- Arranque ----------
init();
