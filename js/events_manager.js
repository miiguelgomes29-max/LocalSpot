// ==========================================================================
// MÓDULO 2: GESTÃO DE EVENTOS, FILTROS, INSCRIÇÕES, PIN NO MAPA E DETALHES
// ==========================================================================
(function () {
    "use strict";

    const LS = window.LocalSpot = window.LocalSpot || {};
    const $ = LS.$;

    LS.state = {
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

    LS.favorites = new Set(LS.loadJSON(LS.STORAGE_FAVS, []).map(String));
    LS.myEnrollments = new Set();
    LS.myFollowing = new Map();
    LS.myFollowingProfiles = [];
    LS.allEnrollmentsMap = new Map();
    LS.activeId = null;
    LS.pendingLocation = null;
    LS.editingEventId = null;
    LS.detailEventId = null;
    LS.currentList = [];

    // ----------------------------------------------------------------------
    // PAÍSES E DISTRITOS NOS SELETORES
    // ----------------------------------------------------------------------
    LS.populateLocationsSelects = () => {
        const headerSel = $("headerCountrySelect");
        const filterSel = $("districtFilter");
        const eventSel = $("eventDistrito");

        const countriesList = (window.COUNTRIES || []).map(c => c.name);
        const distritosList = window.DISTRITOS || [];

        if (headerSel && headerSel.options.length <= 1) {
            countriesList.forEach(c => {
                const opt = document.createElement("option");
                opt.value = c;
                opt.textContent = `🌍 ${c}`;
                headerSel.appendChild(opt);
            });
            distritosList.forEach(d => {
                const opt = document.createElement("option");
                opt.value = d;
                opt.textContent = `📍 ${d} (PT)`;
                headerSel.appendChild(opt);
            });
        }

        if (filterSel && filterSel.options.length <= 1) {
            countriesList.forEach(c => {
                const opt = document.createElement("option");
                opt.value = c;
                opt.textContent = `🌍 ${c}`;
                filterSel.appendChild(opt);
            });
            distritosList.forEach(d => {
                const opt = document.createElement("option");
                opt.value = d;
                opt.textContent = `📍 ${d}`;
                filterSel.appendChild(opt);
            });
        }

        if (eventSel && eventSel.options.length === 0) {
            distritosList.forEach(d => {
                const opt = document.createElement("option");
                opt.value = d;
                opt.textContent = `${d} (Portugal)`;
                eventSel.appendChild(opt);
            });
            countriesList.filter(c => c !== "Portugal").forEach(c => {
                const opt = document.createElement("option");
                opt.value = c;
                opt.textContent = `🌍 ${c}`;
                eventSel.appendChild(opt);
            });
        }
    };

    // ----------------------------------------------------------------------
    // MAPEAMENTO E CARREGAMENTO DE EVENTOS (SUPABASE + FALLBACK LOCAL)
    // ----------------------------------------------------------------------
    LS.mapDbEvent = row => ({
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
        image: row.image || window.DEFAULT_IMAGE
    });

    LS.loadEventsFromSupabase = async () => {
        let dbEvents = [];
        try {
            const { data, error } = await window.supabaseClient
                .from("events")
                .select("*")
                .order("date", { ascending: true });

            if (!error && Array.isArray(data)) {
                dbEvents = data.map(LS.mapDbEvent);
            }
        } catch (e) {}

        const localEvents = LS.loadJSON(LS.STORAGE_LOCAL_EVENTS, []);
        const dbIds = new Set(dbEvents.map(e => String(e.id)));
        const merged = [...dbEvents, ...localEvents.filter(e => !dbIds.has(String(e.id)))];

        window.events = merged;
        LS.filterEvents();
    };

    LS.loadMyEnrollments = async () => {
        if (!LS.currentUser) return;
        try {
            const { data } = await window.supabaseClient
                .from("enrollments")
                .select("event_id")
                .eq("user_id", LS.currentUser.id);
            if (data) LS.myEnrollments = new Set(data.map(row => String(row.event_id)));
        } catch (e) {}
    };

    LS.loadAllEnrollmentsSummary = async () => {
        try {
            const { data } = await window.supabaseClient.from("enrollments").select("event_id, user_id, user_name");
            if (data) {
                LS.allEnrollmentsMap = new Map();
                data.forEach(row => {
                    const key = String(row.event_id);
                    if (!LS.allEnrollmentsMap.has(key)) LS.allEnrollmentsMap.set(key, []);
                    LS.allEnrollmentsMap.get(key).push(row);
                });
            }
        } catch (e) {}
    };

    window.getFriendsGoingToEvent = eventId => {
        const attendees = LS.allEnrollmentsMap.get(String(eventId)) || [];
        if (!attendees.length || !(window.friendsList || []).length) return [];
        const friendById = new Map(window.friendsList.map(f => [String(f.id), f]));
        return attendees.map(a => friendById.get(String(a.user_id))).filter(Boolean);
    };

    window.toggleEnrollment = async id => {
        if (!LS.currentUser || !LS.currentProfile) {
            LS.showToast("Inicia sessão para te inscreveres.", "error");
            LS.$("authOverlay")?.classList.remove("hidden");
            return;
        }

        const ev = window.events.find(x => String(x.id) === String(id));
        if (!ev) return;

        const strId = String(id);
        const isEnrolled = LS.myEnrollments.has(strId);

        try {
            if (isEnrolled) {
                await window.supabaseClient.from("enrollments").delete().eq("event_id", ev.id).eq("user_id", LS.currentUser.id);
                LS.myEnrollments.delete(strId);
                ev.enrolled = Math.max(0, (ev.enrolled || 1) - 1);
                await window.supabaseClient.from("events").update({ enrolled: ev.enrolled }).eq("id", ev.id);
                LS.showToast(`Inscrição cancelada em "${ev.name}".`);
            } else {
                if (ev.maxParticipants && ev.enrolled >= ev.maxParticipants) {
                    LS.showToast("Lotação máxima atingida.", "error");
                    return;
                }
                await window.supabaseClient.from("enrollments").insert([{
                    event_id: ev.id,
                    user_id: LS.currentUser.id,
                    user_name: LS.currentProfile.full_name
                }]);
                LS.myEnrollments.add(strId);
                ev.enrolled = (ev.enrolled || 0) + 1;
                await window.supabaseClient.from("events").update({ enrolled: ev.enrolled }).eq("id", ev.id);
                LS.showToast(`Inscrição confirmada em "${ev.name}"! 🎉`, "success");
            }

            await LS.loadAllEnrollmentsSummary();
            LS.filterEvents();
            if ($("detailModal") && !$("detailModal").classList.contains("hidden") && String(LS.detailEventId) === strId) {
                window.openEventDetails(ev.id);
            }
        } catch (err) {
            // Fallback local caso seja evento local
            if (isEnrolled) {
                LS.myEnrollments.delete(strId);
                ev.enrolled = Math.max(0, (ev.enrolled || 1) - 1);
            } else {
                LS.myEnrollments.add(strId);
                ev.enrolled = (ev.enrolled || 0) + 1;
            }
            LS.filterEvents();
            LS.showToast(isEnrolled ? "Inscrição cancelada." : "Inscrição confirmada! 🎉", "success");
        }
    };

    // ----------------------------------------------------------------------
    // SEGUIR ORGANIZADORES
    // ----------------------------------------------------------------------
    LS.loadMyFollowing = async () => {
        if (!LS.currentUser) return;
        try {
            const { data } = await window.supabaseClient
                .from("follows")
                .select("following_id, following_name")
                .eq("follower_id", LS.currentUser.id);

            if (data) {
                LS.myFollowing = new Map(data.map(r => [String(r.following_id), r.following_name]));
                const ids = data.map(r => r.following_id).filter(Boolean);
                if (ids.length > 0) {
                    const { data: profs } = await window.supabaseClient.from("profiles").select("*").in("id", ids);
                    LS.myFollowingProfiles = profs || [];
                } else {
                    LS.myFollowingProfiles = [];
                }
            }
        } catch (e) {}
    };

    LS.toggleFollowOrganizer = async (organizerId, organizerName) => {
        if (!LS.currentUser || !organizerId || String(organizerId) === String(LS.currentUser.id)) return;
        const key = String(organizerId);

        if (LS.myFollowing.has(key)) {
            await window.supabaseClient.from("follows").delete().eq("follower_id", LS.currentUser.id).eq("following_id", organizerId);
            LS.myFollowing.delete(key);
            LS.myFollowingProfiles = LS.myFollowingProfiles.filter(p => String(p.id) !== key);
            LS.showToast(`Deixaste de seguir ${organizerName}.`);
        } else {
            await window.supabaseClient.from("follows").insert([{
                follower_id: LS.currentUser.id,
                following_id: organizerId,
                following_name: organizerName
            }]);
            LS.myFollowing.set(key, organizerName);
            LS.showToast(`A seguir ${organizerName}!`, "success");
        }
        LS.filterEvents();
    };

    // ----------------------------------------------------------------------
    // FILTROS E RENDERIZAÇÃO DA LISTA
    // ----------------------------------------------------------------------
    LS.getFilteredEvents = () => {
        const query = LS.state.search.trim().toLowerCase();
        const pos = typeof userPosition !== "undefined" ? userPosition : null;

        return (window.events || [])
            .map(ev => ({
                ...ev,
                distance: pos ? distanceKm(pos.lat, pos.lng, ev.latitude, ev.longitude) : null
            }))
            .filter(ev => {
                if (LS.state.category !== "all" && ev.category !== LS.state.category) return false;
                if (LS.state.district !== "all" && ev.distrito !== LS.state.district) return false;
                if (LS.state.onlyFavorites && !LS.favorites.has(String(ev.id))) return false;
                if (LS.state.onlyFree && !isEventFree(ev)) return false;
                if (LS.state.onlyFollowing && (!ev.creatorId || !LS.myFollowing.has(String(ev.creatorId)))) return false;
                if (LS.state.period === "upcoming" && isEventPast(ev)) return false;
                if (LS.state.period === "today" && !isEventToday(ev)) return false;
                if (LS.state.period === "week" && !isEventThisWeek(ev)) return false;
                if (LS.state.period === "past" && !isEventPast(ev)) return false;
                if (ev.distance !== null && LS.state.radius < 300 && ev.distance > LS.state.radius) return false;
                if (query) {
                    const text = `${ev.name} ${ev.location} ${ev.distrito} ${ev.description} ${ev.category} ${ev.creatorName || ""}`.toLowerCase();
                    if (!text.includes(query)) return false;
                }
                return true;
            })
            .sort((a, b) => {
                if (LS.state.sort === "distance" && a.distance !== null && b.distance !== null) return a.distance - b.distance;
                if (LS.state.sort === "popular") return (b.enrolled || 0) - (a.enrolled || 0);
                return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
            });
    };

    LS.canManageEvent = ev => {
        if (!LS.currentUser) return false;
        if (LS.isAdminAccount()) return true;
        return ev.creatorId && String(ev.creatorId) === String(LS.currentUser.id);
    };

    LS.renderList = list => {
        LS.currentList = list;
        const total = list.length;
        const eventCount = $("eventCount");
        const emptyState = $("emptyState");
        const eventsList = $("eventsList");

        if (eventCount) eventCount.textContent = total === 1 ? "1 evento encontrado" : `${total} eventos encontrados`;
        if (emptyState) emptyState.classList.toggle("hidden", total > 0);
        if (!eventsList) return;
        eventsList.innerHTML = "";

        list.forEach(ev => {
            const isFav = LS.favorites.has(String(ev.id));
            const isRegistered = LS.myEnrollments.has(String(ev.id));
            const past = isEventPast(ev);
            const full = ev.maxParticipants && ev.enrolled >= ev.maxParticipants;
            const canManage = LS.canManageEvent(ev);
            const friendsGoing = window.getFriendsGoingToEvent(ev.id);

            const distText = ev.distance !== null
                ? ` · <strong>${ev.distance < 1 ? Math.round(ev.distance * 1000) + " m" : ev.distance.toFixed(1) + " km"}</strong>`
                : "";

            let regBtnText = "Inscrever-me";
            if (past) regBtnText = "Evento terminado";
            else if (isRegistered) regBtnText = "✓ Inscrito";
            else if (full) regBtnText = "Lotação esgotada";

            const card = document.createElement("article");
            card.className = "event-card" + (String(ev.id) === String(LS.activeId) ? " active" : "");
            card.dataset.id = ev.id;
            card.innerHTML = `
                <div class="event-image-wrap">
                    <img class="event-image" src="${escapeHTML(ev.image || window.DEFAULT_IMAGE)}" alt="${escapeHTML(ev.name)}" loading="lazy" onerror="this.src='${window.DEFAULT_IMAGE}'">
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
                LS.selectEvent(ev.id);
                if (window.innerWidth <= 860 && typeof LS.setMobileView === "function") LS.setMobileView("map");
            });

            eventsList.appendChild(card);
        });
    };

    LS.filterEvents = () => {
        const filtered = LS.getFilteredEvents();
        LS.renderList(filtered);
        try {
            if (typeof showEventsOnMap === "function") showEventsOnMap(filtered);
        } catch (e) {}
    };

    LS.selectEvent = (id, { scroll = false } = {}) => {
        LS.activeId = id;
        document.querySelectorAll(".event-card").forEach(c => c.classList.toggle("active", String(c.dataset.id) === String(id)));
        try {
            if (typeof focusEventOnMap === "function") focusEventOnMap(id);
        } catch (e) {}
        if (scroll) {
            const card = document.querySelector(`.event-card[data-id="${id}"]`);
            if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    };

    window.handleMarkerClick = id => LS.selectEvent(id, { scroll: true });

    // ----------------------------------------------------------------------
    // CRIAR, EDITAR E ELIMINAR EVENTOS (+ NOVO EVENTO)
    // ----------------------------------------------------------------------
    LS.getDefaultEventCoords = () => {
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
    };

    LS.updateCoordsDisplay = () => {
        const coordsText = $("selectedCoordinates");
        if (!coordsText) return;
        if (LS.pendingLocation) {
            coordsText.innerHTML = `<span class="ok" style="color:var(--primary); font-weight:700;">📍 ${LS.pendingLocation.lat.toFixed(5)}, ${LS.pendingLocation.lng.toFixed(5)}</span>`;
        } else {
            coordsText.textContent = "Pin ainda não colocado no mapa";
        }
    };

    async function uploadEventImage(file) {
        const ext = file.name.split(".").pop() || "jpg";
        const fileName = `${LS.currentUser.id}_${Date.now()}.${ext}`;
        const { error } = await window.supabaseClient.storage
            .from("event-images")
            .upload(fileName, file, { cacheControl: "3600", upsert: false });
        if (error) throw error;
        const { data } = window.supabaseClient.storage.from("event-images").getPublicUrl(fileName);
        return data.publicUrl;
    }

    LS.bindEventCreationAndEdit = () => {
        const modal = $("eventModal");
        const eventForm = $("eventForm");
        const eventImageInput = $("eventImage");
        const imagePreview = $("imagePreview");
        const formError = $("formError");
        const pickBanner = $("pickBanner");

        $("addEventButton")?.addEventListener("click", async () => {
            // Garante que verifica sessão ativa antes de bloquear
            if (!LS.currentUser) {
                const { data: { session } } = await window.supabaseClient.auth.getSession();
                if (session?.user) {
                    await LS.handleAuthenticatedSession(session.user);
                } else {
                    const cached = LS.loadJSON(LS.STORAGE_ACTIVE_PROFILE, null);
                    if (cached) await LS.activateLocalHybridSession(cached);
                }
            }

            if (!LS.currentUser) {
                LS.showToast("Inicia sessão primeiro para criar um evento.", "error");
                LS.renderSavedSessions();
                LS.$("authOverlay")?.classList.remove("hidden");
                return;
            }

            LS.editingEventId = null;
            if ($("eventModalTitle")) $("eventModalTitle").textContent = "Novo Evento";
            if ($("submitEventBtn")) $("submitEventBtn").textContent = "Publicar Evento";
            eventForm?.reset();
            if ($("eventPrice")) $("eventPrice").value = "Gratuito";
            if ($("eventDate")) $("eventDate").value = new Date().toISOString().slice(0, 10);
            if ($("eventTime")) $("eventTime").value = "19:00";
            imagePreview?.classList.add("hidden");
            formError?.classList.add("hidden");

            LS.pendingLocation = LS.getDefaultEventCoords();
            LS.updateCoordsDisplay();
            LS.openModal(modal);
        });

        window.openEditEvent = id => {
            const ev = (window.events || []).find(x => String(x.id) === String(id));
            if (!ev || !LS.canManageEvent(ev)) return;

            LS.editingEventId = ev.id;
            if ($("eventModalTitle")) $("eventModalTitle").textContent = "Editar Evento";
            if ($("submitEventBtn")) $("submitEventBtn").textContent = "Guardar Alterações";
            formError?.classList.add("hidden");

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

            LS.pendingLocation = { lat: ev.latitude, lng: ev.longitude };
            LS.updateCoordsDisplay();

            if (imagePreview) {
                if (ev.image) {
                    imagePreview.src = ev.image;
                    imagePreview.classList.remove("hidden");
                } else {
                    imagePreview.classList.add("hidden");
                }
            }
            LS.openModal(modal);
        };

        window.deleteEvent = async id => {
            const ev = (window.events || []).find(x => String(x.id) === String(id));
            if (!ev || !LS.canManageEvent(ev)) return;
            if (!confirm(`Tens a certeza que queres eliminar "${ev.name}"?`)) return;

            await window.supabaseClient.from("events").delete().eq("id", ev.id);

            const localList = LS.loadJSON(LS.STORAGE_LOCAL_EVENTS, []).filter(x => String(x.id) !== String(id));
            LS.saveJSON(LS.STORAGE_LOCAL_EVENTS, localList);

            window.events = (window.events || []).filter(x => String(x.id) !== String(id));
            LS.filterEvents();
            LS.showToast("Evento eliminado com sucesso.");
        };

        $("closeModal")?.addEventListener("click", () => {
            LS.closeModalEl(modal);
            try { if (typeof stopLocationPicking === "function") stopLocationPicking(); } catch (e) {}
        });

        modal?.addEventListener("mousedown", e => {
            if (e.target === modal) {
                LS.closeModalEl(modal);
                try { if (typeof stopLocationPicking === "function") stopLocationPicking(); } catch (e) {}
            }
        });

        // Marcar Pin no Mapa
        $("changeLocationButton")?.addEventListener("click", () => {
            LS.closeModalEl(modal);
            pickBanner?.classList.remove("hidden");
            if (window.innerWidth <= 860 && typeof LS.setMobileView === "function") LS.setMobileView("map");

            if (typeof startLocationPicking === "function") {
                startLocationPicking(coords => {
                    LS.pendingLocation = coords;
                    LS.updateCoordsDisplay();
                    pickBanner?.classList.add("hidden");
                    LS.openModal(modal);
                });
            } else if (typeof map !== "undefined" && map && typeof map.once === "function") {
                LS.showToast("Clica num ponto do mapa para marcar o pin.");
                map.once("click", e => {
                    LS.pendingLocation = { lat: e.lngLat.lat, lng: e.lngLat.lng };
                    LS.updateCoordsDisplay();
                    pickBanner?.classList.add("hidden");
                    LS.openModal(modal);
                });
            } else {
                LS.pendingLocation = LS.getDefaultEventCoords();
                LS.updateCoordsDisplay();
                pickBanner?.classList.add("hidden");
                LS.openModal(modal);
            }
        });

        $("cancelPickButton")?.addEventListener("click", () => {
            try { if (typeof stopLocationPicking === "function") stopLocationPicking(); } catch (e) {}
            pickBanner?.classList.add("hidden");
            LS.openModal(modal);
        });

        $("pickSearchBtn")?.addEventListener("click", async () => {
            const q = $("pickSearchInput")?.value.trim();
            if (!q) return;
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
                const data = await res.json();
                if (data && data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lng = parseFloat(data[0].lon);
                    LS.pendingLocation = { lat, lng };
                    LS.updateCoordsDisplay();
                    try { if (typeof map !== "undefined" && map?.flyTo) map.flyTo({ center: [lng, lat], zoom: 15 }); } catch (e) {}
                    LS.showToast(`Localização marcada em ${data[0].display_name.split(",")[0]}`, "success");
                } else {
                    LS.showToast("Morada não encontrada.", "error");
                }
            } catch (e) {
                LS.showToast("Erro ao pesquisar morada.", "error");
            }
        });

        eventImageInput?.addEventListener("change", () => {
            const file = eventImageInput.files?.[0];
            if (!file) { imagePreview?.classList.add("hidden"); return; }
            const reader = new FileReader();
            reader.onload = () => {
                if (imagePreview) {
                    imagePreview.src = reader.result;
                    imagePreview.classList.remove("hidden");
                }
            };
            reader.readAsDataURL(file);
        });

        // Submissão do formulário de criação/edição de evento
        eventForm?.addEventListener("submit", async e => {
            e.preventDefault();
            formError?.classList.add("hidden");

            if (!LS.pendingLocation) {
                LS.pendingLocation = LS.getDefaultEventCoords();
            }

            const submitBtn = $("submitEventBtn");
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "A guardar..."; }

            try {
                const existing = LS.editingEventId
                    ? (window.events || []).find(x => String(x.id) === String(LS.editingEventId))
                    : null;
                let imageUrl = existing ? existing.image : window.DEFAULT_IMAGE;

                const file = eventImageInput?.files?.[0];
                if (file) {
                    try {
                        imageUrl = await uploadEventImage(file);
                    } catch (uploadErr) {
                        imageUrl = imagePreview?.src || window.DEFAULT_IMAGE;
                    }
                }

                const maxVal = $("eventMaxParticipants")?.value;
                const basePayload = {
                    name: $("eventName").value.trim(),
                    category: $("eventCategory").value,
                    distrito: $("eventDistrito").value,
                    date: $("eventDate").value,
                    time: $("eventTime").value,
                    location: $("eventLocation").value.trim(),
                    latitude: LS.pendingLocation.lat,
                    longitude: LS.pendingLocation.lng,
                    max_participants: maxVal ? parseInt(maxVal, 10) : null,
                    price: ($("eventPrice")?.value || "").trim() || "Gratuito",
                    description: ($("eventDescription")?.value || "").trim(),
                    image: imageUrl
                };

                if (LS.editingEventId) {
                    const { data, error } = await window.supabaseClient
                        .from("events")
                        .update(basePayload)
                        .eq("id", LS.editingEventId)
                        .select()
                        .maybeSingle();

                    const updated = data
                        ? LS.mapDbEvent(data)
                        : { ...existing, ...basePayload, maxParticipants: basePayload.max_participants };

                    const idx = window.events.findIndex(x => String(x.id) === String(LS.editingEventId));
                    if (idx !== -1) window.events[idx] = updated;

                    const localList = LS.loadJSON(LS.STORAGE_LOCAL_EVENTS, []);
                    const lIdx = localList.findIndex(x => String(x.id) === String(LS.editingEventId));
                    if (lIdx !== -1) {
                        localList[lIdx] = updated;
                        LS.saveJSON(LS.STORAGE_LOCAL_EVENTS, localList);
                    }

                    LS.showToast("Evento atualizado com sucesso!", "success");
                } else {
                    // Garante que o perfil existe na BD antes de inserir (evita erro de Foreign Key)
                    if (!LS.currentUser.isLocalFallback) {
                        await window.supabaseClient.from("profiles").upsert({
                            id: LS.currentUser.id,
                            email: LS.currentUser.email,
                            full_name: LS.currentProfile?.full_name || LS.currentUser.email.split("@")[0],
                            role: LS.currentProfile?.role || "user"
                        });
                    }

                    const fullPayload = {
                        ...basePayload,
                        creator_id: LS.currentUser.id,
                        creator_name: LS.currentProfile?.full_name || LS.currentUser.email.split("@")[0],
                        creator_type: LS.isBusinessAccount() ? (LS.currentProfile?.business_type || "Entidade") : "Utilizador",
                        creator_role: LS.currentProfile?.role || "user",
                        creator_verified: LS.isEntityVerified(LS.currentProfile),
                        external_url: ($("eventExternalUrl")?.value || "").trim() || null,
                        enrolled: 0
                    };

                    let createdEvent = null;

                    if (!LS.currentUser.isLocalFallback) {
                        let { data, error } = await window.supabaseClient.from("events").insert([fullPayload]).select().maybeSingle();
                        if (error) {
                            const retry = await window.supabaseClient.from("events").insert([{
                                ...basePayload,
                                creator_id: LS.currentUser.id,
                                creator_name: LS.currentProfile?.full_name || LS.currentUser.email.split("@")[0],
                                enrolled: 0
                            }]).select().maybeSingle();
                            data = retry.data;
                            error = retry.error;
                        }
                        if (!error && data) {
                            createdEvent = LS.mapDbEvent(data);
                        }
                    }

                    // Fallback local garantido caso a inserção na nuvem falhe por RLS/sessão
                    if (!createdEvent) {
                        createdEvent = LS.mapDbEvent({
                            ...fullPayload,
                            id: `local_evt_${Date.now()}`
                        });
                        const localList = LS.loadJSON(LS.STORAGE_LOCAL_EVENTS, []);
                        localList.unshift(createdEvent);
                        LS.saveJSON(LS.STORAGE_LOCAL_EVENTS, localList);
                    }

                    window.events.unshift(createdEvent);
                    if (typeof LS.notifyFollowersOfNewEvent === "function") {
                        await LS.notifyFollowersOfNewEvent(createdEvent);
                    }
                    LS.showToast("Evento publicado no mapa! 🎉", "success");
                }

                LS.closeModalEl(modal);
                try { if (typeof stopLocationPicking === "function") stopLocationPicking(); } catch (e) {}
                LS.filterEvents();

                try {
                    if (typeof map !== "undefined" && map?.flyTo && LS.pendingLocation) {
                        map.flyTo({ center: [LS.pendingLocation.lng, LS.pendingLocation.lat], zoom: 14 });
                    }
                } catch (e) {}
            } catch (err) {
                if (formError) {
                    formError.textContent = err.message || "Erro ao guardar evento.";
                    formError.classList.remove("hidden");
                }
                LS.showToast("Erro ao publicar: " + (err.message || "verifica os campos"), "error");
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = LS.editingEventId ? "Guardar Alterações" : "Publicar Evento";
                }
            }
        });
    };

    // ----------------------------------------------------------------------
    // DETALHES DO EVENTO, BILHETE QR, COMENTÁRIOS, AVALIAÇÕES E DENÚNCIAS
    // ----------------------------------------------------------------------
    function updateDetailSocialButton(ev) {
        const followBtn = $("detailFollowBtn");
        if (!followBtn) return;

        if (!ev.creatorId || !LS.currentUser || String(ev.creatorId) === String(LS.currentUser.id)) {
            followBtn.classList.add("hidden");
            return;
        }

        const isOrgBiz = ev.creatorRole === "business" || (ev.creatorType && ev.creatorType !== "Utilizador" && ev.creatorType !== "Admin");
        if (isOrgBiz) {
            followBtn.classList.remove("hidden");
            followBtn.textContent = LS.myFollowing.has(String(ev.creatorId)) ? "✓ A seguir" : "+ Seguir";
            followBtn.onclick = async () => {
                await LS.toggleFollowOrganizer(ev.creatorId, ev.creatorName);
                updateDetailSocialButton(ev);
            };
        } else {
            followBtn.classList.remove("hidden");
            const isFriend = (window.friendsList || []).some(f => String(f.id) === String(ev.creatorId));
            const isSent = LS.sentFriendRequestIds?.has(ev.creatorId);
            if (isFriend) {
                followBtn.textContent = "💬 Conversar";
                followBtn.onclick = () => {
                    LS.closeModalEl($("detailModal"));
                    if (typeof window.openFriendChat === "function") window.openFriendChat(ev.creatorId);
                };
            } else if (isSent) {
                followBtn.textContent = "✈️ Pedido enviado";
                followBtn.onclick = null;
            } else {
                followBtn.textContent = "👊 Adicionar Amigo";
                followBtn.onclick = () => {
                    if (typeof window.sendFriendRequest === "function") window.sendFriendRequest(ev.creatorId, ev.creatorName);
                };
            }
        }
    }

    window.openEventDetails = async id => {
        const ev = (window.events || []).find(x => String(x.id) === String(id));
        const detailModal = $("detailModal");
        if (!ev || !detailModal) return;

        LS.detailEventId = ev.id;
        const isRegistered = LS.myEnrollments.has(String(ev.id));
        const isFav = LS.favorites.has(String(ev.id));
        const past = isEventPast(ev);
        const full = ev.maxParticipants && ev.enrolled >= ev.maxParticipants;
        const canManage = LS.canManageEvent(ev);

        if ($("detailHeroImg")) $("detailHeroImg").src = ev.image || window.DEFAULT_IMAGE;
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
            favBtn.onclick = () => {
                LS.toggleFavorite(ev.id);
                favBtn.textContent = LS.favorites.has(String(ev.id)) ? "★ Guardado" : "☆ Guardar";
            };
        }

        if ($("detailDirectionsBtn")) $("detailDirectionsBtn").href = `https://www.google.com/maps/dir/?api=1&destination=${ev.latitude},${ev.longitude}`;
        if ($("detailCalendarBtn")) $("detailCalendarBtn").onclick = () => downloadEventICS(ev);
        if ($("detailShareBtn")) $("detailShareBtn").onclick = () => shareEventLink(ev);
        if ($("detailReportBtn")) $("detailReportBtn").onclick = () => {
            $("reportEventName").textContent = `A denunciar: ${ev.name}`;
            $("reportDetails").value = "";
            LS.openModal($("reportModal"));
        };

        const ownerBar = $("detailOwnerBar");
        if (ownerBar) ownerBar.classList.toggle("hidden", !canManage);
        if ($("detailEditBtn")) $("detailEditBtn").onclick = () => { LS.closeModalEl(detailModal); window.openEditEvent(ev.id); };
        if ($("detailDeleteBtn")) $("detailDeleteBtn").onclick = () => { LS.closeModalEl(detailModal); window.deleteEvent(ev.id); };

        if ($("reviewForm")) $("reviewForm").classList.toggle("hidden", !past);
        LS.openModal(detailModal);
        await Promise.all([loadEventAttendees(ev.id), loadEventComments(ev.id), loadEventReviews(ev.id)]);
    };

    window.openTicketModal = id => {
        const ev = (window.events || []).find(x => String(x.id) === String(id));
        if (!ev || !LS.currentUser || !LS.currentProfile) return;
        const code = `LS-${String(ev.id).slice(0, 6).toUpperCase()}-${LS.currentUser.id.slice(0, 6).toUpperCase()}`;
        const qrPayload = encodeURIComponent(`LocalSpot Ticket | ${code} | ${ev.name} | ${LS.currentProfile.full_name}`);
        $("ticketEventTitle").textContent = ev.name;
        $("ticketEventMeta").textContent = `📅 ${formatEventDate(ev)} às ${ev.time} · 📍 ${ev.location}`;
        $("ticketQrImage").src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrPayload}`;
        $("ticketCodeText").textContent = code;
        $("ticketHolderName").textContent = `Participante: ${LS.currentProfile.full_name}`;
        LS.openModal($("ticketModal"));
    };

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
        try {
            await navigator.clipboard.writeText(shareUrl);
            LS.showToast("Link copiado!", "success");
        } catch (e) {}
    }

    async function loadEventAttendees(eventId) {
        const listEl = $("detailAttendeesList");
        if (!listEl) return;
        const { data } = await window.supabaseClient.from("enrollments").select("user_id, user_name").eq("event_id", eventId);
        if (!data || data.length === 0) {
            listEl.innerHTML = `<span class="muted">Ainda sem inscritos.</span>`;
            return;
        }
        listEl.innerHTML = data.map(row => `<span class="attendee-pill">👤 ${escapeHTML(row.user_name || "Participante")}</span>`).join("");
    }

    async function loadEventComments(eventId) {
        const listEl = $("detailCommentsList");
        if (!listEl) return;
        const { data } = await window.supabaseClient.from("event_comments").select("*").eq("event_id", eventId).order("created_at", { ascending: true });
        if (!data || data.length === 0) {
            listEl.innerHTML = `<p class="muted" style="font-size:13px;">Sem comentários ainda.</p>`;
            return;
        }
        listEl.innerHTML = data.map(c => `<div class="comment-item"><div class="comment-head"><strong>${escapeHTML(c.user_name)}</strong></div><p>${escapeHTML(c.content)}</p></div>`).join("");
    }

    async function loadEventReviews(eventId) {
        const listEl = $("detailReviewsList");
        const badgeEl = $("detailRatingBadge");
        if (!listEl || !badgeEl) return;
        const { data } = await window.supabaseClient.from("event_reviews").select("*").eq("event_id", eventId);
        if (!data || data.length === 0) {
            badgeEl.classList.add("hidden");
            listEl.innerHTML = `<p class="muted" style="font-size:13px;">Sem avaliações.</p>`;
            return;
        }
        const avg = (data.reduce((sum, r) => sum + Number(r.rating), 0) / data.length).toFixed(1);
        badgeEl.textContent = `⭐ ${avg} (${data.length})`;
        badgeEl.classList.remove("hidden");
        listEl.innerHTML = data.map(r => `<div class="comment-item"><div class="comment-head"><strong>${escapeHTML(r.user_name)} · ${"⭐".repeat(r.rating)}</strong></div>${r.comment ? `<p>${escapeHTML(r.comment)}</p>` : ""}</div>`).join("");
    }

    LS.toggleFavorite = id => {
        const strId = String(id);
        if (LS.favorites.has(strId)) {
            LS.favorites.delete(strId);
            LS.showToast("Removido dos favoritos.");
        } else {
            LS.favorites.add(strId);
            LS.showToast("Guardado nos favoritos ★");
        }
        LS.saveJSON(LS.STORAGE_FAVS, [...LS.favorites]);
        LS.filterEvents();
    };

    // ----------------------------------------------------------------------
    // BIND DE FILTROS E DETALHES
    // ----------------------------------------------------------------------
    LS.bindFiltersAndDetails = () => {
        $("eventsList")?.addEventListener("click", e => {
            const favBtn = e.target.closest("[data-fav]");
            if (favBtn) {
                e.stopPropagation();
                LS.toggleFavorite(favBtn.dataset.fav);
            }
        });

        $("searchInput")?.addEventListener("input", e => {
            LS.state.search = e.target.value;
            LS.filterEvents();
        });

        $("categoryChips")?.addEventListener("click", e => {
            const chip = e.target.closest(".chip");
            if (!chip) return;
            $("categoryChips").querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            LS.state.category = chip.dataset.category;
            LS.filterEvents();
        });

        const handleLocationFilterChange = val => {
            LS.state.district = val;
            if ($("districtFilter")) $("districtFilter").value = val;
            if ($("headerCountrySelect")) $("headerCountrySelect").value = val;

            const foundCountry = (window.COUNTRIES || []).find(c => c.name === val);
            if (foundCountry) {
                try {
                    if (typeof map !== "undefined" && map?.flyTo) {
                        map.flyTo({ center: foundCountry.coords, zoom: foundCountry.zoom });
                    }
                } catch (e) {}
            }
            LS.filterEvents();
        };

        $("districtFilter")?.addEventListener("change", e => handleLocationFilterChange(e.target.value));
        $("headerCountrySelect")?.addEventListener("change", e => handleLocationFilterChange(e.target.value));

        $("periodFilter")?.addEventListener("change", e => {
            LS.state.period = e.target.value;
            LS.filterEvents();
        });

        $("radiusSlider")?.addEventListener("input", e => {
            LS.state.radius = Number(e.target.value);
            if ($("radiusValue")) $("radiusValue").textContent = LS.state.radius >= 300 ? "Global" : `${LS.state.radius} km`;
            LS.filterEvents();
        });

        $("sortFilter")?.addEventListener("change", e => {
            LS.state.sort = e.target.value;
            LS.filterEvents();
        });

        $("favoritesToggle")?.addEventListener("click", () => {
            LS.state.onlyFavorites = !LS.state.onlyFavorites;
            $("favoritesToggle").classList.toggle("on", LS.state.onlyFavorites);
            LS.filterEvents();
        });

        $("freeOnlyToggle")?.addEventListener("click", () => {
            LS.state.onlyFree = !LS.state.onlyFree;
            $("freeOnlyToggle").classList.toggle("on", LS.state.onlyFree);
            LS.filterEvents();
        });

        $("followingOnlyToggle")?.addEventListener("click", () => {
            LS.state.onlyFollowing = !LS.state.onlyFollowing;
            $("followingOnlyToggle").classList.toggle("on", LS.state.onlyFollowing);
            LS.filterEvents();
        });

        $("resetFilters")?.addEventListener("click", () => {
            LS.state = {
                search: "", category: "all", district: "all", period: "all",
                radius: 300, sort: "date", onlyFavorites: false, onlyFree: false, onlyFollowing: false
            };
            if ($("searchInput")) $("searchInput").value = "";
            if ($("districtFilter")) $("districtFilter").value = "all";
            if ($("headerCountrySelect")) $("headerCountrySelect").value = "all";
            if ($("periodFilter")) $("periodFilter").value = "all";
            if ($("radiusSlider")) $("radiusSlider").value = 300;
            if ($("radiusValue")) $("radiusValue").textContent = "Global";
            if ($("sortFilter")) $("sortFilter").value = "date";
            $("favoritesToggle")?.classList.remove("on");
            $("freeOnlyToggle")?.classList.remove("on");
            $("followingOnlyToggle")?.classList.remove("on");
            $("categoryChips")?.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c.dataset.category === "all"));
            LS.filterEvents();
        });

        $("locationButton")?.addEventListener("click", async () => {
            const btn = $("locationButton");
            btn.disabled = true;
            btn.innerHTML = `<span>⏳</span> A localizar...`;
            try {
                if (typeof locateUser === "function") await locateUser();
                if ($("sortFilter")) $("sortFilter").value = "distance";
                LS.state.sort = "distance";
                LS.filterEvents();
                LS.showToast("Localização obtida! Ordenado por distância.", "success");
            } catch (err) {
                LS.showToast(err.message || "Não foi possível obter localização.", "error");
            } finally {
                btn.disabled = false;
                btn.innerHTML = `<span aria-hidden="true">📍</span> Perto de mim`;
            }
        });

        $("exportCsvBtn")?.addEventListener("click", () => {
            if (!LS.currentList.length) {
                LS.showToast("Não existem eventos visíveis para exportar.", "error");
                return;
            }
            const headers = ["Nome", "Categoria", "Organizador", "País/Distrito", "Local", "Data", "Hora", "Preço", "Inscritos"];
            const rows = LS.currentList.map(ev => [
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

        $("closeDetail")?.addEventListener("click", () => LS.closeModalEl($("detailModal")));
        $("detailModal")?.addEventListener("mousedown", e => { if (e.target === $("detailModal")) LS.closeModalEl($("detailModal")); });
        $("closeTicket")?.addEventListener("click", () => LS.closeModalEl($("ticketModal")));
        $("ticketModal")?.addEventListener("mousedown", e => { if (e.target === $("ticketModal")) LS.closeModalEl($("ticketModal")); });
        $("closeReport")?.addEventListener("click", () => LS.closeModalEl($("reportModal")));
        $("reportModal")?.addEventListener("mousedown", e => { if (e.target === $("reportModal")) LS.closeModalEl($("reportModal")); });

        $("reportForm")?.addEventListener("submit", async e => {
            e.preventDefault();
            if (!LS.currentUser || !LS.detailEventId) return;
            await window.supabaseClient.from("event_reports").insert([{
                event_id: LS.detailEventId,
                reporter_id: LS.currentUser.id,
                reason: $("reportReason").value,
                details: $("reportDetails").value.trim()
            }]);
            LS.closeModalEl($("reportModal"));
            LS.showToast("Denúncia enviada.", "success");
        });

        $("commentForm")?.addEventListener("submit", async e => {
            e.preventDefault();
            if (!LS.currentUser || !LS.currentProfile || !LS.detailEventId) return;
            const input = $("commentInput");
            const content = input.value.trim();
            if (!content) return;
            await window.supabaseClient.from("event_comments").insert([{
                event_id: LS.detailEventId,
                user_id: LS.currentUser.id,
                user_name: LS.currentProfile.full_name,
                content
            }]);
            input.value = "";
            await loadEventComments(LS.detailEventId);
        });

        $("reviewForm")?.addEventListener("submit", async e => {
            e.preventDefault();
            if (!LS.currentUser || !LS.currentProfile || !LS.detailEventId) return;
            await window.supabaseClient.from("event_reviews").upsert([{
                event_id: LS.detailEventId,
                user_id: LS.currentUser.id,
                user_name: LS.currentProfile.full_name,
                rating: Number($("reviewRating").value),
                comment: $("reviewComment").value.trim()
            }], { onConflict: "event_id,user_id" });
            $("reviewComment").value = "";
            await loadEventReviews(LS.detailEventId);
        });
    };
})();
