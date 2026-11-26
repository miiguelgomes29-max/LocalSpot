// ==========================================
// LOCALSPOT — CHAT, AMIGOS & LISTA DE UTILIZADORES (v4)
// ==========================================

(function () {
    let currentFriends = [];
    let incomingRequests = [];
    let outgoingRequests = [];
    let allRegisteredUsers = [];
    let activeTab = "add"; // "chats" | "friends" | "add"
    let activeChatFriend = null;
    const friendMapMarkers = new Map();
    const mapFocusFriendOriginal = typeof window.focusFriendOnMap === "function" ? window.focusFriendOnMap : null;

    // Garante que o utilizador atual está gravado na tabela "profiles" com UUID real
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
                if (addEvBtn) nav.insertBefore(btn, addEvBtn);
                else nav.appendChild(btn);
            }
        }
    }

    // ==========================================
    // 1. LOCALIZAÇÃO AO VIVO & PINS NO MAPA
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
        if (mapFocusFriendOriginal && mapFocusFriendOriginal(friendId)) return true;
        const friend = currentFriends.find(f => String(f.id) === String(friendId));
        if (!friend || typeof friend.last_lat !== "number" || typeof friend.last_lng !== "number") return false;
        if (window.map) {
            window.map.flyTo({ center: [friend.last_lng, friend.last_lat], zoom: 16, duration: 900 });
            friendMapMarkers.get(String(friend.id))?.togglePopup();
            return true;
        }
        return false;
    };

    // ==========================================
    // 2. BUMPS & CHAT
    // ==========================================
    window.sendBump = async function (friendId, emoji = "👊", message = "Bump!") {
        const me = await ensureSyncedMe();
        if (!me) return;
        const senderFirst = (me.full_name || "Alguém").split(" ")[0];
        await window.LocalSpotDB.sendBump(me.id, friendId, emoji, `${senderFirst}: ${message}`);
        window.triggerBumpImpactAnimation?.(`${emoji} Bump enviado!`, emoji);
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
    // 3. SINCRONIZAR AMIGOS & UTILIZADORES REGISTADOS
    // ==========================================
    window.refreshFriendsSystem = async function () {
        ensureFriendsHeaderButton();
        const me = await ensureSyncedMe();
        if (!window.LocalSpotDB?.isReady()) return;

        if (me && window.LocalSpotDB.isValidUUID(me.id)) {
            const data = await window.LocalSpotDB.fetchFriendsData(me.id);
            currentFriends = data.friends;
            incomingRequests = data.incoming;
            outgoingRequests = data.outgoing;
        }

        const { profiles, error } = await window.LocalSpotDB.fetchAllProfiles(me?.id);
        if (!error) {
            allRegisteredUsers = (profiles || []).filter(u => !me || String(u.id) !== String(me.id));
        }

        const headerBtn = document.getElementById("lsHeaderFriendsBtn");
        if (headerBtn) {
            const count = incomingRequests.length;
            headerBtn.innerHTML = count > 0
                ? `👊 Amigos <span class="friends-req-badge">${count}</span>`
                : `👊 Amigos`;
        }

        const tabFriends = document.getElementById("lsTabFriendsCount");
        const tabAdd = document.getElementById("lsTabAddCount");
        if (tabFriends) tabFriends.textContent = String(currentFriends.length);
        if (tabAdd) tabAdd.textContent = String(allRegisteredUsers.length);

        if (typeof window.showFriendsOnMap === "function") {
            window.showFriendsOnMap(currentFriends);
        } else {
            renderFriendsOnMapFallback(currentFriends);
        }

        const modal = document.getElementById("lsSocialFriendsModal");
        if (modal && !modal.classList.contains("hidden")) {
            renderActiveTabContent(error);
        }
    };

    // ==========================================
    // 4. MODAL CHAT & AMIGOS (3 ABAS + LISTA AUTOMÁTICA)
    // ==========================================
    function ensureSocialModals() {
        if (!document.getElementById("lsSocialFriendsModal")) {
            const fModal = document.createElement("div");
            fModal.id = "lsSocialFriendsModal";
            fModal.className = "modal hidden";
            fModal.innerHTML = `
                <div class="modal-content" style="max-width:500px;">
                    <button type="button" id="closeLsFriendsModal" class="close-button">&times;</button>
                    <div style="display:flex; align-items:center; justify-content:space-between; padding-right:34px; margin-bottom:4px;">
                        <h2 style="margin:0; font-size:20px;">💬 Chat & Amigos</h2>
                        <button type="button" id="lsRefreshUsersBtn" class="btn-soft" style="padding:4px 10px; font-size:11.5px;">🔄 Atualizar</button>
                    </div>
                    <p class="muted" style="font-size:12.5px; margin:0 0 14px;">Conversa em tempo real, adiciona utilizadores registados e faz Bumps! ⚡</p>

                    <div id="lsFriendsFeedback" class="hidden" style="background:rgba(244,63,94,0.15); border:1px solid rgba(244,63,94,0.4); color:#fda4af; padding:8px 10px; border-radius:10px; font-size:12px; margin-bottom:10px;"></div>

                    <div class="auth-tabs three-cols" style="margin-bottom:14px;">
                        <button type="button" class="auth-tab" data-ls-tab="chats">💬 Conversas</button>
                        <button type="button" class="auth-tab" data-ls-tab="friends">👥 Amigos (<span id="lsTabFriendsCount">0</span>)</button>
                        <button type="button" class="auth-tab active" data-ls-tab="add">🔍 Adicionar (<span id="lsTabAddCount">0</span>)</button>
                    </div>

                    <!-- ABA 1: CONVERSAS -->
                    <div id="lsPaneChats" class="hidden">
                        <div id="lsChatsList" style="display:flex; flex-direction:column; gap:8px;"></div>
                    </div>

                    <!-- ABA 2: AMIGOS -->
                    <div id="lsPaneFriends" class="hidden">
                        <div id="lsMyFriendsList" style="display:flex; flex-direction:column; gap:8px;"></div>
                    </div>

                    <!-- ABA 3: ADICIONAR (LISTA COMPLETA AUTOMÁTICA + PESQUISA) -->
                    <div id="lsPaneAdd">
                        <label for="lsSearchUsersInput">Procurar utilizadores ou entidades</label>
                        <div style="display:flex; gap:8px; margin-bottom:12px;">
                            <input type="search" id="lsSearchUsersInput" placeholder="Filtrar por nome ou e-mail...">
                            <button type="button" id="lsSearchUsersBtn" class="btn-primary-sm">Procurar</button>
                        </div>

                        <div id="lsIncomingRequestsBox" class="hidden" style="margin-bottom:14px;">
                            <h4 style="margin:0 0 8px; font-size:12px; color:#fda4af;">🔔 Pedidos de Amizade Recebidos</h4>
                            <div id="lsIncomingRequestsList" style="display:flex; flex-direction:column; gap:8px;"></div>
                        </div>

                        <h4 style="margin:0 0 8px; font-size:12px; color:var(--primary);">🌍 Todos os Utilizadores Registados</h4>
                        <div id="lsSearchResultsList" style="display:flex; flex-direction:column; gap:8px; max-height:290px; overflow-y:auto;">
                            <p class="muted" style="font-size:12px;">A carregar utilizadores...</p>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(fModal);

            document.getElementById("closeLsFriendsModal").addEventListener("click", () => {
                fModal.classList.add("hidden");
            });

            document.getElementById("lsRefreshUsersBtn").addEventListener("click", async () => {
                await window.refreshFriendsSystem();
            });

            fModal.querySelectorAll("[data-ls-tab]").forEach(tabBtn => {
                tabBtn.addEventListener("click", () => {
                    switchSocialTab(tabBtn.getAttribute("data-ls-tab"));
                });
            });

            const searchInput = document.getElementById("lsSearchUsersInput");
            document.getElementById("lsSearchUsersBtn").addEventListener("click", () => renderAddTabList());
            searchInput.addEventListener("input", () => renderAddTabList());
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

    function switchSocialTab(tabName) {
        activeTab = tabName;
        const modal = document.getElementById("lsSocialFriendsModal");
        if (!modal) return;

        modal.querySelectorAll("[data-ls-tab]").forEach(btn => {
            btn.classList.toggle("active", btn.getAttribute("data-ls-tab") === tabName);
        });

        document.getElementById("lsPaneChats")?.classList.toggle("hidden", tabName !== "chats");
        document.getElementById("lsPaneFriends")?.classList.toggle("hidden", tabName !== "friends");
        document.getElementById("lsPaneAdd")?.classList.toggle("hidden", tabName !== "add");

        renderActiveTabContent();
    }

    function renderActiveTabContent(dbError = null) {
        renderAddTabList(dbError);
        renderFriendsTabList();
        renderChatsTabList();
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

    async function renderAddTabList(dbError = null) {
        const me = await ensureSyncedMe();
        const listEl = document.getElementById("lsSearchResultsList");
        const incBox = document.getElementById("lsIncomingRequestsBox");
        const incList = document.getElementById("lsIncomingRequestsList");
        if (!listEl) return;

        // Pedidos recebidos
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
                                <span style="font-size:11px; color:var(--muted);">Quer ser teu amigo</span>
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

        if (dbError) {
            listEl.innerHTML = `<p style="color:#fda4af; font-size:12px;">Erro ao carregar utilizadores: ${window.escapeHTML(dbError)}</p>`;
            return;
        }

        const q = (document.getElementById("lsSearchUsersInput")?.value || "").trim().toLowerCase();
        const filtered = allRegisteredUsers.filter(u => {
            if (!q) return true;
            return `${u.full_name || ""} ${u.email || ""} ${u.business_type || ""}`.toLowerCase().includes(q);
        });

        if (filtered.length === 0) {
            listEl.innerHTML = `<p class="muted" style="font-size:12.5px; padding:8px 0;">Ainda não existem outros utilizadores registados na base de dados.</p>`;
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
                actionHtml = `<span style="font-size:11.5px; color:var(--muted);">⏳ Pedido enviado</span>`;
            } else if (incomingMap.has(uid)) {
                const reqId = incomingMap.get(uid);
                actionHtml = `<button type="button" class="btn-primary-sm" data-accept-req="${reqId}">Aceitar</button>`;
            } else {
                actionHtml = `<button type="button" class="btn-primary-sm" data-add-friend="${uid}">+ Adicionar</button>`;
            }

            const roleBadge = u.role === "business" ? "🏛️ " : "";

            return `
                <div style="display:flex; align-items:center; justify-content:space-between; background:var(--surface-2); border:1px solid var(--border); padding:9px 12px; border-radius:12px;">
                    <div style="display:flex; align-items:center; gap:9px;">
                        <div class="avatar-circle" style="width:36px; height:36px; font-size:17px;">${window.escapeHTML(u.avatar_emoji || "😎")}</div>
                        <div>
                            <strong style="display:block; font-size:13px;">${roleBadge}${window.escapeHTML(u.full_name)}</strong>
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
                    showModalFeedback("Clica em 'Sair' no topo e volta a entrar para ativar a tua conta na base de dados.");
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
            });
        });

        listEl.querySelectorAll("[data-accept-req]").forEach(btn => {
            btn.addEventListener("click", async () => {
                await window.LocalSpotDB.respondFriendRequest(btn.getAttribute("data-accept-req"), true);
                window.triggerBumpImpactAnimation?.("🎉 Novo amigo adicionado!", "👊");
                await window.refreshFriendsSystem();
            });
        });
    }

    function renderFriendsTabList() {
        const myFriendsList = document.getElementById("lsMyFriendsList");
        if (!myFriendsList) return;

        if (currentFriends.length === 0) {
            myFriendsList.innerHTML = `<p class="muted" style="font-size:12.5px;">Ainda não tens amigos adicionados. Vai à aba <strong>Adicionar</strong> para conectar-te!</p>`;
            return;
        }

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
                await window.sendBump(btn.getAttribute("data-bump-friend"), "👊", "Bump!");
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

    function renderChatsTabList() {
        const chatsList = document.getElementById("lsChatsList");
        if (!chatsList) return;

        if (currentFriends.length === 0) {
            chatsList.innerHTML = `<p class="muted" style="font-size:12.5px;">Adiciona amigos primeiro para conversares em tempo real.</p>`;
            return;
        }

        chatsList.innerHTML = currentFriends.map(f => `
            <div data-open-chat-row="${f.id}" style="display:flex; align-items:center; justify-content:space-between; background:var(--surface-2); border:1px solid var(--border); padding:10px 12px; border-radius:12px; cursor:pointer;">
                <div style="display:flex; align-items:center; gap:9px;">
                    <div class="avatar-circle" style="width:36px; height:36px;">${window.escapeHTML(f.avatar_emoji || "😎")}</div>
                    <div>
                        <strong style="display:block; font-size:13px;">${window.escapeHTML(f.full_name)}</strong>
                        <span style="font-size:11px; color:var(--muted);">Toca para abrir o chat</span>
                    </div>
                </div>
                <span style="color:var(--primary); font-weight:700; font-size:12px;">💬 Abrir</span>
            </div>
        `).join("");

        chatsList.querySelectorAll("[data-open-chat-row]").forEach(row => {
            row.addEventListener("click", () => {
                const fid = row.getAttribute("data-open-chat-row");
                document.getElementById("lsSocialFriendsModal")?.classList.add("hidden");
                window.openFriendChat(fid);
            });
        });
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
    // 5. EVENTOS, GPS & REALTIME
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
                document.getElementById("lsSocialFriendsModal").classList.remove("hidden");
                switchSocialTab(incomingRequests.length > 0 ? "add" : "add");
                await window.refreshFriendsSystem();
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
                .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => window.refreshFriendsSystem())
                .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => window.refreshFriendsSystem())
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

        setTimeout(() => window.refreshFriendsSystem(), 700);
        setInterval(() => window.refreshFriendsSystem(), 12000);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupFriendsSystem);
    } else {
        setupFriendsSystem();
    }
})();
