(function () {
    const TOKEN_KEY = "uet_token";
    const USER_KEY = "uet_user";

    function safeParse(jsonText) {
        try {
            return JSON.parse(jsonText);
        } catch (error) {
            return null;
        }
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function getToken() {
        return localStorage.getItem(TOKEN_KEY) || "";
    }

    function getStoredUser() {
        return safeParse(localStorage.getItem(USER_KEY) || "null");
    }

    function setAuthSession(token, user) {
        if (token) {
            localStorage.setItem(TOKEN_KEY, token);
        }
        if (user) {
            localStorage.setItem(USER_KEY, JSON.stringify(user));
        }
    }

    function clearAuthSession() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }

    function showToast(message, type = "success") {
        const rack = document.getElementById("toastRack");
        if (!rack) {
            return;
        }

        const item = document.createElement("div");
        item.className = `toast toast-${type}`;
        item.textContent = message;
        rack.appendChild(item);

        requestAnimationFrame(() => item.classList.add("is-visible"));

        window.setTimeout(() => {
            item.classList.remove("is-visible");
            window.setTimeout(() => item.remove(), 250);
        }, 3200);
    }

    async function authFetch(url, options = {}) {
        const headers = new Headers(options.headers || {});
        const token = getToken();
        if (token) {
            headers.set("Authorization", `Bearer ${token}`);
        }
        if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
            headers.set("Content-Type", "application/json");
        }

        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (response.status === 401) {
            clearAuthSession();
            window.location.href = "/login";
            throw new Error("Unauthorized");
        }

        return response;
    }

    async function logoutAndRedirect() {
        try {
            await fetch("/logout", { method: "POST" });
        } catch (error) {
            console.error("Logout request failed", error);
        } finally {
            clearAuthSession();
            window.location.href = "/login";
        }
    }

    document.addEventListener("click", (event) => {
        const logoutButton = event.target.closest("[data-logout-button]");
        if (logoutButton) {
            event.preventDefault();
            logoutAndRedirect();
        }
    });

    window.UET = {
        escapeHtml,
        getToken,
        getStoredUser,
        setAuthSession,
        clearAuthSession,
        showToast,
        authFetch,
        safeParse,
        logoutAndRedirect,
    };
})();
