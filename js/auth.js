/**
 * BankEase - Authentication Flow Handler
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Guard check for protected pages
    const isPublicPage = ["index.html", "login.html", "register.html", ""].some(p => 
        window.location.pathname.endsWith(p) || window.location.pathname === "/"
    );

    if (!isPublicPage && !api.isAuthenticated()) {
        window.location.href = "login.html";
        return;
    }

    // 2. Setup user display if logged in
    const user = api.getUser();
    if (user) {
        document.querySelectorAll(".user-fullname").forEach(el => el.textContent = user.full_name || user.username);
        document.querySelectorAll(".user-role-badge").forEach(el => {
            el.textContent = user.role === "BANK_OFFICER" ? "Bank Officer" : "Customer";
            el.className = `badge badge-${user.role === "BANK_OFFICER" ? "warning" : "primary"}`;
        });
        document.querySelectorAll(".user-account-id").forEach(el => el.textContent = user.customer_number || user.username);
    }

    // 3. Login form submission
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = loginForm.querySelector("button[type='submit']");
            const errBox = document.getElementById("login-error");
            if (errBox) errBox.classList.add("hidden");

            const username = document.getElementById("username").value.trim();
            const password = document.getElementById("password").value;

            try {
                btn.disabled = true;
                btn.textContent = "Authenticating...";

                const res = await api.post("/auth/login/", { username, password });
                if (res.status === "success") {
                    api.setTokens(res.data.access, res.data.refresh);
                    api.setUser(res.data.user);
                    showToast("Login successful! Redirecting...", "success");
                    setTimeout(() => {
                        window.location.href = "dashboard.html";
                    }, 800);
                }
            } catch (err) {
                if (errBox) {
                    errBox.textContent = err.message || "Invalid credentials.";
                    errBox.classList.remove("hidden");
                }
                showToast(err.message, "error");
            } finally {
                btn.disabled = false;
                btn.textContent = "Sign In";
            }
        });
    }

    // 4. Register form submission
    const regForm = document.getElementById("register-form");
    if (regForm) {
        regForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = regForm.querySelector("button[type='submit']");
            const errBox = document.getElementById("register-error");
            if (errBox) errBox.classList.add("hidden");

            const username = document.getElementById("reg-username").value.trim();
            const email = document.getElementById("reg-email").value.trim();
            const full_name = document.getElementById("reg-fullname").value.trim();
            const phone_number = document.getElementById("reg-phone").value.trim();
            const address = document.getElementById("reg-address").value.trim();
            const initial_deposit = document.getElementById("reg-deposit").value.trim() || "10000.00";
            const password = document.getElementById("reg-password").value;
            const password_confirm = document.getElementById("reg-confirm-password").value;

            if (password !== password_confirm) {
                if (errBox) {
                    errBox.textContent = "Passwords do not match.";
                    errBox.classList.remove("hidden");
                }
                showToast("Passwords do not match.", "error");
                return;
            }

            try {
                btn.disabled = true;
                btn.textContent = "Creating Account...";

                const res = await api.post("/auth/register/", {
                    username,
                    email,
                    password,
                    password_confirm,
                    full_name,
                    phone_number,
                    address,
                    initial_deposit,
                });

                if (res.status === "success") {
                    showToast("Account created successfully! Please log in.", "success");
                    setTimeout(() => {
                        window.location.href = "login.html";
                    }, 1200);
                }
            } catch (err) {
                if (errBox) {
                    errBox.textContent = err.message || "Registration failed.";
                    errBox.classList.remove("hidden");
                }
                showToast(err.message, "error");
            } finally {
                btn.disabled = false;
                btn.textContent = "Open Account";
            }
        });
    }

    // 5. Logout handler
    document.querySelectorAll(".logout-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            api.clearAuth();
            showToast("Logged out successfully.", "info");
            setTimeout(() => {
                window.location.href = "login.html";
            }, 500);
        });
    });
});
