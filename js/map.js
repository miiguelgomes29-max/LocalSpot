// ==========================================
// MAPA (MapLibre GL JS - Satélite 3D & Mapa Noturno 3D + Relevo + Edifícios + Amigos & Entidades Verificadas)
// ==========================================

window.onEventMarkerClick = null;

function buildMapStyle(mode = "satellite") {
    const isSatellite = mode === "satellite";

    const sources = {
        terrainSource: {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            tileSize: 256,
            encoding: 'terrarium',
            maxzoom: 15
        },
        openmaptiles: {
            type: 'vector',
            url: 'https://tiles.openfreemap.org/planet'
        }
    };

    if (isSatellite) {
        sources.satellite = {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: '© Esri, Maxar'
        };
    }

    const layers = [];

    if (isSatellite) {
        layers.push({
            id: 'satellite-layer',
            type: 'raster',
            source: 'satellite',
            minzoom: 0,
            maxzoom: 22
        });
    } else {
        layers.push(
            { id: 'bg', type: 'background', paint: { 'background-color': '#0b1120' } },
            { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': '#172554' } },
            { id: 'landuse', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse', paint: { 'fill-color': '#111827', 'fill-opacity': 0.6 } },
            { id: 'roads', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', paint: { 'line-color': '#334155', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 15, 3] } }
        );
    }

    layers.push(
        {
            id: '3d-buildings',
            source: 'openmaptiles',
            'source-layer': 'building',
            type: 'fill-extrusion',
            minzoom: 14,
            paint: {
                'fill-extrusion-color': isSatellite ? '#e2e8f0' : '#3b82f6',
                'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 12],
                'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
                'fill-extrusion-opacity': isSatellite ? 0.72 : 0.45
            }
        },
        {
            id: 'road-labels',
            type: 'symbol',
            source: 'openmaptiles',
            'source-layer': 'transportation_name',
            minzoom: 13,
            layout: {
                'symbol-placement': 'line',
                'text-field': ['coalesce', ['get', 'name:pt'], ['get', 'name']],
                'text-font': ['Noto Sans Regular'],
                'text-size': 11
            },
            paint: {
                'text-color': '#e2e8f0',
                'text-halo-color': 'rgba(15, 23, 42, 0.85)',
                'text-halo-width': 1.3
            }
        },
        {
            id: 'place-labels',
            type: 'symbol',
            source: 'openmaptiles',
            'source-layer': 'place',
            filter: ['in', ['get', 'class'], ['literal', ['country', 'city', 'town', 'village']]],
            layout: {
                'text-field': ['coalesce', ['get', 'name:pt'], ['get', 'name']],
                'text-font': ['Noto Sans Regular'],
                'text-size': ['match', ['get', 'class'], 'country', 15, 'city', 13.5, 'town', 11.5, 10.5],
                'text-transform': ['match', ['get', 'class'], 'country', 'uppercase', 'none'],
                'text-letter-spacing': 0.05
            },
            paint: {
                'text-color': '#f8fafc',
                'text-halo-color': 'rgba(15, 23, 42, 0.9)',
                'text-halo-width': 1.6
            }
        }
    );

    return {
        version: 8,
        glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
        sources,
        layers,
        terrain: { source: 'terrainSource', exaggeration: 1.5 },
        sky: {
            'sky-color': isSatellite ? '#1d4ed8' : '#020617',
            'sky-horizon-blend': 0.5,
            'horizon-color': isSatellite ? '#93c5fd' : '#1e293b',
            'horizon-fog-blend': 0.5,
            'fog-color': '#0f172a',
            'fog-ground-blend': 0.4
        }
    };
}

let currentMapMode = "satellite";

const map = new maplibregl.Map({
    container: 'map',
    style: buildMapStyle("satellite"),
    center: [-8.1, 39.6],
    zoom: 6.4,
    pitch: 55,
    bearing: -12,
    maxPitch: 85,
    antialias: true,
    interactive: true,
    dragPan: true,
    scrollZoom: true,
    touchZoomRotate: true,
    attributionControl: false
});

map.addControl(new maplibregl.AttributionControl({ compact: true }));
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }));

let markers = [];
const markerById = new Map();

