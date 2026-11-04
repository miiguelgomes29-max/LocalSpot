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

const STORAGE_EVENTS = "localspot_events";
const STORAGE_FAVS = "localspot_favorites";

// ---------- Armazenamento seguro ----------
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

// ---------- Estado ----------
const state = { search: "", category: "all", district: "all", period: "all", sort: "date", onlyFavorites: false };
let favorites = new Set(loadJSON(STORAGE_FAVS, []));
let activeId = null;
let pendingLocation = null;
let currentList = [];

// Eventos criados pelo utilizador (guardados no dispositivo)
loadJSON(STORAGE_EVENTS, []).forEach(ev => events.push(ev));

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
            (state.district === "all" || ev.distrito === state.district) &&
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
        card.setAttribute("aria-label", `${ev.name}, ver no mapa`);

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
            <p>📍 ${escapeHTML(ev.location)} · ${escapeHTML(districtLabel(ev.distrito))}</p>
            ${ev.custom ? `<button type="button" class="delete-btn" data-action="delete">🗑 Apagar evento</button>` : ""}
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
    setView("map");
    focusEvent(id);
}

// Delegação de eventos na lista
eventsList.addEventListener("click", e => {
    const card = e.target.closest(".event-card");
    if (!card) return;
    const id = Number(card.dataset.id);
    const action = e.target.closest("[data-action]")?.dataset.action;

    if (action === "fav") {
        toggleFavorite(id);
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

// Clicar num marcador destaca o cartão
window.onEventMarkerClick = id => setActive(id, true);

// ---------- Favoritos e apagar ----------
function toggleFavorite(id) {
    if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
    saveJSON(STORAGE_FAVS, [...favorites]);
    filterEvents();
}

function deleteEvent(id) {
    const ev = events.find(x => x.id === id);
    if (!ev || !confirm(`Apagar o evento "${ev.name}"?`)) return;
    events.splice(events.indexOf(ev), 1);
    favorites.delete(id);
    saveJSON(STORAGE_FAVS, [...favorites]);
    persistCustomEvents();
    filterEvents();
    showToast("Evento apagado.");
}

function persistCustomEvents() {
    return saveJSON(STORAGE_EVENTS, events.filter(e => e.custom));
}

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
    else if (!pickBanner.classList.contains("hidden")) stopPicking();
});

// ---------- Adicionar evento: 1) escolher local no mapa, 2) preencher formulário ----------
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
    if (pendingLocation) openModal(modal); else startPicking();
});
changeLocationButton.addEventListener("click", startPicking);
$("cancelPick").addEventListener("click", () => {
    stopPicking();
    if (pendingLocation) openModal(modal);
});

// Pré-visualização da imagem
eventImageInput.addEventListener("change", () => {
    const file = eventImageInput.files[0];
    if (!file) { imagePreview.classList.add("hidden"); return; }
    imagePreview.src = URL.createObjectURL(file);
    imagePreview.classList.remove("hidden");
});

// Reduz a imagem para poupar espaço no armazenamento local
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

    const newEvent = {
        id: Date.now(),
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
        custom: true
    };

    events.push(newEvent);
    const saved = persistCustomEvents();

    closeEventModal();
    resetEventForm();

    if (!getFilteredEvents().some(ev => ev.id === newEvent.id)) resetFiltersBtn.click();
    else filterEvents();

    setActive(newEvent.id);
    focusEvent(newEvent.id);
    showToast(saved ? "Evento adicionado com sucesso!" : "Evento adicionado, mas não foi possível guardá-lo neste dispositivo.", saved ? "success" : "error");
});

// ---------- Arranque ----------
setupControls();
filterEvents({ fit: true });
