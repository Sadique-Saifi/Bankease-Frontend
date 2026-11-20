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
    const iconSvg = type === "success" 
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
        : type === "error"
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    toast.innerHTML = `
        <span class="toast-icon" style="display:inline-flex;align-items:center;">${iconSvg}</span>
        <span class="toast-msg">${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("fade-out");
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}
