// ==========================================
// LOCALSPOT — MOTOR DE MAPA 3D & RADAR BUMP
// ==========================================

window.map = null;
window.userPosition = null;

let mapStyleMode = "dark";
let mapIs3D = false;
let eventMarkersMap = new Map();
let socialMarkersMap = new Map();
let userLocationMarker = null;
let pickingCallback = null;
let pickingMarker = null;
let latestTrailCoords = [];
let latestTrailVisible = false;
let latestSocialEntities = [];

const DARK_MAP_STYLE = {
    version: 8,
    sources: {
        cartoDark: {
            type: "raster",
            tiles: [
                "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
                "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
                "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"
            ],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap &copy; CARTO"
        }
    },
    layers: [
        {
            id: "carto-dark-layer",
            type: "raster",
            source: "cartoDark",
            minzoom: 0,
            maxzoom: 20
        }
    ]
};

const SATELLITE_MAP_STYLE = {
    version: 8,
    sources: {
        esriSat: {
            type: "raster",
            tiles: [
                "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            ],
            tileSize: 256,
            attribution: "&copy; Esri World Imagery"
        }
    },
    layers: [
        {
            id: "esri-sat-layer",
            type: "raster",
            source: "esriSat",
            minzoom: 0,
            maxzoom: 19
        }
    ]
};

window.initMap = function () {
    const mapContainer = document.getElementById("map");
    if (!mapContainer || typeof maplibregl === "undefined") return;

    window.map = new maplibregl.Map({
        container: "map",
        style: DARK_MAP_STYLE,
        center: [-8.5944, 40.3465],
        zoom: 13,
        pitch: 0,
        bearing: 0,
        attributionControl: false
    });

    window.map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-left");

    window.map.on("load", () => {
        window.map.resize();
    });

    window.map.on("style.load", () => {
        ensureCustomGeoJsonLayers();
        if (latestTrailCoords.length > 1) {
            window.setTodayTrailCoords(latestTrailCoords, latestTrailVisible);
        }
        if (latestSocialEntities.length > 0) {
            window.showFriendsOnMap(latestSocialEntities);
        }
    });

    window.map.on("click", e => {
        if (!pickingCallback) return;
        const coords = {
            lat: Number(e.lngLat.lat.toFixed(6)),
            lng: Number(e.lngLat.lng.toFixed(6))
        };

        if (pickingMarker) pickingMarker.remove();
        const pin = document.createElement("div");
        pin.className = "ls-event-marker active";
        pin.textContent = "📍 Local escolhido";
        pickingMarker = new maplibregl.Marker({ element: pin })
            .setLngLat([coords.lng, coords.lat])
            .addTo(window.map);

        const cb = pickingCallback;
        window.stopLocationPicking();
        cb(coords);
    });
};

function ensureCustomGeoJsonLayers() {
    if (!window.map || !window.map.isStyleLoaded()) return;

    if (!window.map.getSource("today-trail-src")) {
        window.map.addSource("today-trail-src", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] }
        });
        window.map.addLayer({
            id: "today-trail-glow",
            type: "line",
            source: "today-trail-src",
            paint: {
                "line-color": "#10b981",
                "line-width": 9,
                "line-opacity": 0.25
            }
        });
        window.map.addLayer({
            id: "today-trail-line",
            type: "line",
            source: "today-trail-src",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
                "line-color": "#34d399",
                "line-width": 3.5,
                "line-dasharray": [1.5, 1.2]
            }
        });
    }

    if (!window.map.getSource("hangout-links-src")) {
        window.map.addSource("hangout-links-src", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] }
        });
        window.map.addLayer({
            id: "hangout-links-line",
            type: "line",
            source: "hangout-links-src",
            paint: {
                "line-color": "#f43f5e",
                "line-width": 4,
                "line-opacity": 0.85
            }
        });
    }

    if (!window.map.getSource("blurred-zones-src")) {
        window.map.addSource("blurred-zones-src", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] }
        });
        window.map.addLayer({
            id: "blurred-zones-circle",
            type: "circle",
            source: "blurred-zones-src",
            paint: {
                "circle-radius": 36,
                "circle-color": "#8b5cf6",
                "circle-opacity": 0.22,
                "circle-stroke-width": 2,
                "circle-stroke-color": "#a78bfa"
            }
        });
    }
}

