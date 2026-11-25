// ==========================================
// LOCALSPOT — LIGAÇÃO À BASE DE DADOS SUPABASE
// ==========================================

const SUPABASE_URL = "https://ufzjexbihnwflqktpomm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ncEgfYkxtHk_pwp4g1P8dg_2aYRjF-j";

const isSupabaseConfigured =
    SUPABASE_URL.startsWith("https://") &&
    SUPABASE_ANON_KEY.length > 20 &&
    typeof window.supabase !== "undefined";

window.supabaseClient = isSupabaseConfigured
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

window.LocalSpotDB = {
    isReady() {
        return Boolean(window.supabaseClient);
    },

    // ==========================================
    // 1. UTILIZADORES (CRIAR / ENTRAR / ATUALIZAR)
    // ==========================================
    async upsertProfile(profileData) {
        if (!this.isReady() || !profileData?.email) return profileData;

        const payload = {
            full_name: profileData.full_name,
            email: profileData.email.toLowerCase().trim(),
            role: profileData.role || "user",
            business_type: profileData.business_type || "",
            bio: profileData.bio || "",
            avatar_emoji: profileData.avatar_emoji || "😎",
            status_emoji: profileData.status_emoji || "🎉",
            status_text: profileData.status_text || "Pronto pra sair",
            privacy_mode: profileData.privacy_mode || "precise",
            updated_at: new Date().toISOString()
        };

        const { data, error } = await window.supabaseClient
            .from("profiles")
            .upsert(payload, { onConflict: "email" })
            .select()
            .single();

        if (error) {
            console.error("Erro ao guardar perfil:", error.message);
            return profileData;
        }
        return data;
    },

    async getProfileByEmail(email) {
        if (!this.isReady() || !email) return null;
        const { data } = await window.supabaseClient
            .from("profiles")
            .select("*")
            .eq("email", email.toLowerCase().trim())
            .maybeSingle();
        return data || null;
    },

    async syncLiveLocation(userId, lat, lng, extra = {}) {
        if (!this.isReady() || !userId || String(userId).startsWith("local-")) return;
        await window.supabaseClient
            .from("profiles")
            .update({
                last_lat: lat,
                last_lng: lng,
                speed_kmh: extra.speed_kmh ?? 0,
                battery_level: extra.battery_level ?? null,
                is_charging: extra.is_charging ?? false,
                current_place: extra.current_place ?? "",
                updated_at: new Date().toISOString()
            })
            .eq("id", userId);
    },

    // ==========================================
    // 2. EVENTOS & PESSOAS INSCRITAS
    // ==========================================
    async fetchAllEventsWithAttendees() {
        if (!this.isReady()) return window.events || [];

        const [{ data: dbEvents, error }, { data: regs }] = await Promise.all([
            window.supabaseClient.from("events").select("*").order("date", { ascending: true }),
            window.supabaseClient.from("event_registrations").select("*")
        ]);

        if (error || !dbEvents) {
            console.error("Erro ao carregar eventos:", error?.message);
            return window.events || [];
        }

        const regsByEvent = new Map();
        (regs || []).forEach(r => {
            const list = regsByEvent.get(r.event_id) || [];
            list.push(r);
            regsByEvent.set(r.event_id, list);
        });

        const formatted = dbEvents.map(ev => {
            const attendees = regsByEvent.get(ev.id) || [];
            return {
                id: ev.id,
                creatorId: ev.creator_id,
                creatorName: ev.creator_name,
                creatorType: ev.creator_type,
                creatorRole: ev.creator_role,
                creatorVerified: ev.creator_verified,
                name: ev.name,
                category: ev.category,
                distrito: ev.distrito,
                date: ev.date,
                time: ev.time,
                location: ev.location,
                latitude: Number(ev.latitude),
                longitude: Number(ev.longitude),
                maxParticipants: ev.max_participants,
                enrolled: attendees.length,
                attendees,
                price: ev.price || "Gratuito",
                externalUrl: ev.external_url || "",
                description: ev.description || "",
                image: ev.image || window.DEFAULT_IMAGE
            };
        });

        if (formatted.length > 0) {
            window.events = formatted;
        }
        return window.events || [];
    },

    async createEvent(ev, currentUser) {
        if (!this.isReady()) return null;

        const payload = {
            creator_id: currentUser?.id && !String(currentUser.id).startsWith("user-") ? currentUser.id : null,
            creator_name: currentUser?.full_name || "Organizador LocalSpot",
            creator_type: currentUser?.business_type || "",
            creator_role: currentUser?.role || "user",
            creator_verified: currentUser?.role === "business",
            name: ev.name,
            category: ev.category,
            distrito: ev.distrito,
            date: ev.date,
            time: ev.time,
            location: ev.location,
            latitude: ev.latitude,
            longitude: ev.longitude,
            max_participants: ev.maxParticipants ? Number(ev.maxParticipants) : null,
            price: ev.price || "Gratuito",
            external_url: ev.externalUrl || "",
            description: ev.description || "",
            image: ev.image || window.DEFAULT_IMAGE
        };

        const { data, error } = await window.supabaseClient
            .from("events")
            .insert(payload)
            .select()
            .single();

        if (error) {
            console.error("Erro ao criar evento:", error.message);
            throw error;
        }
        return data;
    },

    async deleteEvent(eventId) {
        if (!this.isReady()) return;
        await window.supabaseClient.from("events").delete().eq("id", eventId);
    },

    async toggleRegistration(eventId, user) {
        if (!this.isReady() || !user?.id) return { enrolled: false };

        const { data: existing } = await window.supabaseClient
            .from("event_registrations")
            .select("id, ticket_code")
            .eq("event_id", eventId)
            .eq("user_id", user.id)
            .maybeSingle();

        if (existing) {
            await window.supabaseClient.from("event_registrations").delete().eq("id", existing.id);
            return { enrolled: false, ticketCode: null };
        }

        const ticketCode = `LS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const { error } = await window.supabaseClient.from("event_registrations").insert({
            event_id: eventId,
            user_id: user.id,
            user_name: user.full_name,
            user_avatar: user.avatar_emoji || "😎",
            ticket_code: ticketCode
        });

        if (error) {
            console.error("Erro na inscrição:", error.message);
            return { enrolled: false };
        }
        return { enrolled: true, ticketCode };
    },

    // ==========================================
    // 3. COMENTÁRIOS & AVALIAÇÕES
    // ==========================================
    async fetchCommentsAndReviews(eventId) {
        if (!this.isReady()) return { comments: [], reviews: [] };
        const [{ data: comments }, { data: reviews }] = await Promise.all([
            window.supabaseClient.from("event_comments").select("*").eq("event_id", eventId).order("created_at", { ascending: true }),
            window.supabaseClient.from("event_reviews").select("*").eq("event_id", eventId).order("created_at", { ascending: false })
        ]);
        return { comments: comments || [], reviews: reviews || [] };
    },

    async addComment(eventId, user, content) {
        if (!this.isReady() || !user?.id || !content.trim()) return;
        await window.supabaseClient.from("event_comments").insert({
            event_id: eventId,
            user_id: user.id,
            user_name: user.full_name,
            content: content.trim()
        });
    },

    // ==========================================
    // 4. TEMPO REAL (SINCRONIZAÇÃO AUTOMÁTICA)
    // ==========================================
    startRealtimeSync(onDataChanged) {
        if (!this.isReady()) return;

        window.supabaseClient
            .channel("localspot-global-sync")
            .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => {
                this.fetchAllEventsWithAttendees().then(() => onDataChanged?.("events"));
            })
            .on("postgres_changes", { event: "*", schema: "public", table: "event_registrations" }, () => {
                this.fetchAllEventsWithAttendees().then(() => onDataChanged?.("registrations"));
            })
            .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, async () => {
                const { data } = await window.supabaseClient.from("profiles").select("*");
                if (data && typeof window.showFriendsOnMap === "function") {
                    window.showFriendsOnMap(data);
                }
            })
            .subscribe();
    }
};

document.addEventListener("DOMContentLoaded", async () => {
    if (!window.LocalSpotDB.isReady()) return;

    if (window.currentLocalProfile) {
        const dbProfile = await window.LocalSpotDB.upsertProfile(window.currentLocalProfile);
        if (dbProfile?.id) {
            window.currentLocalProfile = { ...window.currentLocalProfile, ...dbProfile };
            localStorage.setItem("localspot_active_session_v1", JSON.stringify(window.currentLocalProfile));
        }
    }

    const events = await window.LocalSpotDB.fetchAllEventsWithAttendees();
    if (typeof window.showEventsOnMap === "function") {
        window.showEventsOnMap(events);
    }
    if (typeof window.filterEvents === "function") {
        window.filterEvents();
    }

    const { data: allProfiles } = await window.supabaseClient.from("profiles").select("*");
    if (allProfiles && typeof window.showFriendsOnMap === "function") {
        window.showFriendsOnMap(allProfiles);
    }

    window.LocalSpotDB.startRealtimeSync(async () => {
        if (typeof window.showEventsOnMap === "function") window.showEventsOnMap(window.events);
        if (typeof window.filterEvents === "function") window.filterEvents();
    });
});
