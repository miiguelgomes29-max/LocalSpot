// ==========================================
// LOCALSPOT — ONBOARDING & SESSÕES LIGADAS À BD
// ==========================================

(function () {
    const SESSIONS_KEY = "localspot_saved_sessions_v1";
    const ACTIVE_SESSION_KEY = "localspot_active_session_v1";

    let selectedAvatarEmoji = "😎";
    let selectedVibeEmoji = "🎉";
    let selectedVibeText = "Pronto pra sair";
    let selectedPrivacy = "precise";

    window.triggerBumpImpactAnimation = function (labelText = "👊 Bump enviado!", emoji = "👊") {
        if (navigator.vibrate) {
            try { navigator.vibrate([45, 30, 70]); } catch (e) {}
        }

        const existing = document.querySelector(".bump-impact-overlay");
        if (existing) existing.remove();

        const overlay = document.createElement("div");
        overlay.className = "bump-impact-overlay";
        overlay.innerHTML = `
            <div class="bump-impact-ring"></div>
            <div class="bump-impact-ring r2"></div>
            <div class="bump-impact-emoji">${emoji}</div>
            <div class="bump-impact-label">${window.escapeHTML(labelText)}</div>
        `;
        document.body.appendChild(overlay);

        setTimeout(() => {
            overlay.style.opacity = "0";
            overlay.style.transition = "opacity 0.25s ease";
            setTimeout(() => overlay.remove(), 260);
        }, 1150);
    };

    function getSavedSessions() {
        try {
            return JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]");
        } catch (e) {
            return [];
        }
    }

    function saveProfileSession(profile) {
        if (!profile || !profile.email) return;
        const list = getSavedSessions().filter(s => s.email.toLowerCase() !== profile.email.toLowerCase());
        list.unshift({
            id: profile.id || null,
            full_name: profile.full_name || "Utilizador",
            email: profile.email.toLowerCase().trim(),
            role: profile.role || "user",
            business_type: profile.business_type || "",
            avatar_emoji: profile.avatar_emoji || "😎",
            status_emoji: profile.status_emoji || "🎉",
            status_text: profile.status_text || "Pronto pra sair",
            privacy_mode: profile.privacy_mode || "precise",
            last_used: new Date().toISOString()
        });
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(list.slice(0, 6)));
        localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(list[0]));
    }

    function getActiveLocalSession() {
        try {
            return JSON.parse(localStorage.getItem(ACTIVE_SESSION_KEY) || "null");
        } catch (e) {
            return null;
        }
    }

    function clearActiveLocalSession() {
        localStorage.removeItem(ACTIVE_SESSION_KEY);
    }

    function renderSavedSessions() {
        const box = document.getElementById("savedSessionsContainer");
        const listEl = document.getElementById("savedSessionsList");
        if (!box || !listEl) return;

        const sessions = getSavedSessions();
        if (sessions.length === 0) {
            box.classList.add("hidden");
            return;
        }

        box.classList.remove("hidden");
        listEl.innerHTML = sessions.map(s => `
            <div class="saved-session-card" data-session-email="${window.escapeHTML(s.email)}">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="saved-session-avatar">${window.escapeHTML(s.avatar_emoji || "😎")}</div>
                    <div>
                        <strong style="display:block; font-size:13.5px;">${window.escapeHTML(s.full_name)}</strong>
                        <span style="font-size:11.5px; color:var(--muted);">${window.escapeHTML(s.email)} · ${window.escapeHTML(s.status_emoji || "📍")} ${window.escapeHTML(s.status_text || "Online")}</span>
                    </div>
                </div>
                <span style="color:var(--primary); font-weight:800; font-size:12px;">Entrar →</span>
            </div>
        `).join("");

        listEl.querySelectorAll(".saved-session-card").forEach(card => {
            card.addEventListener("click", () => {
                const email = card.getAttribute("data-session-email");
                const found = getSavedSessions().find(item => item.email === email);
                if (found) {
                    activateSessionInUI(found, true);
                }
            });
        });
    }

    async function activateSessionInUI(profile, showAnimation = true) {
        saveProfileSession(profile);

        // Sincroniza e grava na tabela "profiles" do Supabase para obter o UUID real
        if (window.LocalSpotDB && window.LocalSpotDB.isReady()) {
            const dbProfile = await window.LocalSpotDB.upsertProfile(profile);
            if (dbProfile && dbProfile.id) {
                profile = { ...profile, ...dbProfile };
                saveProfileSession(profile);
            }
        }

        window.currentLocalProfile = profile;

        const authOverlay = document.getElementById("authOverlay");
        const userBadge = document.getElementById("userBadge");
        const logoutBtn = document.getElementById("logoutButton");
        const addEventBtn = document.getElementById("addEventButton");
        const notifBtn = document.getElementById("notifBtn");

        if (authOverlay) authOverlay.classList.add("hidden");
        if (logoutBtn) logoutBtn.classList.remove("hidden");
        if (addEventBtn) addEventBtn.classList.remove("hidden");
        if (notifBtn) notifBtn.classList.remove("hidden");

        if (userBadge) {
            userBadge.classList.remove("hidden");
            userBadge.innerHTML = `
                <span class="avatar-circle">${window.escapeHTML(profile.avatar_emoji || profile.full_name[0].toUpperCase())}</span>
                <span>${window.escapeHTML(profile.full_name.split(" ")[0])}</span>
            `;
        }

        if (typeof window.applyExternalUserSession === "function") {
            window.applyExternalUserSession(profile);
        }

        if (typeof window.refreshFriendsSystem === "function") {
            window.refreshFriendsSystem();
        }

        if (showAnimation) {
            window.triggerBumpImpactAnimation(`👊 Bem-vindo, ${profile.full_name.split(" ")[0]}!`, profile.avatar_emoji || "👊");
        }

        if (typeof window.locateUser === "function") {
            window.locateUser().catch(() => {});
        }
        if (window.map) {
            setTimeout(() => window.map.resize(), 120);
        }
    }

    function showOnboardingScreen(screenId) {
        const screens = ["onboardingWelcomeScreen", "onboardingWizardScreen", "onboardingLoginScreen"];
        screens.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle("hidden", id !== screenId);
        });
    }

    function setWizardStep(stepNumber) {
        [1, 2, 3].forEach(num => {
            const stepEl = document.getElementById(`wizardStep${num}`);
            if (stepEl) stepEl.classList.toggle("hidden", num !== stepNumber);

            const dot = document.querySelector(`.onboarding-dot[data-step-dot="${num}"]`);
            if (dot) dot.classList.toggle("active", num <= stepNumber);
        });
    }

    function initBumpOnboarding() {
        const authOverlay = document.getElementById("authOverlay");
        if (!authOverlay) return;

        document.getElementById("startOnboardingBtn")?.addEventListener("click", () => {
            showOnboardingScreen("onboardingWizardScreen");
            setWizardStep(1);
        });

        document.getElementById("goToLoginScreenBtn")?.addEventListener("click", () => {
            showOnboardingScreen("onboardingLoginScreen");
        });

        document.getElementById("loginBackToWelcomeBtn")?.addEventListener("click", () => {
            renderSavedSessions();
            showOnboardingScreen("onboardingWelcomeScreen");
        });

        document.getElementById("backToWelcomeBtn")?.addEventListener("click", () => {
            renderSavedSessions();
            showOnboardingScreen("onboardingWelcomeScreen");
        });

        document.getElementById("nextToStep2Btn")?.addEventListener("click", () => {
            const name = document.getElementById("regName")?.value.trim();
            const email = document.getElementById("regEmail")?.value.trim();
            const pass = document.getElementById("regPassword")?.value || "";
            const errBox = document.getElementById("registerError");

            if (!name || !email || pass.length < 6) {
                if (errBox) {
                    errBox.textContent = "Preenche o nome, e-mail e uma palavra-passe com pelo menos 6 caracteres.";
                    errBox.classList.remove("hidden");
                }
                return;
            }
            if (errBox) errBox.classList.add("hidden");
            setWizardStep(2);
        });

        document.getElementById("backToStep1Btn")?.addEventListener("click", () => setWizardStep(1));
        document.getElementById("nextToStep3Btn")?.addEventListener("click", () => setWizardStep(3));
        document.getElementById("backToStep2Btn")?.addEventListener("click", () => setWizardStep(2));

        document.querySelectorAll("#avatarPickerGrid .avatar-emoji-opt").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#avatarPickerGrid .avatar-emoji-opt").forEach(b => b.classList.remove("selected"));
                btn.classList.add("selected");
                selectedAvatarEmoji = btn.getAttribute("data-emoji") || "😎";
            });
        });

        document.querySelectorAll("#vibePickerGrid .vibe-opt-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#vibePickerGrid .vibe-opt-btn").forEach(b => b.classList.remove("selected"));
                btn.classList.add("selected");
                selectedVibeEmoji = btn.getAttribute("data-vibe-emoji") || "🎉";
                selectedVibeText = btn.getAttribute("data-vibe-text") || "Pronto pra sair";
            });
        });

        document.querySelectorAll("#onboardingPrivacyGrid .privacy-opt-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#onboardingPrivacyGrid .privacy-opt-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                selectedPrivacy = btn.getAttribute("data-privacy") || "precise";
            });
        });

        document.getElementById("regAccountType")?.addEventListener("change", e => {
            const isBiz = e.target.value === "business";
            document.getElementById("businessTypeGroup")?.classList.toggle("hidden", !isBiz);
            const label = document.getElementById("regNameLabel");
            if (label) label.textContent = isBiz ? "Nome da Entidade / Empresa *" : "Nome de exibição *";
        });

        document.getElementById("registerForm")?.addEventListener("submit", async e => {
            e.preventDefault();
            const submitBtn = document.getElementById("registerSubmitBtn");
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "A guardar perfil...";
            }

            const profile = {
                full_name: document.getElementById("regName")?.value.trim() || "Explorador",
                email: document.getElementById("regEmail")?.value.trim() || "user@localspot.pt",
                role: document.getElementById("regAccountType")?.value || "user",
                business_type: document.getElementById("regBusinessType")?.value || "",
                avatar_emoji: selectedAvatarEmoji,
                status_emoji: selectedVibeEmoji,
                status_text: selectedVibeText,
                privacy_mode: selectedPrivacy
            };

            await activateSessionInUI(profile, true);

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "👊 Entrar no Mapa!";
            }
        }, true);

        document.getElementById("loginForm")?.addEventListener("submit", async e => {
            e.preventDefault();
            const email = document.getElementById("loginEmail")?.value.trim() || "";
            const submitBtn = document.getElementById("loginSubmitBtn");
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "A entrar...";
            }

            let profile = null;
            if (window.LocalSpotDB && window.LocalSpotDB.isReady()) {
                profile = await window.LocalSpotDB.getProfileByEmail(email);
            }
            if (!profile) {
                profile = getSavedSessions().find(s => s.email.toLowerCase() === email.toLowerCase()) || {
                    full_name: email.split("@")[0] || "Utilizador",
                    email,
                    role: "user",
                    avatar_emoji: "😎",
                    status_emoji: "📍",
                    status_text: "Online",
                    privacy_mode: "precise"
                };
            }

            await activateSessionInUI(profile, true);

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Entrar no Radar";
            }
        }, true);

        document.getElementById("switchSessionBtn")?.addEventListener("click", () => {
            renderSavedSessions();
            showOnboardingScreen("onboardingWelcomeScreen");
            authOverlay.classList.remove("hidden");
        });

        document.getElementById("logoutButton")?.addEventListener("click", () => {
            clearActiveLocalSession();
            renderSavedSessions();
            showOnboardingScreen("onboardingWelcomeScreen");
            authOverlay.classList.remove("hidden");
        });

        const activeSession = getActiveLocalSession();
        if (activeSession) {
            activateSessionInUI(activeSession, false);
        } else {
            renderSavedSessions();
            showOnboardingScreen("onboardingWelcomeScreen");
            authOverlay.classList.remove("hidden");
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initBumpOnboarding);
    } else {
        initBumpOnboarding();
    }
})();
