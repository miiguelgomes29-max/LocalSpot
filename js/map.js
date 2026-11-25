// ==========================================
// LOCALSPOT — OPENSTREETMAP 3D + SATÉLITE 3D
// 100% Gratuito · Sem Chaves API
// ==========================================

window.map = null;
window.userPosition = null;

let mapStyleMode = "osm"; // "osm" (OpenStreetMap 3D) ou "satellite" (Satélite 3D)
let mapIs3D = true;       // Começa com inclinação 3D ativa para ver edifícios e relevo
let eventMarkersMap = new Map();
let socialMarkersMap = new Map();
let userLocationMarker = null;
let pickingCallback = null;
let pickingMarker = null;
let latestTrailCoords = [];
let latestTrailVisible = false;
let latestSocialEntities = [];
let pendingEventsToRender = null;
let mapInitStarted = false;

// Estilo OpenStreetMap Vetorial Gratuito (OpenFreeMap)
const OPEN_MAP_3D_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

// Estilo Satélite + Edifícios 3D OpenStreetMap (Gratuito, sem API Key)
const SATELLITE_3D_STYLE = {
    version: 8,
    sources: {
        esriSat: {
            type: "raster",
            tiles: [
                "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            ],
            tileSize: 256,
            maxzoom: 19,
            attribution: "&copy; Esri World Imagery &copy; OpenStreetMap"
        },
        openfreemap: {
            type: "vector",
            url: "https://tiles.openfreemap.org/planet"
        }
    },
    layers: [
        {
            id: "esri-sat-layer",
            type: "raster",
            source: "esriSat",
            minzoom: 0,
            maxzoom: 22
        },
        {
            id: "osm-3d-buildings-sat",
            type: "fill-extrusion",
            source: "openfreemap",
            "source-layer": "building",
            minzoom: 14,
            filter: ["!=", ["get", "hide_3d"], true],
            paint: {
                "fill-extrusion-color": "#38bdf8",
                "fill-extrusion-height": [
                    "interpolate", ["linear"], ["zoom"],
                    14, 0,
                    14.5, ["coalesce", ["get", "render_height"], 10]
                ],
                "fill-extrusion-base": [
                    "interpolate", ["linear"], ["zoom"],
                    14, 0,
                    14.5, ["coalesce", ["get", "render_min_height"], 0]
                ],
                "fill-extrusion-opacity": 0.42
            }
        }
    ]
};

function ensureMapLibreLoaded() {
    return new Promise((resolve, reject) => {
        if (typeof window.maplibregl !== "undefined") {
            resolve();
            return;
        }

        const cdns = [
            {
                js: "https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js",
                css: "https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css"
            },
            {
                js: "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.js",
                css: "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.css"
            }
        ];

        let idx = 0;
        function tryNext() {
            if (typeof window.maplibregl !== "undefined") {
                resolve();
                return;
            }
            if (idx >= cdns.length) {
                reject(new Error("Não foi possível carregar o motor do mapa."));
                return;
            }

            const current = cdns[idx++];
            if (!document.querySelector(`link[href="${current.css}"]`)) {
                const link = document.createElement("link");
                link.rel = "stylesheet";
                link.href = current.css;
                document.head.appendChild(link);
            }

            const script = document.createElement("script");
            script.src = current.js;
            script.async = true;
            script.onload = () => {
                if (typeof window.maplibregl !== "undefined") resolve();
                else tryNext();
            };
            script.onerror = () => tryNext();
            document.head.appendChild(script);
        }

        tryNext();
    });
}

function setup3DBuildingsAndTerrain() {
    if (!window.map || !window.map.isStyleLoaded()) return;

    // 1. Terreno / Montanhas 3D Gratuito (AWS Terrarium DEM)
    if (!window.map.getSource("terrainDem")) {
        window.map.addSource("terrainDem", {
            type: "raster-dem",
            tiles: [
                "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
            ],
            tileSize: 256,
            maxzoom: 14,
            encoding: "terrarium"
        });
    }

    if (mapIs3D) {
        window.map.setTerrain({ source: "terrainDem", exaggeration: 1.25 });
    } else {
        window.map.setTerrain(null);
    }

    // 2. Edifícios 3D OpenStreetMap no modo Open Map
    if (mapStyleMode === "osm") {
        if (!window.map.getSource("openfreemap")) {
            window.map.addSource("openfreemap", {
                type: "vector",
                url: "https://tiles.openfreemap.org/planet"
            });
        }

        if (!window.map.getLayer("osm-3d-buildings")) {
            const layers = window.map.getStyle().layers || [];
            let labelLayerId = null;
            for (let i = 0; i < layers.length; i++) {
                if (layers[i].type === "symbol" && layers[i].layout && layers[i].layout["text-field"]) {
                    labelLayerId = layers[i].id;
                    break;
                }
            }

            window.map.addLayer(
                {
                    id: "osm-3d-buildings",
                    source: "openfreemap",
                    "source-layer": "building",
                    type: "fill-extrusion",
                    minzoom: 14,
                    filter: ["!=", ["get", "hide_3d"], true],
                    paint: {
                        "fill-extrusion-color": [
                            "interpolate", ["linear"], ["coalesce", ["get", "render_height"], 10],
                            0, "#cbd5e1",
                            25, "#94a3b8",
                            60, "#64748b"
                        ],
                        "fill-extrusion-height": [
                            "interpolate", ["linear"], ["zoom"],
                            14, 0,
                            14.5, ["coalesce", ["get", "render_height"], 10]
                        ],
                        "fill-extrusion-base": [
                            "interpolate", ["linear"], ["zoom"],
                            14, 0,
                            14.5, ["coalesce", ["get", "render_min_height"], 0]
                        ],
                        "fill-extrusion-opacity": 0.85
                    }
                },
                labelLayerId || undefined
            );
        }
    }
}

window.initMap = async function () {
    if (mapInitStarted && window.map) return;
    const mapContainer = document.getElementById("map");
    if (!mapContainer) return;

    mapInitStarted = true;

    try {
        await ensureMapLibreLoaded();
    } catch (err) {
        mapInitStarted = false;
        mapContainer.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:14px;padding:20px;text-align:center;">
                ⚠️ Não foi possível ligar ao servidor de mapas. Verifica a ligação à internet e recarrega a página.
            </div>
        `;
        return;
    }

    try {
        window.map = new maplibregl.Map({
            container: "map",
            style: OPEN_MAP_3D_STYLE_URL,
            center: [-8.5944, 40.3465], // Cantanhede / Centro PT
            zoom: 15,
            pitch: 52,
            bearing: -15,
            maxPitch: 75,
            attributionControl: false
        });
    } catch (webglErr) {
        mapInitStarted = false;
        mapContainer.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:14px;padding:20px;text-align:center;">
                ⚠️ O navegador bloqueou o WebGL necessário para o mapa 3D.
            </div>
        `;
        return;
    }

    window.map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-left");

    if (typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(() => {
            if (window.map) window.map.resize();
        });
        ro.observe(mapContainer);
    }
    setTimeout(() => { if (window.map) window.map.resize(); }, 150);
    setTimeout(() => { if (window.map) window.map.resize(); }, 800);

    window.map.on("load", () => {
        window.map.resize();
        setup3DBuildingsAndTerrain();
        ensureCustomGeoJsonLayers();

        if (pendingEventsToRender) {
            window.showEventsOnMap(pendingEventsToRender);
        } else if (Array.isArray(window.events) && window.events.length > 0) {
            window.showEventsOnMap(window.events);
        }
    });

    window.map.on("style.load", () => {
        setup3DBuildingsAndTerrain();
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

// Alternar entre OpenStreetMap 3D e Satélite 3D
window.toggleMapStyleMode = function () {
    if (!window.map) return mapStyleMode;
    mapStyleMode = mapStyleMode === "osm" ? "satellite" : "osm";
    window.map.setStyle(mapStyleMode === "satellite" ? SATELLITE_3D_STYLE : OPEN_MAP_3D_STYLE_URL);

    const btn = document.getElementById("mapStyleToggle");
    if (btn) {
        btn.textContent = mapStyleMode === "satellite" ? "🗺️ OpenMap 3D" : "🛰️ Satélite 3D";
    }
    return mapStyleMode;
};

// Alternar inclinação 3D (Edifícios + Montanhas) vs Vista 2D de topo
window.toggleMapPitchMode = function () {
    if (!window.map) return mapIs3D;
    mapIs3D = !mapIs3D;

    if (window.map.getSource("terrainDem")) {
        window.map.setTerrain(mapIs3D ? { source: "terrainDem", exaggeration: 1.25 } : null);
    }

    window.map.easeTo({
        pitch: mapIs3D ? 55 : 0,
        bearing: mapIs3D ? -15 : 0,
        duration: 650
    });

    const btn = document.getElementById("mapPitchToggle");
    if (btn) {
        btn.textContent = mapIs3D ? "📐 Vista 2D" : "🧊 Vista 3D";
    }
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

                    window.map.flyTo({
                        center: [coords.lng, coords.lat],
                        zoom: 15.5,
                        pitch: mapIs3D ? 55 : 0,
                        duration: 900
                    });
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
    pendingEventsToRender = eventsList;
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
        zoom: 16,
        pitch: mapIs3D ? 55 : 0,
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
            : window.escapeHTML(person.avatar_emoji || initials);

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
                        <button type="button" onclick="window.triggerBumpImpactAnimation('👊 Bump enviado para ${window.escapeHTML(shortName)}!'); window.sendBump('${person.id}', '👊', 'Bump!')" style="background:#f43f5e; color:#fff; border:none; border-radius:8px; padding:6px 4px; font-weight:800; font-size:11.5px; cursor:pointer;">👊 Bump</button>
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
        zoom: 16.5,
        pitch: mapIs3D ? 55 : 0,
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

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        if (!window.map) window.initMap();
    });
} else {
    setTimeout(() => {
        if (!window.map) window.initMap();
    }, 0);
}
