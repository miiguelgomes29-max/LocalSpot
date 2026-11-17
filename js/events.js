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

const INITIAL_EVENTS = [
    {
        name: "Torneio Comunitário de Basquetebol 3v3",
        description: "Torneio aberto a equipas locais com música ao vivo e convívio no parque.",
        category: "desporto",
        date: "2026-12-12",
        time: "15:00",
        location: "Parque Verde da Cidade",
        distrito: "coimbra",
        latitude: 40.3465,
        longitude: -8.5944,
        image: DEFAULT_IMAGE,
        max_participants: 24,
        enrolled: 8,
        price: "Gratuito",
        creator_name: "LocalSpot Comunidade",
        creator_type: "Associação"
    }
];

const events = [];

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
}

function sanitizeUrl(url) {
    if (!url) return "";
    const trimmed = String(url).trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed)) return "https://" + trimmed;
    return "";
}

function normalizeText(value) {
    return String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isFreePrice(price) {
    const p = normalizeText(price || "gratuito").trim();
    return !p || p === "gratuito" || p === "gratis" || p === "0" || p === "0€" || p === "0 €";
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

function buildGoogleCalendarUrl(ev) {
    const start = eventDateTime(ev);
    if (isNaN(start)) return "https://calendar.google.com";
    const end = new Date(start.getTime() + 2 * 3600000);
    const fmt = d => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: ev.name,
        dates: `${fmt(start)}/${fmt(end)}`,
        details: ev.description || "Evento no LocalSpot",
        location: `${ev.location}, ${districtLabel(ev.distrito)}`
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function downloadEventICS(ev) {
    const start = eventDateTime(ev);
    if (isNaN(start)) return;
    const end = new Date(start.getTime() + 2 * 3600000);
    const fmt = d => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const ics = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//LocalSpot//PT",
        "BEGIN:VEVENT",
        `UID:localspot-${ev.id}@localspot.app`,
        `DTSTAMP:${fmt(new Date())}`,
        `DTSTART:${fmt(start)}`,
        `DTEND:${fmt(end)}`,
        `SUMMARY:${ev.name.replace(/\n/g, " ")}`,
        `DESCRIPTION:${(ev.description || "Evento no LocalSpot").replace(/\n/g, " ")}`,
        `LOCATION:${ev.location}, ${districtLabel(ev.distrito)}`,
        "END:VEVENT",
        "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ev.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
    a.click();
    URL.revokeObjectURL(url);
}
