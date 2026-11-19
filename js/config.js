/**
 * BankEase - Frontend Global Configuration
 * Configures the backend REST API endpoint.
 * In production (e.g., deployed on Netlify), change this to your Render backend URL.
 */
const CONFIG = {
    // Priority: window.BANKEASE_API_URL -> LocalStorage override -> default
    API_BASE_URL: window.BANKEASE_API_URL || 
                  localStorage.getItem("BANKEASE_API_BASE_URL") || 
                  "http://127.0.0.1:8000/api/v1",
    APP_NAME: "BankEase",
    CURRENCY: "₹",
};
