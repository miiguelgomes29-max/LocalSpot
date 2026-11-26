// ==========================================================================
// MÓDULO 3: ORQUESTRADOR PRINCIPAL, MAPA 3D, RADAR SOCIAL BUMP, CHAT & ADMIN
// ==========================================================================
(function () {
    "use strict";

    const LS = window.LocalSpot = window.LocalSpot || {};
    const $ = LS.$;

    window.friendsList = [];
    LS.friendshipRecords = new Map();
    LS.incomingFriendRequests = [];
    LS.sentFriendRequestIds = new Set();
    LS.lastChatMessageByFriend = new Map();
    LS.activeChatFriendId = null;
    LS.unreadMessagesBySender = new Map();
    LS.onlineUserIds = new Set();
    LS.myFollowersList = [];
    LS.notifications = [];

    let locationSyncInterval = null;
    let geoWatchId = null;
    let realtimeChannel = null;
    let bumpBroadcastChannel = null;
    let typingTimer = null;
    let lastShakeTime = 0;
    let shakeSensorBound = false;
    let trailVisible = false;

    let explorationData = LS.loadJSON(LS.STORAGE_EXPLORATION, {
        date: new Date().toISOString().slice(0, 10),
        zones: [],
        trail: [],
        distanceKm: 0
    });

    window.isFriendLiveOnline = friendId => LS.onlineUserIds.has(String(friendId));

    window.getFriendshipTier = (bumpCount = 0) => {
        if (bumpCount >= 30) return { badge: "👑 BFF / Alma Gémea", next: 50, pct: 100 };
        if (bumpCount >= 15) return { badge: "🔥 Melhores Amigos", next: 30, pct: Math.round(((bumpCount - 15) / 15) * 100) };
        if (bumpCount >= 5) return { badge: "⚡ Bons Amigos", next: 15, pct: Math.round(((bumpCount - 5) / 10) * 100) };
        return { badge: "🌱 Novos Amigos", next: 5, pct: Math.round((bumpCount / 5) * 100) };
    };

    window.getMapSocialEntities = () => {
        const followedVisibleEntities = (LS.myFollowingProfiles || []).filter(e =>
            e.role === "business" &&
            !e.ghost_mode &&
            e.privacy_mode !== "ghost" &&
            typeof e.last_lat === "number" &&
            typeof e.last_lng === "number"
        );
        return [...window.friendsList, ...followedVisibleEntities];
    };

    // ----------------------------------------------------------------------
    // SONS E ANIMAÇÕES BUMP
    // ----------------------------------------------------------------------
    function playBumpSound(isSuper = false) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = isSuper ? "triangle" : "sine";
            osc.frequency.setValueAtTime(isSuper ? 220 : 150, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(isSuper ? 680 : 45, ctx.currentTime + (isSuper ? 0.35 : 0.2));
            gain.gain.setValueAtTime(0.35, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (isSuper ? 0.38 : 0.22));
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + (isSuper ? 0.4 : 0.25));
        } catch (e) {}
    }

    function triggerBumpVisual(emoji = "👊", text = "BUMP!", isSuper = false) {
        if (navigator.vibrate) {
            try { navigator.vibrate(isSuper ? [150, 60, 150, 60, 280] : [100, 50, 140]); } catch (e) {}
        }
        playBumpSound(isSuper);

        const existing = document.querySelector(".bump-impact-overlay");
        if (existing) existing.remove();

        const overlay = document.createElement("div");
        overlay.className = "bump-impact-overlay";
        overlay.innerHTML = `
            <div class="bump-impact-ring"></div>
            <div class="bump-impact-ring r2"></div>
            <div class="bump-impact-emoji">${isSuper ? "⚡" : emoji}</div>
            <div class="bump-impact-label">${escapeHTML(text)}</div>
        `;
        document.body.appendChild(overlay);
        setTimeout(() => overlay.remove(), isSuper ? 2100 : 1700);
    }

    // ----------------------------------------------------------------------
    // EXPLORAÇÃO & PERCURSO
    // ----------------------------------------------------------------------
    LS.updateExplorationPill = () => {
        const btn = $("explorationMapBtn");
        if (!btn) return;
        const zonesCount = (explorationData.zones || []).length;
        const kmStr = Number(explorationData.distanceKm || 0).toFixed(1).replace(".", ",");
        btn.textContent = `🗺️ ${zonesCount} zonas · ${kmStr} km`;
        btn.classList.toggle("active", trailVisible);
    };

    window.recordExplorationPoint = (lat, lng) => {
        if (typeof lat !== "number" || typeof lng !== "number") return;
        const zoneKey = `${lat.toFixed(3)}_${lng.toFixed(3)}`;
        if (!explorationData.zones.includes(zoneKey)) explorationData.zones.push(zoneKey);
        LS.saveJSON(LS.STORAGE_EXPLORATION, explorationData);
        LS.updateExplorationPill();
    };

    // ----------------------------------------------------------------------
    // INJEÇÃO DA INTERFACE SOCIAL, PERFIL AVANÇADO & MODAIS DE CHAT/AMIGOS
    // ----------------------------------------------------------------------
    function ensureSocialUI() {
        const nav = document.querySelector(".header nav");

        if (nav && !$("friendsNavBtn")) {
            const friendsBtn = document.createElement("button");
            friendsBtn.type = "button";
            friendsBtn.id = "friendsNavBtn";
            friendsBtn.className = "btn-friends-nav hidden";
            friendsBtn.innerHTML = `👊 Amigos <span id="friendsReqBadge" class="friends-req-badge hidden">0</span>`;
            const notifBtn = $("notifBtn");
            if (notifBtn && notifBtn.parentElement === nav) nav.insertBefore(friendsBtn, notifBtn);
            else nav.appendChild(friendsBtn);
        }

        if (nav && !$("directChatsNavBtn")) {
            const chatHeaderBtn = document.createElement("button");
            chatHeaderBtn.type = "button";
            chatHeaderBtn.id = "directChatsNavBtn";
            chatHeaderBtn.className = "btn-chat-nav hidden";
            chatHeaderBtn.innerHTML = `💬 Chat <span id="headerChatUnreadBadge" class="friends-req-badge hidden">0</span>`;
            const notifBtn = $("notifBtn");
            if (notifBtn && notifBtn.parentElement === nav) nav.insertBefore(chatHeaderBtn, notifBtn);
            else nav.appendChild(chatHeaderBtn);
        }

        const mapCtrls = document.querySelector(".map-floating-controls");
        if (mapCtrls && !$("privacyMapBtn")) {
            const bumpRadarBtn = document.createElement("button");
            bumpRadarBtn.type = "button";
            bumpRadarBtn.id = "bumpShakeMapBtn";
            bumpRadarBtn.className = "map-ctrl-btn hidden";
            bumpRadarBtn.textContent = "👊 Bump!";
            mapCtrls.appendChild(bumpRadarBtn);

            const quickMoodBtn = document.createElement("button");
            quickMoodBtn.type = "button";
            quickMoodBtn.id = "quickMoodMapBtn";
            quickMoodBtn.className = "map-ctrl-btn hidden";
            quickMoodBtn.textContent = "📍 Vibe";
            mapCtrls.appendChild(quickMoodBtn);

            const privacyBtn = document.createElement("button");
            privacyBtn.type = "button";
            privacyBtn.id = "privacyMapBtn";
            privacyBtn.className = "map-ctrl-btn hidden";
            privacyBtn.textContent = "📍 Precisa";
            mapCtrls.appendChild(privacyBtn);
        }

        const mapContainer = document.querySelector(".map-container");
        if (mapContainer && !$("quickMoodPopover")) {
            const moodPopover = document.createElement("div");
            moodPopover.id = "quickMoodPopover";
            moodPopover.className = "quick-mood-popover hidden";
            moodPopover.innerHTML = `
                <h4>
                    <span>✨ O que estás a fazer?</span>
                    <button type="button" id="closeQuickMoodBtn" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:15px;">&times;</button>
                </h4>
                <div class="quick-mood-grid">
                    ${LS.BUMP_STATUSES.map(s => `
                        <button type="button" class="quick-mood-item" data-emoji="${s.emoji}" data-text="${s.text}">
                            ${s.emoji} ${s.text}
                        </button>
                    `).join("")}
                </div>
            `;
            mapContainer.appendChild(moodPopover);
        }

        // Injeta opções avançadas no Modal de Perfil
        const profileForm = $("profileUpdateForm");
        if (profileForm && !$("profileAvatarBox")) {
            const avatarSection = document.createElement("div");
            avatarSection.id = "profileAvatarBox";
            avatarSection.style.marginBottom = "12px";
            avatarSection.innerHTML = `
                <div style="display:flex; align-items:center; gap:14px; margin-bottom:12px;">
                    <div id="profileAvatarPreview" class="avatar-circle lg">?</div>
                    <div style="flex:1;">
                        <label for="profileAvatarInput" style="margin:0 0 6px;">Foto de Perfil</label>
                        <input type="file" id="profileAvatarInput" accept="image/*" style="padding:6px; font-size:12px;">
                    </div>
                </div>

                <div id="businessOnlyProfileFields" class="hidden">
                    <label for="profileBusinessTypeSelect">Setor / Tipologia da Entidade</label>
                    <select id="profileBusinessTypeSelect" style="margin-bottom:12px;">
                        ${LS.BUSINESS_SECTORS.map(s => `<option value="${escapeHTML(s.label)}">${s.emoji} ${escapeHTML(s.label)}</option>`).join("")}
                    </select>
                    <label>Visibilidade da Sede no Mapa</label>
                    <div id="businessPrivacyGrid" class="privacy-selector-grid">
                        <button type="button" class="privacy-opt-btn business-opt" data-mode="precise">🏢 Sede Visível</button>
                        <button type="button" class="privacy-opt-btn business-opt" data-mode="ghost">📅 Apenas Eventos</button>
                    </div>
                </div>

                <div id="userOnlyProfileFields">
                    <label for="profileBirthDateInput">Data de Nascimento</label>
                    <input type="date" id="profileBirthDateInput" style="margin-bottom:10px;">
                    <label>Estado / Vibe atual</label>
                    <div id="statusPillsContainer" class="status-pills-grid" style="margin-bottom:8px;">
                        ${LS.BUMP_STATUSES.map(s => `
                            <button type="button" class="status-pill-btn" data-emoji="${s.emoji}" data-text="${s.text}">${s.emoji} ${s.text}</button>
                        `).join("")}
                    </div>
                    <div style="display:grid; grid-template-columns: 64px 1fr; gap:8px; margin-bottom:12px;">
                        <input type="text" id="profileCustomEmoji" maxlength="4" placeholder="📍" style="text-align:center;">
                        <input type="text" id="profileCustomStatus" maxlength="40" placeholder="Estado personalizado...">
                    </div>
                    <label>Privacidade da localização no mapa</label>
                    <div id="privacySelectorGrid" class="privacy-selector-grid">
                        <button type="button" class="privacy-opt-btn" data-mode="precise">📍 Precisa</button>
                        <button type="button" class="privacy-opt-btn" data-mode="blurred">🌫️ Borrão (~400m)</button>
                        <button type="button" class="privacy-opt-btn" data-mode="ghost">👻 Fantasma</button>
                    </div>
                </div>
            `;
            profileForm.insertBefore(avatarSection, profileForm.firstChild);
        }

        const tabFollowing = $("tabMyFollowing");
        if (tabFollowing && !$("tabMyFriends")) {
            const friendsTab = document.createElement("button");
            friendsTab.type = "button";
            friendsTab.id = "tabMyFriends";
            friendsTab.className = "auth-tab";
            friendsTab.textContent = "Amigos";
            tabFollowing.parentElement.insertBefore(friendsTab, tabFollowing);

            const friendsPanel = document.createElement("div");
            friendsPanel.id = "profileFriendsList";
            friendsPanel.className = "profile-events-list hidden";
            $("profileFollowingList")?.parentElement.insertBefore(friendsPanel, $("profileFollowingList"));
        }

        // Modal Unificado de Chat & Amigos
        if (!$("friendsModal")) {
            const fModal = document.createElement("div");
            fModal.id = "friendsModal";
            fModal.className = "modal hidden";
            fModal.setAttribute("aria-hidden", "true");
            fModal.innerHTML = `
                <div class="modal-content">
                    <button type="button" id="closeFriendsModal" class="close-button" aria-label="Fechar">&times;</button>
                    <h2 style="margin:0 0 4px;">💬 Chat & Amigos</h2>
                    <p style="color:var(--muted); font-size:13px; margin:0 0 14px;">Conversa em tempo real, adiciona amigos e faz Bumps! ⚡</p>

                    <div class="auth-tabs three-cols" style="margin-bottom:14px;">
                        <button type="button" id="tabFriendsChats" class="auth-tab active">💬 Conversas <span id="chatsTabUnreadBadge" class="friends-req-badge hidden">0</span></button>
                        <button type="button" id="tabFriendsList" class="auth-tab">👥 Amigos (<span id="friendsTabCount">0</span>)</button>
                        <button type="button" id="tabFriendsAdd" class="auth-tab">🔍 Adicionar (<span id="requestsTabCount">0</span>)</button>
                    </div>

                    <div id="panelFriendsChats"><div id="chatsListContainer"></div></div>
                    <div id="panelFriendsList" class="hidden"><div id="friendsContainerList"></div></div>
                    <div id="panelFriendsAdd" class="hidden">
                        <div id="incomingRequestsSection" style="margin-bottom:16px;"></div>
                        <label for="friendSearchInput">Procurar utilizadores ou entidades</label>
                        <div style="display:flex; gap:8px; margin-bottom:12px;">
                            <input type="text" id="friendSearchInput" placeholder="Nome ou e-mail...">
                            <button type="button" id="friendSearchBtn" class="btn-primary-sm">Procurar</button>
                        </div>
                        <div id="friendSearchResults"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(fModal);
        }

        // Modal de Chat Direto
        if (!$("friendChatModal")) {
            const chatModal = document.createElement("div");
            chatModal.id = "friendChatModal";
            chatModal.className = "modal hidden";
            chatModal.setAttribute("aria-hidden", "true");
            chatModal.innerHTML = `
                <div class="modal-content" style="width:450px;">
                    <button type="button" id="closeFriendChatModal" class="close-button" aria-label="Fechar">&times;</button>
                    <div id="chatFriendHeader" style="display:flex; align-items:center; gap:10px; margin-bottom:10px;"></div>
                    <div id="chatMessagesBox" class="chat-messages-box" style="min-height:220px; max-height:320px; overflow-y:auto; margin-bottom:10px;"></div>
                    <form id="friendChatForm" style="display:flex; gap:8px;">
                        <input type="text" id="friendChatInput" placeholder="Escreve uma mensagem..." required autocomplete="off">
                        <button type="submit" class="btn-primary-sm">Enviar</button>
                    </form>
                </div>
            `;
            document.body.appendChild(chatModal);
        }

        bindSocialAndProfileOptionEvents();
    }

    function bindSocialAndProfileOptionEvents() {
        const friendsModal = $("friendsModal");

        const switchFriendsTab = activeId => {
            ["tabFriendsChats", "tabFriendsList", "tabFriendsAdd"].forEach(id => $(id)?.classList.toggle("active", id === activeId));
            $("panelFriendsChats")?.classList.toggle("hidden", activeId !== "tabFriendsChats");
            $("panelFriendsList")?.classList.toggle("hidden", activeId !== "tabFriendsList");
            $("panelFriendsAdd")?.classList.toggle("hidden", activeId !== "tabFriendsAdd");
        };

        const openFriendsDrawer = async tabId => {
            LS.openModal(friendsModal);
            switchFriendsTab(tabId);
            await LS.loadSocialData();
        };

        $("friendsNavBtn")?.addEventListener("click", () => openFriendsDrawer("tabFriendsList"));
        $("lsHeaderFriendsBtn")?.addEventListener("click", () => openFriendsDrawer("tabFriendsList"));
        $("directChatsNavBtn")?.addEventListener("click", () => openFriendsDrawer("tabFriendsChats"));
        $("closeFriendsModal")?.addEventListener("click", () => LS.closeModalEl(friendsModal));
        friendsModal?.addEventListener("mousedown", e => { if (e.target === friendsModal) LS.closeModalEl(friendsModal); });

        $("tabFriendsList")?.addEventListener("click", () => switchFriendsTab("tabFriendsList"));
        $("tabFriendsChats")?.addEventListener("click", () => switchFriendsTab("tabFriendsChats"));
        $("tabFriendsAdd")?.addEventListener("click", () => switchFriendsTab("tabFriendsAdd"));

        $("friendSearchBtn")?.addEventListener("click", searchUsersAndEntities);
        $("friendSearchInput")?.addEventListener("keydown", e => {
            if (e.key === "Enter") { e.preventDefault(); searchUsersAndEntities(); }
        });

        $("closeFriendChatModal")?.addEventListener("click", () => {
            LS.activeChatFriendId = null;
            LS.closeModalEl($("friendChatModal"));
        });

        $("friendChatForm")?.addEventListener("submit", async e => {
            e.preventDefault();
            if (!LS.activeChatFriendId) return;
            const input = $("friendChatInput");
            const text = input.value.trim();
            if (!text) return;
            input.value = "";
            await sendDirectMessage(LS.activeChatFriendId, text);
        });

        $("bumpShakeMapBtn")?.addEventListener("click", () => {
            if (!window.friendsList.length) {
                LS.showToast("Adiciona primeiro um amigo para fazer Bump! 👊");
                openFriendsDrawer("tabFriendsAdd");
                return;
            }
            window.sendBump(window.friendsList[0].id, "👊", "Bump!");
        });

        $("quickMoodMapBtn")?.addEventListener("click", e => {
            e.stopPropagation();
            $("quickMoodPopover")?.classList.toggle("hidden");
        });
        $("closeQuickMoodBtn")?.addEventListener("click", () => $("quickMoodPopover")?.classList.add("hidden"));
        $("quickMoodPopover")?.addEventListener("click", async e => {
            const item = e.target.closest(".quick-mood-item");
            if (!item || !LS.currentUser || !LS.currentProfile) return;
            $("quickMoodPopover").classList.add("hidden");
            LS.currentProfile.status_emoji = item.dataset.emoji;
            LS.currentProfile.status_text = item.dataset.text;
            LS.saveDeviceSession(LS.currentProfile);
            LS.applyRoleUI();
            if (!LS.currentUser.isLocalFallback) {
                await window.supabaseClient.from("profiles").update({
                    status_emoji: item.dataset.emoji,
                    status_text: item.dataset.text
                }).eq("id", LS.currentUser.id);
            }
            LS.showToast(`Estado atualizado: ${item.dataset.emoji} ${item.dataset.text}`, "success");
        });

        $("privacyMapBtn")?.addEventListener("click", async () => {
            if (!LS.currentUser || !LS.currentProfile) return;
            const order = LS.isBusinessAccount() ? ["precise", "ghost"] : ["precise", "blurred", "ghost"];
            const cur = LS.currentProfile.privacy_mode || "precise";
            const next = order[(order.indexOf(cur) + 1) % order.length];
            LS.currentProfile.privacy_mode = next;
            LS.currentProfile.ghost_mode = next === "ghost";
            LS.selectedProfilePrivacy = next;
            LS.saveDeviceSession(LS.currentProfile);
            LS.applyRoleUI();

            if (!LS.currentUser.isLocalFallback) {
                await window.supabaseClient.from("profiles").update({
                    privacy_mode: next,
                    ghost_mode: next === "ghost"
                }).eq("id", LS.currentUser.id);
            }
            LS.showToast(next === "precise" ? "📍 Localização Precisa" : (next === "blurred" ? "🌫️ Modo Borrão" : "👻 Modo Fantasma"));
        });

        // Seleção de opções dentro do Modal de Perfil
        $("statusPillsContainer")?.addEventListener("click", e => {
            const btn = e.target.closest(".status-pill-btn");
            if (!btn) return;
            $("statusPillsContainer").querySelectorAll(".status-pill-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            if ($("profileCustomEmoji")) $("profileCustomEmoji").value = btn.dataset.emoji;
            if ($("profileCustomStatus")) $("profileCustomStatus").value = btn.dataset.text;
        });

        $("privacySelectorGrid")?.addEventListener("click", e => {
            const btn = e.target.closest(".privacy-opt-btn");
            if (!btn) return;
            $("privacySelectorGrid").querySelectorAll(".privacy-opt-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            LS.selectedProfilePrivacy = btn.dataset.mode;
        });

        $("businessPrivacyGrid")?.addEventListener("click", e => {
            const btn = e.target.closest(".privacy-opt-btn");
            if (!btn) return;
            $("businessPrivacyGrid").querySelectorAll(".privacy-opt-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            LS.selectedProfilePrivacy = btn.dataset.mode;
        });

        $("profileAvatarInput")?.addEventListener("change", () => {
            const file = $("profileAvatarInput").files?.[0];
            if (!file) return;
            $("profileAvatarPreview").innerHTML = `<img src="${URL.createObjectURL(file)}" alt="">`;
        });

        $("tabMyFriends")?.addEventListener("click", () => LS.switchProfileTab("tabMyFriends", "profileFriendsList"));
    }

    // ----------------------------------------------------------------------
    // AMIGOS, BUMPS E CHAT DIRETO
    // ----------------------------------------------------------------------
    LS.loadSocialData = async () => {
        if (!LS.currentUser || LS.currentUser.isLocalFallback) {
            renderFriendsModalContent();
            return;
        }
        try {
            const { data: rows, error } = await window.supabaseClient
                .from("friendships")
                .select("*")
                .or(`requester_id.eq.${LS.currentUser.id},addressee_id.eq.${LS.currentUser.id}`);

            if (error || !rows) return;

            const acceptedIds = new Set();
            const incomingRows = [];
            LS.sentFriendRequestIds = new Set();
            LS.friendshipRecords = new Map();

            rows.forEach(r => {
                if (r.status === "accepted") {
                    const otherId = r.requester_id === LS.currentUser.id ? r.addressee_id : r.requester_id;
                    acceptedIds.add(otherId);
                    LS.friendshipRecords.set(String(otherId), r);
                } else if (r.status === "pending") {
                    if (r.addressee_id === LS.currentUser.id) incomingRows.push(r);
                    else LS.sentFriendRequestIds.add(r.addressee_id);
                }
            });

            const allIds = [...new Set([...acceptedIds, ...incomingRows.map(r => r.requester_id)])];
            let profilesById = new Map();
            if (allIds.length > 0) {
                const { data: profs } = await window.supabaseClient.from("profiles").select("*").in("id", allIds);
                if (profs) profilesById = new Map(profs.map(p => [p.id, p]));
            }

            window.friendsList = [...acceptedIds]
                .map(id => {
                    const prof = profilesById.get(id);
                    if (!prof) return null;
                    const fRow = LS.friendshipRecords.get(String(id));
                    return { ...prof, bump_count: fRow?.bump_count || 0 };
                })
                .filter(Boolean);

            LS.incomingFriendRequests = incomingRows
                .map(r => {
                    const prof = profilesById.get(r.requester_id);
                    return prof ? { friendshipId: r.id, user: prof } : null;
                })
                .filter(Boolean);

            updateSocialBadges();
            renderFriendsModalContent();
            try {
                if (typeof showFriendsOnMap === "function") showFriendsOnMap(window.getMapSocialEntities());
            } catch (e) {}
        } catch (e) {}
    };

    function updateSocialBadges() {
        const reqCount = LS.incomingFriendRequests.length;
        const badge = $("friendsReqBadge");
        if (badge) {
            badge.textContent = reqCount;
            badge.classList.toggle("hidden", reqCount === 0);
        }
        if ($("friendsTabCount")) $("friendsTabCount").textContent = window.friendsList.length;
        if ($("requestsTabCount")) $("requestsTabCount").textContent = reqCount;
    }

    function renderFriendsModalContent() {
        const container = $("friendsContainerList");
        const reqContainer = $("incomingRequestsSection");
        const chatsContainer = $("chatsListContainer");
        if (!container) return;

        if (reqContainer) {
            reqContainer.innerHTML = LS.incomingFriendRequests.length
                ? `<h4 style="margin:0 0 8px; font-size:13.5px; color:var(--bump);">🔔 Pedidos de Amizade (${LS.incomingFriendRequests.length})</h4>` +
                  LS.incomingFriendRequests.map(req => `
                    <div class="friend-row">
                        <div class="friend-row-left">
                            ${LS.renderAvatarChip(req.user, "")}
                            <div class="friend-row-info">
                                <strong>${escapeHTML(req.user.full_name)}</strong>
                                <span>${escapeHTML(req.user.email || "")}</span>
                            </div>
                        </div>
                        <div class="friend-row-actions">
                            <button type="button" class="btn-primary-sm" onclick="window.acceptFriendRequest(${req.friendshipId}, '${req.user.id}')">Aceitar</button>
                            <button type="button" class="btn-logout" onclick="window.rejectFriendRequest(${req.friendshipId})">Recusar</button>
                        </div>
                    </div>
                  `).join("")
                : "";
        }

        if (!window.friendsList.length) {
            const emptyHtml = `
                <div style="text-align:center; padding:24px 12px; color:var(--muted);">
                    <p style="font-size:28px; margin:0 0 8px;">👊</p>
                    <p style="margin:0 0 12px; font-size:13.5px;">Ainda não tens amigos adicionados.</p>
                    <button type="button" class="btn-primary-sm" onclick="document.getElementById('tabFriendsAdd').click()">Procurar amigos</button>
                </div>
            `;
            container.innerHTML = emptyHtml;
            if (chatsContainer) chatsContainer.innerHTML = emptyHtml;
            return;
        }

        const rowsHtml = window.friendsList.map(f => `
            <div class="friend-row">
                <div class="friend-row-left" style="flex:1; min-width:0;">
                    ${LS.renderAvatarChip(f, "")}
                    <div class="friend-row-info">
                        <strong>${escapeHTML(f.full_name)} <small style="color:var(--bump);">👊${f.bump_count || 0}</small></strong>
                        <span>${escapeHTML(f.status_emoji || "📍")} ${escapeHTML(f.status_text || "Online")}</span>
                    </div>
                </div>
                <div class="friend-row-actions">
                    <button type="button" class="btn-bump" onclick="window.sendBump('${f.id}', '👊', 'Bump!')" title="Enviar Bump">👊</button>
                    <button type="button" class="btn-soft" onclick="window.openFriendChat('${f.id}')" title="Chat">💬</button>
                </div>
            </div>
        `).join("");

        container.innerHTML = rowsHtml;
        if (chatsContainer) chatsContainer.innerHTML = rowsHtml;
    }

    async function searchUsersAndEntities() {
        const query = $("friendSearchInput")?.value.trim();
        const resultsEl = $("friendSearchResults");
        if (!query || !LS.currentUser || !resultsEl) return;

        resultsEl.innerHTML = `<p class="muted" style="font-size:12.5px;">A procurar...</p>`;
        const { data } = await window.supabaseClient
            .from("profiles")
            .select("*")
            .neq("id", LS.currentUser.id)
            .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
            .limit(18);

        if (!data || data.length === 0) {
            resultsEl.innerHTML = `<p class="muted" style="font-size:13px;">Nenhum resultado encontrado com "${escapeHTML(query)}".</p>`;
            return;
        }

        const friendIds = new Set(window.friendsList.map(f => String(f.id)));
        resultsEl.innerHTML = data.map(u => {
            const isBiz = u.role === "business";
            let actionBtn = "";
            if (isBiz) {
                const isFollowing = LS.myFollowing.has(String(u.id));
                actionBtn = isFollowing
                    ? `<button type="button" class="btn-soft" onclick="window.toggleFollowFromSearch('${u.id}', '${escapeHTML(u.full_name)}')">✓ A seguir</button>`
                    : `<button type="button" class="btn-primary-sm" onclick="window.toggleFollowFromSearch('${u.id}', '${escapeHTML(u.full_name)}')">+ Seguir</button>`;
            } else if (friendIds.has(String(u.id))) {
                actionBtn = `<button type="button" class="btn-soft" onclick="window.openFriendChat('${u.id}')">💬 Conversar</button>`;
            } else if (LS.sentFriendRequestIds.has(u.id)) {
                actionBtn = `<span class="muted" style="font-size:12px;">✈️ Pedido enviado</span>`;
            } else {
                actionBtn = `<button type="button" class="btn-primary-sm" onclick="window.sendFriendRequest('${u.id}', '${escapeHTML(u.full_name)}')">👊 Adicionar</button>`;
            }

            return `
                <div class="friend-row">
                    <div class="friend-row-left">
                        ${LS.renderAvatarChip(u, "")}
                        <div class="friend-row-info">
                            <strong>${escapeHTML(u.full_name)}</strong>
                            <span>${isBiz ? "🏛️ Entidade" : "👤 " + escapeHTML(u.email || "")}</span>
                        </div>
                    </div>
                    <div>${actionBtn}</div>
                </div>
            `;
        }).join("");
    }

    window.toggleFollowFromSearch = async (targetId, targetName) => {
        await LS.toggleFollowOrganizer(targetId, targetName);
        await searchUsersAndEntities();
    };

    window.sendFriendRequest = async (targetId, targetName) => {
        if (!LS.currentUser) return;
        const { error } = await window.supabaseClient.from("friendships").insert([{
            requester_id: LS.currentUser.id,
            addressee_id: targetId,
            status: "pending"
        }]);
        if (error) {
            LS.showToast("Pedido já enviado ou indisponível.", "error");
            return;
        }
        LS.sentFriendRequestIds.add(targetId);
        LS.showToast(`Pedido enviado para ${targetName}! 👊`, "success");
        searchUsersAndEntities();
    };

    window.acceptFriendRequest = async friendshipId => {
        await window.supabaseClient.from("friendships").update({ status: "accepted" }).eq("id", friendshipId);
        triggerBumpVisual("🎉", "Novo amigo adicionado!");
        await LS.loadSocialData();
    };

    window.rejectFriendRequest = async friendshipId => {
        await window.supabaseClient.from("friendships").delete().eq("id", friendshipId);
        await LS.loadSocialData();
    };

    window.sendBump = async (friendId, emoji = "👊", label = "Bump!") => {
        const friend = window.friendsList.find(f => String(f.id) === String(friendId));
        if (!friend) return;
        triggerBumpVisual(emoji, `${emoji} ${label} com ${friend.full_name}!`);
    };

    window.openFriendChat = async friendId => {
        const friend = window.friendsList.find(f => String(f.id) === String(friendId));
        if (!friend) return;
        LS.activeChatFriendId = String(friend.id);
        LS.closeModalEl($("friendsModal"));
        $("chatFriendHeader").innerHTML = `${LS.renderAvatarChip(friend, "")} <strong>${escapeHTML(friend.full_name)}</strong>`;
        LS.openModal($("friendChatModal"));
        await loadChatHistory(LS.activeChatFriendId);
    };

    async function loadChatHistory(friendId) {
        const box = $("chatMessagesBox");
        if (!box) return;
        const { data } = await window.supabaseClient
            .from("friend_messages")
            .select("*")
            .or(`and(sender_id.eq.${LS.currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${LS.currentUser.id})`)
            .order("created_at", { ascending: true })
            .limit(60);

        if (!data || data.length === 0) {
            box.innerHTML = `<p class="muted" style="font-size:12.5px; text-align:center; margin-top:60px;">Envia a primeira mensagem! 💬</p>`;
            return;
        }
        box.innerHTML = data.map(m => {
            const isMine = String(m.sender_id) === String(LS.currentUser.id);
            return `<div class="chat-bubble ${isMine ? "mine" : "theirs"}"><div>${escapeHTML(m.content)}</div></div>`;
        }).join("");
        box.scrollTop = box.scrollHeight;
    }

    async function sendDirectMessage(receiverId, content) {
        if (!LS.currentUser) return;
        await window.supabaseClient.from("friend_messages").insert([{
            sender_id: LS.currentUser.id,
            receiver_id: receiverId,
            content,
            msg_type: "text"
        }]);
        if (String(LS.activeChatFriendId) === String(receiverId)) {
            await loadChatHistory(receiverId);
        }
    }

    LS.renderProfileLists = () => {
        const enrolledEvents = (window.events || []).filter(e => LS.myEnrollments.has(String(e.id)));
        const createdEvents = (window.events || []).filter(e => String(e.creatorId) === String(LS.currentUser?.id));

        if ($("profileEnrolledList")) {
            $("profileEnrolledList").innerHTML = enrolledEvents.length
                ? enrolledEvents.map(ev => `
                    <div class="profile-event-item">
                        <div><strong>${escapeHTML(ev.name)}</strong><span>📅 ${escapeHTML(formatEventDate(ev))}</span></div>
                        <button type="button" class="btn-soft" onclick="window.LocalSpot.closeModalEl(document.getElementById('profileModal')); window.openEventDetails('${ev.id}')">Abrir</button>
                    </div>
                `).join("")
                : `<p class="muted" style="font-size:13px;">Ainda não estás inscrito em nenhum evento.</p>`;
        }

        if ($("profileCreatedList")) {
            $("profileCreatedList").innerHTML = createdEvents.length
                ? createdEvents.map(ev => `
                    <div class="profile-event-item">
                        <div><strong>${escapeHTML(ev.name)}</strong><span>👥 ${ev.enrolled || 0} inscritos</span></div>
                        <button type="button" class="btn-soft" onclick="window.LocalSpot.closeModalEl(document.getElementById('profileModal')); window.openEventDetails('${ev.id}')">Gerir</button>
                    </div>
                `).join("")
                : `<p class="muted" style="font-size:13px;">Ainda não criaste nenhum evento.</p>`;
        }

        if ($("profileFriendsList")) {
            $("profileFriendsList").innerHTML = window.friendsList.length
                ? window.friendsList.map(f => `
                    <div class="profile-event-item">
                        <div><strong>${escapeHTML(f.full_name)}</strong><span>${escapeHTML(f.status_emoji || "📍")} ${escapeHTML(f.status_text || "Online")}</span></div>
                        <button type="button" class="btn-soft" onclick="window.LocalSpot.closeModalEl(document.getElementById('profileModal')); window.openFriendChat('${f.id}')">💬 Chat</button>
                    </div>
                `).join("")
                : `<p class="muted" style="font-size:13px;">Ainda não tens amigos adicionados.</p>`;
        }

        if ($("profileFollowingList")) {
            const followingArr = Array.from(LS.myFollowing.entries());
            $("profileFollowingList").innerHTML = followingArr.length
                ? followingArr.map(([id, name]) => `
                    <div class="profile-event-item">
                        <div><strong>🏛️ ${escapeHTML(name)}</strong></div>
                        <button type="button" class="btn-logout" onclick="window.LocalSpot.toggleFollowOrganizer('${id}', '${escapeHTML(name)}').then(window.LocalSpot.renderProfileLists)">Deixar de seguir</button>
                    </div>
                `).join("")
                : `<p class="muted" style="font-size:13px;">Ainda não segues nenhuma entidade.</p>`;
        }
    };

    // ----------------------------------------------------------------------
    // NOTIFICAÇÕES, ADMIN E CONTROLOS DO MAPA 3D
    // ----------------------------------------------------------------------
    LS.notifyFollowersOfNewEvent = async eventObj => {
        if (!LS.currentUser || !LS.currentProfile || LS.currentUser.isLocalFallback) return;
        try {
            const { data: followers } = await window.supabaseClient
                .from("follows")
                .select("follower_id")
                .eq("following_id", LS.currentUser.id);
            if (followers && followers.length > 0) {
                const rows = followers.map(f => ({
                    user_id: f.follower_id,
                    event_id: eventObj.id,
                    title: `Novo evento de ${LS.currentProfile.full_name}`,
                    message: `${eventObj.name} · ${formatEventDate(eventObj)}`
                }));
                await window.supabaseClient.from("notifications").insert(rows);
            }
        } catch (e) {}
    };

    LS.loadNotifications = async () => {
        if (!LS.currentUser || LS.currentUser.isLocalFallback) return;
        try {
            const { data } = await window.supabaseClient
                .from("notifications")
                .select("*")
                .eq("user_id", LS.currentUser.id)
                .order("created_at", { ascending: false })
                .limit(20);
            if (data) {
                LS.notifications = data;
                const badge = $("notifBadge");
                const list = $("notifList");
                const unread = data.filter(n => !n.is_read).length;
                if (badge) {
                    badge.textContent = unread;
                    badge.classList.toggle("hidden", unread === 0);
                }
                if (list) {
                    list.innerHTML = data.length
                        ? data.map(n => `
                            <div class="notif-item${n.is_read ? "" : " unread"}" data-nid="${n.id}" data-eid="${n.event_id || ""}">
                                <strong>${escapeHTML(n.title)}</strong>
                                <p>${escapeHTML(n.message)}</p>
                            </div>
                          `).join("")
                        : `<p style="padding:14px; font-size:12.5px; color:var(--muted); margin:0;">Sem notificações recentes.</p>`;
                }
            }
        } catch (e) {}
    };

    LS.setMobileView = view => {
        const mainEl = $("main");
        const toggle = $("mobileViewToggle");
        if (!mainEl || !toggle) return;
        mainEl.dataset.view = view;
        toggle.textContent = view === "map" ? "📋 Ver Lista" : "🗺️ Ver Mapa";
        if (view === "map" && typeof map !== "undefined" && map?.resize) {
            setTimeout(() => map.resize(), 60);
        }
    };

    LS.cleanupSocialOnLogout = () => {
        if (locationSyncInterval) clearInterval(locationSyncInterval);
        if (geoWatchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(geoWatchId);
        if (realtimeChannel) window.supabaseClient.removeChannel(realtimeChannel);
        if (bumpBroadcastChannel) window.supabaseClient.removeChannel(bumpBroadcastChannel);
        window.friendsList = [];
        try { if (typeof showFriendsOnMap === "function") showFriendsOnMap([]); } catch (e) {}
        ["friendsNavBtn", "directChatsNavBtn", "bumpShakeMapBtn", "quickMoodMapBtn", "privacyMapBtn"].forEach(id => {
            $(id)?.classList.add("hidden");
        });
    };

    LS.onSessionReady = async () => {
        await Promise.all([
            LS.loadMyEnrollments(),
            LS.loadAllEnrollmentsSummary(),
            LS.loadMyFollowing(),
            LS.loadNotifications(),
            LS.loadSocialData()
        ]);
        await LS.loadEventsFromSupabase();

        const sharedId = new URLSearchParams(window.location.search).get("event");
        if (sharedId) {
            const exists = (window.events || []).find(e => String(e.id) === String(sharedId));
            if (exists) {
                LS.selectEvent(exists.id, { scroll: true });
                window.openEventDetails(exists.id);
            }
        }
    };

    function bindGlobalControls() {
        $("mapStyleToggle")?.addEventListener("click", () => {
            try {
                const mode = toggleMapStyleMode();
                $("mapStyleToggle").textContent = mode === "satellite" ? "🗺️ Mapa Noturno" : "🛰️ Satélite 3D";
            } catch (e) {}
        });

        $("mapPitchToggle")?.addEventListener("click", () => {
            try {
                const is3D = toggleMapPitchMode();
                $("mapPitchToggle").textContent = is3D ? "📐 Vista 2D" : "🧊 Vista 3D";
            } catch (e) {}
        });

        $("mobileViewToggle")?.addEventListener("click", () => {
            LS.setMobileView($("main")?.dataset.view === "map" ? "list" : "map");
        });

        $("notifBtn")?.addEventListener("click", e => {
            e.stopPropagation();
            $("notifDropdown")?.classList.toggle("hidden");
        });

        document.addEventListener("click", e => {
            if ($("notifDropdown") && !$("notifDropdown").contains(e.target) && e.target !== $("notifBtn")) {
                $("notifDropdown").classList.add("hidden");
            }
            if ($("quickMoodPopover") && !$("quickMoodPopover").contains(e.target) && e.target !== $("quickMoodMapBtn")) {
                $("quickMoodPopover").classList.add("hidden");
            }
        });

        $("aboutButton")?.addEventListener("click", () => LS.openModal($("aboutModal")));
        $("closeAbout")?.addEventListener("click", () => LS.closeModalEl($("aboutModal")));
        $("aboutModal")?.addEventListener("mousedown", e => { if (e.target === $("aboutModal")) LS.closeModalEl($("aboutModal")); });

        $("adminPanelBtn")?.addEventListener("click", async () => {
            if (!LS.isAdminAccount()) return;
            LS.openModal($("adminModal"));
            const { data: profiles } = await window.supabaseClient.from("profiles").select("*").order("created_at", { ascending: false });
            if (!profiles) return;
            if ($("adminStatsGrid")) {
                $("adminStatsGrid").innerHTML = `
                    <div class="admin-stat-card"><strong>${profiles.length}</strong><span>Contas</span></div>
                    <div class="admin-stat-card"><strong>${profiles.filter(p => p.role === "business").length}</strong><span>Entidades</span></div>
                    <div class="admin-stat-card"><strong>${profiles.filter(p => LS.isEntityVerified(p)).length}</strong><span>Verificadas</span></div>
                    <div class="admin-stat-card"><strong>${(window.events || []).length}</strong><span>Eventos</span></div>
                `;
            }
            if ($("adminUsersList")) {
                $("adminUsersList").innerHTML = profiles.map(p => `
                    <div class="admin-user-row">
                        <strong>${escapeHTML(p.full_name || "Sem nome")}</strong>
                        <span>${escapeHTML(p.email)} · ${escapeHTML(p.role || "user")}</span>
                    </div>
                `).join("");
            }
        });
        $("closeAdmin")?.addEventListener("click", () => LS.closeModalEl($("adminModal")));

        document.addEventListener("keydown", e => {
            if (e.key === "Escape") {
                [$("eventModal"), $("detailModal"), $("ticketModal"), $("reportModal"), $("aboutModal"), $("adminModal"), $("profileModal"), $("friendsModal"), $("friendChatModal")].forEach(LS.closeModalEl);
                $("quickMoodPopover")?.classList.add("hidden");
                try { if (typeof stopLocationPicking === "function") stopLocationPicking(); } catch (err) {}
                $("pickBanner")?.classList.add("hidden");
            }
        });
    }

    // ----------------------------------------------------------------------
    // ARRANQUE DA APLICAÇÃO
    // ----------------------------------------------------------------------
    LS.populateLocationsSelects();
    ensureSocialUI();
    bindGlobalControls();
    LS.bindEventCreationAndEdit();
    LS.bindFiltersAndDetails();

    try {
        if (typeof initMap === "function") initMap();
    } catch (err) {
        console.warn("Aviso na inicialização do mapa:", err);
    }

    LS.initAuth();
})();
