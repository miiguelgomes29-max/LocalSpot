// Corrigir o problema das imagens dos pinos invisíveis do Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

// Inicializar o mapa centrado em Portugal
const map = L.map("map").setView([39.3999, -8.2245], 6);

// Adicionar a camada do OpenStreetMap
L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
    }
).addTo(map);

// Grupo para gerir os marcadores dos eventos
const markers = L.layerGroup().addTo(map);

// Função para desenhar os marcadores no mapa
function showEventsOnMap(eventList) {
    markers.clearLayers();

    eventList.forEach(event => {
        if (event.latitude && event.longitude) {
            const marker = L.marker([event.latitude, event.longitude]);
            marker.addTo(markers);

            marker.bindPopup(`
                <h3>${event.name}</h3>
                <p>${event.description}</p>
                <p>📅 ${event.date} - 🕐 ${event.time}</p>
                <p>📍 ${event.location}</p>
            `);
        }
    });
}

// Obter localização do utilizador e detetar o distrito via API Nominatim
function showUserLocation() {
    if (!navigator.geolocation) {
        alert("O teu navegador não suporta localização.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async function(position) {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            map.setView([latitude, longitude], 12);
            L.marker([latitude, longitude])
                .addTo(map)
                .bindPopup("📍 Estás aqui")
                .openPopup();

            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                const data = await response.json();
                
                const cityOrDistrict = data.address.state || data.address.city || data.address.county;
                
                if (cityOrDistrict) {
                    const userDistrict = cityOrDistrict.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    const districtSelect = document.getElementById("districtFilter");
                    
                    let optionExists = Array.from(districtSelect.options).some(opt => opt.value === userDistrict);
                    
                    if (optionExists) {
                        districtSelect.value = userDistrict;
                        if (typeof filterEvents === 'function') filterEvents(); 
                    }
                }
            } catch (error) {
                console.log("Não foi possível detetar o distrito automaticamente.", error);
            }
        },
        function() {
            alert("Não foi possível obter a tua localização.");
        }
    );
}

// Lógica de seleção de coordenadas no mapa para criação de novos eventos
let selectedLat = null;
let selectedLng = null;
let tempMarker = null;

map.on('click', function(e) {
    selectedLat = e.latlng.lat;
    selectedLng = e.latlng.lng;

    if (tempMarker) {
        map.removeLayer(tempMarker);
    }

    tempMarker = L.marker([selectedLat, selectedLng]).addTo(map)
        .bindPopup("📍 Localização para o novo evento")
        .openPopup();

    const coordsText = document.getElementById("selectedCoordinates");
    if (coordsText) {
        coordsText.textContent = `📍 Localização guardada!`;
        coordsText.style.color = "#2563eb";
        coordsText.style.fontWeight = "bold";
    }
});

if (typeof events !== 'undefined') {
    showEventsOnMap(events);
}