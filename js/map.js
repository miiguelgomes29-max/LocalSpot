// ==========================================
// MAPA (MapLibre GL JS - Estilo Vetorial 3D Fluído)
// ==========================================

window.onEventMarkerClick = null;

// Inicializa o mapa com estilo vetorial rápido e 100% interativo
const map = new maplibregl.Map({
    container: 'map',
    style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    center: [-8.0, 39.6],
    zoom: 6,
    pitch: 50,
    bearing: -15,
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
    return `
        <div class="popup">
            <span class="popup-cat">${cat ? cat.emoji + " " + cat.label : escapeHTML(ev.category)}</span>
            <h3>${escapeHTML(ev.name)}</h3>
            ${ev.description ? `<p>${escapeHTML(ev.description)}</p>` : ""}
            <p>📅 ${escapeHTML(formatEventDate(ev))}</p>
            <p>📍 ${escapeHTML(ev.location)}</p>
            <a href="${directions}" target="_blank" rel="noopener">Como chegar →</a>
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
        markerById.set(ev.id, marker);
    });
}

function fitToEvents(list) {
    const points = list.filter(e => typeof e.latitude === "number").map(e => [e.longitude, e.latitude]);
    if (!points.length) return;
    
    if (points.length === 1) {
        map.flyTo({ center: points[0], zoom: 13, pitch: 60 });
    } else {
        const bounds = new maplibregl.LngLatBounds(points[0], points[0]);
        points.forEach(p => bounds.extend(p));
        map.fitBounds(bounds, { padding: 50, maxZoom: 13, pitch: 60 });
    }
}

function focusEvent(id) {
    const marker = markerById.get(id);
    if (!marker) return;
    
    map.flyTo({
        center: marker.getLngLat(),
        zoom: Math.max(map.getZoom(), 15),
        pitch: 65,
        bearing: 20,
        speed: 1.2
    });
    
    map.once("moveend", () => {
        if (!marker.getPopup().isOpen()) marker.togglePopup();
    });
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
                userEl.style.background = '#2563eb';
                userEl.style.border = '3px solid #fff';
                userEl.style.borderRadius = '50%';
                userEl.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';

                userMarker = new maplibregl.Marker({ element: userEl })
                    .setLngLat([userPosition.lng, userPosition.lat])
                    .setPopup(new maplibregl.Popup({ offset: 10 }).setText("📍 Estás aqui"))
                    .addTo(map);

                map.flyTo({ center: [userPosition.lng, userPosition.lat], zoom: 12, pitch: 60 });
                resolve(userPosition);
            },
            () => reject(new Error("Não foi possível obter a tua localização. Verifica as permissões.")),
            { enableHighAccuracy: false, timeout: 10000 }
        );
    });
}

// ---------- Escolha de local para novo evento ----------
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
