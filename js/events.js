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

// Array global que vai guardar os eventos vindos da BD
let events = [];

// ---------- Utilitários ----------
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
}

function normalizeText(value) {
    return String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

// ---------- Funções de Base de Dados (Supabase) ----------

async function dbLoadEvents() {
    const { data, error } = await supabase
        .from('events')
        .select(`
            *,
            profiles:created_by (username, avatar_url)
        `)
        .order('date', { ascending: true });

    if (error) {
        console.error("Erro ao carregar eventos:", error);
        return [];
    }
    
    // Adaptar os nomes dos campos da BD para os nomes que o teu frontend usa
    return data.map(e => ({
        ...e,
        location: e.location_name, // O frontend usa 'location', a BD usa 'location_name'
        image: e.image_url,        // O frontend usa 'image', a BD usa 'image_url'
        custom: true               // Assumimos que todos vêm da BD para efeitos de delete
    }));
}

async function dbCreateEvent(eventData, imageFile) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Precisas de iniciar sessão para criar eventos.");

    let image_url = null;

    if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('event-images')
            .upload(fileName, imageFile);

        if (uploadError) throw new Error("Erro ao carregar imagem: " + uploadError.message);

        const { data: urlData } = supabase.storage
            .from('event-images')
            .getPublicUrl(fileName);

        image_url = urlData.publicUrl;
    }

    const { data, error } = await supabase
        .from('events')
        .insert({
            created_by: user.id,
            name: eventData.name,
            description: eventData.description,
            category: eventData.category,
            date: eventData.date,
            time: eventData.time,
            location_name: eventData.location,
            district: eventData.distrito,
            latitude: eventData.latitude,
            longitude: eventData.longitude,
            image_url: image_url
        })
        .select()
        .single();

    if (error) throw new Error("Erro ao criar evento: " + error.message);
    return data;
}

async function dbDeleteEvent(eventId) {
    const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);
    if (error) throw error;
}

async function dbLoadFavorites() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Set();

    const { data, error } = await supabase
        .from('favorites')
        .select('event_id')
        .eq('user_id', user.id);

    if (error) return new Set();
    return new Set(data.map(f => f.event_id));
}

async function dbToggleFavorite(eventId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Precisas de iniciar sessão.");

    const { data: existing } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('event_id', eventId)
        .maybeSingle();

    if (existing) {
        await supabase.from('favorites').delete().eq('id', existing.id);
        return false;
    } else {
        await supabase.from('favorites').insert({ user_id: user.id, event_id: eventId });
        return true;
    }
}

async function dbGetEventDetails(eventId) {
    // Buscar likes
    const { count: likeCount } = await supabase
        .from('event_likes')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId);

    // Verificar se o user atual deu like
    let hasLiked = false;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { data: likeData } = await supabase
            .from('event_likes')
            .select('id')
            .eq('user_id', user.id)
            .eq('event_id', eventId)
            .maybeSingle();
        hasLiked = !!likeData;
    }

    // Buscar comentários
    const { data: comments } = await supabase
        .from('event_comments')
        .select(`*, profiles:user_id (username)`)
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

    return { likeCount: likeCount || 0, hasLiked, comments: comments || [] };
}

async function dbToggleLike(eventId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Precisas de iniciar sessão.");

    const { data: existing } = await supabase
        .from('event_likes')
        .select('id')
        .eq('user_id', user.id)
        .eq('event_id', eventId)
        .maybeSingle();

    if (existing) {
        await supabase.from('event_likes').delete().eq('id', existing.id);
    } else {
        await supabase.from('event_likes').insert({ user_id: user.id, event_id: eventId });
    }
}

async function dbAddComment(eventId, content) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Precisas de iniciar sessão.");

    const { error } = await supabase
        .from('event_comments')
        .insert({ user_id: user.id, event_id: eventId, content });
    if (error) throw error;
}

async function dbCheckIn(eventId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Precisas de iniciar sessão.");

    const { error } = await supabase
        .from('event_checkins')
        .insert({ user_id: user.id, event_id: eventId });
    
    if (error && error.code !== '23505') { // Ignorar se já fez check-in
        throw error;
    }
}