let friendMarkers = [];
const friendMarkerById = new Map();
let activeRadarCoords = null;

function ensureRadarLineLayer() {
    if (!map.getSource("friend-radar")) {
        map.addSource("friend-radar", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] }
        });
        map.addLayer({
            id: "friend-radar-line",
            type: "line",
            source: "friend-radar",
            paint: {
                "line-color": "#ec4899",
                "line-width": 4,
                "line-dasharray": [2, 1.5],
                "line-opacity": 0.9
            }
        });
    }
    if (activeRadarCoords && map.getSource("friend-radar")) {
        map.getSource("friend-radar").setData({
            type: "Feature",
            geometry: {
                type: "LineString",
                coordinates: activeRadarCoords
            }
        });
    }
}

function drawFriendRadarLine(fromLngLat, toLngLat) {
    activeRadarCoords = [fromLngLat, toLngLat];
    ensureRadarLineLayer();
}

function clearFriendRadarLine() {
    activeRadarCoords = null;
    if (map.getSource("friend-radar")) {
        map.getSource("friend-radar").setData({ type: "FeatureCollection", features: [] });
    }
}

map.on('load', () => {
    map.resize();
    ensureRadarLineLayer();
    if (typeof currentList !== 'undefined' && currentList.length > 0) {
        showEventsOnMap(currentList);
    }
    if (typeof window.getMapSocialEntities === 'function') {
        showFriendsOnMap(window.getMapSocialEntities());
    }
});

map.on('style.load', () => {
    ensureRadarLineLayer();
});

function toggleMapStyleMode() {
    currentMapMode = currentMapMode === "satellite" ? "dark" : "satellite";
    map.setStyle(buildMapStyle(currentMapMode));
    return currentMapMode;
}

function toggleMapPitchMode() {
    const is3D = map.getPitch() > 20;
    map.easeTo({ pitch: is3D ? 0 : 60, bearing: is3D ? 0 : -12, duration: 600 });
    return !is3D;
}

function createCustomMarkerElement(category) {
    const c = CATEGORIES[category] || CATEGORIES.comunidade;
    const el = document.createElement('div');
    el.className = 'pin-wrapper';
    el.innerHTML = `<div class="pin" style="--pin:${c.color}"><span>${c.emoji}</span></div>`;
    return el;
}