window.toggleMapStyleMode = function () {
    if (!window.map) return mapStyleMode;
    mapStyleMode = mapStyleMode === "dark" ? "satellite" : "dark";
    window.map.setStyle(mapStyleMode === "satellite" ? SATELLITE_MAP_STYLE : DARK_MAP_STYLE);
    return mapStyleMode;
};

window.toggleMapPitchMode = function () {
    if (!window.map) return mapIs3D;
    mapIs3D = !mapIs3D;
    window.map.easeTo({
        pitch: mapIs3D ? 58 : 0,
        bearing: mapIs3D ? -18 : 0,
        duration: 650
    });
    return mapIs3D;
};

window.locateUser = function () {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("O teu navegador não suporta geolocalização."));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => {
                const coords = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude
                };
                window.userPosition = coords;

                if (typeof window.recordExplorationPoint === "function") {
                    window.recordExplorationPoint(coords.lat, coords.lng);
                }
                if (typeof window.syncMyLiveLocation === "function") {
                    const speedKmh = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
                    window.syncMyLiveLocation(coords.lat, coords.lng, speedKmh);
                }

                if (window.map) {
                    if (userLocationMarker) userLocationMarker.remove();
                    const el = document.createElement("div");
                    el.className = "ls-user-pulse";
                    el.title = "A tua localização atual";
                    userLocationMarker = new maplibregl.Marker({ element: el })
                        .setLngLat([coords.lng, coords.lat])
                        .addTo(window.map);

                    window.map.flyTo({ center: [coords.lng, coords.lat], zoom: 14.5, duration: 900 });
                }
                resolve(coords);
            },
            () => reject(new Error("Permissão de localização recusada ou indisponível.")),
            { enableHighAccuracy: true, timeout: 9000 }
        );
    });
};

window.startLocationPicking = function (callback) {
    pickingCallback = callback;
    if (window.map) {
        window.map.getCanvas().style.cursor = "crosshair";
    }
};

window.stopLocationPicking = function () {
    pickingCallback = null;
    if (window.map) {
        window.map.getCanvas().style.cursor = "";
    }
};

// ==========================================
// MARCADORES DE EVENTOS NO MAPA
// ==========================================
window.showEventsOnMap = function (eventsList) {
    if (!window.map) return;

    eventMarkersMap.forEach(entry => entry.marker.remove());
    eventMarkersMap.clear();

    (eventsList || []).forEach(ev => {
        if (typeof ev.latitude !== "number" || typeof ev.longitude !== "number" || isNaN(ev.latitude) || isNaN(ev.longitude)) {
            return;
        }

        const el = document.createElement("div");
        el.className = "ls-event-marker";
        el.innerHTML = `<span>${window.getCategoryEmoji(ev.category)}</span><span>${window.escapeHTML(ev.price || "Grátis")}</span>`;

        const popupHtml = `
            <div style="min-width:200px;">
                <strong style="display:block; font-size:13.5px; margin-bottom:4px;">${window.escapeHTML(ev.name)}</strong>
                <div style="font-size:11.5px; color:#94a3b8; margin-bottom:8px;">
                    📅 ${window.escapeHTML(window.formatEventDate(ev))} às ${window.escapeHTML(ev.time)}<br>
                    📍 ${window.escapeHTML(ev.location)}
                </div>
                <button type="button" onclick="window.openEventDetails('${ev.id}')" style="width:100%; background:#10b981; color:#04130d; border:none; border-radius:8px; padding:6px 10px; font-weight:700; font-size:12px; cursor:pointer;">
                    Ver Detalhes
                </button>
            </div>
        `;

        const popup = new maplibregl.Popup({ offset: 18 }).setHTML(popupHtml);

        el.addEventListener("click", () => {
            if (typeof window.handleMarkerClick === "function") {
                window.handleMarkerClick(ev.id);
            }
        });

        const marker = new maplibregl.Marker({ element: el })
            .setLngLat([ev.longitude, ev.latitude])
            .setPopup(popup)
            .addTo(window.map);

        eventMarkersMap.set(String(ev.id), { marker, el, event: ev });
    });
};

