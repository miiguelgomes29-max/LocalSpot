// ==========================================
// LOCALSPOT — DADOS BASE E FUNÇÕES AUXILIARES
// ==========================================

window.DEFAULT_IMAGE = "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=900&q=80";

window.DISTRITOS = [
    "Aveiro", "Beja", "Braga", "Bragança", "Castelo Branco", "Coimbra",
    "Évora", "Faro", "Guarda", "Leiria", "Lisboa", "Portalegre",
    "Porto", "Santarém", "Setúbal", "Viana do Castelo", "Vila Real",
    "Viseu", "Açores", "Madeira"
];

window.events = [
    {
        id: "demo-1",
        creatorId: null,
        creatorName: "Município de Cantanhede",
        creatorType: "Câmara Municipal / Junta",
        creatorRole: "business",
        creatorVerified: true,
        name: "Noite Acústica no Parque Verde",
        category: "Música",
        distrito: "Coimbra",
        date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        time: "21:30",
        location: "Parque Verde de São Mateus, Cantanhede",
        latitude: 40.3468,
        longitude: -8.5941,
        maxParticipants: 250,
        enrolled: 84,
        price: "Gratuito",
        externalUrl: "",
        description: "Concertos acústicos ao ar livre com artistas locais, zona lounge e street food.",
        image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80"
    },
    {
        id: "demo-2",
        creatorId: null,
        creatorName: "Clube Corrida Centro",
        creatorType: "Desporto / Ginásio",
        creatorRole: "business",
        creatorVerified: true,
        name: "Night Run & Social Bump 5K",
        category: "Desporto",
        distrito: "Coimbra",
        date: new Date().toISOString().slice(0, 10),
        time: "19:30",
        location: "Praça Marquês de Marialva, Cantanhede",
        latitude: 40.3452,
        longitude: -8.5930,
        maxParticipants: 100,
        enrolled: 47,
        price: "Gratuito",
        externalUrl: "",
        description: "Corrida e caminhada noturna aberta a todos os níveis. Encontro final com bebidas e música.",
        image: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=900&q=80"
    }
];

window.escapeHTML = function (str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
};

window.getCategoryEmoji = function (category) {
    const map = {
        "Música": "🎵",
        "Desporto": "⚽",
        "Cultura": "🎭",
        "Gastronomia": "🍽️",
        "Festa": "🎉",
        "Tecnologia": "💻"
    };
    return map[category] || "📍";
};

window.formatEventDate = function (ev) {
    if (!ev || !ev.date) return "";
    try {
        const parts = String(ev.date).split("-");
        if (parts.length !== 3) return ev.date;
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString("pt-PT", {
            weekday: "short",
            day: "2-digit",
            month: "short"
        });
    } catch (e) {
        return ev.date;
    }
};

window.isEventFree = function (ev) {
    if (!ev || !ev.price) return true;
    const p = String(ev.price).trim().toLowerCase();
    return p === "" || p === "0" || p === "0€" || p.includes("gratuito") || p.includes("livre");
};

window.isEventPast = function (ev) {
    if (!ev || !ev.date) return false;
    const dt = new Date(`${ev.date}T${ev.time || "23:59"}`);
    return !isNaN(dt.getTime()) && dt.getTime() < Date.now();
};

window.isEventToday = function (ev) {
    if (!ev || !ev.date) return false;
    const today = new Date().toISOString().slice(0, 10);
    return ev.date === today;
};

window.isEventThisWeek = function (ev) {
    if (!ev || !ev.date) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dt = new Date(`${ev.date}T00:00:00`);
    const diffDays = (dt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 7;
};

window.distanceKm = function (lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