function popupHTML(ev) {
    const cat = CATEGORIES[ev.category];
    const directions = `https://www.google.com/maps/dir/?api=1&destination=${ev.latitude},${ev.longitude}`;
    const fav = typeof favorites !== "undefined" && favorites.has(String(ev.id));
    const enrolled = typeof myEnrollments !== "undefined" && myEnrollments.has(String(ev.id));
    const past = typeof isPast === "function" ? isPast(ev) : (eventDateTime(ev) < new Date());

    const currentEnrolled = ev.enrolled || 0;
    const max = ev.maxParticipants;
    const isFull = max && currentEnrolled >= max;

    let vagasLabel = max ? `${currentEnrolled}/${max} vagas` : `${currentEnrolled} inscritos`;
    if (isFull) vagasLabel += " (Esgotado)";

    let enrollBtnHtml = "";
    if (!past) {
        if (enrolled) {
            enrollBtnHtml = `<button type="button" class="register-btn registered" onclick="window.toggleEnrollment('${ev.id}')">✓ Inscrito</button>`;
        } else if (isFull) {
            enrollBtnHtml = `<button type="button" class="register-btn" disabled>Esgotado</button>`;
        } else {
            enrollBtnHtml = `<button type="button" class="register-btn" onclick="window.toggleEnrollment('${ev.id}')">✋ Inscrever-me</button>`;
        }
    } else {
        enrollBtnHtml = `<button type="button" class="register-btn" disabled>Terminado</button>`;
    }

    let organizerBadge = "";
    if (ev.creatorName) {
        const isNormalUser = ev.creatorRole === "user" || ev.creatorType === "Utilizador";
        const isAdmin = ev.creatorRole === "admin" || ev.creatorType === "Admin";
        const badgeIcon = isAdmin ? "🛡️" : (isNormalUser ? "👤" : "🏢");
        const prefix = !isNormalUser && !isAdmin && ev.creatorType ? `${ev.creatorType} · ` : "";
        const verifiedHtml = !isNormalUser && !isAdmin && ev.creatorVerified
            ? `<span class="verified-check" title="Entidade Verificada">✓</span>`
            : "";
        const tagClass = isAdmin ? " admin-tag" : (isNormalUser ? " user-tag" : "");
        organizerBadge = `<div class="organizer-tag${tagClass}">${badgeIcon} ${escapeHTML(prefix)}${escapeHTML(ev.creatorName)}${verifiedHtml}</div>`;
    }

    const friendsGoing = typeof window.getFriendsGoingToEvent === "function" ? window.getFriendsGoingToEvent(ev.id) : [];
    const friendsBadge = friendsGoing.length
        ? `<div class="friends-going-badge">👊 ${friendsGoing.length === 1 ? escapeHTML(friendsGoing[0].full_name) + " vai" : friendsGoing.length + " amigos vão"}</div>`
        : "";

    return `
        <div class="popup-card">
            <div class="event-image-wrap">
                <img src="${escapeHTML(ev.image || DEFAULT_IMAGE)}" alt="" class="event-image"
                     onerror="this.onerror=null;this.src='${DEFAULT_IMAGE}'">
                ${past ? '<span class="badge-past">Terminado</span>' : ""}
                <span class="badge-price-card">${escapeHTML(ev.price || "Gratuito")}</span>
                <button type="button" class="fav-btn${fav ? " on" : ""}" onclick="window.toggleFavorite('${ev.id}')" title="Favorito">${fav ? "★" : "☆"}</button>
            </div>
            <div class="event-meta">
                <span class="category">${cat ? cat.emoji + " " + cat.label : escapeHTML(ev.category)}</span>
            </div>
            <h4>${escapeHTML(ev.name)}</h4>
            ${organizerBadge}
            ${friendsBadge}
            <p>📅 ${escapeHTML(formatEventDate(ev))}</p>
            <p>📍 ${escapeHTML(ev.location)} · ${escapeHTML(districtLabel(ev.distrito))}</p>
            <div class="registration-info">👥 ${vagasLabel}</div>
            <div class="popup-actions-grid">
                ${enrollBtnHtml}
                <button type="button" class="details-btn" onclick="window.openEventDetails('${ev.id}')">Detalhes</button>
                <a href="${directions}" target="_blank" rel="noopener" class="popup-dir-btn" title="Como chegar">🧭</a>
            </div>
        </div>`;
}

function showEventsOnMap(list) {
    let openPopupId = null;
    markerById.forEach((marker, key) => {
        if (marker.getPopup() && marker.getPopup().isOpen()) {
            openPopupId = key;
        }
    });

    markers.forEach(m => m.remove());
    markers = [];
    markerById.clear();

    list.forEach(ev => {
        if (typeof ev.latitude !== "number" || typeof ev.longitude !== "number") return;
        
        const el = createCustomMarkerElement(ev.category);
        const popup = new maplibregl.Popup({
            offset: [0, -38],
            closeButton: false,
            focusAfterOpen: false,
            maxWidth: '300px'
        }).setHTML(popupHTML(ev));
        
        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([ev.longitude, ev.latitude])
            .setPopup(popup)
            .addTo(map);

        el.addEventListener('click', () => {
            clearFriendRadarLine();
            if (typeof window.onEventMarkerClick === "function") {
                window.onEventMarkerClick(ev.id);
            }
        });

        markers.push(marker);
        markerById.set(String(ev.id), marker);
    });

    if (openPopupId && markerById.has(openPopupId)) {
        markerById.get(openPopupId).togglePopup();
    }
}

// ---------- Amigos e Entidades Seguidas no Mapa ----------
function getInitials(name) {
    if (!name) return "?";
    return name.trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join("");
}

function formatLastSeen(isoDate) {
    if (!isoDate) return "Agora mesmo";
    const diffMin = Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000);
    if (diffMin < 2) return "Online agora";
    if (diffMin < 60) return `Há ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Há ${diffH}h`;
    return `Há ${Math.floor(diffH / 24)}d`;
}

