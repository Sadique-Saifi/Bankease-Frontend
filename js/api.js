/**
 * BankEase - Centralized API Service
 * Handles fetch requests, JWT header injection, automatic token refresh,
 * error normalization, and toast notifications.
 */

class ApiService {
    constructor() {
        this.baseUrl = CONFIG.API_BASE_URL;
    }

    getAccessToken() {
        return localStorage.getItem("bankease_access_token");
    }

    getRefreshToken() {
        return localStorage.getItem("bankease_refresh_token");
    }

    setTokens(access, refresh) {
        if (access) localStorage.setItem("bankease_access_token", access);
        if (refresh) localStorage.setItem("bankease_refresh_token", refresh);
    }

    getUser() {
        const u = localStorage.getItem("bankease_user");
        return u ? JSON.parse(u) : null;
    }

    setUser(user) {
        localStorage.setItem("bankease_user", JSON.stringify(user));
    }

    clearAuth() {
        localStorage.removeItem("bankease_access_token");
        localStorage.removeItem("bankease_refresh_token");
        localStorage.removeItem("bankease_user");
    }

    isAuthenticated() {
        return !!this.getAccessToken();
    }

    isBankOfficer() {
        const u = this.getUser();
        return u && (u.role === "BANK_OFFICER" || u.is_staff);
    }

    async refreshAuthToken() {
        const refresh = this.getRefreshToken();
        if (!refresh) {
            this.clearAuth();
            window.location.href = "login.html";
            return null;
        }

        try {
            const res = await fetch(`${this.baseUrl}/auth/refresh/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh }),
            });
            if (res.ok) {
                const data = await res.json();
                this.setTokens(data.access, data.refresh || refresh);
                return data.access;
            } else {
                this.clearAuth();
                window.location.href = "login.html";
                return null;
            }
        } catch (err) {
            this.clearAuth();
            window.location.href = "login.html";
            return null;
        }
    }

    async request(endpoint, options = {}) {
        const url = endpoint.startsWith("http") ? endpoint : `${this.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
        const headers = {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        };

        const token = this.getAccessToken();
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        let response = await fetch(url, { ...options, headers });

        // Token expired -> Attempt refresh once
        if (response.status === 401 && token && !endpoint.includes("/auth/login/")) {
            const newToken = await this.refreshAuthToken();
            if (newToken) {
                headers["Authorization"] = `Bearer ${newToken}`;
                response = await fetch(url, { ...options, headers });
            }
        }

        let data = null;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            data = await response.json();
        }

        if (!response.ok) {
            const errorMsg = data?.message || data?.error || (data?.errors ? JSON.stringify(data.errors) : "An error occurred");
            throw new Error(errorMsg);
        }

        return data;
    }

    get(endpoint) {
        return this.request(endpoint, { method: "GET" });
    }

    post(endpoint, body) {
        return this.request(endpoint, { method: "POST", body: JSON.stringify(body) });
    }

    patch(endpoint, body) {
        return this.request(endpoint, { method: "PATCH", body: JSON.stringify(body) });
    }

    delete(endpoint) {
        return this.request(endpoint, { method: "DELETE" });
    }
}

const api = new ApiService();

// Toast helper
function showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.className = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === "success" ? "✓" : type === "error" ? "⚠" : "ℹ"}</span>
        <span class="toast-msg">${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("fade-out");
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}