window.focusEventOnMap = function (eventId) {
    if (!window.map) return;
    const key = String(eventId);

    eventMarkersMap.forEach((entry, id) => {
        entry.el.classList.toggle("active", id === key);
    });

    const target = eventMarkersMap.get(key);
    if (!target) return;

    window.map.flyTo({
        center: [target.event.longitude, target.event.latitude],
        zoom: 15.5,
        duration: 850
    });
    target.marker.togglePopup();
};

// ==========================================
// RADAR BUMP: AMIGOS, ENTIDADES & HANGOUTS
// ==========================================
window.showFriendsOnMap = function (entities) {
    latestSocialEntities = Array.isArray(entities) ? entities : [];
    if (!window.map) return;

    socialMarkersMap.forEach(entry => entry.marker.remove());
    socialMarkersMap.clear();

    const visibleFriends = [];
    const blurredFeatures = [];

    latestSocialEntities.forEach(person => {
        const isGhost = person.ghost_mode || person.privacy_mode === "ghost";
        if (isGhost || typeof person.last_lat !== "number" || typeof person.last_lng !== "number") {
            return;
        }

        const isBiz = person.role === "business";
        const isLive = typeof window.isFriendLiveOnline === "function" && window.isFriendLiveOnline(person.id);

        if (!isBiz) {
            visibleFriends.push(person);
            if (person.privacy_mode === "blurred") {
                blurredFeatures.push({
                    type: "Feature",
                    geometry: { type: "Point", coordinates: [person.last_lng, person.last_lat] }
                });
            }
        }

        const el = document.createElement("div");
        el.className = `ls-friend-marker${isLive ? " online" : ""}${isBiz ? " business" : ""}`;

        const initials = (person.full_name || "?")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(p => p[0].toUpperCase())
            .join("");

        const avatarInner = person.avatar_url
            ? `<img src="${window.escapeHTML(person.avatar_url)}" alt="" onerror="this.remove()">`
            : window.escapeHTML(initials);

        const moodBadge = isBiz ? "🏛️" : (person.status_emoji || "📍");
        const shortName = (person.full_name || "Amigo").split(" ")[0];

        el.innerHTML = `
            <span class="ls-friend-name-tag">${isLive ? "🟢 " : ""}${window.escapeHTML(shortName)}</span>
            ${avatarInner}
            <span class="ls-friend-mood-badge">${moodBadge}</span>
        `;

        let popupHtml = "";
        if (isBiz) {
            popupHtml = `
                <div style="min-width:200px;">
                    <strong style="display:block; font-size:13.5px;">🏛️ ${window.escapeHTML(person.full_name)}</strong>
                    <span style="display:block; font-size:11.5px; color:#94a3b8; margin:3px 0 8px;">
                        ${window.escapeHTML(person.business_type || "Entidade Oficial")}
                    </span>
                    <div style="font-size:11.5px; color:#38bdf8;">Sede oficial verificada no LocalSpot</div>
                </div>
            `;
        } else {
            const tier = typeof window.getFriendshipTier === "function"
                ? window.getFriendshipTier(person.bump_count || 0)
                : { badge: "🌱 Amigos" };
            const batInfo = typeof person.battery_level === "number"
                ? ` · ${person.is_charging ? "⚡" : "🔋"}${person.battery_level}%`
                : "";
            const speedInfo = typeof person.speed_kmh === "number" && person.speed_kmh > 3
                ? ` · 🚗 ${person.speed_kmh} km/h`
                : "";
            const placeInfo = person.current_place
                ? `📌 ${window.escapeHTML(person.current_place)}`
                : `${window.escapeHTML(person.status_emoji || "📍")} ${window.escapeHTML(person.status_text || "Online")}`;

            popupHtml = `
                <div style="min-width:225px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
                        <strong style="font-size:14px;">${window.escapeHTML(person.full_name)}</strong>
                        <span style="font-size:11px; color:#f43f5e; font-weight:800;">👊 ${person.bump_count || 0} pts</span>
                    </div>
                    <div style="font-size:11px; color:#a78bfa; font-weight:700; margin:2px 0 4px;">${tier.badge}</div>
                    <div style="font-size:12px; color:#cbd5e1; margin-bottom:10px;">
                        ${placeInfo}${batInfo}${speedInfo}
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:5px;">
                        <button type="button" onclick="window.sendBump('${person.id}', '👊', 'Bump!')" style="background:#f43f5e; color:#fff; border:none; border-radius:8px; padding:6px 4px; font-weight:800; font-size:11.5px; cursor:pointer;">👊 Bump</button>
                        <button type="button" onclick="window.openFriendChat('${person.id}')" style="background:#10b981; color:#04130d; border:none; border-radius:8px; padding:6px 4px; font-weight:800; font-size:11.5px; cursor:pointer;">💬 Chat</button>
                        <button type="button" onclick="window.sendWhereAreYouPing('${person.id}')" style="background:#1e293b; color:#f8fafc; border:1px solid rgba(148,163,184,0.3); border-radius:8px; padding:6px 4px; font-weight:700; font-size:11.5px; cursor:pointer;">👀 Onde?</button>
                    </div>
                </div>
            `;
        }

        const popup = new maplibregl.Popup({ offset: 24 }).setHTML(popupHtml);
        const marker = new maplibregl.Marker({ element: el })
            .setLngLat([person.last_lng, person.last_lat])
            .setPopup(popup)
            .addTo(window.map);

        socialMarkersMap.set(String(person.id), { marker, person });
    });

    ensureCustomGeoJsonLayers();
    if (window.map.getSource("blurred-zones-src")) {
        window.map.getSource("blurred-zones-src").setData({
            type: "FeatureCollection",
            features: blurredFeatures
        });
    }

    detectFriendHangouts(visibleFriends);
};