function formatBattery(level, charging) {
    if (typeof level !== "number") return null;
    if (charging) return `⚡ ${level}%`;
    if (level <= 20) return `🪫 ${level}%`;
    return `🔋 ${level}%`;
}

function formatSpeed(speedKmh) {
    if (typeof speedKmh !== "number" || speedKmh <= 2) return "🧍 Parado";
    if (speedKmh <= 12) return `🚶 ${speedKmh} km/h`;
    if (speedKmh <= 30) return `🚲 ${speedKmh} km/h`;
    return `🚗 ${speedKmh} km/h`;
}

function friendPopupHTML(friend) {
    const isBiz = friend.role === "business";
    const avatarInner = friend.avatar_url
        ? `<img src="${escapeHTML(friend.avatar_url)}" alt="" onerror="this.remove()">`
        : escapeHTML(getInitials(friend.full_name));

    const verifiedBadge = isBiz && friend.is_verified
        ? `<span class="verified-check" title="Entidade Verificada">✓</span>`
        : "";

    const placeOrStatus = isBiz
        ? `🏛️ ${escapeHTML(friend.business_type || "Entidade Oficial")}`
        : (friend.current_place
            ? `📍 ${escapeHTML(friend.current_place)}`
            : `${friend.status_emoji || "📍"} ${escapeHTML(friend.status_text || "No LocalSpot")}`);

    const seenLine = formatLastSeen(friend.last_seen);
    const directions = `https://www.google.com/maps/dir/?api=1&destination=${friend.last_lat},${friend.last_lng}`;
    const batLabel = !isBiz ? formatBattery(friend.battery_level, friend.is_charging) : null;
    const spdLabel = !isBiz ? formatSpeed(friend.speed_kmh) : null;
    const bumps = friend.bump_count || 0;

    let distText = "";
    if (userPosition && typeof friend.last_lat === "number" && typeof friend.last_lng === "number") {
        const km = distanceKm(userPosition.lat, userPosition.lng, friend.last_lat, friend.last_lng);
        const walkMins = Math.max(1, Math.round((km / 5) * 60));
        distText = km < 0.2
            ? " · 🔥 Mesmo ao pé de ti!"
            : ` · A ${km < 10 ? km.toFixed(1).replace(".", ",") : Math.round(km)} km (~${walkMins} min)`;
    }

    const privacyHint = !isBiz && friend.privacy_mode === "blurred" ? " (Zona aprox.)" : "";

    return `
        <div class="friend-popup-card">
            <div class="friend-popup-header">
                <div class="avatar-circle lg${isBiz ? " business-avatar" : ""}">${avatarInner}</div>
                <h4>${escapeHTML(friend.full_name)}${verifiedBadge}</h4>
                <span class="friend-popup-status${isBiz ? " business-status" : ""}">${placeOrStatus}${privacyHint}</span>
            </div>
            ${!isBiz ? `
                <div class="friend-telemetry-row">
                    ${batLabel ? `<span class="telemetry-chip">${batLabel}</span>` : ""}
                    <span class="telemetry-chip">${spdLabel}</span>
                    <span class="telemetry-chip bump-streak">👊 ${bumps} Bumps</span>
                </div>
            ` : (friend.bio ? `<p style="font-size:12px; color:var(--muted); margin:4px 0 8px;">${escapeHTML(friend.bio)}</p>` : "")}
            <div class="friend-popup-meta">${isBiz ? "🏢 Sede / Localização" : "🟢 " + seenLine}${distText}</div>
            <div class="friend-bump-actions">
                ${!isBiz
                    ? `<button type="button" class="btn-bump" onclick="window.sendBump('${friend.id}', '👊', 'Bump!')">👊 Fazer Bump!</button>
                       <button type="button" class="btn-wave" onclick="window.openFriendChat('${friend.id}')">💬 Chat / Bombs</button>`
                    : `<button type="button" class="btn-wave" onclick="window.toggleFollowFromList('${friend.id}', '${escapeHTML(friend.full_name)}')">✓ A seguir</button>
                       <a href="${directions}" target="_blank" rel="noopener" class="btn-wave" style="text-decoration:none;">🧭 Direções</a>`
                }
            </div>
            ${!isBiz ? `<a href="${directions}" target="_blank" rel="noopener" class="popup-dir-btn" style="width:100%;">🧭 Ir ter com ${escapeHTML(friend.full_name.split(" ")[0])}</a>` : ""}
        </div>`;
}

