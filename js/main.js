/* ==========================================================================
   LocalSpot — Controlador Principal Unificado (Mapa 3D, Eventos & Radar Bump)
   ========================================================================== */
(function () {
    "use strict";

    // ----------------------------------------------------------------------
    // 1. CONSTANTES & PAÍSES GLOBAIS
    // ----------------------------------------------------------------------
    const STORAGE_KEYS = {
        CURRENT_USER: "ls_current_user_v6",
        SAVED_SESSIONS: "ls_saved_sessions_v6",
        USERS: "ls_users_v6",
        EVENTS: "ls_events_v6",
        NOTIFICATIONS: "ls_notifications_v6"
    };

    const COUNTRIES = [
        { name: "Portugal", coords: [-8.2245, 39.3999], zoom: 6.2 },
        { name: "Brasil", coords: [-47.9292, -15.7801], zoom: 4.2 },
        { name: "Espanha", coords: [-3.7492, 40.4637], zoom: 5.5 },
        { name: "França", coords: [2.2137, 46.2276], zoom: 5.3 },
        { name: "Reino Unido", coords: [-3.4360, 55.3781], zoom: 5.2 },
        { name: "Alemanha", coords: [10.4515, 51.1657], zoom: 5.4 },
        { name: "Itália", coords: [12.5674, 41.8719], zoom: 5.4 },
        { name: "Suíça", coords: [8.2275, 46.8182], zoom: 6.8 },
        { name: "Luxemburgo", coords: [6.1296, 49.8153], zoom: 8.5 },
        { name: "Países Baixos", coords: [5.2913, 52.1326], zoom: 6.8 },
        { name: "Bélgica", coords: [4.4699, 50.5039], zoom: 7.0 },
        { name: "Estados Unidos", coords: [-95.7129, 37.0902], zoom: 3.8 },
        { name: "Canadá", coords: [-106.3468, 56.1304], zoom: 3.5 },
        { name: "Angola", coords: [17.8739, -11.2027], zoom: 5.0 },
        { name: "Moçambique", coords: [35.5296, -18.6657], zoom: 5.0 },
        { name: "Cabo Verde", coords: [-23.6052, 15.1201], zoom: 7.5 },
        { name: "Japão", coords: [138.2529, 36.2048], zoom: 5.0 },
        { name: "Austrália", coords: [133.7751, -25.2744], zoom: 3.8 }
    ];

    const CATEGORY_EMOJIS = {
        "Música": "🎵",
        "Desporto": "⚽",
        "Cultura": "🎭",
        "Gastronomia": "🍽️",
        "Festa": "🎉",
        "Tecnologia": "💻"
    };

    const CATEGORY_IMAGES = {
        "Música": "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=900&q=80",
        "Desporto": "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=900&q=80",
        "Cultura": "https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&w=900&q=80",
        "Gastronomia": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80",
        "Festa": "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80",
        "Tecnologia": "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=900&q=80"
    };

    // ----------------------------------------------------------------------
    // 2. ESTADO GLOBAL DA APLICAÇÃO
    // ----------------------------------------------------------------------
    const state = {
        currentUser: null,
        users: [],
        events: [],
        filteredEvents: [],
        notifications: [],
        userLocation: null,
        filters: {
            search: "",
            category: "all",
            country: "all",
            period: "all",
            radius: 300,
            sort: "date",
            favoritesOnly: false,
            freeOnly: false,
            followingOnly: false
        },
        editingEventId: null,
        pickedCoords: null,
        isPickingLocation: false,
        activeDetailEventId: null,
        uploadedImageData: "",
        // Estado do Assistente de Registo
        selectedAvatar: "😎",
        selectedVibe: { emoji: "🎉", text: "Pronto pra sair" },
        selectedPrivacy: "precise",
        // Referências MapLibre
        mapInstance: null,
        eventMarkers: [],
        friendMarkers: [],
        userMarker: null,
        pickMarker: null,
        isSatellite: false,
        is3D: true
    };

    // ----------------------------------------------------------------------
    // 3. UTILITÁRIOS DE ARMAZENAMENTO & DADOS INICIAIS
    // ----------------------------------------------------------------------
    function readJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function writeJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn("Erro ao guardar no localStorage:", e);
        }
    }

    function escapeHTML(str) {
        return String(str ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function generateId(prefix = "id") {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }

    function formatDateOffset(daysFromNow) {
        const d = new Date();
        d.setDate(d.getDate() + daysFromNow);
        return d.toISOString().split("T")[0];
    }

    function seedInitialData() {
        let users = readJSON(STORAGE_KEYS.USERS, null);
        if (!users || !users.length) {
            users = [
                {
                    id: "usr_demo_1",
                    name: "Sofia Martins",
                    email: "sofia@localspot.app",
                    password: "demo123",
                    avatarEmoji: "🦊",
                    vibeEmoji: "🎧",
                    vibeText: "A curtir música ao vivo",
                    privacyMode: "precise",
                    accountType: "user",
                    verified: true,
                    bio: "Exploradora urbana e fã de concertos ao ar livre.",
                    lat: 38.7139,
                    lng: -9.1394,
                    online: true,
                    friends: ["usr_demo_2"],
                    friendRequests: [],
                    following: ["usr_org_1"],
                    favorites: ["evt_1"]
                },
                {
                    id: "usr_demo_2",
                    name: "Tiago Costa",
                    email: "tiago@localspot.app",
                    password: "demo123",
                    avatarEmoji: "🚀",
                    vibeEmoji: "☕",
                    vibeText: "Café na Baixa",
                    privacyMode: "precise",
                    accountType: "user",
                    verified: false,
                    bio: "Desporto, tecnologia e bons spots.",
                    lat: 41.1496,
                    lng: -8.6109,
                    online: true,
                    friends: ["usr_demo_1"],
                    friendRequests: [],
                    following: [],
                    favorites: []
                },
                {
                    id: "usr_org_1",
                    name: "Câmara Municipal de Lisboa",
                    email: "cultura@cm-lisboa.pt",
                    password: "demo123",
                    avatarEmoji: "🏛️",
                    vibeEmoji: "🎭",
                    vibeText: "Agenda Cultural Aberta",
                    privacyMode: "precise",
                    accountType: "business",
                    businessType: "Câmara Municipal / Junta",
                    verified: true,
                    bio: "Eventos oficiais, cultura e desporto na cidade de Lisboa.",
                    lat: 38.7078,
                    lng: -9.1366,
                    online: true,
                    friends: [],
                    friendRequests: [],
                    following: [],
                    favorites: []
                }
            ];
            writeJSON(STORAGE_KEYS.USERS, users);
        }
        state.users = users;

        let events = readJSON(STORAGE_KEYS.EVENTS, null);
        if (!events || !events.length) {
            events = [
                {
                    id: "evt_1",
                    name: "Sunset Eletrónico no Miradouro",
                    category: "Música",
                    country: "Portugal",
                    date: formatDateOffset(0),
                    time: "18:30",
                    location: "Miradouro de Santa Catarina, Lisboa",
                    lat: 38.7097,
                    lng: -9.1476,
                    price: "Gratuito",
                    maxParticipants: 200,
                    description: "Sessão de DJ ao pôr do sol com vista sobre o rio Tejo. Entrada livre para toda a comunidade.",
                    image: CATEGORY_IMAGES["Música"],
                    organizerId: "usr_org_1",
                    organizerName: "Câmara Municipal de Lisboa",
                    organizerVerified: true,
                    attendees: [
                        { id: "usr_demo_1", name: "Sofia Martins" },
                        { id: "usr_demo_2", name: "Tiago Costa" }
                    ],
                    comments: [
                        { id: "c1", userName: "Sofia Martins", text: "Vai ser incrível! Já confirmei presença.", createdAt: "Hoje" }
                    ],
                    reviews: [
                        { id: "r1", userName: "Tiago Costa", rating: 5, comment: "Ambiente fantástico na edição passada." }
                    ]
                },
                {
                    id: "evt_2",
                    name: "Corrida Noturna Ribeira do Porto",
                    category: "Desporto",
                    country: "Portugal",
                    date: formatDateOffset(2),
                    time: "21:00",
                    location: "Cais da Ribeira, Porto",
                    lat: 41.1408,
                    lng: -8.6132,
                    price: "Gratuito",
                    maxParticipants: 150,
                    description: "Percurso de 8 km junto ao Douro para todos os ritmos, com aquecimento guiado.",
                    image: CATEGORY_IMAGES["Desporto"],
                    organizerId: "usr_demo_2",
                    organizerName: "Tiago Costa",
                    organizerVerified: false,
                    attendees: [{ id: "usr_demo_2", name: "Tiago Costa" }],
                    comments: [],
                    reviews: []
                },
                {
                    id: "evt_3",
                    name: "Festival de Street Food & Samba",
                    category: "Gastronomia",
                    country: "Brasil",
                    date: formatDateOffset(3),
                    time: "16:00",
                    location: "Parque Ibirapuera, São Paulo",
                    lat: -23.5874,
                    lng: -46.6576,
                    price: "15 R$",
                    maxParticipants: 500,
                    description: "Gastronomia de rua, música ao vivo e espaço aberto para famílias e amigos.",
                    image: CATEGORY_IMAGES["Gastronomia"],
                    organizerId: "usr_org_1",
                    organizerName: "Câmara Municipal de Lisboa",
                    organizerVerified: true,
                    attendees: [],
                    comments: [],
                    reviews: []
                },
                {
                    id: "evt_4",
                    name: "Noite de Jazz & Arte Contemporânea",
                    category: "Cultura",
                    country: "Espanha",
                    date: formatDateOffset(5),
                    time: "20:00",
                    location: "Parque del Retiro, Madrid",
                    lat: 40.4153,
                    lng: -3.6845,
                    price: "10 €",
                    maxParticipants: 120,
                    description: "Exposição ao ar livre acompanhada por quarteto de jazz acústico.",
                    image: CATEGORY_IMAGES["Cultura"],
                    organizerId: "usr_demo_1",
                    organizerName: "Sofia Martins",
                    organizerVerified: true,
                    attendees: [],
                    comments: [],
                    reviews: []
                }
            ];
            writeJSON(STORAGE_KEYS.EVENTS, events);
        }
        state.events = events;
        state.notifications = readJSON(STORAGE_KEYS.NOTIFICATIONS, []);
    }

    function persistEvents() {
        writeJSON(STORAGE_KEYS.EVENTS, state.events);
        if (window.LocalSpotDB && typeof window.LocalSpotDB.saveEvents === "function") {
            try { window.LocalSpotDB.saveEvents(state.events); } catch (e) {}
        }
    }

    function persistUsers() {
        writeJSON(STORAGE_KEYS.USERS, state.users);
        if (state.currentUser) {
            const idx = state.users.findIndex(u => u.id === state.currentUser.id);
            if (idx !== -1) state.users[idx] = { ...state.users[idx], ...state.currentUser };
            writeJSON(STORAGE_KEYS.USERS, state.users);
            writeJSON(STORAGE_KEYS.CURRENT_USER, state.currentUser);
            saveSessionToDevice(state.currentUser);
        }
    }

    function pushNotification(title, body) {
        state.notifications.unshift({
            id: generateId("notif"),
            title,
            body,
            read: false,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        });
        writeJSON(STORAGE_KEYS.NOTIFICATIONS, state.notifications);
        renderNotifications();
    }

    // ----------------------------------------------------------------------
    // 4. INICIALIZAÇÃO DO MAPA 3D (MAPLIBRE GL)
    // ----------------------------------------------------------------------
    const DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
    const SATELLITE_STYLE = {
        version: 8,
        sources: {
            "esri-satellite": {
                type: "raster",
                tiles: [
                    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                ],
                tileSize: 256,
                attribution: "Esri World Imagery"
            }
        },
        layers: [
            { id: "esri-satellite-layer", type: "raster", source: "esri-satellite", minzoom: 0, maxzoom: 19 }
        ]
    };

    function initMap() {
        const mapEl = document.getElementById("map");
        if (!mapEl || typeof maplibregl === "undefined") return;

        // Reutiliza instância caso map.js já a tenha criado
        if (window.localSpotMap && typeof window.localSpotMap.flyTo === "function") {
            state.mapInstance = window.localSpotMap;
        } else {
            state.mapInstance = new maplibregl.Map({
                container: "map",
                style: DARK_STYLE,
                center: [-8.5, 39.6],
                zoom: 5.5,
                pitch: 50,
                bearing: -10,
                antialias: true
            });
            window.localSpotMap = state.mapInstance;
            state.mapInstance.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
        }

        state.mapInstance.on("load", () => {
            state.mapInstance.resize();
            syncMapMarkers();
            renderFriendMarkers();
        });

        state.mapInstance.on("click", (e) => {
            if (!state.isPickingLocation) return;
            const { lng, lat } = e.lngLat;
            setPickedLocation(lng, lat);
        });

        setTimeout(() => {
            if (state.mapInstance) state.mapInstance.resize();
        }, 350);
    }

    function setPickedLocation(lng, lat) {
        state.pickedCoords = { lng: Number(lng.toFixed(6)), lat: Number(lat.toFixed(6)) };

        if (state.pickMarker) state.pickMarker.remove();
        const el = document.createElement("div");
        el.className = "ls-pin-wrap pick-pin active";
        el.innerHTML = `<div class="ls-pin-drop"><span class="ls-pin-emoji">📍</span></div><div class="ls-pin-shadow"></div>`;

        state.pickMarker = new maplibregl.Marker({ element: el, anchor: "bottom" })
            .setLngLat([state.pickedCoords.lng, state.pickedCoords.lat])
            .addTo(state.mapInstance);

        const coordLabel = document.getElementById("selectedCoordinates");
        if (coordLabel) {
            coordLabel.textContent = `✅ Pin marcado: ${state.pickedCoords.lat}, ${state.pickedCoords.lng}`;
            coordLabel.style.color = "#10b981";
        }

        // Termina modo de seleção e reabre modal do evento
        state.isPickingLocation = false;
        document.getElementById("pickBanner")?.classList.add("hidden");
        document.getElementById("eventModal")?.classList.remove("hidden");
    }

    function syncMapMarkers() {
        if (!state.mapInstance) return;

        state.eventMarkers.forEach(m => m.remove());
        state.eventMarkers = [];

        state.filteredEvents.forEach(ev => {
            if (typeof ev.lng !== "number" || typeof ev.lat !== "number") return;

            const isPaid = ev.price && ev.price.toLowerCase() !== "gratuito" && ev.price !== "0";
            const emoji = CATEGORY_EMOJIS[ev.category] || "📍";

            const el = document.createElement("div");
            el.className = `ls-pin-wrap ${isPaid ? "paid" : ""}`;
            el.innerHTML = `
                <div class="ls-pin-tooltip">${escapeHTML(ev.name)}</div>
                <div class="ls-pin-drop"><span class="ls-pin-emoji">${emoji}</span></div>
                <div class="ls-pin-shadow"></div>
            `;

            el.addEventListener("click", (e) => {
                e.stopPropagation();
                openEventDetail(ev.id);
            });

            const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
                .setLngLat([ev.lng, ev.lat])
                .addTo(state.mapInstance);

            state.eventMarkers.push(marker);
        });
    }

    function renderFriendMarkers() {
        if (!state.mapInstance) return;
        state.friendMarkers.forEach(m => m.remove());
        state.friendMarkers = [];

        if (!state.currentUser) return;

        const friendIds = new Set(state.currentUser.friends || []);
        const visibleUsers = state.users.filter(u =>
            u.id !== state.currentUser.id &&
            (friendIds.has(u.id) || u.accountType === "business") &&
            u.privacyMode !== "ghost" &&
            typeof u.lat === "number" &&
            typeof u.lng === "number"
        );

        visibleUsers.forEach(u => {
            let lat = u.lat;
            let lng = u.lng;
            if (u.privacyMode === "blurred") {
                lat += 0.0025;
                lng -= 0.0025;
            }

            const el = document.createElement("div");
            el.className = `ls-friend-marker ${u.online ? "online" : ""} ${u.accountType === "business" ? "business" : ""}`;
            el.innerHTML = `
                <span class="ls-friend-name-tag">${escapeHTML(u.name.split(" ")[0])}</span>
                <span>${escapeHTML(u.avatarEmoji || "😎")}</span>
                <span class="ls-friend-mood-badge">${escapeHTML(u.vibeEmoji || "🎉")}</span>
            `;

            const popup = new maplibregl.Popup({ offset: 28 }).setHTML(`
                <div style="min-width:170px;">
                    <strong style="font-size:13.5px;">${escapeHTML(u.name)}</strong>
                    <div style="font-size:12px; color:#94a3b8; margin:3px 0 8px;">
                        ${escapeHTML(u.vibeEmoji || "🎉")} ${escapeHTML(u.vibeText || "No radar")}
                    </div>
                    <button type="button" class="btn-bump" style="width:100%; padding:6px 10px; font-size:12px;"
                        onclick="window.triggerBumpWith('${escapeHTML(u.name)}')">
                        👊 Enviar Bump!
                    </button>
                </div>
            `);

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([lng, lat])
                .setPopup(popup)
                .addTo(state.mapInstance);

            state.friendMarkers.push(marker);
        });
    }

    // ----------------------------------------------------------------------
    // 5. ANIMAÇÃO & RADAR BUMP + MODAL DE AMIGOS UNIFICADO
    // ----------------------------------------------------------------------
    window.triggerBumpWith = function (targetName) {
        const overlay = document.createElement("div");
        overlay.className = "bump-impact-overlay";
        overlay.innerHTML = `
            <div class="bump-impact-ring"></div>
            <div class="bump-impact-ring r2"></div>
            <div class="bump-impact-emoji">👊</div>
            <div class="bump-impact-label">BUMP enviado para ${escapeHTML(targetName)}!</div>
        `;
        document.body.appendChild(overlay);
        pushNotification("👊 Bump enviado!", `Fizeste Bump com ${targetName} no mapa.`);

        setTimeout(() => {
            overlay.remove();
        }, 1600);
    };

    function ensureUnifiedFriendsModal() {
        if (document.getElementById("unifiedFriendsModal")) return;

        const modal = document.createElement("div");
        modal.id = "unifiedFriendsModal";
        modal.className = "modal hidden";
        modal.setAttribute("aria-hidden", "true");
        modal.innerHTML = `
            <div class="modal-content" style="max-width:480px;">
                <button type="button" id="closeUnifiedFriends" class="close-button" aria-label="Fechar">&times;</button>
                <h2 style="margin:0 0 4px;">👊 Radar Social & Amigos</h2>
                <p class="muted" style="font-size:12.5px; margin:0 0 14px;">Partilha o teu estado ao vivo e faz Bump com amigos no mapa.</p>

                <div style="background:var(--surface-2); border:1px solid var(--border); border-radius:14px; padding:12px; margin-bottom:14px;">
                    <label style="font-size:11.5px; color:var(--muted);">O teu estado atual (Vibe)</label>
                    <div style="display:flex; gap:8px; margin:6px 0 10px;">
                        <select id="myVibeEmojiSelect" style="width:74px;">
                            <option value="🎉">🎉</option>
                            <option value="☕">☕</option>
                            <option value="🎧">🎧</option>
                            <option value="🔥">🔥</option>
                            <option value="⚽">⚽</option>
                            <option value="📚">📚</option>
                        </select>
                        <input type="text" id="myVibeTextInput" placeholder="Ex: No concerto da Ribeira..." maxlength="50">
                        <button type="button" id="saveMyVibeBtn" class="btn-primary-sm">Atualizar</button>
                    </div>

                    <label style="font-size:11.5px; color:var(--muted);">Privacidade da tua localização</label>
                    <div class="privacy-selector-grid" id="friendsModalPrivacyGrid" style="margin-top:6px; margin-bottom:0;">
                        <button type="button" class="privacy-opt-btn" data-privacy="precise">📍 Exata</button>
                        <button type="button" class="privacy-opt-btn" data-privacy="blurred">🌫️ Borrão</button>
                        <button type="button" class="privacy-opt-btn" data-privacy="ghost">👻 Fantasma</button>
                    </div>
                </div>

                <div style="display:flex; gap:8px; margin-bottom:14px;">
                    <input type="text" id="friendSearchAddInput" placeholder="Adicionar amigo por nome ou e-mail...">
                    <button type="button" id="friendSearchAddBtn" class="btn-primary-sm">+ Adicionar</button>
                </div>

                <h4 style="margin:0 0 8px; font-size:13px;">Os teus Amigos no Radar</h4>
                <div id="unifiedFriendsList" style="max-height:240px; overflow-y:auto;"></div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById("closeUnifiedFriends").addEventListener("click", () => {
            modal.classList.add("hidden");
        });

        document.getElementById("saveMyVibeBtn").addEventListener("click", () => {
            if (!state.currentUser) return;
            state.currentUser.vibeEmoji = document.getElementById("myVibeEmojiSelect").value;
            state.currentUser.vibeText = document.getElementById("myVibeTextInput").value.trim() || "No radar LocalSpot";
            persistUsers();
            updateAuthUI();
            window.triggerBumpWith("todos os amigos próximos");
        });

        modal.querySelectorAll("#friendsModalPrivacyGrid .privacy-opt-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                if (!state.currentUser) return;
                state.currentUser.privacyMode = btn.dataset.privacy;
                persistUsers();
                renderFriendsModalContent();
            });
        });

        document.getElementById("friendSearchAddBtn").addEventListener("click", () => {
            if (!state.currentUser) return;
            const query = document.getElementById("friendSearchAddInput").value.trim().toLowerCase();
            if (!query) return;

            const found = state.users.find(u =>
                u.id !== state.currentUser.id &&
                (u.email.toLowerCase() === query || u.name.toLowerCase().includes(query))
            );

            if (!found) {
                alert("Utilizador não encontrado. Experimenta 'Sofia' ou 'Tiago'.");
                return;
            }

            state.currentUser.friends = state.currentUser.friends || [];
            if (!state.currentUser.friends.includes(found.id)) {
                state.currentUser.friends.push(found.id);
                found.friends = found.friends || [];
                if (!found.friends.includes(state.currentUser.id)) found.friends.push(state.currentUser.id);
                persistUsers();
                renderFriendMarkers();
                renderFriendsModalContent();
                window.triggerBumpWith(found.name);
            }
            document.getElementById("friendSearchAddInput").value = "";
        });
    }

    function renderFriendsModalContent() {
        ensureUnifiedFriendsModal();
        if (!state.currentUser) return;

        document.getElementById("myVibeEmojiSelect").value = state.currentUser.vibeEmoji || "🎉";
        document.getElementById("myVibeTextInput").value = state.currentUser.vibeText || "";

        const currentPrivacy = state.currentUser.privacyMode || "precise";
        document.querySelectorAll("#friendsModalPrivacyGrid .privacy-opt-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.privacy === currentPrivacy);
        });

        const listEl = document.getElementById("unifiedFriendsList");
        const friendIds = state.currentUser.friends || [];
        const friends = state.users.filter(u => friendIds.includes(u.id));

        if (!friends.length) {
            listEl.innerHTML = `<p class="muted" style="font-size:12.5px;">Ainda não tens amigos adicionados. Procura por "Sofia" ou "Tiago" acima.</p>`;
            return;
        }

        listEl.innerHTML = friends.map(f => `
            <div class="saved-session-card" style="cursor:default;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="saved-session-avatar">${escapeHTML(f.avatarEmoji || "😎")}</div>
                    <div>
                        <strong style="font-size:13px; display:block;">${escapeHTML(f.name)}</strong>
                        <span class="muted" style="font-size:11.5px;">${escapeHTML(f.vibeEmoji || "🎉")} ${escapeHTML(f.vibeText || "Online")}</span>
                    </div>
                </div>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="btn-soft" style="padding:5px 9px; font-size:11.5px;" onclick="window.flyToFriend('${f.id}')">📍 Ver</button>
                    <button type="button" class="btn-bump" style="padding:5px 10px; font-size:11.5px;" onclick="window.triggerBumpWith('${escapeHTML(f.name)}')">👊 Bump</button>
                </div>
            </div>
        `).join("");
    }

    window.flyToFriend = function (friendId) {
        const friend = state.users.find(u => u.id === friendId);
        if (!friend || !state.mapInstance) return;
        document.getElementById("unifiedFriendsModal")?.classList.add("hidden");
        state.mapInstance.flyTo({ center: [friend.lng || -9.14, friend.lat || 38.71], zoom: 14, pitch: 55 });
    };

    // ----------------------------------------------------------------------
    // 6. AUTENTICAÇÃO, ONBOARDING & SESSÕES GUARDADAS
    // ----------------------------------------------------------------------
    function saveSessionToDevice(user) {
        if (!user) return;
        let sessions = readJSON(STORAGE_KEYS.SAVED_SESSIONS, []);
        sessions = sessions.filter(s => s.id !== user.id);
        sessions.unshift({
            id: user.id,
            name: user.name,
            email: user.email,
            avatarEmoji: user.avatarEmoji || "😎",
            accountType: user.accountType || "user"
        });
        writeJSON(STORAGE_KEYS.SAVED_SESSIONS, sessions.slice(0, 5));
    }

    function renderSavedSessions() {
        const container = document.getElementById("savedSessionsContainer");
        const list = document.getElementById("savedSessionsList");
        if (!container || !list) return;

        const sessions = readJSON(STORAGE_KEYS.SAVED_SESSIONS, []);
        if (!sessions.length) {
            container.classList.add("hidden");
            return;
        }

        container.classList.remove("hidden");
        list.innerHTML = sessions.map(s => `
            <div class="saved-session-card" data-session-id="${escapeHTML(s.id)}">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="saved-session-avatar">${escapeHTML(s.avatarEmoji || "😎")}</div>
                    <div>
                        <strong style="font-size:13px; display:block;">${escapeHTML(s.name)}</strong>
                        <span class="muted" style="font-size:11.5px;">${escapeHTML(s.email)}</span>
                    </div>
                </div>
                <span style="font-size:12px; color:var(--primary); font-weight:700;">Entrar →</span>
            </div>
        `).join("");

        list.querySelectorAll(".saved-session-card").forEach(card => {
            card.addEventListener("click", () => {
                const sid = card.dataset.sessionId;
                const user = state.users.find(u => u.id === sid);
                if (user) {
                    loginUser(user);
                }
            });
        });
    }

    function showOnboardingScreen(screenId) {
        ["onboardingWelcomeScreen", "onboardingWizardScreen", "onboardingLoginScreen"].forEach(id => {
            document.getElementById(id)?.classList.toggle("hidden", id !== screenId);
        });
    }

    function showWizardStep(stepNum) {
        [1, 2, 3].forEach(n => {
            document.getElementById(`wizardStep${n}`)?.classList.toggle("hidden", n !== stepNum);
            const dot = document.querySelector(`[data-step-dot="${n}"]`);
            if (dot) dot.classList.toggle("active", n <= stepNum);
        });
    }

    function loginUser(user) {
        state.currentUser = user;
        writeJSON(STORAGE_KEYS.CURRENT_USER, user);
        saveSessionToDevice(user);
        document.getElementById("authOverlay")?.classList.add("hidden");
        updateAuthUI();
        applyFiltersAndRender();
        renderFriendMarkers();
    }

    function updateAuthUI() {
        const user = state.currentUser;
        const addBtn = document.getElementById("addEventButton");
        const notifBtn = document.getElementById("notifBtn");
        const badge = document.getElementById("userBadge");
        const logoutBtn = document.getElementById("logoutButton");
        const adminBtn = document.getElementById("adminPanelBtn");

        if (user) {
            addBtn?.classList.remove("hidden");
            notifBtn?.classList.remove("hidden");
            badge?.classList.remove("hidden");
            logoutBtn?.classList.remove("hidden");

            if (badge) {
                badge.innerHTML = `<span>${escapeHTML(user.avatarEmoji || "😎")}</span> <strong>${escapeHTML(user.name.split(" ")[0])}</strong>`;
            }

            if (adminBtn) {
                const isAdmin = user.isAdmin || user.email.includes("admin") || user.accountType === "business";
                adminBtn.classList.toggle("hidden", !isAdmin);
            }
        } else {
            addBtn?.classList.add("hidden");
            notifBtn?.classList.add("hidden");
            badge?.classList.add("hidden");
            logoutBtn?.classList.add("hidden");
            adminBtn?.classList.add("hidden");
        }
        renderNotifications();
    }

    function initAuthFlow() {
        const savedUser = readJSON(STORAGE_KEYS.CURRENT_USER, null);
        if (savedUser) {
            const fresh = state.users.find(u => u.id === savedUser.id) || savedUser;
            state.currentUser = fresh;
            updateAuthUI();
        } else {
            // Inicia com conta demo automática se não houver sessão, mantendo acesso ao ecrã de sessões
            const defaultDemo = state.users[0];
            if (defaultDemo) {
                state.currentUser = defaultDemo;
                writeJSON(STORAGE_KEYS.CURRENT_USER, defaultDemo);
                saveSessionToDevice(defaultDemo);
                updateAuthUI();
            } else {
                renderSavedSessions();
                document.getElementById("authOverlay")?.classList.remove("hidden");
            }
        }

        // Botões de navegação do Onboarding
        document.getElementById("startOnboardingBtn")?.addEventListener("click", () => {
            showOnboardingScreen("onboardingWizardScreen");
            showWizardStep(1);
        });

        document.getElementById("goToLoginScreenBtn")?.addEventListener("click", () => {
            showOnboardingScreen("onboardingLoginScreen");
        });

        document.getElementById("backToWelcomeBtn")?.addEventListener("click", () => {
            renderSavedSessions();
            showOnboardingScreen("onboardingWelcomeScreen");
        });

        document.getElementById("loginBackToWelcomeBtn")?.addEventListener("click", () => {
            renderSavedSessions();
            showOnboardingScreen("onboardingWelcomeScreen");
        });

        document.getElementById("regAccountType")?.addEventListener("change", (e) => {
            const isBiz = e.target.value === "business";
            document.getElementById("businessTypeGroup")?.classList.toggle("hidden", !isBiz);
            const lbl = document.getElementById("regNameLabel");
            if (lbl) lbl.textContent = isBiz ? "Nome da Entidade / Empresa *" : "Nome de exibição *";
        });

        document.getElementById("nextToStep2Btn")?.addEventListener("click", () => {
            const name = document.getElementById("regName").value.trim();
            const email = document.getElementById("regEmail").value.trim();
            const pass = document.getElementById("regPassword").value;
            const errEl = document.getElementById("registerError");

            if (!name || !email || pass.length < 6) {
                if (errEl) {
                    errEl.textContent = "Preenche o nome, e-mail válido e palavra-passe (mín. 6 caracteres).";
                    errEl.classList.remove("hidden");
                }
                return;
            }
            errEl?.classList.add("hidden");
            showWizardStep(2);
        });

        document.getElementById("backToStep1Btn")?.addEventListener("click", () => showWizardStep(1));
        document.getElementById("nextToStep3Btn")?.addEventListener("click", () => showWizardStep(3));
        document.getElementById("backToStep2Btn")?.addEventListener("click", () => showWizardStep(2));

        // Pickers do Passo 2 & 3
        document.querySelectorAll("#avatarPickerGrid .avatar-emoji-opt").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#avatarPickerGrid .avatar-emoji-opt").forEach(b => b.classList.remove("selected"));
                btn.classList.add("selected");
                state.selectedAvatar = btn.dataset.emoji;
            });
        });

        document.querySelectorAll("#vibePickerGrid .vibe-opt-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#vibePickerGrid .vibe-opt-btn").forEach(b => b.classList.remove("selected"));
                btn.classList.add("selected");
                state.selectedVibe = { emoji: btn.dataset.vibeEmoji, text: btn.dataset.vibeText };
            });
        });

        document.querySelectorAll("#onboardingPrivacyGrid .privacy-opt-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#onboardingPrivacyGrid .privacy-opt-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                state.selectedPrivacy = btn.dataset.privacy;
            });
        });

        // Submissão de Registo
        document.getElementById("registerForm")?.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = document.getElementById("regName").value.trim();
            const email = document.getElementById("regEmail").value.trim().toLowerCase();
            const password = document.getElementById("regPassword").value;
            const accountType = document.getElementById("regAccountType").value;
            const businessType = document.getElementById("regBusinessType").value;

            const newUser = {
                id: generateId("usr"),
                name,
                email,
                password,
                avatarEmoji: state.selectedAvatar,
                vibeEmoji: state.selectedVibe.emoji,
                vibeText: state.selectedVibe.text,
                privacyMode: state.selectedPrivacy,
                accountType,
                businessType: accountType === "business" ? businessType : "",
                verified: accountType === "business",
                bio: "",
                lat: state.userLocation?.lat || 38.7223,
                lng: state.userLocation?.lng || -9.1393,
                online: true,
                friends: ["usr_demo_1", "usr_demo_2"],
                friendRequests: [],
                following: [],
                favorites: []
            };

            state.users.push(newUser);
            persistUsers();
            loginUser(newUser);
            window.triggerBumpWith("a comunidade LocalSpot");
        });

        // Submissão de Login
        document.getElementById("loginForm")?.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = document.getElementById("loginEmail").value.trim().toLowerCase();
            const pass = document.getElementById("loginPassword").value;
            const errEl = document.getElementById("loginError");

            const found = state.users.find(u => u.email.toLowerCase() === email && (!u.password || u.password === pass));
            if (!found) {
                if (errEl) {
                    errEl.textContent = "E-mail ou palavra-passe incorretos. (Dica: sofia@localspot.app / demo123)";
                    errEl.classList.remove("hidden");
                }
                return;
            }
            errEl?.classList.add("hidden");
            loginUser(found);
        });

        // Trocar Sessão / Sair
        document.getElementById("switchSessionBtn")?.addEventListener("click", () => {
            renderSavedSessions();
            showOnboardingScreen("onboardingWelcomeScreen");
            document.getElementById("authOverlay")?.classList.remove("hidden");
        });

        document.getElementById("logoutButton")?.addEventListener("click", () => {
            localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
            state.currentUser = null;
            updateAuthUI();
            renderSavedSessions();
            showOnboardingScreen("onboardingWelcomeScreen");
            document.getElementById("authOverlay")?.classList.remove("hidden");
        });
    }

    // ----------------------------------------------------------------------
    // 7. FILTROS, PESQUISA & LISTA DE EVENTOS
    // ----------------------------------------------------------------------
    function populateCountrySelects() {
        const headerSel = document.getElementById("headerCountrySelect");
        const filterSel = document.getElementById("districtFilter");
        const formSel = document.getElementById("eventDistrito");

        COUNTRIES.forEach(c => {
            if (headerSel) headerSel.add(new Option(`🌍 ${c.name}`, c.name));
            if (filterSel) filterSel.add(new Option(c.name, c.name));
            if (formSel) formSel.add(new Option(c.name, c.name));
        });
    }

    function haversineKm(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function applyFiltersAndRender() {
        const todayStr = new Date().toISOString().split("T")[0];
        const weekLimit = new Date();
        weekLimit.setDate(weekLimit.getDate() + 7);
        const weekStr = weekLimit.toISOString().split("T")[0];

        const favs = new Set(state.currentUser?.favorites || []);
        const following = new Set(state.currentUser?.following || []);

        let list = state.events.filter(ev => {
            const q = state.filters.search.toLowerCase();
            if (q) {
                const hay = `${ev.name} ${ev.location} ${ev.country} ${ev.category} ${ev.description}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }

            if (state.filters.category !== "all" && ev.category !== state.filters.category) return false;
            if (state.filters.country !== "all" && ev.country !== state.filters.country) return false;

            if (state.filters.period === "today" && ev.date !== todayStr) return false;
            if (state.filters.period === "upcoming" && ev.date < todayStr) return false;
            if (state.filters.period === "past" && ev.date >= todayStr) return false;
            if (state.filters.period === "week" && (ev.date < todayStr || ev.date > weekStr)) return false;

            if (state.filters.favoritesOnly && !favs.has(ev.id)) return false;
            if (state.filters.followingOnly && !following.has(ev.organizerId)) return false;
            if (state.filters.freeOnly) {
                const p = (ev.price || "").toLowerCase();
                if (p && p !== "gratuito" && p !== "0" && p !== "0€") return false;
            }

            if (state.userLocation && state.filters.radius < 300 && typeof ev.lat === "number") {
                const dist = haversineKm(state.userLocation.lat, state.userLocation.lng, ev.lat, ev.lng);
                if (dist > state.filters.radius) return false;
            }

            return true;
        });

        // Ordenação
        list.sort((a, b) => {
            if (state.filters.sort === "popular") {
                return (b.attendees?.length || 0) - (a.attendees?.length || 0);
            }
            if (state.filters.sort === "distance" && state.userLocation) {
                const da = haversineKm(state.userLocation.lat, state.userLocation.lng, a.lat || 0, a.lng || 0);
                const db = haversineKm(state.userLocation.lat, state.userLocation.lng, b.lat || 0, b.lng || 0);
                return da - db;
            }
            return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
        });

        state.filteredEvents = list;
        renderEventsList();
        syncMapMarkers();
    }

    function renderEventsList() {
        const container = document.getElementById("eventsList");
        const countEl = document.getElementById("eventCount");
        const emptyEl = document.getElementById("emptyState");
        if (!container) return;

        if (countEl) {
            countEl.textContent = `${state.filteredEvents.length} evento${state.filteredEvents.length === 1 ? "" : "s"} encontrado${state.filteredEvents.length === 1 ? "" : "s"}`;
        }

        if (!state.filteredEvents.length) {
            container.innerHTML = "";
            emptyEl?.classList.remove("hidden");
            return;
        }

        emptyEl?.classList.add("hidden");
        const todayStr = new Date().toISOString().split("T")[0];
        const myId = state.currentUser?.id;
        const myFriends = new Set(state.currentUser?.friends || []);

        container.innerHTML = state.filteredEvents.map(ev => {
            const isPast = ev.date < todayStr;
            const attendees = ev.attendees || [];
            const isEnrolled = myId && attendees.some(a => a.id === myId);
            const friendsGoing = attendees.filter(a => myFriends.has(a.id));
            const img = ev.image || CATEGORY_IMAGES[ev.category] || CATEGORY_IMAGES["Música"];

            return `
                <article class="event-card" data-event-id="${escapeHTML(ev.id)}">
                    <div style="position:relative;">
                        <img src="${escapeHTML(img)}" alt="${escapeHTML(ev.name)}" loading="lazy">
                        ${isPast ? `<span class="badge-past">Terminado</span>` : ""}
                    </div>
                    <div class="event-card-body">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-bottom:4px;">
                            <span class="chip active" style="font-size:11px; padding:2px 8px;">${CATEGORY_EMOJIS[ev.category] || "📍"} ${escapeHTML(ev.category)}</span>
                            <span style="font-size:11.5px; font-weight:700; color:var(--primary);">${escapeHTML(ev.price || "Gratuito")}</span>
                        </div>
                        <h3 style="margin:2px 0 4px; font-size:15px;">${escapeHTML(ev.name)}</h3>
                        <div class="organizer-tag">
                            Por <strong>${escapeHTML(ev.organizerName || "Comunidade")}</strong>
                            ${ev.organizerVerified ? `<span class="verified-check" title="Entidade Verificada">✓</span>` : ""}
                        </div>
                        ${friendsGoing.length ? `<div class="friends-going-badge">👊 ${friendsGoing.length} amigo${friendsGoing.length > 1 ? "s" : ""} vão</div>` : ""}
                        <div style="font-size:12px; color:var(--muted);">📅 ${escapeHTML(ev.date)} às ${escapeHTML(ev.time)}</div>
                        <div style="font-size:12px; color:var(--muted);">📍 ${escapeHTML(ev.location)} (${escapeHTML(ev.country || "Portugal")})</div>
                        <div class="registration-info">👥 ${attendees.length}${ev.maxParticipants ? ` / ${ev.maxParticipants}` : ""} inscritos</div>
                        <div style="display:flex; gap:6px; margin-top:10px;">
                            <button type="button" class="${isEnrolled ? "btn-soft" : "register-btn"}" style="flex:1; padding:7px; font-size:12px;" data-quick-enroll="${escapeHTML(ev.id)}">
                                ${isEnrolled ? "✅ Inscrito" : "Inscrever-me"}
                            </button>
                            <button type="button" class="btn-soft" style="padding:7px 10px; font-size:12px;" data-fly-event="${escapeHTML(ev.id)}" title="Ver no Mapa">🗺️</button>
                        </div>
                    </div>
                </article>
            `;
        }).join("");

        container.querySelectorAll(".event-card").forEach(card => {
            card.addEventListener("click", (e) => {
                const enrollId = e.target.closest("[data-quick-enroll]")?.dataset.quickEnroll;
                if (enrollId) {
                    e.stopPropagation();
                    toggleEnrollment(enrollId);
                    return;
                }
                const flyId = e.target.closest("[data-fly-event]")?.dataset.flyEvent;
                if (flyId) {
                    e.stopPropagation();
                    const ev = state.events.find(x => x.id === flyId);
                    if (ev && state.mapInstance) {
                        document.getElementById("main")?.setAttribute("data-view", "map");
                        state.mapInstance.resize();
                        state.mapInstance.flyTo({ center: [ev.lng, ev.lat], zoom: 15, pitch: 55 });
                    }
                    return;
                }
                openEventDetail(card.dataset.eventId);
            });
        });
    }

    // ----------------------------------------------------------------------
    // 8. CRIAR, EDITAR & ELIMINAR EVENTOS
    // ----------------------------------------------------------------------
    function openCreateEventModal(eventToEdit = null) {
        if (!state.currentUser) {
            document.getElementById("authOverlay")?.classList.remove("hidden");
            return;
        }

        state.editingEventId = eventToEdit ? eventToEdit.id : null;
        state.uploadedImageData = eventToEdit?.image || "";
        state.pickedCoords = eventToEdit ? { lat: eventToEdit.lat, lng: eventToEdit.lng } : null;

        document.getElementById("eventModalTitle").textContent = eventToEdit ? "Editar Evento" : "Novo Evento";
        document.getElementById("submitEventBtn").textContent = eventToEdit ? "Guardar Alterações" : "Publicar Evento";
        document.getElementById("formError")?.classList.add("hidden");

        document.getElementById("eventName").value = eventToEdit?.name || "";
        document.getElementById("eventCategory").value = eventToEdit?.category || "Música";
        document.getElementById("eventDistrito").value = eventToEdit?.country || "Portugal";
        document.getElementById("eventDate").value = eventToEdit?.date || formatDateOffset(1);
        document.getElementById("eventTime").value = eventToEdit?.time || "19:00";
        document.getElementById("eventLocation").value = eventToEdit?.location || "";
        document.getElementById("eventMaxParticipants").value = eventToEdit?.maxParticipants || "";
        document.getElementById("eventPrice").value = eventToEdit?.price || "Gratuito";
        document.getElementById("eventExternalUrl").value = eventToEdit?.externalUrl || "";
        document.getElementById("eventDescription").value = eventToEdit?.description || "";

        const coordLabel = document.getElementById("selectedCoordinates");
        if (state.pickedCoords) {
            coordLabel.textContent = `✅ Pin: ${state.pickedCoords.lat}, ${state.pickedCoords.lng}`;
            coordLabel.style.color = "#10b981";
        } else {
            coordLabel.textContent = "Pin ainda não colocado no mapa";
            coordLabel.style.color = "var(--muted)";
        }

        const preview = document.getElementById("imagePreview");
        if (eventToEdit?.image) {
            preview.src = eventToEdit.image;
            preview.classList.remove("hidden");
        } else {
            preview.classList.add("hidden");
        }

        document.getElementById("eventModal")?.classList.remove("hidden");
    }

    function initEventFormHandlers() {
        document.getElementById("addEventButton")?.addEventListener("click", () => openCreateEventModal(null));
        document.getElementById("closeModal")?.addEventListener("click", () => {
            document.getElementById("eventModal")?.classList.add("hidden");
        });

        document.getElementById("eventImage")?.addEventListener("change", (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                state.uploadedImageData = reader.result;
                const preview = document.getElementById("imagePreview");
                preview.src = reader.result;
                preview.classList.remove("hidden");
            };
            reader.readAsDataURL(file);
        });

        // Marcar Pin no Mapa
        document.getElementById("changeLocationButton")?.addEventListener("click", () => {
            state.isPickingLocation = true;
            document.getElementById("eventModal")?.classList.add("hidden");
            document.getElementById("pickBanner")?.classList.remove("hidden");
            document.getElementById("main")?.setAttribute("data-view", "map");
            state.mapInstance?.resize();
        });

        document.getElementById("cancelPickButton")?.addEventListener("click", () => {
            state.isPickingLocation = false;
            document.getElementById("pickBanner")?.classList.add("hidden");
            document.getElementById("eventModal")?.classList.remove("hidden");
        });

        document.getElementById("pickSearchBtn")?.addEventListener("click", async () => {
            const q = document.getElementById("pickSearchInput").value.trim();
            if (!q) return;
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
                const data = await res.json();
                if (data && data[0]) {
                    const lat = parseFloat(data[0].lat);
                    const lng = parseFloat(data[0].lon);
                    state.mapInstance?.flyTo({ center: [lng, lat], zoom: 14 });
                    setPickedLocation(lng, lat);
                } else {
                    alert("Localização não encontrada. Tenta outra cidade ou morada.");
                }
            } catch (err) {
                alert("Não foi possível pesquisar a morada. Clica diretamente no mapa.");
            }
        });

        document.getElementById("eventForm")?.addEventListener("submit", (e) => {
            e.preventDefault();
            if (!state.currentUser) return;

            const name = document.getElementById("eventName").value.trim();
            const category = document.getElementById("eventCategory").value;
            const country = document.getElementById("eventDistrito").value;
            const date = document.getElementById("eventDate").value;
            const time = document.getElementById("eventTime").value;
            const location = document.getElementById("eventLocation").value.trim();
            const maxParticipants = parseInt(document.getElementById("eventMaxParticipants").value, 10) || null;
            const price = document.getElementById("eventPrice").value.trim() || "Gratuito";
            const externalUrl = document.getElementById("eventExternalUrl").value.trim();
            const description = document.getElementById("eventDescription").value.trim();

            const countryObj = COUNTRIES.find(c => c.name === country) || COUNTRIES[0];
            const lat = state.pickedCoords?.lat ?? (countryObj.coords[1] + (Math.random() - 0.5) * 0.04);
            const lng = state.pickedCoords?.lng ?? (countryObj.coords[0] + (Math.random() - 0.5) * 0.04);
            const image = state.uploadedImageData || CATEGORY_IMAGES[category] || CATEGORY_IMAGES["Música"];

            if (state.editingEventId) {
                const idx = state.events.findIndex(ev => ev.id === state.editingEventId);
                if (idx !== -1) {
                    state.events[idx] = {
                        ...state.events[idx],
                        name, category, country, date, time, location, lat, lng,
                        maxParticipants, price, externalUrl, description, image
                    };
                }
                pushNotification("✏️ Evento atualizado", `"${name}" foi atualizado com sucesso.`);
            } else {
                const newEvent = {
                    id: generateId("evt"),
                    name, category, country, date, time, location, lat, lng,
                    maxParticipants, price, externalUrl, description, image,
                    organizerId: state.currentUser.id,
                    organizerName: state.currentUser.name,
                    organizerVerified: !!state.currentUser.verified,
                    attendees: [{ id: state.currentUser.id, name: state.currentUser.name }],
                    comments: [],
                    reviews: []
                };
                state.events.unshift(newEvent);
                pushNotification("🎉 Novo evento publicado!", `"${name}" já está visível no mapa global.`);
            }

            if (state.pickMarker) {
                state.pickMarker.remove();
                state.pickMarker = null;
            }

            persistEvents();
            document.getElementById("eventModal")?.classList.add("hidden");
            applyFiltersAndRender();
            state.mapInstance?.flyTo({ center: [lng, lat], zoom: 13.5, pitch: 55 });
        });
    }

    // ----------------------------------------------------------------------
    // 9. DETALHES DO EVENTO, INSCRIÇÕES, BILHETE QR, COMENTÁRIOS & AVALIAÇÕES
    // ----------------------------------------------------------------------
    function toggleEnrollment(eventId) {
        if (!state.currentUser) {
            document.getElementById("authOverlay")?.classList.remove("hidden");
            return;
        }
        const ev = state.events.find(x => x.id === eventId);
        if (!ev) return;

        ev.attendees = ev.attendees || [];
        const existingIdx = ev.attendees.findIndex(a => a.id === state.currentUser.id);

        if (existingIdx !== -1) {
            ev.attendees.splice(existingIdx, 1);
            pushNotification("Inscrição cancelada", `Saíste da lista de "${ev.name}".`);
        } else {
            if (ev.maxParticipants && ev.attendees.length >= ev.maxParticipants) {
                alert("Este evento já atingiu a lotação máxima.");
                return;
            }
            ev.attendees.push({ id: state.currentUser.id, name: state.currentUser.name });
            pushNotification("🎟️ Inscrição confirmada!", `Estás inscrito em "${ev.name}".`);
        }

        persistEvents();
        applyFiltersAndRender();
        if (state.activeDetailEventId === eventId) {
            openEventDetail(eventId);
        }
    }

    function openEventDetail(eventId) {
        const ev = state.events.find(x => x.id === eventId);
        if (!ev) return;
        state.activeDetailEventId = eventId;

        const attendees = ev.attendees || [];
        const isEnrolled = state.currentUser && attendees.some(a => a.id === state.currentUser.id);
        const isFav = state.currentUser?.favorites?.includes(ev.id);
        const isFollowing = state.currentUser?.following?.includes(ev.organizerId);
        const isOwner = state.currentUser && (ev.organizerId === state.currentUser.id || state.currentUser.isAdmin);

        document.getElementById("detailHeroImg").src = ev.image || CATEGORY_IMAGES[ev.category] || CATEGORY_IMAGES["Música"];
        document.getElementById("detailCategory").textContent = `${CATEGORY_EMOJIS[ev.category] || "📍"} ${ev.category}`;
        document.getElementById("detailPrice").textContent = ev.price || "Gratuito";
        document.getElementById("detailTitle").textContent = ev.name;
        document.getElementById("detailOrganizer").innerHTML = `Organizado por <strong>${escapeHTML(ev.organizerName || "Comunidade")}</strong> ${ev.organizerVerified ? `<span class="verified-check">✓</span>` : ""}`;
        document.getElementById("detailDescription").textContent = ev.description || "Sem descrição adicional.";
        document.getElementById("detailDateTime").textContent = `${ev.date} às ${ev.time}`;
        document.getElementById("detailLocation").textContent = `${ev.location} (${ev.country || "Portugal"})`;
        document.getElementById("detailCapacity").textContent = `${attendees.length}${ev.maxParticipants ? ` / ${ev.maxParticipants}` : ""} inscritos`;

        const extLink = document.getElementById("detailExternalLink");
        if (ev.externalUrl) {
            extLink.href = ev.externalUrl;
            extLink.classList.remove("hidden");
        } else {
            extLink.classList.add("hidden");
        }

        const followBtn = document.getElementById("detailFollowBtn");
        if (state.currentUser && ev.organizerId && ev.organizerId !== state.currentUser.id) {
            followBtn.classList.remove("hidden");
            followBtn.textContent = isFollowing ? "✓ A Seguir" : "+ Seguir";
        } else {
            followBtn.classList.add("hidden");
        }

        const regBtn = document.getElementById("detailRegisterBtn");
        regBtn.textContent = isEnrolled ? "✅ Inscrito (Cancelar)" : "Inscrever-me";
        regBtn.className = isEnrolled ? "btn-soft" : "register-btn";

        document.getElementById("detailTicketBtn").classList.toggle("hidden", !isEnrolled);
        document.getElementById("detailFavBtn").textContent = isFav ? "★ Guardado" : "☆ Guardar";
        document.getElementById("detailDirectionsBtn").href = `https://www.google.com/maps/dir/?api=1&destination=${ev.lat},${ev.lng}`;
        document.getElementById("detailOwnerBar").classList.toggle("hidden", !isOwner);

        // Lista de inscritos
        const attEl = document.getElementById("detailAttendeesList");
        attEl.innerHTML = attendees.length
            ? attendees.map(a => `<span class="attendee-pill">👤 ${escapeHTML(a.name)}</span>`).join("")
            : `<span class="muted" style="font-size:12px;">Sê o primeiro a inscrever-te!</span>`;

        // Comentários
        const comEl = document.getElementById("detailCommentsList");
        const comments = ev.comments || [];
        comEl.innerHTML = comments.length
            ? comments.map(c => `<div class="comment-item"><strong>${escapeHTML(c.userName)}</strong> <span class="muted" style="font-size:11px;">· ${escapeHTML(c.createdAt || "")}</span><p>${escapeHTML(c.text)}</p></div>`).join("")
            : `<p class="muted" style="font-size:12px;">Ainda sem comentários.</p>`;

        // Avaliações
        const revEl = document.getElementById("detailReviewsList");
        const reviews = ev.reviews || [];
        const ratingBadge = document.getElementById("detailRatingBadge");
        if (reviews.length) {
            const avg = (reviews.reduce((s, r) => s + Number(r.rating), 0) / reviews.length).toFixed(1);
            ratingBadge.textContent = `⭐ ${avg} (${reviews.length})`;
            ratingBadge.classList.remove("hidden");
            revEl.innerHTML = reviews.map(r => `<div class="comment-item"><strong>${escapeHTML(r.userName)}</strong> · ${"⭐".repeat(Number(r.rating))}<p>${escapeHTML(r.comment || "")}</p></div>`).join("");
        } else {
            ratingBadge.classList.add("hidden");
            revEl.innerHTML = `<p class="muted" style="font-size:12px;">Ainda sem avaliações.</p>`;
        }

        document.getElementById("reviewForm").classList.toggle("hidden", !state.currentUser);
        document.getElementById("detailModal")?.classList.remove("hidden");
    }

    function initDetailModalHandlers() {
        document.getElementById("closeDetail")?.addEventListener("click", () => {
            document.getElementById("detailModal")?.classList.add("hidden");
            state.activeDetailEventId = null;
        });

        document.getElementById("detailRegisterBtn")?.addEventListener("click", () => {
            if (state.activeDetailEventId) toggleEnrollment(state.activeDetailEventId);
        });

        document.getElementById("detailFollowBtn")?.addEventListener("click", () => {
            if (!state.currentUser || !state.activeDetailEventId) return;
            const ev = state.events.find(x => x.id === state.activeDetailEventId);
            if (!ev || !ev.organizerId) return;

            state.currentUser.following = state.currentUser.following || [];
            const idx = state.currentUser.following.indexOf(ev.organizerId);
            if (idx === -1) state.currentUser.following.push(ev.organizerId);
            else state.currentUser.following.splice(idx, 1);

            persistUsers();
            openEventDetail(ev.id);
        });

        document.getElementById("detailFavBtn")?.addEventListener("click", () => {
            if (!state.currentUser || !state.activeDetailEventId) return;
            state.currentUser.favorites = state.currentUser.favorites || [];
            const idx = state.currentUser.favorites.indexOf(state.activeDetailEventId);
            if (idx === -1) state.currentUser.favorites.push(state.activeDetailEventId);
            else state.currentUser.favorites.splice(idx, 1);

            persistUsers();
            applyFiltersAndRender();
            openEventDetail(state.activeDetailEventId);
        });

        // Bilhete QR
        document.getElementById("detailTicketBtn")?.addEventListener("click", () => {
            const ev = state.events.find(x => x.id === state.activeDetailEventId);
            if (!ev || !state.currentUser) return;
            const code = `LS-${ev.id.slice(-4).toUpperCase()}-${state.currentUser.id.slice(-4).toUpperCase()}`;
            document.getElementById("ticketEventTitle").textContent = ev.name;
            document.getElementById("ticketEventMeta").textContent = `${ev.date} · ${ev.time} · ${ev.location}`;
            document.getElementById("ticketQrImage").src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(code)}`;
            document.getElementById("ticketCodeText").textContent = code;
            document.getElementById("ticketHolderName").textContent = `Titular: ${state.currentUser.name}`;
            document.getElementById("ticketModal")?.classList.remove("hidden");
        });

        document.getElementById("closeTicket")?.addEventListener("click", () => {
            document.getElementById("ticketModal")?.classList.add("hidden");
        });

        // Exportar .ICS
        document.getElementById("detailCalendarBtn")?.addEventListener("click", () => {
            const ev = state.events.find(x => x.id === state.activeDetailEventId);
            if (!ev) return;
            const dtStart = `${ev.date.replace(/-/g, "")}T${ev.time.replace(":", "")}00`;
            const ics = [
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "BEGIN:VEVENT",
                `SUMMARY:${ev.name}`,
                `DTSTART:${dtStart}`,
                `LOCATION:${ev.location}`,
                `DESCRIPTION:${ev.description || ""}`,
                "END:VEVENT",
                "END:VCALENDAR"
            ].join("\r\n");
            const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `${ev.name.toLowerCase().replace(/\s+/g, "-")}.ics`;
            a.click();
        });

        // Partilhar
        document.getElementById("detailShareBtn")?.addEventListener("click", async () => {
            const ev = state.events.find(x => x.id === state.activeDetailEventId);
            if (!ev) return;
            const shareText = `${ev.name} — ${ev.date} às ${ev.time} em ${ev.location} (via LocalSpot)`;
            if (navigator.share) {
                try { await navigator.share({ title: ev.name, text: shareText, url: window.location.href }); } catch (e) {}
            } else {
                await navigator.clipboard?.writeText(shareText);
                alert("Ligação e detalhes copiados para a área de transferência!");
            }
        });

        // Editar / Eliminar Evento
        document.getElementById("detailEditBtn")?.addEventListener("click", () => {
            const ev = state.events.find(x => x.id === state.activeDetailEventId);
            if (!ev) return;
            document.getElementById("detailModal")?.classList.add("hidden");
            openCreateEventModal(ev);
        });

        document.getElementById("detailDeleteBtn")?.addEventListener("click", () => {
            if (!state.activeDetailEventId) return;
            if (!confirm("Tens a certeza que queres eliminar este evento?")) return;
            state.events = state.events.filter(x => x.id !== state.activeDetailEventId);
            persistEvents();
            document.getElementById("detailModal")?.classList.add("hidden");
            applyFiltersAndRender();
        });

        // Comentários
        document.getElementById("commentForm")?.addEventListener("submit", (e) => {
            e.preventDefault();
            if (!state.currentUser || !state.activeDetailEventId) return;
            const input = document.getElementById("commentInput");
            const text = input.value.trim();
            if (!text) return;

            const ev = state.events.find(x => x.id === state.activeDetailEventId);
            if (!ev) return;
            ev.comments = ev.comments || [];
            ev.comments.push({
                id: generateId("com"),
                userName: state.currentUser.name,
                text,
                createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            });
            input.value = "";
            persistEvents();
            openEventDetail(ev.id);
        });

        // Avaliações
        document.getElementById("reviewForm")?.addEventListener("submit", (e) => {
            e.preventDefault();
            if (!state.currentUser || !state.activeDetailEventId) return;
            const rating = parseInt(document.getElementById("reviewRating").value, 10) || 5;
            const comment = document.getElementById("reviewComment").value.trim();
            const ev = state.events.find(x => x.id === state.activeDetailEventId);
            if (!ev) return;

            ev.reviews = ev.reviews || [];
            ev.reviews.push({ id: generateId("rev"), userName: state.currentUser.name, rating, comment });
            document.getElementById("reviewComment").value = "";
            persistEvents();
            openEventDetail(ev.id);
        });

        // Denúncia
        document.getElementById("detailReportBtn")?.addEventListener("click", () => {
            const ev = state.events.find(x => x.id === state.activeDetailEventId);
            if (!ev) return;
            document.getElementById("reportEventName").textContent = ev.name;
            document.getElementById("reportModal")?.classList.remove("hidden");
        });

        document.getElementById("closeReport")?.addEventListener("click", () => {
            document.getElementById("reportModal")?.classList.add("hidden");
        });

        document.getElementById("reportForm")?.addEventListener("submit", (e) => {
            e.preventDefault();
            document.getElementById("reportModal")?.classList.add("hidden");
            alert("Denúncia registada. A equipa de moderação irá analisar o evento.");
        });
    }

    // ----------------------------------------------------------------------
    // 10. PERFIL, NOTIFICAÇÕES, ADMIN & CONTROLES DE INTERFACE
    // ----------------------------------------------------------------------
    function renderNotifications() {
        const badge = document.getElementById("notifBadge");
        const list = document.getElementById("notifList");
        if (!badge || !list) return;

        const unread = state.notifications.filter(n => !n.read).length;
        badge.textContent = unread;
        badge.classList.toggle("hidden", unread === 0);

        if (!state.notifications.length) {
            list.innerHTML = `<div class="notif-item"><p>Sem notificações recentes.</p></div>`;
            return;
        }

        list.innerHTML = state.notifications.slice(0, 15).map(n => `
            <div class="notif-item ${n.read ? "" : "unread"}">
                <strong>${escapeHTML(n.title)} <span class="muted" style="font-weight:400;">· ${escapeHTML(n.time || "")}</span></strong>
                <p>${escapeHTML(n.body)}</p>
            </div>
        `).join("");
    }

    function openProfileModal() {
        if (!state.currentUser) return;
        document.getElementById("profileEmailDisplay").textContent = state.currentUser.email;
        document.getElementById("profileNameInput").value = state.currentUser.name;
        document.getElementById("profileBioInput").value = state.currentUser.bio || "";

        const enrolled = state.events.filter(ev => (ev.attendees || []).some(a => a.id === state.currentUser.id));
        const created = state.events.filter(ev => ev.organizerId === state.currentUser.id);
        const followingIds = state.currentUser.following || [];
        const followingUsers = state.users.filter(u => followingIds.includes(u.id));

        document.getElementById("profileEnrolledList").innerHTML = enrolled.length
            ? enrolled.map(e => `<div class="admin-user-row"><strong>${escapeHTML(e.name)}</strong><span>📅 ${escapeHTML(e.date)} · ${escapeHTML(e.location)}</span></div>`).join("")
            : `<p class="muted" style="font-size:12.5px;">Ainda não tens inscrições.</p>`;

        document.getElementById("profileCreatedList").innerHTML = created.length
            ? created.map(e => `<div class="admin-user-row"><strong>${escapeHTML(e.name)}</strong><span>👥 ${(e.attendees || []).length} inscritos · ${escapeHTML(e.date)}</span></div>`).join("")
            : `<p class="muted" style="font-size:12.5px;">Ainda não criaste eventos.</p>`;

        document.getElementById("profileFollowingList").innerHTML = followingUsers.length
            ? followingUsers.map(u => `<div class="admin-user-row"><strong>${escapeHTML(u.name)}</strong><span>${escapeHTML(u.bio || "Entidade / Organizador")}</span></div>`).join("")
            : `<p class="muted" style="font-size:12.5px;">Ainda não segues nenhum organizador.</p>`;

        document.getElementById("profileModal")?.classList.remove("hidden");
    }

    function openAdminModal() {
        const totalAttendees = state.events.reduce((acc, e) => acc + (e.attendees?.length || 0), 0);
        document.getElementById("adminStatsGrid").innerHTML = `
            <div class="admin-stat-card"><strong>${state.events.length}</strong><span>Eventos</span></div>
            <div class="admin-stat-card"><strong>${state.users.length}</strong><span>Utilizadores</span></div>
            <div class="admin-stat-card"><strong>${totalAttendees}</strong><span>Inscrições</span></div>
            <div class="admin-stat-card"><strong>${COUNTRIES.length}</strong><span>Países</span></div>
        `;
        document.getElementById("adminUsersList").innerHTML = state.users.map(u => `
            <div class="admin-user-row">
                <strong>${escapeHTML(u.avatarEmoji || "👤")} ${escapeHTML(u.name)} ${u.verified ? "✓" : ""}</strong>
                <span>${escapeHTML(u.email)} · ${escapeHTML(u.accountType === "business" ? "Entidade" : "Pessoal")}</span>
            </div>
        `).join("");
        document.getElementById("adminModal")?.classList.remove("hidden");
    }

    function initUIControls() {
        // Pesquisa & Filtros
        document.getElementById("searchInput")?.addEventListener("input", (e) => {
            state.filters.search = e.target.value;
            applyFiltersAndRender();
        });

        document.querySelectorAll("#categoryChips .chip").forEach(chip => {
            chip.addEventListener("click", () => {
                document.querySelectorAll("#categoryChips .chip").forEach(c => c.classList.remove("active"));
                chip.classList.add("active");
                state.filters.category = chip.dataset.category;
                applyFiltersAndRender();
            });
        });

        const syncCountryFilter = (val) => {
            state.filters.country = val;
            const hSel = document.getElementById("headerCountrySelect");
            const dSel = document.getElementById("districtFilter");
            if (hSel) hSel.value = val;
            if (dSel) dSel.value = val;

            const foundCountry = COUNTRIES.find(c => c.name === val);
            if (foundCountry && state.mapInstance) {
                state.mapInstance.flyTo({ center: foundCountry.coords, zoom: foundCountry.zoom, pitch: 45 });
            }
            applyFiltersAndRender();
        };

        document.getElementById("headerCountrySelect")?.addEventListener("change", (e) => syncCountryFilter(e.target.value));
        document.getElementById("districtFilter")?.addEventListener("change", (e) => syncCountryFilter(e.target.value));

        document.getElementById("periodFilter")?.addEventListener("change", (e) => {
            state.filters.period = e.target.value;
            applyFiltersAndRender();
        });

        document.getElementById("sortFilter")?.addEventListener("change", (e) => {
            state.filters.sort = e.target.value;
            applyFiltersAndRender();
        });

        document.getElementById("radiusSlider")?.addEventListener("input", (e) => {
            const val = parseInt(e.target.value, 10);
            state.filters.radius = val;
            const lbl = document.getElementById("radiusValue");
            if (lbl) lbl.textContent = val >= 300 ? "Global" : `${val} km`;
            applyFiltersAndRender();
        });

        const bindTogglePill = (id, filterKey) => {
            document.getElementById(id)?.addEventListener("click", (e) => {
                state.filters[filterKey] = !state.filters[filterKey];
                e.currentTarget.classList.toggle("active", state.filters[filterKey]);
                applyFiltersAndRender();
            });
        };
        bindTogglePill("favoritesToggle", "favoritesOnly");
        bindTogglePill("freeOnlyToggle", "freeOnly");
        bindTogglePill("followingOnlyToggle", "followingOnly");

        document.getElementById("resetFilters")?.addEventListener("click", () => {
            state.filters = {
                search: "", category: "all", country: "all", period: "all",
                radius: 300, sort: "date", favoritesOnly: false, freeOnly: false, followingOnly: false
            };
            document.getElementById("searchInput").value = "";
            document.getElementById("headerCountrySelect").value = "all";
            document.getElementById("districtFilter").value = "all";
            document.getElementById("periodFilter").value = "all";
            document.getElementById("sortFilter").value = "date";
            document.getElementById("radiusSlider").value = 300;
            document.getElementById("radiusValue").textContent = "Global";
            document.querySelectorAll("#categoryChips .chip").forEach(c => c.classList.toggle("active", c.dataset.category === "all"));
            document.querySelectorAll(".toggle-pill").forEach(p => p.classList.remove("active"));
            applyFiltersAndRender();
        });

        // Geolocalização ("Perto de mim")
        document.getElementById("locationButton")?.addEventListener("click", () => {
            if (!navigator.geolocation) {
                alert("Geolocalização não suportada neste navegador.");
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    state.userLocation = { lat: latitude, lng: longitude };
                    if (state.currentUser) {
                        state.currentUser.lat = latitude;
                        state.currentUser.lng = longitude;
                        persistUsers();
                    }
                    if (state.mapInstance) {
                        if (state.userMarker) state.userMarker.remove();
                        const pulseEl = document.createElement("div");
                        pulseEl.className = "ls-user-pulse";
                        state.userMarker = new maplibregl.Marker({ element: pulseEl })
                            .setLngLat([longitude, latitude])
                            .addTo(state.mapInstance);
                        state.mapInstance.flyTo({ center: [longitude, latitude], zoom: 13.5, pitch: 55 });
                    }
                    document.getElementById("sortFilter").value = "distance";
                    state.filters.sort = "distance";
                    applyFiltersAndRender();
                },
                () => alert("Não foi possível obter a tua localização. Verifica as permissões do navegador.")
            );
        });

        // Exportar CSV
        document.getElementById("exportCsvBtn")?.addEventListener("click", () => {
            const headers = ["Nome", "Categoria", "País", "Data", "Hora", "Local", "Preço", "Inscritos"];
            const rows = state.filteredEvents.map(e => [
                `"${(e.name || "").replace(/"/g, '""')}"`,
                `"${e.category}"`,
                `"${e.country || ""}"`,
                `"${e.date}"`,
                `"${e.time}"`,
                `"${(e.location || "").replace(/"/g, '""')}"`,
                `"${e.price || "Gratuito"}"`,
                (e.attendees || []).length
            ].join(","));
            const csv = [headers.join(","), ...rows].join("\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "localspot-eventos.csv";
            a.click();
        });

        // Controles do Mapa 3D
        document.getElementById("mapStyleToggle")?.addEventListener("click", (e) => {
            if (!state.mapInstance) return;
            state.isSatellite = !state.isSatellite;
            state.mapInstance.setStyle(state.isSatellite ? SATELLITE_STYLE : DARK_STYLE);
            e.currentTarget.textContent = state.isSatellite ? "🗺️ Mapa Escuro" : "🛰️ Satélite 3D";
            state.mapInstance.once("styledata", () => {
                syncMapMarkers();
                renderFriendMarkers();
            });
        });

        document.getElementById("mapPitchToggle")?.addEventListener("click", (e) => {
            if (!state.mapInstance) return;
            state.is3D = !state.is3D;
            state.mapInstance.easeTo({ pitch: state.is3D ? 55 : 0, bearing: state.is3D ? -10 : 0 });
            e.currentTarget.textContent = state.is3D ? "📐 Vista 2D" : "🏙️ Vista 3D";
        });

        // Mobile Toggle Lista / Mapa
        document.getElementById("mobileViewToggle")?.addEventListener("click", (e) => {
            const main = document.getElementById("main");
            const isMap = main.getAttribute("data-view") === "map";
            main.setAttribute("data-view", isMap ? "list" : "map");
            e.currentTarget.textContent = isMap ? "🗺️ Ver Mapa" : "📋 Ver Lista";
            setTimeout(() => state.mapInstance?.resize(), 100);
        });

        // Amigos (Radar Bump)
        document.getElementById("lsHeaderFriendsBtn")?.addEventListener("click", () => {
            renderFriendsModalContent();
            document.getElementById("unifiedFriendsModal")?.classList.remove("hidden");
        });

        // Notificações
        document.getElementById("notifBtn")?.addEventListener("click", (e) => {
            e.stopPropagation();
            document.getElementById("notifDropdown")?.classList.toggle("hidden");
        });

        document.getElementById("markAllReadBtn")?.addEventListener("click", () => {
            state.notifications.forEach(n => { n.read = true; });
            writeJSON(STORAGE_KEYS.NOTIFICATIONS, state.notifications);
            renderNotifications();
        });

        document.addEventListener("click", (e) => {
            const drop = document.getElementById("notifDropdown");
            if (drop && !drop.classList.contains("hidden") && !e.target.closest(".notif-wrap")) {
                drop.classList.add("hidden");
            }
        });

        // Perfil
        document.getElementById("userBadge")?.addEventListener("click", openProfileModal);
        document.getElementById("closeProfile")?.addEventListener("click", () => {
            document.getElementById("profileModal")?.classList.add("hidden");
        });

        document.getElementById("profileUpdateForm")?.addEventListener("submit", (e) => {
            e.preventDefault();
            if (!state.currentUser) return;
            state.currentUser.name = document.getElementById("profileNameInput").value.trim() || state.currentUser.name;
            state.currentUser.bio = document.getElementById("profileBioInput").value.trim();
            persistUsers();
            updateAuthUI();
            alert("Perfil atualizado com sucesso!");
        });

        const profileTabs = [
            { tab: "tabMyEnrollments", list: "profileEnrolledList" },
            { tab: "tabMyCreated", list: "profileCreatedList" },
            { tab: "tabMyFollowing", list: "profileFollowingList" }
        ];
        profileTabs.forEach(({ tab, list }) => {
            document.getElementById(tab)?.addEventListener("click", () => {
                profileTabs.forEach(t => {
                    document.getElementById(t.tab)?.classList.toggle("active", t.tab === tab);
                    document.getElementById(t.list)?.classList.toggle("hidden", t.list !== list);
                });
            });
        });

        // Admin & Sobre
        document.getElementById("adminPanelBtn")?.addEventListener("click", openAdminModal);
        document.getElementById("closeAdmin")?.addEventListener("click", () => {
            document.getElementById("adminModal")?.classList.add("hidden");
        });

        document.getElementById("aboutButton")?.addEventListener("click", () => {
            document.getElementById("aboutModal")?.classList.remove("hidden");
        });
        document.getElementById("closeAbout")?.addEventListener("click", () => {
            document.getElementById("aboutModal")?.classList.add("hidden");
        });
    }

    // ----------------------------------------------------------------------
    // 11. ARRANQUE DA APLICAÇÃO
    // ----------------------------------------------------------------------
    document.addEventListener("DOMContentLoaded", () => {
        seedInitialData();
        populateCountrySelects();
        initMap();
        initAuthFlow();
        initEventFormHandlers();
        initDetailModalHandlers();
        initUIControls();
        applyFiltersAndRender();
    });
})();
