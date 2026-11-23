// ==========================================
// DADOS BASE, DISTRITOS, CATEGORIAS E UTILITÁRIOS GEOGRÁFICOS
// ==========================================

let events = [];

const DEFAULT_IMAGE = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="800" height="400" fill="url(#g)"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="28" font-weight="bold">📍 LocalSpot Evento</text>
</svg>
`);

const DISTRICTS = {
    aveiro: "Aveiro",
    beja: "Beja",
    braga: "Braga",
    braganca: "Bragança",
    castelo_branco: "Castelo Branco",
    coimbra: "Coimbra",
    evora: "Évora",
    faro: "Faro",
    guarda: "Guarda",
    leiria: "Leiria",
    lisboa: "Lisboa",
    portalegre: "Portalegre",
    porto: "Porto",
    santarem: "Santarém",
    setubal: "Setúbal",
    viana_do_castelo: "Viana do Castelo",
    vila_real: "Vila Real",
    viseu: "Viseu",
    acores: "Açores",
    madeira: "Madeira"
};

const CATEGORIES = {
    desporto: { label: "Desporto", emoji: "⚽", color: "#10b981" },
    musica: { label: "Música", emoji: "🎵", color: "#8b5cf6" },
    cultura: { label: "Cultura", emoji: "🎭", color: "#f59e0b" },
    gaming: { label: "Gaming", emoji: "🎮", color: "#3b82f6" },
    gastronomia: { label: "Gastronomia", emoji: "🍽️", color: "#ef4444" },
    comunidade: { label: "Comunidade", emoji: "🤝", color: "#ec4899" }
};

function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function districtLabel(key) {
    return DISTRICTS[key] || key || "Portugal";
}

function eventDateTime(ev) {
    const datePart = ev.date || "2026-01-01";
    const timePart = ev.time || "18:00";
    return new Date(`${datePart}T${timePart}:00`);
}

function formatEventDate(ev) {
    if (!ev.date) return "Data a anunciar";
    const dt = eventDateTime(ev);
    if (isNaN(dt.getTime())) return `${ev.date} ${ev.time || ""}`.trim();
    const dateStr = dt.toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
    return `${dateStr} às ${ev.time || "18:00"}`;
}

// Cálculo de distância em quilómetros (Fórmula de Haversine)
function distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = deg => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