function showFriendsOnMap(friends) {
    friendMarkers.forEach(m => m.remove());
    friendMarkers = [];
    friendMarkerById.clear();

    const visibleFriends = friends.filter(f =>
        !f.ghost_mode &&
        f.privacy_mode !== "ghost" &&
        typeof f.last_lat === "number" &&
        typeof f.last_lng === "number"
    );

    const hangoutIds = new Set();
    const hangoutNames = [];
    const personalVisible = visibleFriends.filter(f => f.role === "user");
    for (let i = 0; i < personalVisible.length; i++) {
        for (let j = i + 1; j < personalVisible.length; j++) {
            const d = distanceKm(
                personalVisible[i].last_lat,
                personalVisible[i].last_lng,
                personalVisible[j].last_lat,
                personalVisible[j].last_lng
            );
            if (d <= 0.15) {
                hangoutIds.add(personalVisible[i].id);
                hangoutIds.add(personalVisible[j].id);
                hangoutNames.push(`${personalVisible[i].full_name.split(" ")[0]} & ${personalVisible[j].full_name.split(" ")[0]}`);
            }
        }
    }

    if (typeof window.updateHangoutBanner === "function") {
        window.updateHangoutBanner(hangoutNames, personalVisible.find(f => hangoutIds.has(f.id)));
    }

    visibleFriends.forEach(f => {
        const isBiz = f.role === "business";
        const el = document.createElement("div");
        el.className = "friend-map-pin";
        const avatarContent = f.avatar_url
            ? `<img src="${escapeHTML(f.avatar_url)}" alt="" onerror="this.remove()">`
            : escapeHTML(getInitials(f.full_name));

        const isRecent = !isBiz && f.last_seen && (Date.now() - new Date(f.last_seen).getTime()) < 30 * 60000;
        const labelName = isBiz ? f.full_name : f.full_name.trim().split(/\s+/)[0];
        const isHangout = !isBiz && hangoutIds.has(f.id);
        const isBlurred = !isBiz && f.privacy_mode === "blurred";
        const verifiedHtml = isBiz && f.is_verified ? `<span class="verified-check">✓</span>` : "";

        const bubbleText = isBiz
            ? `🏛️ ${escapeHTML(f.business_type || "Entidade")}`
            : (isHangout
                ? `🔥 Hangout! ${f.status_emoji || ""}`
                : (f.current_place ? `📍 ${escapeHTML(f.current_place)}` : `${f.status_emoji || "📍"} ${escapeHTML(f.status_text || "Online")}`));

        const batPill = !isBiz && typeof f.battery_level === "number"
            ? `<span class="friend-battery-pill${f.battery_level <= 20 && !f.is_charging ? " low" : ""}">${f.is_charging ? "⚡" : ""}${f.battery_level}%</span>`
            : "";

        el.innerHTML = `
            <div class="friend-status-bubble${isBiz ? " business-bubble" : ""}">${bubbleText}</div>
            <div class="friend-avatar-pin${isBiz ? " business-pin" : ""}${isHangout ? " hangout-glow" : ""}${isBlurred ? " blurred-pin" : ""}">
                ${avatarContent}
                ${batPill}
                ${isRecent ? '<span class="friend-online-dot"></span>' : ""}
            </div>
            <div class="friend-name-tag">${escapeHTML(labelName)}${verifiedHtml}${!isBiz && f.speed_kmh > 15 ? " 🚗" : ""}</div>
        `;

        const popup = new maplibregl.Popup({
            offset: [0, -44],
            closeButton: false,
            focusAfterOpen: false,
            maxWidth: '290px'
        }).setHTML(friendPopupHTML(f));

        el.addEventListener("click", () => {
            if (userPosition) {
                drawFriendRadarLine([userPosition.lng, userPosition.lat], [f.last_lng, f.last_lat]);
            }
        });

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([f.last_lng, f.last_lat])
            .setPopup(popup)
            .addTo(map);

        friendMarkers.push(marker);
        friendMarkerById.set(String(f.id), marker);
    });
}

