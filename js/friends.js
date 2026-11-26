// ==========================================
// LOCALSPOT — SISTEMA DE AMIGOS, BUMPS & CHAT
// ==========================================

(function () {
    let currentFriends = [];
    let incomingRequests = [];
    let outgoingRequests = [];
    let activeChatFriend = null;

    function getMe() {
        return window.currentLocalProfile || null;
    }

    // ==========================================
    // 1. SINCRONIZAR LOCALIZAÇÃO GPS COM A BD
    // ==========================================
    window.syncMyLiveLocation = async function (lat, lng, speedKmh = 0) {
        const me = getMe();
        if (!me || !me.id || !window.LocalSpotDB?.isReady()) return;

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

    // ==========================================
    // 2. FUNÇÕES GLOBAIS PARA OS PINS DO MAPA
    // ==========================================
    window.getFriendshipTier = function (bumpCount = 0) {
        if (bumpCount >= 50) return { badge: "👑 Melhores Amigos" };
        if (bumpCount >= 20) return { badge: "🔥 Parceiros" };
        if (bumpCount >= 5) return { badge: "⚡ Próximos" };
        return { badge: "🌱 Amigos" };
    };

    window.isFriendLiveOnline = function (friendId) {
        const f = currentFriends.find(item => String(item.id) === String(friendId));
        if (!f || !f.updated_at) return false;
        const diffMs = Date.now() - new Date(f.updated_at).getTime();
        return diffMs < 10 * 60 * 1000; // Ativo nos últimos 10 minutos
    };

    window.sendBump = async function (friendId, emoji = "👊", message = "Bump!") {
        const me = getMe();
        if (!me || !me.id) return;
        await window.LocalSpotDB.sendBump(me.id, friendId, emoji, message);
    };

    window.sendWhereAreYouPing = async function (friendId) {
        const me = getMe();
        if (!me || !me.id) return;
        await window.LocalSpotDB.sendBump(me.id, friendId, "👀", "Onde andas?");
        if (typeof window.triggerBumpImpactAnimation === "function") {
            window.triggerBumpImpactAnimation("👀 Ping 'Onde andas?' enviado!", "👀");
        }
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
        const me = getMe();
        if (!me || !me.id || !window.LocalSpotDB?.isReady()) return;

        const data = await window.LocalSpotDB.fetchFriendsData(me.id);
        currentFriends = data.friends;
        incomingRequests = data.incoming;
        outgoingRequests = data.outgoing;

        // Atualizar badge de pedidos pendentes no botão Amigos
        document.querySelectorAll("button").forEach(btn => {
            if (btn.textContent.includes("Amigos")) {
                const count = incomingRequests.length;
                btn.innerHTML = count > 0
                    ? `👊 Amigos <span class="friends-req-badge">${count}</span>`
                    : `👊 Amigos`;
            }
        });

        // Mostrar amigos aceites no mapa 3D
        if (typeof window.showFriendsOnMap === "function") {
            window.showFriendsOnMap(currentFriends);
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

                    <div style="display:flex; gap:8px; margin-bottom:14px;">
                        <input type="search" id="lsSearchUsersInput" placeholder="Procurar utilizadores por nome ou e-mail...">
                        <button type="button" id="lsSearchUsersBtn" class="btn-primary-sm">Procurar</button>
                    </div>

                    <div id="lsIncomingRequestsBox" class="hidden" style="margin-bottom:14px;">
                        <h4 style="margin:0 0 8px; font-size:12.5px; color:#fda4af;">🔔 Pedidos de Amizade Recebidos</h4>
                        <div id="lsIncomingRequestsList"></div>
                    </div>

                    <div id="lsSearchResultsBox" style="margin-bottom:14px;">
                        <h4 style="margin:0 0 8px; font-size:12.5px; color:var(--primary);">🌍 Utilizadores no LocalSpot</h4>
                        <div id="lsSearchResultsList" class="muted" style="font-size:12.5px;">A carregar perfis...</div>
                    </div>

                    <h4 style="margin:0 0 8px; font-size:12.5px;">👥 Os Meus Amigos (<span id="lsFriendsCount">0</span>)</h4>
                    <div id="lsMyFriendsList"></div>
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
                const me = getMe();
                const input = document.getElementById("lsChatInput");
                if (!me || !activeChatFriend || !input.value.trim()) return;

                const text = input.value.trim();
                input.value = "";
                await window.LocalSpotDB.sendMessage(me.id, activeChatFriend.id, text);
                await renderChatHistory();
            });
        }
    }

    async function searchAndRenderProfiles(query) {
        const me = getMe();
        const listEl = document.getElementById("lsSearchResultsList");
        if (!listEl || !me) return;

        const results = await window.LocalSpotDB.searchProfiles(query, me.id);
        if (results.length === 0) {
            listEl.innerHTML = `<p class="muted" style="font-size:12px;">Nenhum utilizador encontrado.</p>`;
            return;
        }

        const friendIds = new Set(currentFriends.map(f => f.id));
        const outgoingIds = new Set(outgoingRequests.map(f => f.id));
        const incomingMap = new Map(incomingRequests.map(f => [f.id, f.friendship_id]));

        listEl.innerHTML = results.map(u => {
            let actionHtml = "";
            if (friendIds.has(u.id)) {
                actionHtml = `<span style="font-size:11.5px; color:var(--primary); font-weight:700;">✓ Amigo</span>`;
            } else if (outgoingIds.has(u.id)) {
                actionHtml = `<span style="font-size:11.5px; color:var(--muted);">⏳ Pendente</span>`;
            } else if (incomingMap.has(u.id)) {
                const reqId = incomingMap.get(u.id);
                actionHtml = `<button type="button" class="btn-primary-sm" data-accept-req="${reqId}">Aceitar</button>`;
            } else {
                actionHtml = `<button type="button" class="btn-primary-sm" data-add-friend="${u.id}">+ Adicionar</button>`;
            }

            return `
                <div class="saved-session-card" style="cursor:default;">
                    <div style="display:flex; align-items:center; gap:9px;">
                        <div class="saved-session-avatar" style="width:34px; height:34px; font-size:15px;">${window.escapeHTML(u.avatar_emoji || "😎")}</div>
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
                const targetId = btn.getAttribute("data-add-friend");
                btn.disabled = true;
                btn.textContent = "A enviar...";
                const res = await window.LocalSpotDB.sendFriendRequest(me.id, targetId);
                if (res.ok && typeof window.triggerBumpImpactAnimation === "function") {
                    window.triggerBumpImpactAnimation("📨 Pedido de amizade enviado!", "🤝");
                }
                await window.refreshFriendsSystem();
                await searchAndRenderProfiles(document.getElementById("lsSearchUsersInput")?.value || "");
            });
        });

        listEl.querySelectorAll("[data-accept-req]").forEach(btn => {
            btn.addEventListener("click", async () => {
                const reqId = btn.getAttribute("data-accept-req");
                await window.LocalSpotDB.respondFriendRequest(reqId, true);
                if (typeof window.triggerBumpImpactAnimation === "function") {
                    window.triggerBumpImpactAnimation("🎉 Novo amigo adicionado ao radar!", "👊");
                }
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
                    <div class="saved-session-card" style="cursor:default; border-color:var(--bump);">
                        <div style="display:flex; align-items:center; gap:9px;">
                            <div class="saved-session-avatar" style="width:34px; height:34px;">${window.escapeHTML(req.avatar_emoji || "😎")}</div>
                            <div>
                                <strong style="display:block; font-size:13px;">${window.escapeHTML(req.full_name)}</strong>
                                <span style="font-size:11px; color:var(--muted);">Quer conectar-se contigo</span>
                            </div>
                        </div>
                        <div style="display:flex; gap:5px;">
                            <button type="button" class="btn-primary-sm" data-inc-accept="${req.friendship_id}">✓</button>
                            <button type="button" class="btn-logout" style="padding:4px 8px;" data-inc-reject="${req.friendship_id}">✕</button>
                        </div>
                    </div>
                `).join("");

                incList.querySelectorAll("[data-inc-accept]").forEach(btn => {
                    btn.addEventListener("click", async () => {
                        await window.LocalSpotDB.respondFriendRequest(btn.getAttribute("data-inc-accept"), true);
                        window.triggerBumpImpactAnimation("👊 Amizade aceite!", "👊");
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
                        <div class="saved-session-card" style="cursor:default;">
                            <div style="display:flex; align-items:center; gap:9px;">
                                <div class="saved-session-avatar" style="width:36px; height:36px;">${window.escapeHTML(f.avatar_emoji || "😎")}</div>
                                <div>
                                    <strong style="display:block; font-size:13px;">${window.escapeHTML(f.full_name)}</strong>
                                    <span style="font-size:11px; color:var(--muted);">${window.escapeHTML(f.status_emoji || "📍")} ${window.escapeHTML(f.status_text || "Online")} · 👊 ${f.bump_count || 0}</span>
                                </div>
                            </div>
                            <div style="display:flex; gap:5px;">
                                ${hasLoc ? `<button type="button" class="btn-soft" style="padding:5px 8px; font-size:11.5px;" data-locate-friend="${f.id}" title="Ver no Mapa">📍</button>` : ""}
                                <button type="button" class="btn-soft" style="padding:5px 8px; font-size:11.5px;" data-bump-friend="${f.id}" data-bump-name="${window.escapeHTML(f.full_name.split(" ")[0])}">👊</button>
                                <button type="button" class="btn-primary-sm" data-chat-friend="${f.id}">💬</button>
                            </div>
                        </div>
                    `;
                }).join("");

                myFriendsList.querySelectorAll("[data-locate-friend]").forEach(btn => {
                    btn.addEventListener("click", () => {
                        const fid = btn.getAttribute("data-locate-friend");
                        document.getElementById("lsSocialFriendsModal")?.classList.add("hidden");
                        if (typeof window.focusFriendOnMap === "function") {
                            window.focusFriendOnMap(fid);
                        }
                    });
                });

                myFriendsList.querySelectorAll("[data-bump-friend]").forEach(btn => {
                    btn.addEventListener("click", async () => {
                        const fid = btn.getAttribute("data-bump-friend");
                        const fname = btn.getAttribute("data-bump-name");
                        window.triggerBumpImpactAnimation(`👊 Bump enviado para ${fname}!`, "👊");
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
        const me = getMe();
        const box = document.getElementById("lsChatMessagesBox");
        if (!me || !activeChatFriend || !box) return;

        const msgs = await window.LocalSpotDB.fetchMessages(me.id, activeChatFriend.id);
        if (msgs.length === 0) {
            box.innerHTML = `<p class="muted" style="text-align:center; font-size:12px; margin:auto;">Sem mensagens ainda. Diz olá! 👋</p>`;
            return;
        }

        box.innerHTML = msgs.map(m => {
            const isMine = m.sender_id === me.id;
            return `
                <div style="align-self:${isMine ? "flex-end" : "flex-start"}; max-width:78%; background:${isMine ? "var(--primary)" : "var(--surface)"}; color:${isMine ? "#04130d" : "var(--text)"}; padding:7px 11px; border-radius:12px; font-size:12.5px; font-weight:${isMine ? "600" : "400"}; border:1px solid var(--border);">
                    ${window.escapeHTML(m.content)}
                </div>
            `;
        }).join("");
        box.scrollTop = box.scrollHeight;
    }

    // ==========================================
    // 5. LIGAR AOS BOTÕES DO TOPO E REALTIME
    // ==========================================
    function setupFriendsTriggersAndRealtime() {
        ensureSocialModals();

        // Intercetar cliques nos botões "Amigos" e "Chat"
        document.addEventListener("click", async e => {
            const btn = e.target.closest("button");
            if (!btn) return;
            const txt = btn.textContent || "";

            if (txt.includes("Amigos") && !btn.closest("#lsSocialFriendsModal")) {
                e.stopImmediatePropagation();
                await window.refreshFriendsSystem();
                renderFriendsModalContent();
                document.getElementById("lsSocialFriendsModal").classList.remove("hidden");
                searchAndRenderProfiles(document.getElementById("lsSearchUsersInput")?.value || "");
            } else if (txt.includes("Chat") && !btn.closest("#lsSocialChatModal") && !btn.closest(".maplibregl-popup")) {
                e.stopImmediatePropagation();
                await window.refreshFriendsSystem();
                if (currentFriends.length > 0) {
                    window.openFriendChat(currentFriends[0].id);
                } else {
                    renderFriendsModalContent();
                    document.getElementById("lsSocialFriendsModal").classList.remove("hidden");
                    searchAndRenderProfiles("");
                }
            }
        }, true);

        // Subscrição em tempo real para amigos, bumps e mensagens
        if (window.supabaseClient) {
            window.supabaseClient
                .channel("localspot-friends-live")
                .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => {
                    window.refreshFriendsSystem();
                })
                .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
                    window.refreshFriendsSystem();
                })
                .on("postgres_changes", { event: "INSERT", schema: "public", table: "bumps" }, payload => {
                    const me = getMe();
                    if (me && payload.new?.receiver_id === me.id && typeof window.triggerBumpImpactAnimation === "function") {
                        window.triggerBumpImpactAnimation(`${payload.new.emoji || "👊"} ${payload.new.message || "Recebeste um Bump!"}`, payload.new.emoji || "👊");
                    }
                })
                .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, payload => {
                    const me = getMe();
                    if (me && activeChatFriend && (payload.new?.sender_id === activeChatFriend.id || payload.new?.receiver_id === activeChatFriend.id)) {
                        renderChatHistory();
                    }
                })
                .subscribe();
        }

        setTimeout(() => window.refreshFriendsSystem(), 600);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupFriendsTriggersAndRealtime);
    } else {
        setupFriendsTriggersAndRealtime();
    }
})();
