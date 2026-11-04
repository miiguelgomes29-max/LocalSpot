// ==========================================
// MAPA (Leaflet)
// ==========================================

// Pinos personalizados por categoria (não dependem das imagens do Leaflet)
function categoryIcon(category) {
    const c = CATEGORIES[category] || CATEGORIES.comunidade;
    return L.divIcon({
        className: "pin-wrapper",
        html: `<div class="pin" style="--pin:${c.color}"><span>${c.emoji}</span></div>`,
        iconSize: [36, 44],
        iconAnchor: [18, 42],
        popupAnchor: [0, -38]
    });
}

const map = L.map("map").setView([39.6, -8.0], 6);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; contribuidores do OpenStreetMap"
}).addTo(map);

const markers = L.layerGroup().addTo(map);
const markerById = new Map();
let onEventMarkerClick = null;

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
    markers.clearLayers();
    markerById.clear();

    list.forEach(ev => {
        if (typeof ev.latitude !== "number" || typeof ev.longitude !== "number") return;
        const marker = L.marker([ev.latitude, ev.longitude], {
            icon: categoryIcon(ev.category),
            title: ev.name,
            keyboard: true
        });
        marker.bindPopup(popupHTML(ev));
        marker.on("click", () => { if (onEventMarkerClick) onEventMarkerClick(ev.id); });
        marker.addTo(markers);
        markerById.set(ev.id, marker);
    });
}

function fitToEvents(list) {
    const points = list.filter(e => typeof e.latitude === "number").map(e => [e.latitude, e.longitude]);
    if (!points.length) return;
    if (points.length === 1) {
        map.flyTo(points[0], 13);
    } else {
        map.flyToBounds(points, { padding: [50, 50], maxZoom: 13 });
    }
}

function focusEvent(id) {
    const marker = markerById.get(id);
    if (!marker) return;
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 14), { duration: 0.8 });
    map.once("moveend", () => marker.openPopup());
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
                if (userMarker) map.removeLayer(userMarker);
                userMarker = L.circleMarker([userPosition.lat, userPosition.lng], {
                    radius: 9, color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1
                }).addTo(map).bindPopup("📍 Estás aqui");
                map.flyTo([userPosition.lat, userPosition.lng], 11);
                resolve(userPosition);
            },
            () => reject(new Error("Não foi possível obter a tua localização. Verifica as permissões do navegador.")),
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
    tempMarker = L.marker(latlng, { icon: categoryIcon("comunidade"), zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup("📍 Local do novo evento");
}

function clearTempMarker() {
    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }
}

map.on("click", e => {
    if (!pickHandler) return;
    const handler = pickHandler;
    cancelPick();
    handler(e.latlng);
});