function focusFriendOnMap(friendId) {
    const marker = friendMarkerById.get(String(friendId));
    if (!marker) return false;

    const targetLngLat = marker.getLngLat();
    if (userPosition) {
        drawFriendRadarLine([userPosition.lng, userPosition.lat], [targetLngLat.lng, targetLngLat.lat]);
    }

    map.flyTo({
        center: targetLngLat,
        zoom: Math.max(map.getZoom(), 16),
        pitch: 65,
        speed: 1.2
    });

    map.once("moveend", () => {
        if (!marker.getPopup().isOpen()) marker.togglePopup();
    });
    return true;
}

function highlightMarkerOnMap(id) {
    markerById.forEach((marker, key) => {
        const pin = marker.getElement().querySelector('.pin');
        if (pin) pin.classList.toggle('selected', key === String(id));
    });
}

function fitToEvents(list) {
    const points = list.filter(e => typeof e.latitude === "number").map(e => [e.longitude, e.latitude]);
    if (!points.length) return;
    
    if (points.length === 1) {
        map.flyTo({ center: points[0], zoom: 14.5, pitch: 65, bearing: -12 });
    } else {
        const bounds = new maplibregl.LngLatBounds(points[0], points[0]);
        points.forEach(p => bounds.extend(p));
        map.fitBounds(bounds, { padding: 60, maxZoom: 14.5, pitch: 65 });
    }
}

function focusEvent(id) {
    const marker = markerById.get(String(id));
    if (!marker) return;
    clearFriendRadarLine();
    highlightMarkerOnMap(id);
    
    map.flyTo({
        center: marker.getLngLat(),
        zoom: Math.max(map.getZoom(), 16),
        pitch: 70,
        bearing: 20,
        speed: 1.2
    });
    
    map.once("moveend", () => {
        if (!marker.getPopup().isOpen()) marker.togglePopup();
    });
}

function flyToCoordinates(lng, lat, zoom = 15) {
    map.flyTo({ center: [lng, lat], zoom, pitch: 60 });
}

// ---------- Localização do utilizador ----------
let userPosition = null;
let userMarker = null;

function locateUser() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("O teu navegador não suporta localização."));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => {
                userPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                const speedKmh = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
                if (typeof window.syncMyLiveLocation === "function") {
                    window.syncMyLiveLocation(userPosition.lat, userPosition.lng, speedKmh);
                }

                if (userMarker) userMarker.remove();
                
                const userEl = document.createElement('div');
                userEl.style.width = '18px';
                userEl.style.height = '18px';
                userEl.style.background = '#3b82f6';
                userEl.style.border = '3px solid #fff';
                userEl.style.borderRadius = '50%';
                userEl.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';

                userMarker = new maplibregl.Marker({ element: userEl })
                    .setLngLat([userPosition.lng, userPosition.lat])
                    .setPopup(new maplibregl.Popup({ offset: 10, focusAfterOpen: false }).setText("📍 Estás aqui"))
                    .addTo(map);

                map.flyTo({ center: [userPosition.lng, userPosition.lat], zoom: 15, pitch: 65 });
                resolve(userPosition);
            },
            () => reject(new Error("Não foi possível obter a tua localização. Verifica as permissões.")),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
}

// ---------- Escolha de local ----------
let pickHandler = null;
let tempMarker = null;

function pickLocation(callback) {
    pickHandler = callback;
    map.getContainer().classList.add("picking");
}

function cancelPick() {
    pickHandler = null;
    map.getContainer().classList.remove("picking");
}

function setTempMarker(latlng) {
    clearTempMarker();
    const el = createCustomMarkerElement("comunidade");
    tempMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([latlng.lng, latlng.lat])
        .setPopup(new maplibregl.Popup({ offset: [0, -38], focusAfterOpen: false }).setText("📍 Local do novo evento"))
        .addTo(map);
    tempMarker.togglePopup();
}

function clearTempMarker() {
    if (tempMarker) {
        tempMarker.remove();
        tempMarker = null;
    }
}

map.on("click", e => {
    if (!pickHandler) return;
    const handler = pickHandler;
    cancelPick();
    handler({ lat: e.lngLat.lat, lng: e.lngLat.lng });
});
