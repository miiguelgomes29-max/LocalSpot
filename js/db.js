// ==========================================
// LOCALSPOT — BASE DE DADOS SUPABASE (COMPLETO)
// ==========================================

window.escapeHTML = window.escapeHTML || function (str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
};

const SUPABASE_URL = "https://ufzjexbihnwflqktpomm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmempleGJpaG53Zmxxa3Rwb21tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzMjU5NDUsImV4cCI6MjEwOTkwMTk0NX0.hy3x0RuyuKYwTOGvdAA2hYKH_02SEy49YRaZHoD2ufA";

const isSupabaseConfigured =
    SUPABASE_URL.startsWith("https://") &&
    SUPABASE_ANON_KEY.length > 20 &&
    typeof window.supabase !== "undefined";

window.supabaseClient = isSupabaseConfigured
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

function isValidUUID(val) {
    return typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

window.LocalSpotDB = {
    isReady() {
        return Boolean(window.supabaseClient);
    },

    isValidUUID,

    // ==========================================
    // 1. PERFIS & SESSÕES NA BASE DE DADOS
    // ==========================================
    async upsertProfile(profileData) {
        if (!this.isReady() || !profileData?.email) return profileData;

        const cleanEmail = profileData.email.toLowerCase().trim();
        const payload = {
            full_name: profileData.full_name || "Explorador",
            email: cleanEmail,
            role: profileData.role || "user",
            business_type: profileData.business_type || "",
            bio: profileData.bio || "",
            avatar_emoji: profileData.avatar_emoji || "😎",
            status_emoji: profileData.status_emoji || "🎉",
            status_text: profileData.status_text || "Pronto pra sair",
            privacy_mode: profileData.privacy_mode || "precise",
            ghost_mode: profileData.privacy_mode === "ghost",
            updated_at: new Date().toISOString()
        };

        if (typeof profileData.last_lat === "number" && typeof profileData.last_lng === "number") {
            payload.last_lat = profileData.last_lat;
            payload.last_lng = profileData.last_lng;
        }

        // Verifica se já existe perfil com este e-mail para atualizar ou inserir com UUID real
        const { data: existing } = await window.supabaseClient
            .from("profiles")
            .select("*")
            .eq("email", cleanEmail)
            .maybeSingle();

        if (existing && existing.id) {
            const { data: updated, error: updErr } = await window.supabaseClient
                .from("profiles")
                .update(payload)
                .eq("id", existing.id)
                .select()
                .single();

            if (updErr) {
                console.error("Erro ao atualizar perfil na BD:", updErr.message);
                return existing;
            }
            return updated;
        }

        const { data: inserted, error: insErr } = await window.supabaseClient
            .from("profiles")
            .insert(payload)
            .select()
            .single();

        if (insErr) {
            console.error("Erro ao criar perfil na BD:", insErr.message);
            return profileData;
        }
        return inserted;
    },

    async getProfileByEmail(email) {
        if (!this.isReady() || !email) return null;
        const { data, error } = await window.supabaseClient
            .from("profiles")
            .select("*")
            .eq("email", email.toLowerCase().trim())
            .maybeSingle();

        if (error) return null;
        return data || null;
    },

    async fetchAllProfiles(excludeUserId) {
        if (!this.isReady()) return { profiles: [], error: "Supabase não ligado." };

        let req = window.supabaseClient
            .from("profiles")
            .select("*")
            .order("updated_at", { ascending: false })
            .limit(50);

        if (isValidUUID(excludeUserId)) {
            req = req.neq("id", excludeUserId);
        }

        const { data, error } = await req;
        if (error) {
            return { profiles: [], error: error.message };
        }
        return { profiles: data || [], error: null };
    },

    async syncLiveLocation(userId, lat, lng, extra = {}) {
        if (!this.isReady() || !isValidUUID(userId)) return;
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
    // 2. SISTEMA DE AMIGOS (PEDIDOS & LISTA)
    // ==========================================
    async fetchFriendsData(userId) {
        if (!this.isReady() || !isValidUUID(userId)) {
            return { friends: [], incoming: [], outgoing: [] };
        }

        const { data: rows, error } = await window.supabaseClient
            .from("friendships")
            .select("*")
            .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

        if (error || !rows || rows.length === 0) {
            return { friends: [], incoming: [], outgoing: [] };
        }

        const otherIds = Array.from(
            new Set(
                rows.map(r => (r.requester_id === userId ? r.addressee_id : r.requester_id)).filter(isValidUUID)
            )
        );

        if (otherIds.length === 0) {
            return { friends: [], incoming: [], outgoing: [] };
        }

        const { data: profiles } = await window.supabaseClient
            .from("profiles")
            .select("*")
            .in("id", otherIds);

        const profileMap = new Map((profiles || []).map(p => [String(p.id), p]));

        const friends = [];
        const incoming = [];
        const outgoing = [];

        rows.forEach(r => {
            const isRequester = String(r.requester_id) === String(userId);
            const otherId = String(isRequester ? r.addressee_id : r.requester_id);
            const otherProfile = profileMap.get(otherId);
            if (!otherProfile) return;

            if (r.status === "accepted") {
                friends.push({ ...otherProfile, friendship_id: r.id });
            } else if (r.status === "pending") {
                if (isRequester) {
                    outgoing.push({ ...otherProfile, friendship_id: r.id });
                } else {
                    incoming.push({ ...otherProfile, friendship_id: r.id });
                }
            }
        });

        return { friends, incoming, outgoing };
    },

    async sendFriendRequest(fromUserId, toUserId) {
        if (!this.isReady() || !isValidUUID(fromUserId) || !isValidUUID(toUserId) || fromUserId === toUserId) {
            return { ok: false, error: "O teu perfil ainda não está sincronizado com a base de dados." };
        }

        const { data: existing } = await window.supabaseClient
            .from("friendships")
            .select("*")
            .or(`and(requester_id.eq.${fromUserId},addressee_id.eq.${toUserId}),and(requester_id.eq.${toUserId},addressee_id.eq.${fromUserId})`)
            .maybeSingle();

        if (existing) {
            if (existing.status === "accepted") {
                return { ok: false, error: "Já são amigos!" };
            }
            if (String(existing.addressee_id) === String(fromUserId)) {
                await this.respondFriendRequest(existing.id, true);
                return { ok: true, autoAccepted: true };
            }
            return { ok: false, error: "Pedido já enviado." };
        }

        const { error } = await window.supabaseClient
            .from("friendships")
            .insert({
                requester_id: fromUserId,
                addressee_id: toUserId,
                status: "pending"
            });

        if (error) {
            console.error("Erro ao enviar pedido de amizade:", error.message);
            return { ok: false, error: error.message };
        }
        return { ok: true };
    },

    async respondFriendRequest(friendshipId, accept) {
        if (!this.isReady() || !friendshipId) return false;
        if (accept) {
            const { error } = await window.supabaseClient
                .from("friendships")
                .update({ status: "accepted" })
                .eq("id", friendshipId);
            return !error;
        } else {
            const { error } = await window.supabaseClient
                .from("friendships")
                .delete()
                .eq("id", friendshipId);
            return !error;
        }
    },

    // ==========================================
    // 3. BUMPS & CHAT EM TEMPO REAL
    // ==========================================
    async sendBump(fromUserId, toUserId, emoji = "👊", message = "Bump!") {
        if (!this.isReady() || !isValidUUID(fromUserId) || !isValidUUID(toUserId)) return;

        await window.supabaseClient.from("bumps").insert({
            sender_id: fromUserId,
            receiver_id: toUserId,
            emoji,
            message
        });

        const { data: target } = await window.supabaseClient
            .from("profiles")
            .select("bump_count")
            .eq("id", toUserId)
            .maybeSingle();

        if (target) {
            await window.supabaseClient
                .from("profiles")
                .update({ bump_count: (target.bump_count || 0) + 1 })
                .eq("id", toUserId);
        }
    },

    async fetchMessages(userId, friendId) {
        if (!this.isReady() || !isValidUUID(userId) || !isValidUUID(friendId)) return [];
        const { data, error } = await window.supabaseClient
            .from("messages")
            .select("*")
            .or(`and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`)
            .order("created_at", { ascending: true })
            .limit(80);

        if (error) return [];
        return data || [];
    },

    async sendMessage(fromUserId, toUserId, content) {
        if (!this.isReady() || !isValidUUID(fromUserId) || !isValidUUID(toUserId) || !content.trim()) return null;
        const { data, error } = await window.supabaseClient
            .from("messages")
            .insert({
                sender_id: fromUserId,
                receiver_id: toUserId,
                content: content.trim()
            })
            .select()
            .single();

        if (error) return null;
        return data;
    },

    // ==========================================
    // 4. EVENTOS, INSCRIÇÕES & COMENTÁRIOS
    // ==========================================
    async fetchAllEventsWithAttendees() {
        if (!this.isReady()) return window.events || [];

        const [{ data: dbEvents, error }, { data: regs }] = await Promise.all([
            window.supabaseClient.from("events").select("*").order("date", { ascending: true }),
            window.supabaseClient.from("event_registrations").select("*")
        ]);

        if (error || !dbEvents) return window.events || [];

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
            creator_id: isValidUUID(currentUser?.id) ? currentUser.id : null,
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

        if (error) throw error;
        return data;
    },

    async updateEvent(eventId, ev) {
        if (!this.isReady() || !eventId) return null;
        const { data, error } = await window.supabaseClient
            .from("events")
            .update({
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
            })
            .eq("id", eventId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteEvent(eventId) {
        if (!this.isReady() || !eventId) return;
        await window.supabaseClient.from("events").delete().eq("id", eventId);
    },

    async toggleRegistration(eventId, user) {
        if (!this.isReady() || !isValidUUID(user?.id)) return { enrolled: false };

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

        if (error) return { enrolled: false };
        return { enrolled: true, ticketCode };
    },

    async fetchCommentsAndReviews(eventId) {
        if (!this.isReady()) return { comments: [], reviews: [] };
        const [{ data: comments }, { data: reviews }] = await Promise.all([
            window.supabaseClient.from("event_comments").select("*").eq("event_id", eventId).order("created_at", { ascending: true }),
            window.supabaseClient.from("event_reviews").select("*").eq("event_id", eventId).order("created_at", { ascending: false })
        ]);
        return { comments: comments || [], reviews: reviews || [] };
    },

    async addComment(eventId, user, content) {
        if (!this.isReady() || !isValidUUID(user?.id) || !content.trim()) return;
        await window.supabaseClient.from("event_comments").insert({
            event_id: eventId,
            user_id: user.id,
            user_name: user.full_name,
            content: content.trim()
        });
    },

    async addReview(eventId, user, rating, comment) {
        if (!this.isReady() || !isValidUUID(user?.id)) return;
        await window.supabaseClient.from("event_reviews").upsert(
            {
                event_id: eventId,
                user_id: user.id,
                user_name: user.full_name,
                rating,
                comment: comment || ""
            },
            { onConflict: "event_id,user_id" }
        );
    },

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
            .subscribe();
    }
};

document.addEventListener("DOMContentLoaded", async () => {
    if (!window.LocalSpotDB.isReady()) return;

    const events = await window.LocalSpotDB.fetchAllEventsWithAttendees();
    if (typeof window.showEventsOnMap === "function") {
        window.showEventsOnMap(events);
    }
    if (typeof window.filterEvents === "function") {
        window.filterEvents();
    }

    window.LocalSpotDB.startRealtimeSync(() => {
        if (typeof window.showEventsOnMap === "function") window.showEventsOnMap(window.events);
        if (typeof window.filterEvents === "function") window.filterEvents();
    });
});
