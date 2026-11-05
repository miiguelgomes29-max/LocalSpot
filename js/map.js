window.onEventMarkerClick = null;

// Inicialização do mapa
const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        sources: {
            'esri-satellite': {
                type: 'raster',
                tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                tileSize: 256,
                attribution: 'Tiles &copy; Esri'
            }
        },
        layers: [{ id: 'esri-satellite', type: 'raster', source: 'esri-satellite', minzoom: 0, maxzoom: 19 }]
    },
    center: [-8.0, 39.6],
    zoom: 6,
    pitch: 50,
    bearing: -15,
    dragPan: true, 
    scrollZoom: true,
    touchZoomRotate: true
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }));

// Garantir que o mapa redimensiona corretamente ao carregar a página
setTimeout(() => map.resize(), 500);

let markers = [];
const markerById = new Map();

map.on('load', () => {
    map.resize();
    if (typeof currentList !== 'undefined' && currentList.length > 0) showEventsOnMap(currentList);
});

function createCustomMarkerElement(category) {
    const c = CATEGORIES[category] || CATEGORIES.comunidade;
    const el = document.createElement('div');
    el.className = 'pin-wrapper';
    el.innerHTML = `<div class="pin" style="--pin:${c.color}"><span>${c.emoji}</span></div>`;
    return el;
}

function showEventsOnMap(list) {
    markers.forEach(m => m.remove());
    markers = [];
    markerById.clear();

    list.forEach(ev => {
        if (typeof ev.latitude !== "number" || typeof ev.longitude !== "number") return;
        const el = createCustomMarkerElement(ev.category);
        const popup = new maplibregl.Popup({ offset: [0, -38], closeButton: false }).setHTML(`
            <div style="color:#000; padding: 4px;">
                <h3 style="margin:0 0 4px 0;">${escapeHTML(ev.name)}</h3>
                <p style="margin:0;">📍 ${escapeHTML(ev.location)}</p>
            </div>
        `);
        
        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([ev.longitude, ev.latitude])
            .setPopup(popup)
            .addTo(map);

        el.addEventListener('click', () => {
            if (typeof window.onEventMarkerClick === "function") window.onEventMarkerClick(ev.id);
        });

        markers.push(marker);
        markerById.set(ev.id, marker);
    });
}

function fitToEvents(list) {
    const points = list.filter(e => typeof e.latitude === "number").map(e => [e.longitude, e.latitude]);
    if (!points.length) return;
    if (points.length === 1) {
        map.flyTo({ center: points[0], zoom: 13 });
    } else {
        const bounds = new maplibregl.LngLatBounds(points[0], points[0]);
        points.forEach(p => bounds.extend(p));
        map.fitBounds(bounds, { padding: 50, maxZoom: 13 });
    }
}

function focusEvent(id) {
    const marker = markerById.get(id);
    if (!marker) return;
    map.flyTo({ center: marker.getLngLat(), zoom: Math.max(map.getZoom(), 14) });
    map.once("moveend", () => { if (!marker.getPopup().isOpen()) marker.togglePopup(); });
}

let userPosition = null;
function locateUser() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("Navegador sem suporte."));
        navigator.geolocation.getCurrentPosition(
            pos => {
                userPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                map.flyTo({ center: [userPosition.lng, userPosition.lat], zoom: 12 });
                resolve(userPosition);
            },
            () => reject(new Error("Não foi possível obter a localização."))
        );
    });
}

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
    tempMarker = new maplibregl.Marker({ element: createCustomMarkerElement("comunidade"), anchor: 'bottom' })
        .setLngLat([latlng.lng, latlng.lat]).addTo(map);
}

function clearTempMarker() {
    if (tempMarker) { tempMarker.remove(); tempMarker = null; }
}

map.on("click", e => {
    if (!pickHandler) return;
    const handler = pickHandler;
    cancelPick();
    handler({ lat: e.lngLat.lat, lng: e.lngLat.lng });
});
