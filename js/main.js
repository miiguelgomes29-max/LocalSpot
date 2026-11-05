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
const radiusSlider = $("radiusSlider");
const radiusValue = $("radiusValue");

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
const STORAGE_REGS = "localspot_registrations";

function loadJSON(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; } }
function saveJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; } }

const state = { search: "", category: "all", district: "all", period: "all", sort: "date", onlyFavorites: false };
let favorites = new Set(loadJSON(STORAGE_FAVS, []));
let registrations = loadJSON(STORAGE_REGS, {}); // Guarda as inscrições
let activeId = null;
let pendingLocation = null;
let currentList = [];

loadJSON(STORAGE_EVENTS, []).forEach(ev => events.push(ev));

let toastTimer;
function showToast(message, type = "info") {
    const toast = $("toast");
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3500);
}

function setupControls() {
    districtFilter.innerHTML = `<option value="all">Todos os distritos</option>` + DISTRICTS.map(d => `<option value="${d.value}">${d.label}</option>`).join("");
    $("eventFormDistrict").innerHTML = `<option value="">Selecionar distrito</option>` + DISTRICTS.map(d => `<option value="${d.value}">${d.label}</option>`).join("");
    $("eventCategory").innerHTML = `<option value="">Selecionar categoria</option>` + Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}">${c.emoji} ${c.label}</option>`).join("");

    const chips = [["all", "Todas"], ...Object.entries(CATEGORIES).map(([k, c]) => [k, `${c.emoji} ${c.label}`])];
    categoryChips.innerHTML = chips.map(([key, label]) => `<button type="button" class="chip${key === "all" ? " active" : ""}" data-category="${key}" aria-pressed="${key === "all"}">${label}</button>`).join("");

    const today = new Date().toISOString().slice(0, 10);
    $("eventDate").min = today;
}

function isPast(ev) { return eventDateTime(ev) < new Date(); }
function matchesPeriod(ev) {
    if (state.period === "all") return true;
    const d = eventDateTime(ev); const now = new Date();
    if (d < now) return false;
    if (state.period === "upcoming") return true;
    return d <= new Date(now.getTime() + (state.period === "week" ? 7 : 30) * 86400000);
}
function distanceOf(ev) { if (!userPosition) return null; return distanceKm(userPosition.lat, userPosition.lng, ev.latitude, ev.longitude); }

function sortEvents(list) {
    const sorted = [...list];
    if (state.sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "pt"));
    else if (state.sort === "distance" && userPosition) sorted.sort((a, b) => distanceOf(a) - distanceOf(b));
    else {
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
        return (!q || haystack.includes(q)) && (state.category === "all" || ev.category === state.category) &&
            (state.district === "all" || ev.distrito === state.district) && matchesPeriod(ev) && (!state.onlyFavorites || favorites.has(ev.id));
    });
    return sortEvents(filtered);
}

function hasActiveFilters() { return state.search || state.category !== "all" || state.district !== "all" || state.period !== "all" || state.onlyFavorites; }

