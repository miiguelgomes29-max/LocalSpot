// ==========================================
// DADOS E UTILITÁRIOS
// ==========================================

const DEFAULT_IMAGE = "assets/images/default-event.jpg";

const CATEGORIES = {
    desporto:   { label: "Desporto",   emoji: "⚽", color: "#16a34a" },
    musica:     { label: "Música",     emoji: "🎵", color: "#9333ea" },
    cultura:    { label: "Cultura",    emoji: "🎨", color: "#ea580c" },
    gaming:     { label: "Gaming",     emoji: "🎮", color: "#2563eb" },
    comunidade: { label: "Comunidade", emoji: "🤝", color: "#db2777" }
};

// Capitais de distrito (usadas para detetar o distrito mais próximo)
const DISTRICTS = [
    { value: "aveiro", label: "Aveiro", lat: 40.6405, lng: -8.6538 },
    { value: "beja", label: "Beja", lat: 38.0151, lng: -7.8632 },
    { value: "braga", label: "Braga", lat: 41.5454, lng: -8.4265 },
    { value: "braganca", label: "Bragança", lat: 41.8061, lng: -6.7567 },
    { value: "castelo branco", label: "Castelo Branco", lat: 39.8222, lng: -7.4909 },
    { value: "coimbra", label: "Coimbra", lat: 40.2033, lng: -8.4103 },
    { value: "evora", label: "Évora", lat: 38.5714, lng: -7.9135 },
    { value: "faro", label: "Faro", lat: 37.0194, lng: -7.9304 },
    { value: "guarda", label: "Guarda", lat: 40.5373, lng: -7.2677 },
    { value: "leiria", label: "Leiria", lat: 39.7437, lng: -8.8071 },
    { value: "lisboa", label: "Lisboa", lat: 38.7223, lng: -9.1393 },
    { value: "portalegre", label: "Portalegre", lat: 39.2967, lng: -7.4286 },
    { value: "porto", label: "Porto", lat: 41.1579, lng: -8.6291 },
    { value: "santarem", label: "Santarém", lat: 39.2369, lng: -8.6850 },
    { value: "setubal", label: "Setúbal", lat: 38.5244, lng: -8.8882 },
    { value: "viana do castelo", label: "Viana do Castelo", lat: 41.6918, lng: -8.8344 },
    { value: "vila real", label: "Vila Real", lat: 41.3006, lng: -7.7441 },
    { value: "viseu", label: "Viseu", lat: 40.6566, lng: -7.9139 },
    { value: "acores", label: "Açores (Região Autónoma)", lat: 37.7412, lng: -25.6756 },
    { value: "madeira", label: "Madeira (Região Autónoma)", lat: 32.6669, lng: -16.9241 }
];

const events = [
    {
        id: 1,
        name: "Basketball 3v3",
        description: "Torneio de basketball 3x3 aberto a equipas da zona.",
        category: "desporto",
        date: "2026-11-14",
        time: "15:00",
        location: "Parque da Cidade",
        distrito: "porto",
        latitude: 41.1699,
        longitude: -8.6790,
        image: "assets/eventos/basketball.jpg"
    },
    {
        id: 2,
        name: "Concerto ao Vivo",
        description: "Música ao vivo no Estádio da Luz.",
        category: "musica",
        date: "2026-11-20",
        time: "21:00",
        location: "Estádio da Luz",
        distrito: "lisboa",
        latitude: 38.7526,
        longitude: -9.1847,
        image: "assets/eventos/concerto.jpg"
    },
    {
        id: 3,
        name: "Workshop de Fotografia",
        description: "Workshop de fotografia urbana na Baixa.",
        category: "cultura",
        date: "2026-11-22",
        time: "14:30",
        location: "Baixa de Coimbra",
        distrito: "coimbra",
        latitude: 40.2081,
        longitude: -8.4265,
        image: "assets/eventos/fotografia.jpg"
    },
    {
        id: 4,
        name: "Torneio de Gaming",
        description: "Competição de jogos com prémios.",
        category: "gaming",
        date: "2026-12-05",
        time: "16:00",
        location: "Espaço Gaming Aveiro",
        distrito: "aveiro",
        latitude: 40.6405,
        longitude: -8.6538,
        image: "assets/eventos/gaming.jpg"
    },
    {
        id: 5,
        name: "Corrida Solidária",
        description: "Corrida e caminhada solidária aberta a todas as idades. Inscrição gratuita.",
        category: "comunidade",
        date: "2026-11-29",
        time: "09:30",
        location: "Parque da Ponte",
        distrito: "braga",
        latitude: 41.5503,
        longitude: -8.4200,
        image: DEFAULT_IMAGE
    },
    {
        id: 6,
        name: "Feira de Artesanato",
        description: "Artesãos locais, gastronomia e música ao ar livre.",
        category: "cultura",
        date: "2026-12-06",
        time: "10:00",
        location: "Jardim Manuel Bivar",
        distrito: "faro",
        latitude: 37.0160,
        longitude: -7.9350,
        image: DEFAULT_IMAGE
    }
];

// ---------- Utilitários ----------

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
}

// Minúsculas e sem acentos, para pesquisas tolerantes
function normalizeText(value) {
    return String(value ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function eventDateTime(ev) {
    return new Date(`${ev.date}T${ev.time || "00:00"}`);
}

function formatEventDate(ev) {
    const d = eventDateTime(ev);
    if (isNaN(d)) return ev.date;
    const text = d.toLocaleDateString("pt-PT", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    return `${text} · ${ev.time}`;
}

function districtLabel(value) {
    const d = DISTRICTS.find(x => x.value === value);
    return d ? d.label.replace(" (Região Autónoma)", "") : value;
}

// Distância em km (fórmula de Haversine)
function distanceKm(lat1, lng1, lat2, lng2) {
    const rad = x => x * Math.PI / 180;
    const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
        Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestDistrict(lat, lng) {
    let best = DISTRICTS[0], bestDist = Infinity;
    DISTRICTS.forEach(d => {
        const dist = distanceKm(lat, lng, d.lat, d.lng);
        if (dist < bestDist) { best = d; bestDist = dist; }
    });
    return best.value;
}