function detectFriendHangouts(visibleFriends) {
    const hangoutFeatures = [];
    const hangoutLabels = [];
    let firstHangoutFriend = null;

    if (window.userPosition && typeof window.distanceKm === "function") {
        visibleFriends.forEach(f => {
            const dist = window.distanceKm(window.userPosition.lat, window.userPosition.lng, f.last_lat, f.last_lng);
            if (dist <= 0.15) {
                hangoutLabels.push(`Tu e ${f.full_name.split(" ")[0]}`);
                if (!firstHangoutFriend) firstHangoutFriend = f;
                hangoutFeatures.push({
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: [
                            [window.userPosition.lng, window.userPosition.lat],
                            [f.last_lng, f.last_lat]
                        ]
                    }
                });
            }
        });
    }

    for (let i = 0; i < visibleFriends.length; i++) {
        for (let j = i + 1; j < visibleFriends.length; j++) {
            const a = visibleFriends[i];
            const b = visibleFriends[j];
            const dist = window.distanceKm(a.last_lat, a.last_lng, b.last_lat, b.last_lng);
            if (dist <= 0.15) {
                hangoutLabels.push(`${a.full_name.split(" ")[0]} & ${b.full_name.split(" ")[0]}`);
                if (!firstHangoutFriend) firstHangoutFriend = a;
                hangoutFeatures.push({
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: [
                            [a.last_lng, a.last_lat],
                            [b.last_lng, b.last_lat]
                        ]
                    }
                });
            }
        }
    }

    if (window.map && window.map.getSource("hangout-links-src")) {
        window.map.getSource("hangout-links-src").setData({
            type: "FeatureCollection",
            features: hangoutFeatures
        });
    }

    if (typeof window.updateHangoutBanner === "function") {
        window.updateHangoutBanner(hangoutLabels, firstHangoutFriend);
    }
}

window.focusFriendOnMap = function (friendId) {
    if (!window.map) return false;
    const entry = socialMarkersMap.get(String(friendId));
    if (!entry) return false;

    window.map.flyTo({
        center: [entry.person.last_lng, entry.person.last_lat],
        zoom: 16,
        duration: 850
    });
    entry.marker.togglePopup();
    return true;
};

// ==========================================
// PERCURSO DE EXPLORAÇÃO DIÁRIA NO MAPA
// ==========================================
window.setTodayTrailCoords = function (coordsArray, isVisible) {
    latestTrailCoords = Array.isArray(coordsArray) ? coordsArray : [];
    latestTrailVisible = Boolean(isVisible);

    if (!window.map) return;
    ensureCustomGeoJsonLayers();

    const src = window.map.getSource("today-trail-src");
    if (!src) return;

    if (!latestTrailVisible || latestTrailCoords.length < 2) {
        src.setData({ type: "FeatureCollection", features: [] });
        return;
    }

    src.setData({
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates: latestTrailCoords
                }
            }
        ]
    });
};