function filterEvents({ fit = false } = {}) {
    currentList = getFilteredEvents();
    displayEvents(currentList);
    showEventsOnMap(currentList);
    if (fit) fitToEvents(currentList);
    resetFiltersBtn.classList.toggle("hidden", !hasActiveFilters());
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

        // Lógica de Inscrições
        const evRegs = registrations[ev.id] || [];
        const limitText = ev.limit ? `${evRegs.length} / ${ev.limit}` : `${evRegs.length} inscritos`;
        const isFull = ev.limit && evRegs.length >= ev.limit;
        const myName = localStorage.getItem("localspot_username");
        const amIRegistered = myName && evRegs.includes(myName);

        const card = document.createElement("article");
        card.className = "event-card" + (past ? " past" : "") + (ev.id === activeId ? " active" : "");
        card.dataset.id = ev.id;
        card.tabIndex = 0;
        card.setAttribute("role", "button");

        card.innerHTML = `
            <div class="event-image-wrap">
                <img src="${escapeHTML(ev.image || DEFAULT_IMAGE)}" alt="" class="event-image" loading="lazy" onerror="this.onerror=null;this.src='${DEFAULT_IMAGE}'">
                ${past ? '<span class="badge-past" style="position:absolute;left:8px;top:8px;background:rgba(0,0,0,0.8);color:#fff;padding:4px 8px;border-radius:4px;font-size:11px;">Terminado</span>' : ""}
                <button type="button" class="fav-btn${fav ? " on" : ""}" data-action="fav" aria-pressed="${fav}">${fav ? "★" : "☆"}</button>
            </div>
            <div class="event-meta">
                <span class="category" style="--pin:${cat ? cat.color : "#3b82f6"}">${cat ? cat.emoji + " " + cat.label : escapeHTML(ev.category)}</span>
                ${km !== null ? `<span class="distance" style="color:var(--muted);font-weight:bold;">${km < 10 ? km.toFixed(1).replace(".", ",") : Math.round(km)} km</span>` : ""}
            </div>
            <h4>${escapeHTML(ev.name)}</h4>
            <p>📅 ${escapeHTML(formatEventDate(ev))}</p>
            <p>📍 ${escapeHTML(ev.location)} · ${escapeHTML(districtLabel(ev.distrito))}</p>
            
            <p class="registration-info">📝 Inscrições: ${limitText}</p>
            <button type="button" class="register-btn ${amIRegistered ? 'registered' : ''}" data-action="register" ${(!amIRegistered && isFull) ? 'disabled' : ''}>
                ${amIRegistered ? '✓ Inscrito (Cancelar)' : isFull ? 'Esgotado' : 'Inscrever-me'}
            </button>

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

function openEventOnMap(id) { setActive(id, false); setView("map"); focusEvent(id); }

eventsList.addEventListener("click", e => {
    const card = e.target.closest(".event-card");
    if (!card) return;
    const id = Number(card.dataset.id);
    const action = e.target.closest("[data-action]")?.dataset.action;

    if (action === "fav") toggleFavorite(id);
    else if (action === "delete") deleteEvent(id);
    else if (action === "register") toggleRegistration(id);
    else openEventOnMap(id);
});

eventsList.addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("event-card")) {
        e.preventDefault(); openEventOnMap(Number(e.target.dataset.id));
    }
});

window.onEventMarkerClick = id => setActive(id, true);

function toggleFavorite(id) {
    if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
    saveJSON(STORAGE_FAVS, [...favorites]);
    filterEvents();
}

// FUNÇÃO DE INSCRIÇÃO
function toggleRegistration(id) {
    const ev = events.find(x => x.id === id);
    if (!ev) return;

    let myName = localStorage.getItem("localspot_username");
    if (!myName) {
        myName = prompt("Insere o teu nome para a inscrição:");
        if (!myName || !myName.trim()) return; 
        myName = myName.trim();
        localStorage.setItem("localspot_username", myName);
    }

    if (!registrations[id]) registrations[id] = [];
    const index = registrations[id].indexOf(myName);

    if (index > -1) {
        registrations[id].splice(index, 1);
        showToast("Inscrição cancelada.", "info");
    } else {
        if (ev.limit && registrations[id].length >= ev.limit) {
            showToast("Este evento já atingiu o limite de inscrições.", "error");
            return;
        }
        registrations[id].push(myName);
        showToast("Inscrição realizada com sucesso!", "success");
    }

    saveJSON(STORAGE_REGS, registrations);
    filterEvents();
}

function deleteEvent(id) {
    const ev = events.find(x => x.id === id);
    if (!ev || !confirm(`Apagar o evento "${ev.name}"?`)) return;
    
    events.splice(events.indexOf(ev), 1);
    favorites.delete(id);
    
    if (registrations[id]) { delete registrations[id]; saveJSON(STORAGE_REGS, registrations); }
    saveJSON(STORAGE_FAVS, [...favorites]);
    persistCustomEvents();
    filterEvents();
    showToast("Evento apagado.");
}

function persistCustomEvents() { return saveJSON(STORAGE_EVENTS, events.filter(e => e.custom)); }

// SLIDER DO RAIO (Apenas visual por agora)
radiusSlider.addEventListener("input", (e) => {
    const val = e.target.value;
    radiusValue.textContent = val == 100 ? "Sem limite" : `${val} km`;
});

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
        c.classList.toggle("active", on); c.setAttribute("aria-pressed", on);
    });
    filterEvents({ fit: true });
});

districtFilter.addEventListener("change", () => { state.district = districtFilter.value; filterEvents({ fit: true }); });
periodFilter.addEventListener("change", () => { state.period = periodFilter.value; filterEvents({ fit: true }); });

sortFilter.addEventListener("change", async () => {
    state.sort = sortFilter.value;
    if (state.sort === "distance" && !userPosition) {
        try { await locateUser(); } catch (err) { showToast(err.message, "error"); state.sort = "date"; sortFilter.value = "date"; }
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
    searchInput.value = ""; districtFilter.value = "all"; periodFilter.value = "all";
    favoritesToggle.setAttribute("aria-pressed", "false");
    favoritesToggle.classList.remove("on"); favoritesToggle.textContent = "☆ Só favoritos";
    categoryChips.querySelectorAll(".chip").forEach(c => {
        const on = c.dataset.category === "all";
        c.classList.toggle("active", on); c.setAttribute("aria-pressed", on);
    });
    filterEvents({ fit: true });
});

locationButton.addEventListener("click", async () => {
    locationButton.disabled = true;
    try {
        await locateUser();
        state.sort = "distance"; sortFilter.value = "distance";
        filterEvents(); setView("map");
        showToast("Eventos ordenados pela distância a ti.");
    } catch (err) { showToast(err.message, "error"); } finally { locationButton.disabled = false; }
});

function setView(view) {
    mainEl.dataset.view = view;
    setTimeout(() => { if (typeof map !== "undefined" && map) map.resize(); }, 50);
}

function openModal(el) {
    el.classList.remove("hidden"); el.setAttribute("aria-hidden", "false");
    const focusable = el.querySelector("input, select, textarea, button");
    if (focusable) setTimeout(() => focusable.focus(), 50);
}
function closeEventModal() { modal.classList.add("hidden"); modal.setAttribute("aria-hidden", "true"); }

function resetEventForm() {
    eventForm.reset(); imagePreview.classList.add("hidden"); imagePreview.removeAttribute("src");
    formError.classList.add("hidden"); pendingLocation = null; clearTempMarker();
    coordsText.textContent = "📍 Nenhuma localização selecionada no mapa"; coordsText.classList.remove("ok");
}

closeModal.addEventListener("click", () => { closeEventModal(); resetEventForm(); });
modal.addEventListener("mousedown", e => { if (e.target === modal) { closeEventModal(); resetEventForm(); } });
$("aboutButton").addEventListener("click", () => openModal(aboutModal));
$("closeAbout").addEventListener("click", () => { aboutModal.classList.add("hidden"); });
aboutModal.addEventListener("mousedown", e => { if (e.target === aboutModal) aboutModal.classList.add("hidden"); });

document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!modal.classList.contains("hidden")) { closeEventModal(); resetEventForm(); }
    else if (!aboutModal.classList.contains("hidden")) aboutModal.classList.add("hidden");
    else if (!pickBanner.classList.contains("hidden")) stopPicking();
});

function startPicking() {
    closeEventModal(); setView("map"); pickBanner.classList.remove("hidden");
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
function stopPicking() { cancelPick(); pickBanner.classList.add("hidden"); }

addEventButton.addEventListener("click", () => { if (pendingLocation) openModal(modal); else startPicking(); });
changeLocationButton.addEventListener("click", startPicking);
$("cancelPick").addEventListener("click", () => { stopPicking(); if (pendingLocation) openModal(modal); });

eventImageInput.addEventListener("change", () => {
    const file = eventImageInput.files[0];
    if (!file) { imagePreview.classList.add("hidden"); return; }
    imagePreview.src = URL.createObjectURL(file); imagePreview.classList.remove("hidden");
});

function resizeImage(file, maxSize = 800) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error("Ficheiro inválido."));
            img.onload = () => {
                const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
                canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.78));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

eventForm.addEventListener("submit", async e => {
    e.preventDefault();
    formError.classList.add("hidden");

    if (!pendingLocation) { formError.textContent = "Escolhe a localização no mapa."; formError.classList.remove("hidden"); return; }
    if (!eventForm.checkValidity()) { eventForm.reportValidity(); return; }

    let image = DEFAULT_IMAGE;
    const file = eventImageInput.files[0];
    if (file) { try { image = await resizeImage(file); } catch (err) { formError.textContent = err.message; formError.classList.remove("hidden"); return; } }

    const limitValue = $("eventLimit").value;

    const newEvent = {
        id: Date.now(), name: $("eventName").value.trim(), description: $("eventDescription").value.trim(),
        category: $("eventCategory").value, date: $("eventDate").value, time: $("eventTime").value,
        location: $("eventLocation").value.trim(), distrito: $("eventFormDistrict").value,
        latitude: pendingLocation.lat, longitude: pendingLocation.lng, image, custom: true,
        limit: limitValue ? parseInt(limitValue) : null // Guarda o limite
    };

    events.push(newEvent);
    const saved = persistCustomEvents();

    closeEventModal(); resetEventForm();
    if (!getFilteredEvents().some(ev => ev.id === newEvent.id)) resetFiltersBtn.click();
    else filterEvents();

    setActive(newEvent.id); focusEvent(newEvent.id);
    showToast(saved ? "Evento adicionado!" : "Erro ao guardar.", saved ? "success" : "error");
});

setupControls();
filterEvents({ fit: true });
