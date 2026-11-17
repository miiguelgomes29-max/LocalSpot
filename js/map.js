// ==========================================
// MAPA (MapLibre GL JS - Satélite 3D & Mapa Noturno 3D + Relevo + Edifícios)
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

map.on('load', () => {
    map.resize();
    if (typeof currentList !== 'undefined' && currentList.length > 0) {
        showEventsOnMap(currentList);
    }
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
    
    const enrolled = ev.enrolled || 0;
    const max = ev.maxParticipants;
    const vagasText = max ? `${enrolled}/${max} vagas` : `${enrolled} inscritos`;
    const icon = ev.creatorType === "Utilizador" ? "👤" : "🏢";
    const organizerHtml = ev.creatorName
        ? `<p style="color:#2563eb;font-weight:600;">${icon} ${escapeHTML(ev.creatorName)}</p>`
        : "";

    return `
        <div class="popup">
            <span class="popup-cat">${cat ? cat.emoji + " " + cat.label : escapeHTML(ev.category)}</span>
            <h3>${escapeHTML(ev.name)}</h3>
            ${organizerHtml}
            <p>📅 ${escapeHTML(formatEventDate(ev))}</p>
            <p>📍 ${escapeHTML(ev.location)}</p>
            <p>👥 <strong>${vagasText}</strong> · 🎟️ ${escapeHTML(ev.price || "Gratuito")}</p>
            <div class="popup-links">
                <button type="button" onclick="window.openEventDetails('${ev.id}')">Ver detalhes</button>
                <a href="${directions}" target="_blank" rel="noopener">Como chegar →</a>
            </div>
        </div>`;
}

function showEventsOnMap(list) {
    markers.forEach(m => m.remove());
    markers = [];
    markerById.clear();

    list.forEach(ev => {
        if (typeof ev.latitude !== "number" || typeof ev.longitude !== "number") return;
        
        const el = createCustomMarkerElement(ev.category);
        const popup = new maplibregl.Popup({ offset: [0, -38], closeButton: false }).setHTML(popupHTML(ev));
        
        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([ev.longitude, ev.latitude])
            .setPopup(popup)
            .addTo(map);

        el.addEventListener('click', () => {
            if (typeof window.onEventMarkerClick === "function") {
                window.onEventMarkerClick(ev.id);
            }
        });

        markers.push(marker);
        markerById.set(String(ev.id), marker);
    });
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
                    .setPopup(new maplibregl.Popup({ offset: 10 }).setText("📍 Estás aqui"))
                    .addTo(map);

                map.flyTo({ center: [userPosition.lng, userPosition.lat], zoom: 15, pitch: 65 });
                resolve(userPosition);
            },
            () => reject(new Error("Não foi possível obter a tua localização. Verifica as permissões.")),
            { enableHighAccuracy: false, timeout: 10000 }
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
        .setPopup(new maplibregl.Popup({ offset: [0, -38] }).setText("📍 Local do novo evento"))
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
