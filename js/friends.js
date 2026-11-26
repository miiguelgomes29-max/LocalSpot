// ==========================================
// LOCALSPOT — SISTEMA DE AMIGOS, RADAR & CHAT (COMPLETO)
// ==========================================

(function () {
    let currentFriends = [];
    let incomingRequests = [];
    let outgoingRequests = [];
    let activeChatFriend = null;
    const friendMapMarkers = new Map();
    const mapFocusFriendOriginal = typeof window.focusFriendOnMap === "function" ? window.focusFriendOnMap : null;

    // Garante que o utilizador atual tem o UUID real da tabela "profiles"
    async function ensureSyncedMe() {
        let me = window.currentLocalProfile;
        if (!me) {
            try {
                me = JSON.parse(localStorage.getItem("localspot_active_session_v1") || "null");
            } catch (e) {}
        }
        if (!me || !me.email) return null;

        if (window.LocalSpotDB?.isReady() && !window.LocalSpotDB.isValidUUID(me.id)) {
            const dbProfile = await window.LocalSpotDB.upsertProfile(me);
            if (dbProfile && window.LocalSpotDB.isValidUUID(dbProfile.id)) {
                me = { ...me, ...dbProfile };
                window.currentLocalProfile = me;
                localStorage.setItem("localspot_active_session_v1", JSON.stringify(me));
            }
        }
        return me;
    }

    function ensureFriendsHeaderButton() {
        const nav = document.querySelector(".header nav");
        if (!nav) return;

        let btn = document.getElementById("lsHeaderFriendsBtn");
        if (!btn) {
            const existing = Array.from(nav.querySelectorAll("button")).find(b =>
                b.textContent.toLowerCase().includes("amigos")
            );
            if (existing) {
                existing.id = "lsHeaderFriendsBtn";
                btn = existing;
            } else {
                btn = document.createElement("button");
                btn.id = "lsHeaderFriendsBtn";
                btn.type = "button";
                btn.className = "btn-soft";
                btn.innerHTML = `👊 Amigos`;
                const addEvBtn = document.getElementById("addEventButton");
                if (addEvBtn) {
                    nav.insertBefore(btn, addEvBtn);
                } else {
                    nav.appendChild(btn);
                }
            }
        }
    }

    // ==========================================
    // 1. SINCRONIZAR GPS & DESENHAR AMIGOS NO MAPA
    // ==========================================
    window.syncMyLiveLocation = async function (lat, lng, speedKmh = 0) {
        const me = await ensureSyncedMe();
        if (!me || !window.LocalSpotDB?.isValidUUID(me.id)) return;

        let batteryLevel = null;
        let isCharging = false;
        if (navigator.getBattery) {
            try {
                const bat = await navigator.getBattery();
                batteryLevel = Math.round(bat.level * 100);
                isCharging = bat.charging;
            } catch (e) {}
        }

        await window.LocalSpotDB.syncLiveLocation(me.id, lat, lng, {
            speed_kmh: speedKmh,
            battery_level: batteryLevel,
            is_charging: isCharging
        });
    };

    function renderFriendsOnMapFallback(friendsList) {
        if (!window.map || typeof maplibregl === "undefined") return;

        const validIds = new Set();
        (friendsList || []).forEach(friend => {
            if (friend.ghost_mode || typeof friend.last_lat !== "number" || typeof friend.last_lng !== "number") return;
            validIds.add(String(friend.id));

            const existing = friendMapMarkers.get(String(friend.id));
            if (existing) {
                existing.setLngLat([friend.last_lng, friend.last_lat]);
                return;
            }

            const el = document.createElement("div");
            el.className = "ls-friend-marker online";
            el.innerHTML = `
                <span class="ls-friend-name-tag">🟢 ${window.escapeHTML((friend.full_name || "Amigo").split(" ")[0])}</span>
                <span>${window.escapeHTML(friend.avatar_emoji || "😎")}</span>
                <span class="ls-friend-mood-badge">${window.escapeHTML(friend.status_emoji || "📍")}</span>
            `;

            const popupHtml = `
                <div style="min-width:190px;">
                    <strong style="display:block; font-size:14px;">${window.escapeHTML(friend.avatar_emoji || "😎")} ${window.escapeHTML(friend.full_name)}</strong>
                    <span style="display:block; font-size:12px; color:#94a3b8; margin:3px 0 8px;">${window.escapeHTML(friend.status_emoji || "📍")} ${window.escapeHTML(friend.status_text || "Online")} · 👊 ${friend.bump_count || 0}</span>
                    <div style="display:flex; gap:6px;">
                        <button type="button" onclick="window.sendBump('${friend.id}', '👊', 'Bump!')" style="flex:1; background:#f43f5e; color:#fff; border:none; border-radius:8px; padding:6px; font-weight:800; cursor:pointer;">👊 Bump</button>
                        <button type="button" onclick="window.openFriendChat('${friend.id}')" style="flex:1; background:#10b981; color:#04130d; border:none; border-radius:8px; padding:6px; font-weight:800; cursor:pointer;">💬 Chat</button>
                    </div>
                </div>
            `;

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([friend.last_lng, friend.last_lat])
                .setPopup(new maplibregl.Popup({ offset: 24 }).setHTML(popupHtml))
                .addTo(window.map);

            friendMapMarkers.set(String(friend.id), marker);
        });

        friendMapMarkers.forEach((marker, id) => {
            if (!validIds.has(id)) {
                marker.remove();
                friendMapMarkers.delete(id);
            }
        });
    }

    window.focusFriendOnMap = function (friendId) {
        if (mapFocusFriendOriginal && mapFocusFriendOriginal(friendId)) {
            return true;
        }
        const friend = currentFriends.find(f => String(f.id) === String(friendId));
        if (!friend || typeof friend.last_lat !== "number" || typeof friend.last_lng !== "number") return false;
        if (window.map) {
            window.map.flyTo({ center: [friend.last_lng, friend.last_lat], zoom: 16, duration: 900 });
            const marker = friendMapMarkers.get(String(friend.id));
            marker?.togglePopup();
            return true;
        }
        return false;
    };

    // ==========================================
    // 2. BUMPS & CHAT
    // ==========================================
    window.getFriendshipTier = window.getFriendshipTier || function (bumpCount = 0) {
        if (bumpCount >= 50) return { badge: "👑 Melhores Amigos" };
        if (bumpCount >= 20) return { badge: "🔥 Parceiros" };
        if (bumpCount >= 5) return { badge: "⚡ Próximos" };
        return { badge: "🌱 Amigos" };
    };

    window.isFriendLiveOnline = window.isFriendLiveOnline || function (friendId) {
        const f = currentFriends.find(item => String(item.id) === String(friendId));
        if (!f || !f.updated_at) return false;
        return Date.now() - new Date(f.updated_at).getTime() < 10 * 60 * 1000;
    };

    window.sendBump = async function (friendId, emoji = "👊", message = "Bump!") {
        const me = await ensureSyncedMe();
        if (!me) return;
        const senderFirst = (me.full_name || "Alguém").split(" ")[0];
        await window.LocalSpotDB.sendBump(me.id, friendId, emoji, `${senderFirst}: ${message}`);
        window.triggerBumpImpactAnimation?.(`${emoji} Bump enviado!`, emoji);
    };

    window.sendWhereAreYouPing = async function (friendId) {
        const me = await ensureSyncedMe();
        if (!me) return;
        const senderFirst = (me.full_name || "Alguém").split(" ")[0];
        await window.LocalSpotDB.sendBump(me.id, friendId, "👀", `${senderFirst}: Onde andas?`);
        window.triggerBumpImpactAnimation?.("👀 Ping 'Onde andas?' enviado!", "👀");
    };

    window.openFriendChat = async function (friendId) {
        const friend = currentFriends.find(f => String(f.id) === String(friendId));
        if (!friend) return;
        activeChatFriend = friend;
        ensureSocialModals();

        const modal = document.getElementById("lsSocialChatModal");
        const titleEl = document.getElementById("lsChatTitle");
        if (titleEl) {
            titleEl.innerHTML = `${window.escapeHTML(friend.avatar_emoji || "😎")} ${window.escapeHTML(friend.full_name)}`;
        }
        modal.classList.remove("hidden");
        await renderChatHistory();
    };

    // ==========================================
    // 3. ATUALIZAR LISTA DE AMIGOS & MAPA
    // ==========================================
    window.refreshFriendsSystem = async function () {
        ensureFriendsHeaderButton();
        const me = await ensureSyncedMe();
        if (!me || !window.LocalSpotDB?.isReady()) return;

        const data = await window.LocalSpotDB.fetchFriendsData(me.id);
        currentFriends = data.friends;
        incomingRequests = data.incoming;
        outgoingRequests = data.outgoing;

        const btn = document.getElementById("lsHeaderFriendsBtn");
        if (btn) {
            const count = incomingRequests.length;
            btn.innerHTML = count > 0
                ? `👊 Amigos <span class="friends-req-badge">${count}</span>`
                : `👊 Amigos`;
        }

        if (typeof window.showFriendsOnMap === "function") {
            window.showFriendsOnMap(currentFriends);
        } else {
            renderFriendsOnMapFallback(currentFriends);
        }

        const friendsModal = document.getElementById("lsSocialFriendsModal");
        if (friendsModal && !friendsModal.classList.contains("hidden")) {
            renderFriendsModalContent();
        }
    };

    // ==========================================
    // 4. MODAIS DE AMIGOS & CHAT
    // ==========================================
    function ensureSocialModals() {
        if (!document.getElementById("lsSocialFriendsModal")) {
            const fModal = document.createElement("div");
            fModal.id = "lsSocialFriendsModal";
            fModal.className = "modal hidden";
            fModal.innerHTML = `
                <div class="modal-content" style="max-width:480px;">
                    <button type="button" id="closeLsFriendsModal" class="close-button">&times;</button>
                    <h2 style="margin:0 0 4px;">👊 Amigos & Radar Bump</h2>
                    <p class="muted" style="font-size:12.5px; margin:0 0 12px;">Procura perfis registados, aceita pedidos e vê onde estão no mapa.</p>

                    <div id="lsFriendsFeedback" class="hidden" style="background:rgba(244,63,94,0.15); border:1px solid rgba(244,63,94,0.4); color:#fda4af; padding:8px 10px; border-radius:10px; font-size:12px; margin-bottom:10px;"></div>

                    <div style="display:flex; gap:8px; margin-bottom:14px;">
                        <input type="search" id="lsSearchUsersInput" placeholder="Procurar utilizadores por nome ou e-mail...">
                        <button type="button" id="lsSearchUsersBtn" class="btn-primary-sm">Procurar</button>
                    </div>

                    <div id="lsIncomingRequestsBox" class="hidden" style="margin-bottom:14px;">
                        <h4 style="margin:0 0 8px; font-size:12.5px; color:#fda4af;">🔔 Pedidos de Amizade Recebidos</h4>
                        <div id="lsIncomingRequestsList" style="display:flex; flex-direction:column; gap:8px;"></div>
                    </div>

                    <div id="lsSearchResultsBox" style="margin-bottom:14px;">
                        <h4 style="margin:0 0 8px; font-size:12.5px; color:var(--primary);">🌍 Utilizadores Registados</h4>
                        <div id="lsSearchResultsList" style="display:flex; flex-direction:column; gap:8px;" class="muted">A carregar perfis...</div>
                    </div>

                    <h4 style="margin:0 0 8px; font-size:12.5px;">👥 Os Meus Amigos (<span id="lsFriendsCount">0</span>)</h4>
                    <div id="lsMyFriendsList" style="display:flex; flex-direction:column; gap:8px;"></div>
                </div>
            `;
            document.body.appendChild(fModal);

            document.getElementById("closeLsFriendsModal").addEventListener("click", () => {
                fModal.classList.add("hidden");
            });

            const searchInput = document.getElementById("lsSearchUsersInput");
            document.getElementById("lsSearchUsersBtn").addEventListener("click", () => {
                searchAndRenderProfiles(searchInput.value);
            });
            searchInput.addEventListener("input", () => {
                searchAndRenderProfiles(searchInput.value);
            });
        }

        if (!document.getElementById("lsSocialChatModal")) {
            const cModal = document.createElement("div");
            cModal.id = "lsSocialChatModal";
            cModal.className = "modal hidden";
            cModal.innerHTML = `
                <div class="modal-content" style="max-width:420px;">
                    <button type="button" id="closeLsChatModal" class="close-button">&times;</button>
                    <h3 id="lsChatTitle" style="margin:0 0 10px;">💬 Chat</h3>
                    <div id="lsChatMessagesBox" style="height:260px; overflow-y:auto; background:var(--surface-2); border:1px solid var(--border); border-radius:12px; padding:10px; margin-bottom:10px; display:flex; flex-direction:column; gap:8px;"></div>
                    <form id="lsChatSendForm" style="display:flex; gap:8px;">
                        <input type="text" id="lsChatInput" placeholder="Escreve uma mensagem..." required>
                        <button type="submit" class="btn-primary-sm">Enviar</button>
                    </form>
                </div>
            `;
            document.body.appendChild(cModal);

            document.getElementById("closeLsChatModal").addEventListener("click", () => {
                cModal.classList.add("hidden");
                activeChatFriend = null;
            });

            document.getElementById("lsChatSendForm").addEventListener("submit", async e => {
                e.preventDefault();
                const me = await ensureSyncedMe();
                const input = document.getElementById("lsChatInput");
                if (!me || !activeChatFriend || !input.value.trim()) return;

                const text = input.value.trim();
                input.value = "";
                await window.LocalSpotDB.sendMessage(me.id, activeChatFriend.id, text);
                await renderChatHistory();
            });
        }
    }

    function showModalFeedback(msg) {
        const box = document.getElementById("lsFriendsFeedback");
        if (!box) return;
        if (!msg) {
            box.classList.add("hidden");
            return;
        }
        box.textContent = msg;
        box.classList.remove("hidden");
    }

    async function searchAndRenderProfiles(query) {
        const me = await ensureSyncedMe();
        const listEl = document.getElementById("lsSearchResultsList");
        if (!listEl) return;

        if (!window.LocalSpotDB?.isReady()) {
            listEl.innerHTML = `<p class="muted" style="font-size:12px;">Base de dados Supabase não inicializada.</p>`;
            return;
        }

        const { profiles, error } = await window.LocalSpotDB.fetchAllProfiles(me?.id);
        if (error) {
            listEl.innerHTML = `<p style="color:#fda4af; font-size:12px;">Erro BD: ${window.escapeHTML(error)}</p>`;
            return;
        }

        const q = (query || "").trim().toLowerCase();
        const filtered = profiles.filter(u => {
            if (me && String(u.id) === String(me.id)) return false;
            if (!q) return true;
            return `${u.full_name || ""} ${u.email || ""}`.toLowerCase().includes(q);
        });

        if (filtered.length === 0) {
            listEl.innerHTML = `<p class="muted" style="font-size:12px;">Nenhum outro utilizador encontrado na tabela profiles.</p>`;
            return;
        }

        const friendIds = new Set(currentFriends.map(f => String(f.id)));
        const outgoingIds = new Set(outgoingRequests.map(f => String(f.id)));
        const incomingMap = new Map(incomingRequests.map(f => [String(f.id), f.friendship_id]));

        listEl.innerHTML = filtered.map(u => {
            const uid = String(u.id);
            let actionHtml = "";
            if (friendIds.has(uid)) {
                actionHtml = `<span style="font-size:11.5px; color:var(--primary); font-weight:700;">✓ Amigo</span>`;
            } else if (outgoingIds.has(uid)) {
                actionHtml = `<span style="font-size:11.5px; color:var(--muted);">⏳ Pendente</span>`;
            } else if (incomingMap.has(uid)) {
                const reqId = incomingMap.get(uid);
                actionHtml = `<button type="button" class="btn-primary-sm" data-accept-req="${reqId}">Aceitar</button>`;
            } else {
                actionHtml = `<button type="button" class="btn-primary-sm" data-add-friend="${uid}">+ Adicionar</button>`;
            }

            return `
                <div style="display:flex; align-items:center; justify-content:space-between; background:var(--surface-2); border:1px solid var(--border); padding:9px 12px; border-radius:12px;">
                    <div style="display:flex; align-items:center; gap:9px;">
                        <div class="avatar-circle" style="width:34px; height:34px; font-size:16px;">${window.escapeHTML(u.avatar_emoji || "😎")}</div>
                        <div>
                            <strong style="display:block; font-size:13px;">${window.escapeHTML(u.full_name)}</strong>
                            <span style="font-size:11px; color:var(--muted);">${window.escapeHTML(u.status_emoji || "📍")} ${window.escapeHTML(u.status_text || "Online")}</span>
                        </div>
                    </div>
                    <div>${actionHtml}</div>
                </div>
            `;
        }).join("");

        listEl.querySelectorAll("[data-add-friend]").forEach(btn => {
            btn.addEventListener("click", async () => {
                showModalFeedback("");
                if (!me || !window.LocalSpotDB.isValidUUID(me.id)) {
                    showModalFeedback("Faz Sair (logout) e volta a entrar para sincronizar o teu perfil com a BD.");
                    return;
                }
                const targetId = btn.getAttribute("data-add-friend");
                btn.disabled = true;
                btn.textContent = "A enviar...";
                const res = await window.LocalSpotDB.sendFriendRequest(me.id, targetId);
                if (!res.ok) {
                    showModalFeedback(res.error || "Não foi possível enviar o pedido.");
                    btn.disabled = false;
                    btn.textContent = "+ Adicionar";
                    return;
                }
                window.triggerBumpImpactAnimation?.("📨 Pedido de amizade enviado!", "🤝");
                await window.refreshFriendsSystem();
                await searchAndRenderProfiles(document.getElementById("lsSearchUsersInput")?.value || "");
            });
        });

        listEl.querySelectorAll("[data-accept-req]").forEach(btn => {
            btn.addEventListener("click", async () => {
                const reqId = btn.getAttribute("data-accept-req");
                await window.LocalSpotDB.respondFriendRequest(reqId, true);
                window.triggerBumpImpactAnimation?.("🎉 Novo amigo adicionado ao radar!", "👊");
                await window.refreshFriendsSystem();
                await searchAndRenderProfiles(document.getElementById("lsSearchUsersInput")?.value || "");
            });
        });
    }

    function renderFriendsModalContent() {
        const incBox = document.getElementById("lsIncomingRequestsBox");
        const incList = document.getElementById("lsIncomingRequestsList");
        const myFriendsList = document.getElementById("lsMyFriendsList");
        const countEl = document.getElementById("lsFriendsCount");

        if (countEl) countEl.textContent = String(currentFriends.length);

        if (incBox && incList) {
            if (incomingRequests.length === 0) {
                incBox.classList.add("hidden");
            } else {
                incBox.classList.remove("hidden");
                incList.innerHTML = incomingRequests.map(req => `
                    <div style="display:flex; align-items:center; justify-content:space-between; background:var(--surface-2); border:1px solid var(--bump); padding:9px 12px; border-radius:12px;">
                        <div style="display:flex; align-items:center; gap:9px;">
                            <div class="avatar-circle" style="width:34px; height:34px;">${window.escapeHTML(req.avatar_emoji || "😎")}</div>
                            <div>
                                <strong style="display:block; font-size:13px;">${window.escapeHTML(req.full_name)}</strong>
                                <span style="font-size:11px; color:var(--muted);">Quer conectar-se contigo</span>
                            </div>
                        </div>
                        <div style="display:flex; gap:5px;">
                            <button type="button" class="btn-primary-sm" data-inc-accept="${req.friendship_id}">✓ Aceitar</button>
                            <button type="button" class="btn-logout" style="padding:4px 8px;" data-inc-reject="${req.friendship_id}">✕</button>
                        </div>
                    </div>
                `).join("");

                incList.querySelectorAll("[data-inc-accept]").forEach(btn => {
                    btn.addEventListener("click", async () => {
                        await window.LocalSpotDB.respondFriendRequest(btn.getAttribute("data-inc-accept"), true);
                        window.triggerBumpImpactAnimation?.("👊 Amizade aceite!", "👊");
                        await window.refreshFriendsSystem();
                        await searchAndRenderProfiles(document.getElementById("lsSearchUsersInput")?.value || "");
                    });
                });

                incList.querySelectorAll("[data-inc-reject]").forEach(btn => {
                    btn.addEventListener("click", async () => {
                        await window.LocalSpotDB.respondFriendRequest(btn.getAttribute("data-inc-reject"), false);
                        await window.refreshFriendsSystem();
                    });
                });
            }
        }

        if (myFriendsList) {
            if (currentFriends.length === 0) {
                myFriendsList.innerHTML = `<p class="muted" style="font-size:12.5px;">Ainda não tens amigos adicionados. Procura acima para adicionar!</p>`;
            } else {
                myFriendsList.innerHTML = currentFriends.map(f => {
                    const hasLoc = typeof f.last_lat === "number" && typeof f.last_lng === "number";
                    return `
                        <div style="display:flex; align-items:center; justify-content:space-between; background:var(--surface-2); border:1px solid var(--border); padding:9px 12px; border-radius:12px;">
                            <div style="display:flex; align-items:center; gap:9px;">
                                <div class="avatar-circle" style="width:36px; height:36px;">${window.escapeHTML(f.avatar_emoji || "😎")}</div>
                                <div>
                                    <strong style="display:block; font-size:13px;">${window.escapeHTML(f.full_name)}</strong>
                                    <span style="font-size:11px; color:var(--muted);">${window.escapeHTML(f.status_emoji || "📍")} ${window.escapeHTML(f.status_text || "Online")} · 👊 ${f.bump_count || 0}</span>
                                </div>
                            </div>
                            <div style="display:flex; gap:5px;">
                                ${hasLoc ? `<button type="button" class="btn-soft" style="padding:5px 8px; font-size:11.5px;" data-locate-friend="${f.id}" title="Ver no Mapa">📍</button>` : ""}
                                <button type="button" class="btn-soft" style="padding:5px 8px; font-size:11.5px;" data-bump-friend="${f.id}">👊</button>
                                <button type="button" class="btn-primary-sm" data-chat-friend="${f.id}">💬</button>
                            </div>
                        </div>
                    `;
                }).join("");

                myFriendsList.querySelectorAll("[data-locate-friend]").forEach(btn => {
                    btn.addEventListener("click", () => {
                        const fid = btn.getAttribute("data-locate-friend");
                        document.getElementById("lsSocialFriendsModal")?.classList.add("hidden");
                        window.focusFriendOnMap(fid);
                    });
                });

                myFriendsList.querySelectorAll("[data-bump-friend]").forEach(btn => {
                    btn.addEventListener("click", async () => {
                        const fid = btn.getAttribute("data-bump-friend");
                        await window.sendBump(fid, "👊", "Bump!");
                    });
                });

                myFriendsList.querySelectorAll("[data-chat-friend]").forEach(btn => {
                    btn.addEventListener("click", () => {
                        const fid = btn.getAttribute("data-chat-friend");
                        document.getElementById("lsSocialFriendsModal")?.classList.add("hidden");
                        window.openFriendChat(fid);
                    });
                });
            }
        }
    }

    async function renderChatHistory() {
        const me = await ensureSyncedMe();
        const box = document.getElementById("lsChatMessagesBox");
        if (!me || !activeChatFriend || !box) return;

        const msgs = await window.LocalSpotDB.fetchMessages(me.id, activeChatFriend.id);
        if (msgs.length === 0) {
            box.innerHTML = `<p class="muted" style="text-align:center; font-size:12px; margin:auto;">Sem mensagens ainda. Diz olá! 👋</p>`;
            return;
        }

        box.innerHTML = msgs.map(m => {
            const isMine = String(m.sender_id) === String(me.id);
            return `
                <div style="align-self:${isMine ? "flex-end" : "flex-start"}; max-width:78%; background:${isMine ? "var(--primary)" : "var(--surface)"}; color:${isMine ? "#04130d" : "var(--text)"}; padding:7px 11px; border-radius:12px; font-size:12.5px; font-weight:${isMine ? "600" : "400"}; border:1px solid var(--border);">
                    ${window.escapeHTML(m.content)}
                </div>
            `;
        }).join("");
        box.scrollTop = box.scrollHeight;
    }

    // ==========================================
    // 5. LIGAR AOS CLIQUES, GPS & REALTIME
    // ==========================================
    function setupFriendsSystem() {
        ensureFriendsHeaderButton();
        ensureSocialModals();

        document.addEventListener("click", async e => {
            const btn = e.target.closest("button");
            if (!btn) return;

            if (btn.id === "lsHeaderFriendsBtn" || (btn.textContent.includes("Amigos") && !btn.closest("#lsSocialFriendsModal"))) {
                e.stopImmediatePropagation();
                showModalFeedback("");
                await window.refreshFriendsSystem();
                renderFriendsModalContent();
                document.getElementById("lsSocialFriendsModal").classList.remove("hidden");
                await searchAndRenderProfiles(document.getElementById("lsSearchUsersInput")?.value || "");
            }
        }, true);

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                window.syncMyLiveLocation(pos.coords.latitude, pos.coords.longitude, 0);
            }, () => {}, { enableHighAccuracy: true });
        }

        if (window.supabaseClient) {
            window.supabaseClient
                .channel("localspot-friends-live")
                .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => {
                    window.refreshFriendsSystem();
                })
                .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
                    window.refreshFriendsSystem();
                })
                .on("postgres_changes", { event: "INSERT", schema: "public", table: "bumps" }, async payload => {
                    const me = await ensureSyncedMe();
                    if (me && String(payload.new?.receiver_id) === String(me.id)) {
                        window.triggerBumpImpactAnimation?.(`${payload.new.emoji || "👊"} ${payload.new.message || "Recebeste um Bump!"}`, payload.new.emoji || "👊");
                    }
                })
                .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, payload => {
                    if (activeChatFriend && (String(payload.new?.sender_id) === String(activeChatFriend.id) || String(payload.new?.receiver_id) === String(activeChatFriend.id))) {
                        renderChatHistory();
                    }
                })
                .subscribe();
        }

        setTimeout(() => window.refreshFriendsSystem(), 800);
        setInterval(() => window.refreshFriendsSystem(), 12000);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupFriendsSystem);
    } else {
        setupFriendsSystem();
    }
})();
