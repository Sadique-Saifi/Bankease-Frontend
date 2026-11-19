/**
 * BankEase - Frontend Global Configuration
 * Configures the backend REST API endpoint.
 * In production (e.g., deployed on Netlify), change this to your Render backend URL.
 */
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

const CONFIG = {
    // Priority: window.BANKEASE_API_URL -> LocalStorage override -> dynamic default (local vs Render)
    API_BASE_URL: window.BANKEASE_API_URL || 
                  localStorage.getItem("BANKEASE_API_BASE_URL") || 
                  (isLocal ? "http://127.0.0.1:8000/api/v1" : "https://bankease-backend-a8gi.onrender.com/api/v1"),
    APP_NAME: "BankEase",
    CURRENCY: "₹",
};
