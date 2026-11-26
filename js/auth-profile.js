// ==========================================================================
// MÓDULO 1: AUTENTICAÇÃO, ONBOARDING, SESSÕES GUARDADAS E PERFIL DO UTILIZADOR
// ==========================================================================
(function () {
    "use strict";

    // Remoção imediata de qualquer splash residual
    const oldSplash = document.getElementById("welcomeSplash");
    if (oldSplash) oldSplash.remove();

    // Fallbacks globais de segurança
    if (typeof window.events === "undefined") window.events = [];
    if (typeof window.DEFAULT_IMAGE === "undefined") {
        window.DEFAULT_IMAGE = "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=900&q=80";
    }
    if (typeof window.DISTRITOS === "undefined") {
        window.DISTRITOS = [
            "Aveiro", "Beja", "Braga", "Bragança", "Castelo Branco", "Coimbra",
            "Évora", "Faro", "Guarda", "Leiria", "Lisboa", "Portalegre",
            "Porto", "Santarém", "Setúbal", "Viana do Castelo", "Vila Real",
            "Viseu", "Açores", "Madeira"
        ];
    }
    if (typeof window.COUNTRIES === "undefined") {
        window.COUNTRIES = [
            { name: "Portugal", coords: [-8.2245, 39.3999], zoom: 6.2 },
            { name: "Brasil", coords: [-47.9292, -15.7801], zoom: 4.2 },
            { name: "Espanha", coords: [-3.7492, 40.4637], zoom: 5.5 },
            { name: "França", coords: [2.2137, 46.2276], zoom: 5.3 },
            { name: "Reino Unido", coords: [-3.4360, 55.3781], zoom: 5.2 },
            { name: "Alemanha", coords: [10.4515, 51.1657], zoom: 5.4 },
            { name: "Itália", coords: [12.5674, 41.8719], zoom: 5.4 },
            { name: "Suíça", coords: [8.2275, 46.8182], zoom: 6.8 },
            { name: "Luxemburgo", coords: [6.1296, 49.8153], zoom: 8.5 },
            { name: "Estados Unidos", coords: [-95.7129, 37.0902], zoom: 3.8 },
            { name: "Angola", coords: [17.8739, -11.2027], zoom: 5.0 },
            { name: "Moçambique", coords: [35.5296, -18.6657], zoom: 5.0 },
            { name: "Cabo Verde", coords: [-23.6052, 15.1201], zoom: 7.5 }
        ];
    }
    if (typeof window.escapeHTML === "undefined") {
        window.escapeHTML = str => String(str ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    // Cliente Supabase partilhado
    const SUPABASE_URL = "https://ufzjexbihnwflqktpomm.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmempleGJpaG53Zmxxa3Rwb21tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzMjU5NDUsImV4cCI6MjEwOTkwMTk0NX0.hy3x0RuyuKYwTOGvdAA2hYKH_02SEy49YRaZHoD2ufA";
    window.supabaseClient = window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const LS = window.LocalSpot = window.LocalSpot || {};
    LS.$ = id => document.getElementById(id);

    LS.STORAGE_FAVS = "localspot_favorites";
    LS.STORAGE_EXPLORATION = "localspot_exploration_v1";
    LS.STORAGE_SESSIONS = "localspot_saved_sessions_v2";
    LS.STORAGE_ACTIVE_PROFILE = "localspot_active_profile_v2";
    LS.STORAGE_LOCAL_EVENTS = "localspot_local_events_v2";

    LS.loadJSON = (key, fallback) => {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    };

    LS.saveJSON = (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            return false;
        }
    };

    let toastTimer;
    LS.showToast = (message, type = "info") => {
        let toast = LS.$("toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "toast";
            toast.className = "toast";
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("show"), 3600);
    };

    LS.openModal = el => {
        if (!el) return;
        el.classList.remove("hidden");
        el.setAttribute("aria-hidden", "false");
    };

    LS.closeModalEl = el => {
        if (!el) return;
        el.classList.add("hidden");
        el.setAttribute("aria-hidden", "true");
    };

    // Estado partilhado de sessão & perfil
    LS.currentUser = null;
    LS.currentProfile = null;
    LS.selectedAvatarEmoji = "😎";
    LS.selectedVibe = { emoji: "🎉", text: "Pronto pra sair" };
    LS.selectedOnboardingPrivacy = "precise";
    LS.selectedProfilePrivacy = "precise";

    LS.BUMP_STATUSES = [
        { emoji: "📍", text: "No LocalSpot" },
        { emoji: "☕", text: "Num café" },
        { emoji: "🎉", text: "Pronto para sair" },
        { emoji: "🚗", text: "A caminho" },
        { emoji: "📚", text: "A estudar" },
        { emoji: "🎧", text: "A ouvir música" },
        { emoji: "🏃", text: "A treinar" },
        { emoji: "🍔", text: "A comer" },
        { emoji: "🔥", text: "Na festa" },
        { emoji: "🏠", text: "Em casa" }
    ];

    LS.BUSINESS_SECTORS = [
        { emoji: "🏛️", label: "Câmara Municipal / Junta" },
        { emoji: "🤝", label: "Associação / Coletividade" },
        { emoji: "🍽️", label: "Restauração / Café" },
        { emoji: "🎭", label: "Cultura / Espetáculos" },
        { emoji: "🏟️", label: "Desporto / Ginásio" },
        { emoji: "🏢", label: "Empresa / Comércio" },
        { emoji: "🎓", label: "Educação / Universidade" },
        { emoji: "💼", label: "Serviços / Instituição" }
    ];

    LS.isBusinessAccount = () => LS.currentProfile?.role === "business";
    LS.isAdminAccount = () => LS.currentProfile?.role === "admin";
    LS.isNormalUserAccount = () => !LS.currentProfile || LS.currentProfile.role === "user" || !LS.currentProfile.role;

    LS.isEntityVerified = profile => profile?.role === "business" && (profile?.is_verified === true || profile?.status_emoji === "✅");
    LS.verifiedBadgeHTML = profile => LS.isEntityVerified(profile)
        ? `<span class="verified-check" title="Entidade Oficial Verificada">✓</span>`
        : "";

    LS.renderAvatarChip = (profile, sizeClass = "sm") => {
        const isBiz = profile?.role === "business";
        const isAdm = profile?.role === "admin";
        const extraClass = isBiz ? " business-avatar" : (isAdm ? " admin-avatar" : "");
        if (profile?.avatar_url) {
            return `<span class="avatar-circle ${sizeClass}${extraClass}"><img src="${escapeHTML(profile.avatar_url)}" alt="" onerror="this.remove()"></span>`;
        }
        const initials = (profile?.full_name || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join("");
        return `<span class="avatar-circle ${sizeClass}${extraClass}">${escapeHTML(initials)}</span>`;
    };

    LS.translateAuthError = error => {
        if (!error) return "Ocorreu um erro inesperado.";
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("invalid login credentials")) return "E-mail ou palavra-passe incorretos.";
        if (msg.includes("email not confirmed")) return "Desativa «Confirm email» no Supabase para entrar de imediato.";
        if (msg.includes("user already registered") || msg.includes("already been registered")) return "Este e-mail já está registado. Muda para «Iniciar Sessão».";
        if (msg.includes("password should be at least")) return "A palavra-passe tem de ter pelo menos 6 caracteres.";
        if (msg.includes("rate limit") || msg.includes("too many requests")) return "Muitas tentativas seguidas. Aguarda alguns minutos.";
        return error.message;
    };

    // ----------------------------------------------------------------------
    // SESSÕES GUARDADAS NO DISPOSITIVO
    // ----------------------------------------------------------------------
    LS.saveDeviceSession = (profile, passwordHint = "") => {
        if (!profile || !profile.email) return;
        let list = LS.loadJSON(LS.STORAGE_SESSIONS, []);
        list = list.filter(s => s.email.toLowerCase() !== profile.email.toLowerCase());
        list.unshift({
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            role: profile.role || "user",
            business_type: profile.business_type || null,
            status_emoji: profile.status_emoji || "📍",
            status_text: profile.status_text || "No LocalSpot",
            privacy_mode: profile.privacy_mode || "precise",
            bio: profile.bio || "",
            avatar_url: profile.avatar_url || null,
            passwordHint: passwordHint || ""
        });
        LS.saveJSON(LS.STORAGE_SESSIONS, list.slice(0, 6));
        LS.saveJSON(LS.STORAGE_ACTIVE_PROFILE, profile);
    };

    LS.renderSavedSessions = () => {
        const container = LS.$("savedSessionsContainer");
        const listEl = LS.$("savedSessionsList");
        if (!container || !listEl) return;

        const sessions = LS.loadJSON(LS.STORAGE_SESSIONS, []);
        if (!sessions.length) {
            container.classList.add("hidden");
            return;
        }

        container.classList.remove("hidden");
        listEl.innerHTML = sessions.map((s, idx) => `
            <div class="saved-session-card" data-s-idx="${idx}">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="saved-session-avatar">${escapeHTML((s.full_name || "?")[0].toUpperCase())}</div>
                    <div>
                        <strong style="font-size:13px; display:block;">${escapeHTML(s.full_name)}</strong>
                        <span class="muted" style="font-size:11.5px;">${escapeHTML(s.email)}</span>
                    </div>
                </div>
                <span style="font-size:12px; color:var(--primary); font-weight:700;">Entrar →</span>
            </div>
        `).join("");

        listEl.querySelectorAll(".saved-session-card").forEach(card => {
            card.addEventListener("click", async () => {
                const s = sessions[Number(card.dataset.sIdx)];
                if (!s) return;

                if (s.passwordHint) {
                    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                        email: s.email,
                        password: s.passwordHint
                    });
                    if (!error && data?.user) {
                        await LS.handleAuthenticatedSession(data.user);
                        LS.showToast(`Bem-vindo de volta, ${s.full_name}!`, "success");
                        return;
                    }
                }

                // Fallback direto caso a sessão Supabase já esteja ativa ou seja perfil local
                const { data: { session } } = await window.supabaseClient.auth.getSession();
                if (session?.user && session.user.email?.toLowerCase() === s.email.toLowerCase()) {
                    await LS.handleAuthenticatedSession(session.user);
                } else {
                    await LS.activateLocalHybridSession(s);
                }
                LS.showToast(`Sessão ativa: ${s.full_name}`, "success");
            });
        });
    };

    // Garante que mesmo se o trigger da BD falhar, o utilizador fica 100% operacional
    LS.activateLocalHybridSession = async profileData => {
        const userId = profileData.id || `local_${Date.now()}`;
        LS.currentUser = {
            id: userId,
            email: profileData.email,
            user_metadata: {
                full_name: profileData.full_name,
                role: profileData.role || "user",
                business_type: profileData.business_type || null
            },
            isLocalFallback: true
        };
        LS.currentProfile = {
            id: userId,
            email: profileData.email,
            full_name: profileData.full_name,
            role: profileData.role || "user",
            business_type: profileData.business_type || null,
            status_emoji: profileData.status_emoji || "📍",
            status_text: profileData.status_text || "No LocalSpot",
            privacy_mode: profileData.privacy_mode || "precise",
            ghost_mode: profileData.privacy_mode === "ghost",
            bio: profileData.bio || "",
            avatar_url: profileData.avatar_url || null,
            birth_date: profileData.birth_date || null,
            onboarding_completed: true
        };

        LS.saveDeviceSession(LS.currentProfile, profileData.passwordHint || "");
        LS.applyRoleUI();
        LS.$("authOverlay")?.classList.add("hidden");
        if (typeof LS.onSessionReady === "function") {
            await LS.onSessionReady();
        }
    };

    // ----------------------------------------------------------------------
    // ASSISTENTE DE ONBOARDING (3 PASSOS) & LOGIN
    // ----------------------------------------------------------------------
    function showOnboardingScreen(screenId) {
        ["onboardingWelcomeScreen", "onboardingWizardScreen", "onboardingLoginScreen"].forEach(id => {
            LS.$(id)?.classList.toggle("hidden", id !== screenId);
        });
    }

    function showWizardStep(stepNum) {
        [1, 2, 3].forEach(n => {
            LS.$(`wizardStep${n}`)?.classList.toggle("hidden", n !== stepNum);
            const dot = document.querySelector(`[data-step-dot="${n}"]`);
            if (dot) dot.classList.toggle("active", n <= stepNum);
        });
    }

    LS.bindAuthAndOnboardingEvents = () => {
        LS.$("startOnboardingBtn")?.addEventListener("click", () => {
            showOnboardingScreen("onboardingWizardScreen");
            showWizardStep(1);
        });

        LS.$("goToLoginScreenBtn")?.addEventListener("click", () => {
            showOnboardingScreen("onboardingLoginScreen");
        });

        LS.$("backToWelcomeBtn")?.addEventListener("click", () => {
            LS.renderSavedSessions();
            showOnboardingScreen("onboardingWelcomeScreen");
        });

        LS.$("loginBackToWelcomeBtn")?.addEventListener("click", () => {
            LS.renderSavedSessions();
            showOnboardingScreen("onboardingWelcomeScreen");
        });

        LS.$("switchSessionBtn")?.addEventListener("click", () => {
            LS.renderSavedSessions();
            showOnboardingScreen("onboardingWelcomeScreen");
            LS.$("authOverlay")?.classList.remove("hidden");
        });

        LS.$("regAccountType")?.addEventListener("change", e => {
            const isBiz = e.target.value === "business";
            LS.$("businessTypeGroup")?.classList.toggle("hidden", !isBiz);
            if (LS.$("regNameLabel")) {
                LS.$("regNameLabel").textContent = isBiz ? "Nome da Empresa / Entidade *" : "Nome de exibição *";
            }
            if (LS.$("regName")) {
                LS.$("regName").placeholder = isBiz ? "Ex: Câmara Municipal / Café Central" : "Ex: Miguel Silva";
            }
        });

        LS.$("nextToStep2Btn")?.addEventListener("click", () => {
            const name = LS.$("regName")?.value.trim();
            const email = LS.$("regEmail")?.value.trim();
            const pass = LS.$("regPassword")?.value || "";
            const errEl = LS.$("registerError");

            if (!name || !email || pass.length < 6) {
                if (errEl) {
                    errEl.textContent = "Preenche o nome, e-mail válido e palavra-passe (mínimo 6 caracteres).";
                    errEl.classList.remove("hidden");
                }
                return;
            }
            errEl?.classList.add("hidden");
            showWizardStep(2);
        });

        LS.$("backToStep1Btn")?.addEventListener("click", () => showWizardStep(1));
        LS.$("nextToStep3Btn")?.addEventListener("click", () => showWizardStep(3));
        LS.$("backToStep2Btn")?.addEventListener("click", () => showWizardStep(2));

        document.querySelectorAll("#avatarPickerGrid .avatar-emoji-opt").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#avatarPickerGrid .avatar-emoji-opt").forEach(b => b.classList.remove("selected"));
                btn.classList.add("selected");
                LS.selectedAvatarEmoji = btn.dataset.emoji;
            });
        });

        document.querySelectorAll("#vibePickerGrid .vibe-opt-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#vibePickerGrid .vibe-opt-btn").forEach(b => b.classList.remove("selected"));
                btn.classList.add("selected");
                LS.selectedVibe = { emoji: btn.dataset.vibeEmoji, text: btn.dataset.vibeText };
            });
        });

        document.querySelectorAll("#onboardingPrivacyGrid .privacy-opt-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#onboardingPrivacyGrid .privacy-opt-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                LS.selectedOnboardingPrivacy = btn.dataset.privacy;
            });
        });

        // Submissão do Registo (com recuperação automática se o trigger SQL falhar)
        LS.$("registerForm")?.addEventListener("submit", async e => {
            e.preventDefault();
            const errEl = LS.$("registerError");
            errEl?.classList.add("hidden");
            const btn = LS.$("registerSubmitBtn");
            if (btn) { btn.disabled = true; btn.textContent = "A criar perfil..."; }

            const role = LS.$("regAccountType")?.value || "user";
            const businessType = role === "business" ? (LS.$("regBusinessType")?.value || "Entidade") : null;
            const fullName = LS.$("regName").value.trim();
            const email = LS.$("regEmail").value.trim();
            const password = LS.$("regPassword").value;
            const privacyMode = LS.selectedOnboardingPrivacy || "precise";
            const statusEmoji = role === "business" ? "🏢" : (LS.selectedVibe?.emoji || "📍");
            const statusText = role === "business" ? businessType : (LS.selectedVibe?.text || "No LocalSpot");

            try {
                const { data, error } = await window.supabaseClient.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            role,
                            business_type: businessType,
                            status_emoji: statusEmoji,
                            status_text: statusText,
                            privacy_mode: privacyMode
                        }
                    }
                });

                if (error) {
                    // Se o trigger da base de dados falhou ("Database error saving new user"),
                    // tentamos iniciar sessão ou ativar sessão híbrida para não bloquear o utilizador
                    if ((error.message || "").toLowerCase().includes("database error")) {
                        const signInAttempt = await window.supabaseClient.auth.signInWithPassword({ email, password });
                        if (signInAttempt.data?.user) {
                            await LS.handleAuthenticatedSession(signInAttempt.data.user, password);
                            LS.showToast("Perfil criado e sessão iniciada!", "success");
                            return;
                        }
                        await LS.activateLocalHybridSession({
                            email,
                            full_name: fullName,
                            role,
                            business_type: businessType,
                            status_emoji: statusEmoji,
                            status_text: statusText,
                            privacy_mode: privacyMode,
                            passwordHint: password
                        });
                        LS.showToast("Perfil criado! (Nota: executa o ficheiro supabase-fix.sql no Supabase para sincronizar a BD)", "info");
                        return;
                    }

                    if (errEl) {
                        errEl.textContent = LS.translateAuthError(error);
                        errEl.classList.remove("hidden");
                    }
                    return;
                }

                if (data?.user) {
                    if (!data.session) {
                        await LS.activateLocalHybridSession({
                            id: data.user.id,
                            email,
                            full_name: fullName,
                            role,
                            business_type: businessType,
                            status_emoji: statusEmoji,
                            status_text: statusText,
                            privacy_mode: privacyMode,
                            passwordHint: password
                        });
                        LS.showToast("Conta criada com sucesso!", "success");
                        return;
                    }

                    await window.supabaseClient.from("profiles").upsert({
                        id: data.user.id,
                        email,
                        full_name: fullName,
                        role,
                        business_type: businessType,
                        status_emoji: statusEmoji,
                        status_text: statusText,
                        privacy_mode: privacyMode,
                        ghost_mode: privacyMode === "ghost",
                        onboarding_completed: true
                    });

                    await LS.handleAuthenticatedSession(data.user, password);
                    LS.showToast("Perfil criado com sucesso! 🎉", "success");
                }
            } catch (err) {
                await LS.activateLocalHybridSession({
                    email,
                    full_name: fullName,
                    role,
                    business_type: businessType,
                    status_emoji: statusEmoji,
                    status_text: statusText,
                    privacy_mode: privacyMode,
                    passwordHint: password
                });
                LS.showToast("Perfil criado em modo local.", "success");
            } finally {
                if (btn) { btn.disabled = false; btn.textContent = "👊 Criar Perfil"; }
            }
        });

        // Submissão do Login
        LS.$("loginForm")?.addEventListener("submit", async e => {
            e.preventDefault();
            const errEl = LS.$("loginError");
            errEl?.classList.add("hidden");
            const btn = LS.$("loginSubmitBtn");
            if (btn) { btn.disabled = true; btn.textContent = "A entrar..."; }

            const email = LS.$("loginEmail").value.trim();
            const password = LS.$("loginPassword").value;

            try {
                const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
                if (error) {
                    if (errEl) {
                        errEl.textContent = LS.translateAuthError(error);
                        errEl.classList.remove("hidden");
                    }
                    return;
                }
                if (data?.user) {
                    await LS.handleAuthenticatedSession(data.user, password);
                    LS.showToast("Sessão iniciada com sucesso!", "success");
                }
            } catch (err) {
                if (errEl) {
                    errEl.textContent = "Falha de ligação ao servidor.";
                    errEl.classList.remove("hidden");
                }
            } finally {
                if (btn) { btn.disabled = false; btn.textContent = "Entrar no Radar"; }
            }
        });

        // Logout
        LS.$("logoutButton")?.addEventListener("click", async () => {
            try { await window.supabaseClient.auth.signOut(); } catch (e) {}
            localStorage.removeItem(LS.STORAGE_ACTIVE_PROFILE);
            if (typeof LS.cleanupSocialOnLogout === "function") LS.cleanupSocialOnLogout();
            LS.currentUser = null;
            LS.currentProfile = null;
            LS.$("notifBtn")?.classList.add("hidden");
            LS.$("userBadge")?.classList.add("hidden");
            LS.$("adminPanelBtn")?.classList.add("hidden");
            LS.$("logoutButton")?.classList.add("hidden");
            LS.renderSavedSessions();
            showOnboardingScreen("onboardingWelcomeScreen");
            LS.$("authOverlay")?.classList.remove("hidden");
            LS.showToast("Sessão terminada.");
        });
    };

    // ----------------------------------------------------------------------
    // HIDRATAÇÃO DE SESSÃO AUTENTICADA & PERFIL
    // ----------------------------------------------------------------------
    LS.handleAuthenticatedSession = async (user, passwordHint = "") => {
        LS.currentUser = user;
        const meta = user.user_metadata || {};
        let profile = null;

        try {
            const { data } = await window.supabaseClient
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .maybeSingle();

            profile = data;
            if (!profile) {
                const roleVal = meta.role || "user";
                const newProfile = {
                    id: user.id,
                    email: user.email,
                    full_name: meta.full_name || user.email.split("@")[0],
                    role: roleVal,
                    business_type: meta.business_type || null,
                    status_emoji: meta.status_emoji || (roleVal === "business" ? "🏢" : "📍"),
                    status_text: meta.status_text || (roleVal === "business" ? (meta.business_type || "Entidade Oficial") : "No LocalSpot"),
                    privacy_mode: meta.privacy_mode || "precise",
                    ghost_mode: meta.privacy_mode === "ghost",
                    onboarding_completed: true
                };
                const { data: inserted } = await window.supabaseClient
                    .from("profiles")
                    .upsert(newProfile)
                    .select()
                    .maybeSingle();
                profile = inserted || newProfile;
            }
        } catch (e) {
            const roleVal = meta.role || "user";
            profile = {
                id: user.id,
                email: user.email,
                full_name: meta.full_name || user.email.split("@")[0],
                role: roleVal,
                business_type: meta.business_type || null,
                status_emoji: meta.status_emoji || "📍",
                status_text: meta.status_text || "No LocalSpot",
                privacy_mode: meta.privacy_mode || "precise",
                onboarding_completed: true
            };
        }

        // Mescla dados locais guardados se existirem
        const cachedProfile = LS.loadJSON(LS.STORAGE_ACTIVE_PROFILE, null);
        if (cachedProfile && String(cachedProfile.id) === String(profile.id)) {
            profile = { ...cachedProfile, ...profile };
        }

        LS.currentProfile = profile;
        if (!LS.currentProfile.privacy_mode) {
            LS.currentProfile.privacy_mode = LS.currentProfile.ghost_mode ? "ghost" : "precise";
        }
        LS.selectedProfilePrivacy = LS.currentProfile.privacy_mode;

        LS.saveDeviceSession(LS.currentProfile, passwordHint);
        LS.applyRoleUI();
        LS.$("authOverlay")?.classList.add("hidden");

        try {
            if (typeof map !== "undefined" && map?.resize) map.resize();
        } catch (e) {}

        if (typeof LS.onSessionReady === "function") {
            await LS.onSessionReady();
        }
    };

    LS.applyRoleUI = () => {
        if (!LS.currentProfile) return;
        const { role, full_name, business_type, privacy_mode } = LS.currentProfile;
        const isBiz = role === "business";
        const isAdm = role === "admin";
        const isUser = !isBiz && !isAdm;

        LS.$("addEventButton")?.classList.remove("hidden");
        LS.$("friendsNavBtn")?.classList.remove("hidden");
        LS.$("directChatsNavBtn")?.classList.remove("hidden");
        LS.$("floatingSocialDock")?.classList.remove("hidden");

        if (LS.$("bumpShakeMapBtn")) LS.$("bumpShakeMapBtn").classList.toggle("hidden", !isUser);
        if (LS.$("quickMoodMapBtn")) {
            LS.$("quickMoodMapBtn").classList.toggle("hidden", !isUser);
            LS.$("quickMoodMapBtn").textContent = `${LS.currentProfile.status_emoji || "📍"} Vibe`;
        }
        if (LS.$("quickCheckinMapBtn")) LS.$("quickCheckinMapBtn").classList.toggle("hidden", !isUser);
        if (LS.$("explorationMapBtn")) {
            LS.$("explorationMapBtn").classList.toggle("hidden", !isUser);
            if (typeof LS.updateExplorationPill === "function") LS.updateExplorationPill();
        }

        if (LS.$("entityNetworkNavBtn")) {
            LS.$("entityNetworkNavBtn").classList.toggle("hidden", !isBiz);
            if (LS.$("headerFollowersCount")) {
                LS.$("headerFollowersCount").textContent = (LS.myFollowersList || []).length;
            }
        }

        if (LS.$("privacyMapBtn")) {
            const pBtn = LS.$("privacyMapBtn");
            pBtn.classList.toggle("hidden", isAdm);
            pBtn.classList.remove("privacy-blurred", "privacy-ghost");
            if (isBiz) {
                if (privacy_mode === "ghost") {
                    pBtn.classList.add("privacy-ghost");
                    pBtn.textContent = "📅 Apenas Eventos";
                } else {
                    pBtn.textContent = "🏢 Sede Visível";
                }
            } else if (isUser) {
                if (privacy_mode === "ghost") {
                    pBtn.classList.add("privacy-ghost");
                    pBtn.textContent = "👻 Fantasma";
                } else if (privacy_mode === "blurred") {
                    pBtn.classList.add("privacy-blurred");
                    pBtn.textContent = "🌫️ Borrão";
                } else {
                    pBtn.textContent = "📍 Precisa";
                }
            }
        }

        LS.$("notifBtn")?.classList.remove("hidden");
        LS.$("logoutButton")?.classList.remove("hidden");

        const userBadge = LS.$("userBadge");
        if (userBadge) {
            userBadge.classList.remove("hidden", "business-badge", "admin-badge");
            const avatarHtml = LS.renderAvatarChip(LS.currentProfile, "sm");

            if (isAdm) {
                userBadge.classList.add("admin-badge");
                userBadge.innerHTML = `${avatarHtml} <span>🛡️ Admin · ${escapeHTML(full_name)}</span>`;
                LS.$("adminPanelBtn")?.classList.remove("hidden");
            } else if (isBiz) {
                userBadge.classList.add("business-badge");
                const tipo = business_type || "Entidade";
                const vBadge = LS.verifiedBadgeHTML(LS.currentProfile);
                userBadge.innerHTML = `${avatarHtml} <span>👔 ${escapeHTML(tipo)} · ${escapeHTML(full_name)}</span>${vBadge}`;
                LS.$("adminPanelBtn")?.classList.add("hidden");
            } else {
                userBadge.innerHTML = `${avatarHtml} <span>${escapeHTML(full_name)}</span>`;
                LS.$("adminPanelBtn")?.classList.add("hidden");
            }
        }
    };

    // ----------------------------------------------------------------------
    // MODAL DE PERFIL: EDIÇÃO COMPLETA (OPÇÕES, PRIVACIDADE, ESTADO, FOTO)
    // ----------------------------------------------------------------------
    LS.switchProfileTab = (activeTabId, activePanelId) => {
        ["tabMyEnrollments", "tabMyCreated", "tabMyFriends", "tabMyFollowing"].forEach(id => {
            LS.$(id)?.classList.toggle("active", id === activeTabId);
        });
        ["profileEnrolledList", "profileCreatedList", "profileFriendsList", "profileFollowingList"].forEach(id => {
            LS.$(id)?.classList.toggle("hidden", id !== activePanelId);
        });
    };

    LS.syncProfileModalSelections = () => {
        if (!LS.currentProfile) return;
        const mode = LS.selectedProfilePrivacy || LS.currentProfile.privacy_mode || "precise";

        document.querySelectorAll("#privacySelectorGrid .privacy-opt-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.mode === mode);
        });
        document.querySelectorAll("#businessPrivacyGrid .privacy-opt-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.mode === mode);
        });

        const curEmoji = LS.$("profileCustomEmoji")?.value || LS.currentProfile.status_emoji || "📍";
        const curText = LS.$("profileCustomStatus")?.value || LS.currentProfile.status_text || "No LocalSpot";
        document.querySelectorAll("#statusPillsContainer .status-pill-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.emoji === curEmoji && btn.dataset.text === curText);
        });
    };

    LS.bindProfileModalEvents = () => {
        const profileModal = LS.$("profileModal");

        LS.$("userBadge")?.addEventListener("click", async () => {
            if (!LS.currentUser || !LS.currentProfile) {
                LS.renderSavedSessions();
                LS.$("authOverlay")?.classList.remove("hidden");
                return;
            }

            const isBiz = LS.isBusinessAccount();
            const isUser = LS.isNormalUserAccount();
            const isAdm = LS.isAdminAccount();

            if (LS.$("profileEmailDisplay")) LS.$("profileEmailDisplay").textContent = LS.currentUser.email;
            if (LS.$("profileNameInput")) LS.$("profileNameInput").value = LS.currentProfile.full_name || "";
            if (LS.$("profileBioInput")) LS.$("profileBioInput").value = LS.currentProfile.bio || "";
            if (LS.$("profileAvatarInput")) LS.$("profileAvatarInput").value = "";

            LS.$("businessOnlyProfileFields")?.classList.toggle("hidden", !isBiz);
            LS.$("userOnlyProfileFields")?.classList.toggle("hidden", !isUser);
            LS.$("tabMyFriends")?.classList.toggle("hidden", !isUser);
            LS.$("tabMyFollowing")?.classList.toggle("hidden", isAdm);

            if (LS.$("profileAvatarPreview")) {
                LS.$("profileAvatarPreview").className = `avatar-circle lg${isBiz ? " business-avatar" : (isAdm ? " admin-avatar" : "")}`;
                LS.$("profileAvatarPreview").innerHTML = LS.currentProfile.avatar_url
                    ? `<img src="${escapeHTML(LS.currentProfile.avatar_url)}" alt="">`
                    : escapeHTML((LS.currentProfile.full_name || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join(""));
            }

            if (isBiz && LS.$("profileBusinessTypeSelect") && LS.currentProfile.business_type) {
                LS.$("profileBusinessTypeSelect").value = LS.currentProfile.business_type;
            }

            if (isUser) {
                if (LS.$("profileBirthDateInput")) LS.$("profileBirthDateInput").value = LS.currentProfile.birth_date || "";
                if (LS.$("profileCustomEmoji")) LS.$("profileCustomEmoji").value = LS.currentProfile.status_emoji || "📍";
                if (LS.$("profileCustomStatus")) LS.$("profileCustomStatus").value = LS.currentProfile.status_text || "No LocalSpot";
            }

            LS.selectedProfilePrivacy = LS.currentProfile.privacy_mode || (LS.currentProfile.ghost_mode ? "ghost" : "precise");
            LS.syncProfileModalSelections();

            LS.switchProfileTab("tabMyEnrollments", "profileEnrolledList");
            if (typeof LS.loadSocialData === "function") await LS.loadSocialData();
            if (typeof LS.loadMyFollowers === "function") await LS.loadMyFollowers();
            if (typeof LS.loadMyFollowing === "function") await LS.loadMyFollowing();
            if (typeof LS.renderProfileLists === "function") LS.renderProfileLists();

            LS.openModal(profileModal);
        });

        LS.$("closeProfile")?.addEventListener("click", () => LS.closeModalEl(profileModal));
        profileModal?.addEventListener("mousedown", e => {
            if (e.target === profileModal) LS.closeModalEl(profileModal);
        });

        LS.$("tabMyEnrollments")?.addEventListener("click", () => LS.switchProfileTab("tabMyEnrollments", "profileEnrolledList"));
        LS.$("tabMyCreated")?.addEventListener("click", () => LS.switchProfileTab("tabMyCreated", "profileCreatedList"));
        LS.$("tabMyFollowing")?.addEventListener("click", () => LS.switchProfileTab("tabMyFollowing", "profileFollowingList"));

        // Submissão completa de edição de perfil
        LS.$("profileUpdateForm")?.addEventListener("submit", async e => {
            e.preventDefault();
            if (!LS.currentUser || !LS.currentProfile) return;

            const submitBtn = e.target.querySelector('button[type="submit"]');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "A guardar..."; }

            try {
                const newName = LS.$("profileNameInput").value.trim() || LS.currentProfile.full_name;
                const newBio = LS.$("profileBioInput").value.trim();
                const avatarFile = LS.$("profileAvatarInput")?.files?.[0];
                let avatarUrl = LS.currentProfile.avatar_url || null;

                if (avatarFile) {
                    try {
                        const ext = avatarFile.name.split(".").pop() || "jpg";
                        const fileName = `avatars/${LS.currentUser.id}_${Date.now()}.${ext}`;
                        const { error: upErr } = await window.supabaseClient.storage
                            .from("event-images")
                            .upload(fileName, avatarFile, { cacheControl: "3600", upsert: true });
                        if (!upErr) {
                            const { data: pubData } = window.supabaseClient.storage.from("event-images").getPublicUrl(fileName);
                            avatarUrl = pubData.publicUrl;
                        } else {
                            // Fallback local DataURL caso o bucket não permita upload
                            avatarUrl = await new Promise(resolve => {
                                const r = new FileReader();
                                r.onload = () => resolve(r.result);
                                r.readAsDataURL(avatarFile);
                            });
                        }
                    } catch (err) {}
                }

                const privacyMode = LS.selectedProfilePrivacy || LS.currentProfile.privacy_mode || "precise";
                const updatePayload = {
                    full_name: newName,
                    bio: newBio,
                    avatar_url: avatarUrl,
                    privacy_mode: privacyMode,
                    ghost_mode: privacyMode === "ghost"
                };

                if (LS.isBusinessAccount()) {
                    const bizType = LS.$("profileBusinessTypeSelect")?.value;
                    if (bizType) updatePayload.business_type = bizType;
                } else if (LS.isNormalUserAccount()) {
                    updatePayload.birth_date = LS.$("profileBirthDateInput")?.value || null;
                    updatePayload.status_emoji = (LS.$("profileCustomEmoji")?.value || "📍").trim() || "📍";
                    updatePayload.status_text = (LS.$("profileCustomStatus")?.value || "No LocalSpot").trim() || "No LocalSpot";
                }

                // Tenta atualizar no Supabase (upsert garante criação se o trigger inicial falhou)
                if (!LS.currentUser.isLocalFallback) {
                    const { error } = await window.supabaseClient
                        .from("profiles")
                        .upsert({
                            id: LS.currentUser.id,
                            email: LS.currentUser.email,
                            role: LS.currentProfile.role || "user",
                            ...updatePayload
                        });

                    if (error) {
                        console.warn("Aviso ao sincronizar perfil com Supabase:", error.message);
                    }
                }

                Object.assign(LS.currentProfile, updatePayload);
                LS.saveDeviceSession(LS.currentProfile);
                LS.applyRoleUI();

                if (typeof LS.renderProfileLists === "function") LS.renderProfileLists();
                LS.showToast("Perfil atualizado com sucesso! ✅", "success");
                LS.closeModalEl(profileModal);
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Guardar Perfil"; }
            }
        });
    };

    LS.initAuth = async () => {
        LS.bindAuthAndOnboardingEvents();
        LS.bindProfileModalEvents();

        try {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (session && session.user) {
                await LS.handleAuthenticatedSession(session.user);
                return;
            }
        } catch (e) {}

        // Verifica se existe uma sessão híbrida/local ativa guardada
        const cachedActive = LS.loadJSON(LS.STORAGE_ACTIVE_PROFILE, null);
        if (cachedActive && cachedActive.email) {
            await LS.activateLocalHybridSession(cachedActive);
            return;
        }

        LS.renderSavedSessions();
        LS.$("authOverlay")?.classList.remove("hidden");
    };
})();
