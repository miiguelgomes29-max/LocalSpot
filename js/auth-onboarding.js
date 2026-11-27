// ==========================================
// LOCALSPOT — ONBOARDING & AUTENTICAÇÃO BUMP
// ==========================================

(function () {
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
            <div class="bump-impact-label">${window.escapeHTML ? window.escapeHTML(labelText) : labelText}</div>
        `;
        document.body.appendChild(overlay);

        setTimeout(() => {
            overlay.style.opacity = "0";
            overlay.style.transition = "opacity 0.25s ease";
            setTimeout(() => overlay.remove(), 260);
        }, 1150);
    };

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
            showOnboardingScreen("onboardingWelcomeScreen");
        });

        document.getElementById("backToWelcomeBtn")?.addEventListener("click", () => {
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

        // Expor escolhas do assistente para o main.js gravar no Supabase Auth
        window.getOnboardingSelections = () => ({
            avatar_emoji: selectedAvatarEmoji,
            status_emoji: selectedVibeEmoji,
            status_text: selectedVibeText,
            privacy_mode: selectedPrivacy
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initBumpOnboarding);
    } else {
        initBumpOnboarding();
    }
})();
